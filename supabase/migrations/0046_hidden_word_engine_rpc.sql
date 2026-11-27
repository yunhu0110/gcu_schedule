-- 0046 · 히든워드 게임 엔진 RPC (Phase 1)
-- 상태(hw_rooms.state) 스키마:
--   { phase: 'envelope_selection'|'hidden_word_selection'|'round'|'game_over',
--     player_order: uuid[],              -- 시작 시 1회 고정(§2)
--     participant_count: int,
--     configured_rounds: int,            -- 바퀴 수(1~5)
--     total_problems: int,               -- = participant_count × configured_rounds
--     round_no: int,                     -- 현재 바퀴(1~configured_rounds)
--     problem_no: int,                   -- 전역 문제 번호(1~total_problems)
--     giver_index: int,                  -- 현재 라운드 내 출제자 위치(0~n-1)
--     sub: 'clue'|'guess',               -- round 단계의 세부 상태
--     attempt_no: int,                   -- 회차(1~max_attempts)
--     hints_this_attempt: int,           -- 현재 회차 힌트 수(0~max_hints)
--     max_attempts: int, max_hints: int, -- 상한(설정값)
--     multiplier_cap: int,               -- 라운드 배율 상한(점수용 설정값)
--     unlocked: bool, current_hint: {word,similarity}|null }
-- 모든 쓰기는 SECURITY DEFINER + secret_token 검증으로만.

-- 구(舊) 1·2-인자 오버로드 제거(호출 모호성 방지).
drop function if exists public.hw_start_game(uuid);
drop function if exists public.hw_start_game(uuid, int);
-- 반환 컬럼 변경(round_index→round_no) 때문에 재생성 전 드롭 필요.
drop function if exists public.hw_revealed_words(uuid);

-- ════════════════════════════════════════════════════════════════════
-- 점수 지급 — ★ 격리 지점 ★  (점수 체계 확정 후 이 함수 본문만 교체하면 됨)
--   컨텍스트: solved 여부, 정답 회차(solved_attempt, 미해결이면 0),
--             정답자 목록(hw_guesses), 힌트 수(hw_clues), 라운드 배율(min(round_no,cap)).
--   ※ 현재 본문은 플레이테스트용 임시 값. 실제 배점은 미확정(사용자 교체 예정).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.hw_award_scores(
  p_room uuid, p_round_no int, p_problem_no int, p_giver uuid,
  p_solved bool, p_solved_attempt int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_mult int; v_cap int;
begin
  select coalesce((state->>'multiplier_cap')::int, 2) into v_cap from hw_rooms where id = p_room;
  v_mult := least(p_round_no, greatest(1, v_cap));   -- 라운드 배율(상한 cap)

  -- ─── PLACEHOLDER 배점(임시) ───────────────────────────────────────
  -- 정답자: 각 +1 × 배율 / 미해결 시 출제자: +1 × 배율
  if p_solved then
    update hw_scores s set points = points + (1 * v_mult)
      from hw_guesses g
      where g.room_id = p_room and g.problem_no = p_problem_no
        and g.attempt_no = p_solved_attempt and g.is_correct
        and g.guesser_id = s.player_id;
  else
    update hw_scores set points = points + (1 * v_mult) where player_id = p_giver;
  end if;
  -- ──────────────────────────────────────────────────────────────────
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 문제 정산 + 다음 상태 전이(내부용)
--   · 출제자의 이번 라운드 히든워드 공개
--   · 점수 지급(hw_award_scores)
--   · 다음 문제 / 다음 라운드(히든워드 선택) / 게임오버 로 전이
--   반환: game_over 여부
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

  -- 이번 라운드 출제자 히든워드 공개
  update hw_player_words set is_revealed = true
    where room_id = p_room and player_id = v_giver and round_no = v_round;

  -- 점수 지급(격리 지점)
  perform public.hw_award_scores(p_room, v_round, v_problem, v_giver, p_solved, p_solved_attempt);

  if v_gi + 1 < v_n then
    -- 같은 라운드, 다음 출제자
    update hw_rooms set state = v_state || jsonb_build_object(
      'giver_index', v_gi + 1, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null)
      where id = p_room;
    return false;
  elsif v_round < v_rounds then
    -- 라운드 종료 → 다음 라운드 히든워드 선택 단계
    update hw_rooms set state = v_state || jsonb_build_object(
      'phase', 'hidden_word_selection', 'round_no', v_round + 1,
      'giver_index', 0, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null)
      where id = p_room;
    return false;
  else
    -- 전체 종료 → 모든 히든워드 공개 + 게임오버
    update hw_player_words set is_revealed = true where room_id = p_room;
    update hw_rooms set status = 'done', state = v_state || jsonb_build_object(
      'phase', 'game_over', 'sub', 'clue',
      'unlocked', false, 'current_hint', null)
      where id = p_room;
    return true;
  end if;
end $$;

-- ── 게임 시작(방장): 라운드(바퀴) 1~5, 봉투=인원수(각 5단어·카테고리 혼합) ──
create or replace function public.hw_start_game(p_token uuid, p_total_rounds int default 1)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_player hw_players; v_room hw_rooms;
  v_count int; v_pids uuid[]; v_words text[]; v_env uuid; v_i int;
  v_rounds int;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id = v_pid;
  if not v_player.is_host then raise exception '방장만 게임을 시작할 수 있어요'; end if;
  select * into v_room from hw_rooms where id = v_player.room_id;
  if v_room.status <> 'lobby' then raise exception '이미 시작된 게임이에요'; end if;

  select count(*)::int into v_count from hw_players where room_id = v_room.id;
  if v_count < 2 then raise exception '최소 2명이 필요해요'; end if;
  if v_count > 6 then raise exception '최대 6명이에요'; end if;

  -- 봉투당 5단어·라운드마다 1개씩 재사용 없이 쓰므로 바퀴 상한은 5.
  v_rounds := least(5, greatest(1, coalesce(p_total_rounds, 1)));

  -- 봉투 = 인원수, 각 5단어(카테고리 혼합)
  v_words := public.hw_draw_envelopes(v_count);
  if v_words is null or array_length(v_words,1) < v_count * 5 then
    raise exception '게임용 단어가 부족해요(어휘 적재 확인 필요)';
  end if;
  for v_i in 1..v_count loop
    insert into hw_envelopes (room_id, envelope_number) values (v_room.id, v_i)
      returning id into v_env;
    insert into hw_envelope_words (envelope_id, room_id, words)
      values (v_env, v_room.id, v_words[(v_i-1)*5+1 : v_i*5]);
  end loop;

  select array_agg(id) into v_pids
    from (select id from hw_players where room_id = v_room.id order by random()) p;

  insert into hw_scores (player_id, room_id, points)
    select id, v_room.id, 0 from hw_players where room_id = v_room.id
    on conflict (player_id) do update set points = 0;

  update hw_rooms set status = 'playing',
    settings = settings || jsonb_build_object('total_rounds', v_rounds,
                 'total_problems', v_count * v_rounds),
    state = jsonb_build_object(
      'phase','envelope_selection',
      'player_order', to_jsonb(v_pids),
      'participant_count', v_count,
      'configured_rounds', v_rounds,
      'total_problems', v_count * v_rounds,
      'round_no', 1, 'problem_no', 1, 'giver_index', 0,
      'sub','clue', 'attempt_no', 1, 'hints_this_attempt', 0,
      'max_attempts', 3, 'max_hints', 10, 'multiplier_cap', 2,
      'unlocked', false, 'current_hint', null)
    where id = v_room.id;

  return json_build_object('ok', true, 'player_count', v_count,
    'total_rounds', v_rounds, 'total_problems', v_count * v_rounds);
end $$;

-- ── 내가 선택한 봉투의 단어(본인만, §3) ──
create or replace function public.hw_get_my_envelope(p_token uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_room uuid; v_words text[];
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select room_id into v_room from hw_players where id = v_pid;
  select ew.words into v_words
    from hw_envelopes e join hw_envelope_words ew on ew.envelope_id = e.id
    where e.room_id = v_room and e.selected_by = v_pid;
  return v_words;  -- 미선택이면 null
end $$;

-- ── 내가 이미 쓴 히든워드(라운드별 재사용 방지용, 본인만) ──
create or replace function public.hw_get_my_used_words(p_token uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_words text[];
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select array_agg(hidden_word) into v_words from hw_player_words where player_id = v_pid;
  return coalesce(v_words, '{}');
end $$;

-- ── 봉투 선택(단어 노출 없음) ──
create or replace function public.hw_select_envelope(p_token uuid, p_number int)
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_player hw_players; v_room hw_rooms; v_all bool;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id = v_pid;
  select * into v_room from hw_rooms where id = v_player.room_id;
  if (v_room.state->>'phase') <> 'envelope_selection' then raise exception '봉투 선택 단계가 아니에요'; end if;
  if exists (select 1 from hw_envelopes where room_id=v_room.id and selected_by=v_player.id) then
    raise exception '이미 봉투를 선택했어요'; end if;
  if exists (select 1 from hw_envelopes where room_id=v_room.id and envelope_number=p_number and selected_by is not null) then
    raise exception '이미 선택된 봉투예요'; end if;
  update hw_envelopes set selected_by=v_player.id where room_id=v_room.id and envelope_number=p_number;
  if not found then raise exception '봉투를 찾을 수 없어요'; end if;

  -- 전원 선택 완료 → 히든워드 선택 단계(라운드 1)
  select (count(*) filter (where selected_by is not null)) >=
         (select count(*) from hw_players where room_id=v_room.id)
    into v_all from hw_envelopes where room_id=v_room.id;
  if v_all then
    update hw_rooms set state = jsonb_set(state,'{phase}','"hidden_word_selection"') where id=v_room.id;
  end if;
  return json_build_object('ok', true, 'phase_advanced', v_all);
end $$;

-- ── 히든워드 선택(이번 라운드, 본인 봉투 단어 중·재사용 불가) ──
create or replace function public.hw_select_hidden_word(p_token uuid, p_word text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_room hw_rooms; v_words text[]; v_w text; v_round int; v_all bool;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select r.* into v_room from hw_rooms r join hw_players p on p.room_id=r.id where p.id=v_pid;
  if (v_room.state->>'phase') <> 'hidden_word_selection' then
    raise exception '히든워드 선택 단계가 아니에요'; end if;
  v_round := (v_room.state->>'round_no')::int;
  if exists (select 1 from hw_player_words where player_id=v_pid and round_no=v_round) then
    raise exception '이미 이번 라운드 히든워드를 선택했어요'; end if;
  select ew.words into v_words from hw_envelopes e join hw_envelope_words ew on ew.envelope_id=e.id
    where e.room_id=v_room.id and e.selected_by=v_pid;
  if v_words is null then raise exception '선택한 봉투가 없어요'; end if;
  v_w := public.hw_norm(p_word);
  if not (v_w = any(v_words)) then raise exception '봉투에 없는 단어예요'; end if;
  if exists (select 1 from hw_player_words where room_id=v_room.id and player_id=v_pid and hidden_word=v_w) then
    raise exception '이전 라운드에 쓴 단어예요(재사용 불가)'; end if;

  insert into hw_player_words (room_id, player_id, round_no, hidden_word)
    values (v_room.id, v_pid, v_round, v_w);

  -- 전원이 이번 라운드 단어를 골랐으면 라운드 진행 시작
  select (select count(*) from hw_player_words where room_id=v_room.id and round_no=v_round) >=
         (select count(*) from hw_players where room_id=v_room.id) into v_all;
  if v_all then
    update hw_rooms set state = v_room.state || jsonb_build_object(
      'phase','round','sub','clue','giver_index',0,
      'attempt_no',1,'hints_this_attempt',0,'unlocked',false,'current_hint',null)
      where id=v_room.id;
  end if;
  return json_build_object('ok', true, 'phase_advanced', v_all);
end $$;

-- ── 내 이번 라운드 히든워드 조회(본인) ──
create or replace function public.hw_get_my_word(p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_room uuid; v_round int; v_word text;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select room_id into v_room from hw_players where id=v_pid;
  select (state->>'round_no')::int into v_round from hw_rooms where id=v_room;
  select hidden_word into v_word from hw_player_words where player_id=v_pid and round_no=v_round;
  return v_word;
end $$;

-- ── 힌트 제출(현재 출제자): 유사도 계산·공개, §7 재사용 금지, ≥95 시 추측 개방(§11) ──
--    힌트 max_hints 소진까지 ≥95 미도달 시 회차 실패 → 다음 회차 또는 문제 종료.
create or replace function public.hw_submit_clue(p_token uuid, p_clue text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_player hw_players; v_room hw_rooms; v_state jsonb;
  v_order uuid[]; v_gi int; v_giver uuid; v_round int; v_problem int;
  v_attempt int; v_hints int; v_maxh int; v_maxa int;
  v_hidden text; v_clue text; v_sim double precision; v_over bool;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id=v_pid;
  select * into v_room from hw_rooms where id=v_player.room_id;
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

  if v_sim >= 95.0 then
    -- 추측 개방
    update hw_rooms set state = v_state || jsonb_build_object(
      'sub','guess','unlocked',true,'hints_this_attempt',v_hints,
      'current_hint', jsonb_build_object('word',v_clue,'similarity',round(v_sim::numeric,2)))
      where id=v_room.id;
    return json_build_object('ok',true,'similarity',round(v_sim::numeric,2),'unlocked',true,
      'attempt',v_attempt,'hint_index',v_hints);
  elsif v_hints >= v_maxh then
    -- 회차 실패(힌트 소진)
    if v_attempt < v_maxa then
      update hw_rooms set state = v_state || jsonb_build_object(
        'attempt_no', v_attempt + 1, 'hints_this_attempt', 0,
        'sub','clue','unlocked',false,'current_hint',null)
        where id=v_room.id;
      return json_build_object('ok',true,'similarity',round(v_sim::numeric,2),'unlocked',false,
        'attempt',v_attempt,'attempt_failed',true,'next_attempt',v_attempt+1);
    else
      v_over := public.hw_settle_problem(v_room.id, false, 0);
      return json_build_object('ok',true,'similarity',round(v_sim::numeric,2),'unlocked',false,
        'attempt',v_attempt,'problem_over',true,'solved',false,'game_over',v_over);
    end if;
  else
    -- 계속 힌트
    update hw_rooms set state = v_state || jsonb_build_object(
      'hints_this_attempt',v_hints,
      'current_hint', jsonb_build_object('word',v_clue,'similarity',round(v_sim::numeric,2)))
      where id=v_room.id;
    return json_build_object('ok',true,'similarity',round(v_sim::numeric,2),'unlocked',false,
      'attempt',v_attempt,'hint_index',v_hints);
  end if;
end $$;

-- ── 추측 제출(출제자 외, 개방된 뒤에만, §11). 전원 제출 시 회차 판정 ──
create or replace function public.hw_submit_guess(p_token uuid, p_guess text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_player hw_players; v_room hw_rooms; v_state jsonb;
  v_order uuid[]; v_gi int; v_giver uuid; v_round int; v_problem int; v_attempt int; v_maxa int;
  v_hidden text; v_guess text; v_correct bool; v_need int; v_have int; v_ncorrect int; v_over bool;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id=v_pid;
  select * into v_room from hw_rooms where id=v_player.room_id;
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
  v_maxa    := coalesce((v_state->>'max_attempts')::int, 3);
  if exists (select 1 from hw_guesses where room_id=v_room.id and problem_no=v_problem
               and attempt_no=v_attempt and guesser_id=v_pid) then
    raise exception '이미 추측을 제출했어요'; end if;

  v_guess := public.hw_norm(p_guess);
  if coalesce(v_guess,'') = '' then raise exception '추측 단어를 입력해주세요'; end if;
  select hidden_word into v_hidden from hw_player_words where player_id=v_giver and round_no=v_round;
  v_correct := (v_guess = v_hidden);

  insert into hw_guesses (room_id, round_no, problem_no, attempt_no, guesser_id, clue_giver_id, guess_word, is_correct)
    values (v_room.id, v_round, v_problem, v_attempt, v_pid, v_giver, v_guess, v_correct);

  -- 출제자 제외 전원 제출?
  select count(*)::int into v_need from hw_players where room_id=v_room.id and id<>v_giver;
  select count(*)::int into v_have from hw_guesses
    where room_id=v_room.id and problem_no=v_problem and attempt_no=v_attempt;
  if v_have < v_need then
    return json_build_object('ok',true,'all_guessed',false);
  end if;

  -- 이번 회차 추측 공개 + 채점
  update hw_guesses set is_revealed=true
    where room_id=v_room.id and problem_no=v_problem and attempt_no=v_attempt;
  select count(*)::int into v_ncorrect from hw_guesses
    where room_id=v_room.id and problem_no=v_problem and attempt_no=v_attempt and is_correct;

  if v_ncorrect > 0 then
    -- 정답 → 문제 해결
    v_over := public.hw_settle_problem(v_room.id, true, v_attempt);
    return json_build_object('ok',true,'all_guessed',true,'solved',true,
      'attempt',v_attempt,'problem_over',true,'game_over',v_over);
  elsif v_attempt < v_maxa then
    -- 회차 실패 → 다음 회차
    update hw_rooms set state = v_state || jsonb_build_object(
      'attempt_no', v_attempt + 1, 'hints_this_attempt', 0,
      'sub','clue','unlocked',false,'current_hint',null)
      where id=v_room.id;
    return json_build_object('ok',true,'all_guessed',true,'solved',false,
      'attempt',v_attempt,'next_attempt',v_attempt+1);
  else
    -- 3회차까지 실패 → 미해결 문제 종료
    v_over := public.hw_settle_problem(v_room.id, false, 0);
    return json_build_object('ok',true,'all_guessed',true,'solved',false,
      'attempt',v_attempt,'problem_over',true,'game_over',v_over);
  end if;
end $$;

-- ── 게임 종료(방장) ──
create or replace function public.hw_end_game(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_player hw_players; v_room hw_rooms;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id=v_pid;
  if not v_player.is_host then raise exception '방장만 게임을 종료할 수 있어요'; end if;
  select * into v_room from hw_rooms where id=v_player.room_id;
  update hw_player_words set is_revealed=true where room_id=v_room.id;
  update hw_rooms set status='done',
    state = state || jsonb_build_object('phase','game_over') where id=v_room.id;
  return json_build_object('ok', true);
end $$;

-- ── 공개된 히든워드 조회(라운드별). 비공개 단어는 반환하지 않음(§3) ──
create or replace function public.hw_revealed_words(p_room uuid)
returns table (player_id uuid, round_no int, hidden_word text)
language sql stable security definer set search_path = public
as $$
  select pw.player_id, pw.round_no, pw.hidden_word
  from public.hw_player_words pw
  where pw.room_id = p_room and pw.is_revealed = true
$$;

-- ── grants ──
grant execute on function public.hw_start_game(uuid, int)          to anon, authenticated;
grant execute on function public.hw_get_my_envelope(uuid)          to anon, authenticated;
grant execute on function public.hw_get_my_used_words(uuid)        to anon, authenticated;
grant execute on function public.hw_select_envelope(uuid, int)     to anon, authenticated;
grant execute on function public.hw_select_hidden_word(uuid, text) to anon, authenticated;
grant execute on function public.hw_get_my_word(uuid)              to anon, authenticated;
grant execute on function public.hw_submit_clue(uuid, text)        to anon, authenticated;
grant execute on function public.hw_submit_guess(uuid, text)       to anon, authenticated;
grant execute on function public.hw_end_game(uuid)                 to anon, authenticated;
grant execute on function public.hw_revealed_words(uuid)           to anon, authenticated;
-- 내부 전용(직접 호출 차단)
revoke execute on function public.hw_award_scores(uuid,int,int,uuid,bool,int) from anon, authenticated;
revoke execute on function public.hw_settle_problem(uuid,bool,int)            from anon, authenticated;

-- ── Realtime ──
alter publication supabase_realtime add table public.hw_envelopes;
alter publication supabase_realtime add table public.hw_clues;
alter publication supabase_realtime add table public.hw_guesses;
alter publication supabase_realtime add table public.hw_scores;
