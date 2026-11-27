-- 0051 · Phase 3: 방송형 정답 공개(서버 권위) + 95% 미달 회차 직접 실패 (지시서 §5-3·§7)
--
-- 바뀌는 핵심:
--   1) 회차 종료 시 '즉시 정산/공개'하던 것을 → 서버 'reveal' 보류 단계로 바꾼다.
--      · sub = 'reveal' 동안 전원 화면에 두구두구→'정답자 있음/없음' 연출.
--      · 정답자가 있으면 reveal.await_giver=true → 현재 출제자만 '정답 공개하기' 버튼.
--        출제자가 hw_reveal 호출 시에만 히든워드·정답자·점수가 전원에 동시 공개(§7-1).
--      · 정답자가 없거나 95% 미달이면 reveal_deadline 후 hw_tick 이 자동 전이(§7-2·§7-3).
--      · "개별 폰 애니메이션 종료로 상태 변경 금지" → 모든 전이는 서버(hw_reveal/hw_tick)가 수행.
--   2) §5-3·§7-3: 유사도 95 미도달로 힌트 10개 소진 또는 15분 종료 → 정답 단계를 열지 않고
--      그 회차를 'below_95'로 바로 실패 처리(이전 0050 의 '무조건 정답단계 개방'을 되돌림).
--
-- state 추가 키:
--   sub            : 'clue' | 'guess' | 'reveal'
--   reveal         : { kind:'solved'|'no_winner'|'below_95', attempt int, is_final bool,
--                      await_giver bool, revealed bool }  (sub<>'reveal' 이면 null)
--   reveal_deadline: timestamptz text | null  (경과 시 hw_tick 이 다음 단계로 전이)
--
-- 점수·히든워드 공개는 여전히 hw_settle_problem(0047 가드) 1회만. reveal 은 '언제 보여줄지'만 제어.

-- 연출 보류 시간(초)
--   · solved       : 출제자 버튼 대기용 안전 상한(버튼 없으면 자동 공개). 버튼 누르면 짧게 재설정.
--   · no_winner    : 7초
--   · below_95     : 6초
--   · 버튼 후 정답 노출 : 5초

-- ════════════════════════════════════════════════════════════════════
-- hw_conclude: 한 회차를 reveal 보류 단계로 전이(내부용). 호출자가 방 FOR UPDATE 잠금 보유.
--   p_kind: 'solved' | 'no_winner' | 'below_95'
-- ════════════════════════════════════════════════════════════════════
create or replace function public.hw_conclude(p_room uuid, p_kind text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_state jsonb; v_order uuid[]; v_gi int; v_giver uuid;
  v_round int; v_problem int; v_attempt int; v_maxa int;
  v_is_final bool; v_hold int;
begin
  select state into v_state from hw_rooms where id = p_room;
  select array_agg(x::uuid) into v_order from jsonb_array_elements_text(v_state->'player_order') x;
  v_gi      := (v_state->>'giver_index')::int;
  v_giver   := v_order[v_gi + 1];
  v_round   := (v_state->>'round_no')::int;
  v_problem := (v_state->>'problem_no')::int;
  v_attempt := (v_state->>'attempt_no')::int;
  v_maxa    := coalesce((v_state->>'max_attempts')::int, 3);

  if p_kind = 'solved' then
    -- 정답자 있음 → 출제자 버튼 대기. 히든워드는 아직 공개하지 않는다(§7-1).
    update hw_rooms set state = v_state || jsonb_build_object(
      'sub','reveal','unlocked',false,'current_hint', v_state->'current_hint',
      'reveal', jsonb_build_object('kind','solved','attempt',v_attempt,
                 'is_final',true,'await_giver',true,'revealed',false),
      'reveal_deadline', public.hw_deadline(120),  -- 버튼 미클릭 안전 상한
      'clue_deadline', null, 'guess_deadline', null)
      where id = p_room;
    return json_build_object('kind','solved','attempt',v_attempt,'await_giver',true);
  end if;

  -- 미해결(no_winner / below_95)
  v_is_final := (v_attempt >= v_maxa);
  v_hold     := case when p_kind = 'below_95' then 6 else 7 end;

  if v_is_final then
    -- 마지막 회차 실패 → 이번 연출에서 히든워드 공개(§7-2·§7-3). 점수·전이는 hw_tick→settle 에서.
    update hw_player_words set is_revealed = true
      where room_id = p_room and player_id = v_giver and round_no = v_round;
  end if;

  update hw_rooms set state = v_state || jsonb_build_object(
    'sub','reveal','unlocked',false,
    'reveal', jsonb_build_object('kind',p_kind,'attempt',v_attempt,
               'is_final',v_is_final,'await_giver',false,'revealed',v_is_final),
    'reveal_deadline', public.hw_deadline(v_hold),
    'clue_deadline', null, 'guess_deadline', null)
    where id = p_room;
  return json_build_object('kind',p_kind,'attempt',v_attempt,'is_final',v_is_final);
end $$;
revoke execute on function public.hw_conclude(uuid, text) from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- hw_judge_guess: 정답 단계 종료(전원 제출 or 5분) → 추측 공개·채점 → reveal 진입.
--   submit_guess 전원 제출 / hw_tick 정답 타임아웃 양쪽에서 호출. 호출자가 방 잠금 보유.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.hw_judge_guess(p_room uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_state jsonb; v_problem int; v_attempt int; v_ncorrect int;
begin
  select state into v_state from hw_rooms where id = p_room;
  v_problem := (v_state->>'problem_no')::int;
  v_attempt := (v_state->>'attempt_no')::int;

  select count(*)::int into v_ncorrect from hw_guesses
    where room_id = p_room and problem_no = v_problem and attempt_no = v_attempt and is_correct;

  if v_ncorrect > 0 then
    -- 정답자 있음: 정답자 이름은 출제자가 '공개하기'를 누를 때까지 비공개(§7-1).
    -- 추측 공개(is_revealed)는 hw_reveal 에서 수행.
    return public.hw_conclude(p_room, 'solved');
  else
    -- 정답자 없음: 숨길 정답자가 없으므로 이번 회차 추측을 지금 공개.
    update hw_guesses set is_revealed = true
      where room_id = p_room and problem_no = v_problem and attempt_no = v_attempt;
    return public.hw_conclude(p_room, 'no_winner');
  end if;
end $$;
revoke execute on function public.hw_judge_guess(uuid) from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- hw_advance_after_reveal: reveal 보류가 끝나면 실제 전이(내부용). 호출자가 방 잠금 보유.
--   · solved      → settle_problem(true, attempt)  : 점수·히든워드·다음 문제
--   · is_final 실패 → settle_problem(false, 0)       : 출제자 6점·히든워드·다음 문제
--   · 비(非)마지막 실패 → 같은 출제자 다음 회차(새 15분 힌트 타이머)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.hw_advance_after_reveal(p_room uuid)
returns bool language plpgsql security definer set search_path = public as $$
declare v_state jsonb; v_rev jsonb; v_attempt int; v_is_final bool; v_solved bool;
begin
  select state into v_state from hw_rooms where id = p_room;
  v_rev := v_state->'reveal';
  if v_rev is null or (v_state->>'sub') <> 'reveal' then
    return (v_state->>'phase') = 'game_over';
  end if;
  v_attempt  := (v_rev->>'attempt')::int;
  v_is_final := coalesce((v_rev->>'is_final')::bool, false);
  v_solved   := (v_rev->>'kind') = 'solved';

  if v_solved then
    return public.hw_settle_problem(p_room, true, v_attempt);
  elsif v_is_final then
    return public.hw_settle_problem(p_room, false, 0);
  else
    -- 같은 출제자, 다음 회차
    update hw_rooms set state = v_state || jsonb_build_object(
      'attempt_no', v_attempt + 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null,
      'reveal', null, 'reveal_deadline', null,
      'clue_deadline', public.hw_deadline(900), 'guess_deadline', null)
      where id = p_room;
    return false;
  end if;
end $$;
revoke execute on function public.hw_advance_after_reveal(uuid) from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- hw_settle_problem: 점수·히든워드 공개·다음 문제 전이(0050 기반) + reveal 키 초기화.
-- ════════════════════════════════════════════════════════════════════
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

  -- 중복 정산 방지(0047): 공개·점수·전이 전체 가드
  insert into hw_problem_settled (room_id, problem_no) values (p_room, v_problem)
    on conflict do nothing;
  if not found then
    return (v_state->>'phase') = 'game_over';
  end if;

  update hw_player_words set is_revealed = true
    where room_id = p_room and player_id = v_giver and round_no = v_round;
  if p_solved then
    -- 안전장치: 출제자 미클릭으로 자동 전이된 경우에도 정답 회차 추측 공개
    update hw_guesses set is_revealed = true
      where room_id = p_room and problem_no = v_problem and attempt_no = p_solved_attempt;
  end if;

  perform public.hw_award_scores(p_room, v_round, v_problem, v_giver, p_solved, p_solved_attempt);

  if v_gi + 1 < v_n then
    -- 같은 라운드 다음 출제자 → 새 힌트 15분 타이머
    update hw_rooms set state = v_state || jsonb_build_object(
      'giver_index', v_gi + 1, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null,
      'reveal', null, 'reveal_deadline', null,
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
      'reveal', null, 'reveal_deadline', null,
      'clue_deadline', null, 'guess_deadline', null)
      where id = p_room;
    perform public.hw_begin_round(p_room);
    return false;
  else
    update hw_player_words set is_revealed = true where room_id = p_room;
    update hw_rooms set status = 'done', state = v_state || jsonb_build_object(
      'phase', 'game_over', 'sub', 'clue',
      'unlocked', false, 'current_hint', null,
      'reveal', null, 'reveal_deadline', null,
      'clue_deadline', null, 'guess_deadline', null)
      where id = p_room;
    return true;
  end if;
end $$;
revoke execute on function public.hw_settle_problem(uuid,bool,int) from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- hw_submit_clue: 95 도달 → 정답 단계. 95 미달로 힌트 소진 → below_95 회차 실패(§5-3).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.hw_submit_clue(p_token uuid, p_clue text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_player hw_players; v_room hw_rooms; v_state jsonb;
  v_order uuid[]; v_gi int; v_giver uuid; v_round int; v_problem int;
  v_attempt int; v_hints int; v_maxh int;
  v_hidden text; v_clue text; v_sim double precision; v_res json;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id=v_pid;
  select * into v_room from hw_rooms where id=v_player.room_id for update;
  v_state := v_room.state;
  if (v_state->>'phase') <> 'round' then raise exception '라운드 진행 중이 아니에요'; end if;
  if (v_state->>'sub') <> 'clue' then raise exception '지금은 힌트 단계가 아니에요'; end if;

  select array_agg(x::uuid) into v_order from jsonb_array_elements_text(v_state->'player_order') x;
  v_gi      := (v_state->>'giver_index')::int;
  v_giver   := v_order[v_gi + 1];
  if v_giver <> v_pid then raise exception '지금은 출제자가 아니에요'; end if;
  v_round   := (v_state->>'round_no')::int;
  v_problem := (v_state->>'problem_no')::int;
  v_attempt := (v_state->>'attempt_no')::int;
  v_hints   := (v_state->>'hints_this_attempt')::int;
  v_maxh    := coalesce((v_state->>'max_hints')::int, 10);
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

  if v_sim >= 95.0 then
    -- ≥95 → 정답(5분) 단계 개방(§5-3·§5-4)
    update hw_rooms set state = v_state || jsonb_build_object(
      'sub','guess','unlocked',true,'hints_this_attempt',v_hints,
      'current_hint', jsonb_build_object('word',v_clue,'similarity',round(v_sim::numeric,2)),
      'clue_deadline', null, 'guess_deadline', public.hw_deadline(300))
      where id=v_room.id;
    return json_build_object('ok',true,'similarity',round(v_sim::numeric,2),'unlocked',true,
      'attempt',v_attempt,'hint_index',v_hints);
  elsif v_hints >= v_maxh then
    -- 95 미달인데 힌트 소진 → 정답 단계 없이 회차 실패(§5-3·§7-3)
    update hw_rooms set state = v_state || jsonb_build_object(
      'hints_this_attempt',v_hints,
      'current_hint', jsonb_build_object('word',v_clue,'similarity',round(v_sim::numeric,2)))
      where id=v_room.id;
    v_res := public.hw_conclude(v_room.id, 'below_95');
    return (v_res::jsonb || jsonb_build_object('ok',true,'similarity',round(v_sim::numeric,2),
      'unlocked',false,'attempt',v_attempt,'hint_index',v_hints,'below_95',true))::json;
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

-- ════════════════════════════════════════════════════════════════════
-- hw_submit_guess: 출제자 외. 전원 제출 시 hw_judge_guess 로 reveal 진입.
-- ════════════════════════════════════════════════════════════════════
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

  -- 전원 제출 → reveal 진입(두구두구는 클라, 전이는 서버)
  v_res := public.hw_judge_guess(v_room.id)::jsonb;
  return (v_res || jsonb_build_object('ok',true,'all_guessed',true))::json;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- hw_reveal: 현재 출제자가 '정답 공개하기' 클릭(solved 전용). 히든워드 공개 + 정답 노출(5초).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.hw_reveal(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_room hw_rooms; v_state jsonb; v_rev jsonb;
  v_order uuid[]; v_gi int; v_giver uuid; v_round int;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select r.* into v_room from hw_rooms r join hw_players p on p.room_id=r.id where p.id=v_pid for update;
  v_state := v_room.state;
  v_rev := v_state->'reveal';
  if (v_state->>'sub') <> 'reveal' or v_rev is null or (v_rev->>'kind') <> 'solved' then
    raise exception '지금 공개할 결과가 없어요'; end if;
  if not coalesce((v_rev->>'await_giver')::bool, false) then
    raise exception '이미 공개됐어요'; end if;

  select array_agg(x::uuid) into v_order from jsonb_array_elements_text(v_state->'player_order') x;
  v_gi    := (v_state->>'giver_index')::int;
  v_giver := v_order[v_gi + 1];
  if v_giver <> v_pid then raise exception '출제자만 공개할 수 있어요'; end if;
  v_round := (v_state->>'round_no')::int;

  -- 히든워드 공개 + 이번 회차 추측(정답자 포함) 공개 — 이 시점에 전원 동시 공개(§7-1)
  update hw_player_words set is_revealed = true
    where room_id = v_room.id and player_id = v_giver and round_no = v_round;
  update hw_guesses set is_revealed = true
    where room_id = v_room.id and problem_no = (v_state->>'problem_no')::int
      and attempt_no = (v_rev->>'attempt')::int;

  update hw_rooms set state = v_state || jsonb_build_object(
    'reveal', v_rev || jsonb_build_object('await_giver', false, 'revealed', true),
    'reveal_deadline', public.hw_deadline(5))  -- 정답 노출 후 자동 전이
    where id = v_room.id;
  return json_build_object('ok', true);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- hw_tick: 만료된 단계만 서버 now() 기준으로 전이. clue/guess/reveal 모두 처리.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.hw_tick(p_room uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_state jsonb; v_sub text; v_dl timestamptz; v_over bool; v_res json;
begin
  select state into v_state from hw_rooms where id = p_room for update;
  if v_state is null or (v_state->>'phase') <> 'round' then
    return json_build_object('advanced', false);
  end if;
  v_sub := v_state->>'sub';

  if v_sub = 'clue' then
    v_dl := nullif(v_state->>'clue_deadline','')::timestamptz;
    if v_dl is not null and now() >= v_dl then
      -- 힌트 15분 종료(이 지점이면 95 미도달 — 도달했으면 sub='guess') → below_95 회차 실패(§7-3)
      v_res := public.hw_conclude(p_room, 'below_95');
      return json_build_object('advanced', true, 'to', 'reveal', 'result', v_res);
    end if;
  elsif v_sub = 'guess' then
    v_dl := nullif(v_state->>'guess_deadline','')::timestamptz;
    if v_dl is not null and now() >= v_dl then
      v_res := public.hw_judge_guess(p_room);
      return json_build_object('advanced', true, 'to', 'reveal', 'result', v_res);
    end if;
  elsif v_sub = 'reveal' then
    v_dl := nullif(v_state->>'reveal_deadline','')::timestamptz;
    if v_dl is not null and now() >= v_dl then
      v_over := public.hw_advance_after_reveal(p_room);
      return json_build_object('advanced', true, 'to', 'next', 'game_over', v_over);
    end if;
  end if;
  return json_build_object('advanced', false);
end $$;

-- ── grants ──
grant execute on function public.hw_submit_clue(uuid, text)  to anon, authenticated;
grant execute on function public.hw_submit_guess(uuid, text) to anon, authenticated;
grant execute on function public.hw_reveal(uuid)             to anon, authenticated;
grant execute on function public.hw_tick(uuid)               to anon, authenticated;
