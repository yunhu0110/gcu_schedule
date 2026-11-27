-- 0050 · Phase 2: 타이머
--
-- 지시서 §3~§5:
--   · 힌트(clue) 단계: 각 차수(1·2·3차)마다 15분. 차수가 새로 시작될 때 15분 타이머 시작.
--     종료 조건 = 유사도 ≥95 / 힌트 10개 / 15분 경과 → 어떤 경우든 정답(guess) 단계로(§3-4).
--   · 정답(guess) 단계: 5분. 종료 조건 = 출제자 외 전원 제출 / 5분 경과 → 회차 판정.
--
-- 서버리스(크론 없음) 환경이라 데드라인 시각을 state 에 저장하고, 접속 중인 아무 클라이언트나
-- hw_tick(room) 을 호출해 서버 now() 기준으로 만료된 단계를 진행시킨다. 데드라인 전에는 무동작.
-- 동시 호출 경합은 방 행 FOR UPDATE 잠금으로 직렬화 + 문제 정산은 hw_problem_settled 가드로 중복 방지.
--
-- state 추가 키: clue_deadline(timestamptz text|null), guess_deadline(timestamptz text|null).
-- 기존 엔진(0046/0047/0048)과의 차이: 힌트 10개 소진 시 바로 다음 회차로 넘어가던 것을,
-- 지시서대로 '정답 단계로' 바꾼다(95 미도달이어도 참가자에게 추측 기회를 준다).

-- 데드라인 계산 헬퍼(초 → now()+interval 의 ISO 문자열)
create or replace function public.hw_deadline(secs int)
returns text language sql volatile as $$
  select (now() + make_interval(secs => secs))::text
$$;

-- ── 회차 판정(내부용): 현재 회차 추측 공개·채점 → 해결/다음회차/미해결 종료 ──
--    submit_guess(전원 제출) 와 hw_tick(정답 5분 종료) 양쪽에서 호출. 호출자가 방 잠금 보유.
create or replace function public.hw_judge_attempt(p_room uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_state jsonb; v_problem int; v_attempt int; v_maxa int; v_ncorrect int; v_over bool;
begin
  select state into v_state from hw_rooms where id = p_room;
  v_problem := (v_state->>'problem_no')::int;
  v_attempt := (v_state->>'attempt_no')::int;
  v_maxa    := coalesce((v_state->>'max_attempts')::int, 3);

  -- 이번 회차 추측 공개 + 정답 수 집계
  update hw_guesses set is_revealed = true
    where room_id = p_room and problem_no = v_problem and attempt_no = v_attempt;
  select count(*)::int into v_ncorrect from hw_guesses
    where room_id = p_room and problem_no = v_problem and attempt_no = v_attempt and is_correct;

  if v_ncorrect > 0 then
    v_over := public.hw_settle_problem(p_room, true, v_attempt);
    return json_build_object('solved', true, 'attempt', v_attempt, 'problem_over', true, 'game_over', v_over);
  elsif v_attempt < v_maxa then
    -- 회차 실패 → 다음 회차(새 15분 힌트 타이머)
    update hw_rooms set state = v_state || jsonb_build_object(
      'attempt_no', v_attempt + 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null,
      'clue_deadline', public.hw_deadline(900), 'guess_deadline', null)
      where id = p_room;
    return json_build_object('solved', false, 'attempt', v_attempt, 'next_attempt', v_attempt + 1);
  else
    -- 3회차까지 실패 → 미해결 종료
    v_over := public.hw_settle_problem(p_room, false, 0);
    return json_build_object('solved', false, 'attempt', v_attempt, 'problem_over', true, 'game_over', v_over);
  end if;
end $$;
revoke execute on function public.hw_judge_attempt(uuid) from anon, authenticated;

-- ── 문제 정산 + 전이(0048 기반 + 다음 문제의 힌트 데드라인 stamp) ──
create or replace function public.hw_settle_problem(
  p_room uuid, p_solved bool, p_solved_attempt int)
returns bool language plpgsql security definer set search_path = public as $$
declare
  v_state jsonb; v_order uuid[]; v_n int;
  v_round int; v_problem int; v_gi int; v_rounds int; v_giver uuid;
begin
  select state into v_state from hw_rooms where id = p_room;
  select array_agg(x::uuid) into v_order from jsonb_array_elements_text(v_state->'player_order') x;
  v_n       := array_length(v_order,1);
  v_round   := (v_state->>'round_no')::int;
  v_problem := (v_state->>'problem_no')::int;
  v_gi      := (v_state->>'giver_index')::int;
  v_rounds  := (v_state->>'configured_rounds')::int;
  v_giver   := v_order[v_gi + 1];

  -- 중복 정산 방지(0047)
  insert into hw_problem_settled (room_id, problem_no) values (p_room, v_problem)
    on conflict do nothing;
  if not found then
    return (v_state->>'phase') = 'game_over';
  end if;

  update hw_player_words set is_revealed = true
    where room_id = p_room and player_id = v_giver and round_no = v_round;

  perform public.hw_award_scores(p_room, v_round, v_problem, v_giver, p_solved, p_solved_attempt);

  if v_gi + 1 < v_n then
    -- 같은 라운드 다음 출제자 → 새 힌트 15분 타이머
    update hw_rooms set state = v_state || jsonb_build_object(
      'giver_index', v_gi + 1, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null,
      'clue_deadline', public.hw_deadline(900), 'guess_deadline', null)
      where id = p_room;
    return false;
  elsif v_round < v_rounds then
    -- 라운드 종료 → 새 봉투 + 봉투 선택 단계(타이머 없음)
    update hw_rooms set state = v_state || jsonb_build_object(
      'phase', 'envelope_selection', 'round_no', v_round + 1,
      'giver_index', 0, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null,
      'clue_deadline', null, 'guess_deadline', null)
      where id = p_room;
    perform public.hw_begin_round(p_room);
    return false;
  else
    update hw_player_words set is_revealed = true where room_id = p_room;
    update hw_rooms set status = 'done', state = v_state || jsonb_build_object(
      'phase', 'game_over', 'sub', 'clue',
      'unlocked', false, 'current_hint', null,
      'clue_deadline', null, 'guess_deadline', null)
      where id = p_room;
    return true;
  end if;
end $$;
revoke execute on function public.hw_settle_problem(uuid,bool,int) from anon, authenticated;

-- ── 힌트 제출(출제자): 방 잠금, 종료 조건 시 정답 단계 개방(§3-4) ──
create or replace function public.hw_submit_clue(p_token uuid, p_clue text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_player hw_players; v_room hw_rooms; v_state jsonb;
  v_order uuid[]; v_gi int; v_giver uuid; v_round int; v_problem int;
  v_attempt int; v_hints int; v_maxh int; v_maxa int;
  v_hidden text; v_clue text; v_sim double precision;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id=v_pid;
  select * into v_room from hw_rooms where id=v_player.room_id for update;  -- 타이머/제출 직렬화
  v_state := v_room.state;
  if (v_state->>'phase') <> 'round' then raise exception '라운드 진행 중이 아니에요'; end if;
  if (v_state->>'sub') <> 'clue' then raise exception '이미 정답 제출이 열렸어요'; end if;

  select array_agg(x::uuid) into v_order from jsonb_array_elements_text(v_state->'player_order') x;
  v_gi      := (v_state->>'giver_index')::int;
  v_giver   := v_order[v_gi + 1];
  if v_giver <> v_pid then raise exception '지금은 출제자가 아니에요'; end if;
  v_round   := (v_state->>'round_no')::int;
  v_problem := (v_state->>'problem_no')::int;
  v_attempt := (v_state->>'attempt_no')::int;
  v_hints   := (v_state->>'hints_this_attempt')::int;
  v_maxh    := coalesce((v_state->>'max_hints')::int, 10);
  v_maxa    := coalesce((v_state->>'max_attempts')::int, 3);
  if v_hints >= v_maxh then raise exception '이번 회차 힌트를 모두 썼어요'; end if;

  v_clue := public.hw_norm(p_clue);
  if coalesce(v_clue,'') = '' then raise exception '힌트를 입력해주세요'; end if;
  select hidden_word into v_hidden from hw_player_words where player_id=v_pid and round_no=v_round;
  if v_clue = v_hidden then raise exception '히든워드 자체는 힌트로 쓸 수 없어요'; end if;
  if exists (select 1 from hw_clues where room_id=v_room.id and player_id=v_pid and clue_word=v_clue) then
    raise exception '이전에 사용한 힌트예요(재사용 불가)'; end if;

  select score into v_sim from public.hw_word_similarity(v_hidden, v_clue);
  v_sim   := coalesce(v_sim, 0);
  v_hints := v_hints + 1;

  insert into hw_clues (room_id, round_no, problem_no, attempt_no, hint_index, player_id, clue_word, similarity)
    values (v_room.id, v_round, v_problem, v_attempt, v_hints, v_pid, v_clue, round(v_sim::numeric,2));

  if v_sim >= 95.0 or v_hints >= v_maxh then
    -- ≥95 또는 힌트 소진 → 정답(5분) 단계 개방(§3-4)
    update hw_rooms set state = v_state || jsonb_build_object(
      'sub','guess','unlocked',true,'hints_this_attempt',v_hints,
      'current_hint', jsonb_build_object('word',v_clue,'similarity',round(v_sim::numeric,2)),
      'clue_deadline', null, 'guess_deadline', public.hw_deadline(300))
      where id=v_room.id;
    return json_build_object('ok',true,'similarity',round(v_sim::numeric,2),'unlocked',true,
      'attempt',v_attempt,'hint_index',v_hints,
      'hints_exhausted', (v_sim < 95.0 and v_hints >= v_maxh));
  else
    -- 계속 힌트(15분 데드라인은 회차 단위라 유지)
    update hw_rooms set state = v_state || jsonb_build_object(
      'hints_this_attempt',v_hints,
      'current_hint', jsonb_build_object('word',v_clue,'similarity',round(v_sim::numeric,2)))
      where id=v_room.id;
    return json_build_object('ok',true,'similarity',round(v_sim::numeric,2),'unlocked',false,
      'attempt',v_attempt,'hint_index',v_hints);
  end if;
end $$;

-- ── 추측 제출(출제자 외): 방 잠금, 전원 제출 시 회차 판정 ──
create or replace function public.hw_submit_guess(p_token uuid, p_guess text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_player hw_players; v_room hw_rooms; v_state jsonb;
  v_order uuid[]; v_gi int; v_giver uuid; v_round int; v_problem int; v_attempt int;
  v_hidden text; v_guess text; v_correct bool; v_need int; v_have int; v_res jsonb;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id=v_pid;
  select * into v_room from hw_rooms where id=v_player.room_id for update;
  v_state := v_room.state;
  if (v_state->>'phase') <> 'round' then raise exception '라운드 진행 중이 아니에요'; end if;
  if (v_state->>'sub') <> 'guess' or not coalesce((v_state->>'unlocked')::bool,false) then
    raise exception '아직 정답 제출이 열리지 않았어요'; end if;

  select array_agg(x::uuid) into v_order from jsonb_array_elements_text(v_state->'player_order') x;
  v_gi      := (v_state->>'giver_index')::int;
  v_giver   := v_order[v_gi + 1];
  if v_giver = v_pid then raise exception '출제자는 추측할 수 없어요'; end if;
  v_round   := (v_state->>'round_no')::int;
  v_problem := (v_state->>'problem_no')::int;
  v_attempt := (v_state->>'attempt_no')::int;
  if exists (select 1 from hw_guesses where room_id=v_room.id and problem_no=v_problem
               and attempt_no=v_attempt and guesser_id=v_pid) then
    raise exception '이미 추측을 제출했어요'; end if;

  v_guess := public.hw_norm(p_guess);
  if coalesce(v_guess,'') = '' then raise exception '추측 단어를 입력해주세요'; end if;
  select hidden_word into v_hidden from hw_player_words where player_id=v_giver and round_no=v_round;
  v_correct := (v_guess = v_hidden);

  insert into hw_guesses (room_id, round_no, problem_no, attempt_no, guesser_id, clue_giver_id, guess_word, is_correct)
    values (v_room.id, v_round, v_problem, v_attempt, v_pid, v_giver, v_guess, v_correct);

  select count(*)::int into v_need from hw_players where room_id=v_room.id and id<>v_giver;
  select count(*)::int into v_have from hw_guesses
    where room_id=v_room.id and problem_no=v_problem and attempt_no=v_attempt;
  if v_have < v_need then
    return json_build_object('ok',true,'all_guessed',false);
  end if;

  -- 전원 제출 → 회차 판정
  v_res := public.hw_judge_attempt(v_room.id)::jsonb;
  return (v_res || jsonb_build_object('ok',true,'all_guessed',true))::json;
end $$;

-- ── 히든워드 선택: 라운드 진행 시작 시 첫 힌트 15분 타이머 stamp ──
create or replace function public.hw_select_hidden_word(p_token uuid, p_word text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_room hw_rooms; v_words text[]; v_w text; v_round int; v_all bool;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select r.* into v_room from hw_rooms r join hw_players p on p.room_id=r.id where p.id=v_pid for update;
  if (v_room.state->>'phase') <> 'hidden_word_selection' then
    raise exception '히든워드 선택 단계가 아니에요'; end if;
  v_round := (v_room.state->>'round_no')::int;
  if exists (select 1 from hw_player_words where player_id=v_pid and round_no=v_round) then
    raise exception '이미 이번 라운드 히든워드를 선택했어요'; end if;
  select ew.words into v_words from hw_envelopes e join hw_envelope_words ew on ew.envelope_id=e.id
    where e.room_id=v_room.id and e.round_no=v_round and e.selected_by=v_pid;
  if v_words is null then raise exception '선택한 봉투가 없어요'; end if;
  v_w := public.hw_norm(p_word);
  if not (v_w = any(v_words)) then raise exception '봉투에 없는 단어예요'; end if;
  if exists (select 1 from hw_player_words where room_id=v_room.id and player_id=v_pid and hidden_word=v_w) then
    raise exception '이전 라운드에 쓴 단어예요(재사용 불가)'; end if;

  insert into hw_player_words (room_id, player_id, round_no, hidden_word)
    values (v_room.id, v_pid, v_round, v_w);

  select (select count(*) from hw_player_words where room_id=v_room.id and round_no=v_round) >=
         (select count(*) from hw_players where room_id=v_room.id) into v_all;
  if v_all then
    update hw_rooms set state = v_room.state || jsonb_build_object(
      'phase','round','sub','clue','giver_index',0,
      'attempt_no',1,'hints_this_attempt',0,'unlocked',false,'current_hint',null,
      'clue_deadline', public.hw_deadline(900), 'guess_deadline', null)
      where id=v_room.id;
  end if;
  return json_build_object('ok', true, 'phase_advanced', v_all);
end $$;

-- ── 타이머 진행(접속 중 아무 클라이언트나 호출). 만료된 단계만 서버 now() 기준으로 전이 ──
create or replace function public.hw_tick(p_room uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_state jsonb; v_sub text; v_dl timestamptz; v_res json;
begin
  select state into v_state from hw_rooms where id = p_room for update;  -- 경합 직렬화
  if v_state is null or (v_state->>'phase') <> 'round' then
    return json_build_object('advanced', false);
  end if;
  v_sub := v_state->>'sub';

  if v_sub = 'clue' then
    v_dl := nullif(v_state->>'clue_deadline','')::timestamptz;
    if v_dl is not null and now() >= v_dl then
      -- 힌트 15분 종료 → 정답(5분) 단계로(§3-4). 95 미도달·0힌트여도 진행.
      update hw_rooms set state = v_state || jsonb_build_object(
        'sub','guess','unlocked',true,
        'clue_deadline', null, 'guess_deadline', public.hw_deadline(300))
        where id = p_room;
      return json_build_object('advanced', true, 'to', 'guess');
    end if;
  elsif v_sub = 'guess' then
    v_dl := nullif(v_state->>'guess_deadline','')::timestamptz;
    if v_dl is not null and now() >= v_dl then
      -- 정답 5분 종료 → 제출분으로 회차 판정
      v_res := public.hw_judge_attempt(p_room);
      return json_build_object('advanced', true, 'to', 'judge', 'result', v_res);
    end if;
  end if;
  return json_build_object('advanced', false);
end $$;

-- ── grants ──
grant execute on function public.hw_submit_clue(uuid, text)  to anon, authenticated;
grant execute on function public.hw_submit_guess(uuid, text) to anon, authenticated;
grant execute on function public.hw_select_hidden_word(uuid, text) to anon, authenticated;
grant execute on function public.hw_tick(uuid)               to anon, authenticated;
