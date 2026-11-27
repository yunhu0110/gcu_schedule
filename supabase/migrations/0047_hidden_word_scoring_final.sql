-- 0047 · 히든워드 점수 체계 최종 확정 (사용자 지시)
-- 규칙:
--   · 정답자: 어느 회차든 맞히면 각 +1점. 복수 정답자 전원 +1. 선착 보너스 없음.
--   · 출제자: 실패 회차 누적(1차실패 +1, 2차실패 +2, 3차실패 +3). 한 문제 최대 6점.
--       - solved_attempt A 에서 해결 → 출제자 = (A-1)·A/2   (A=1→0, A=2→1, A=3→3)
--       - 3회차까지 미해결 → 출제자 = 6 (=1+2+3)
--   · 라운드 배율(1배/2배 등) 개념 전면 제거.
-- 중복 지급 방지:
--   · 문제별 정산을 hw_problem_settled 에 1회만 기록 → settle 전체(공개·점수·전이)를 가드.
--   · 서버(SECURITY DEFINER)에서만 계산·검증. 클라이언트는 개입 불가.

-- ── 정산 완료 마커(내부용): (room, problem) 당 1행. RLS deny-all. ──
create table if not exists public.hw_problem_settled (
  room_id    uuid not null references public.hw_rooms(id) on delete cascade,
  problem_no int  not null,
  settled_at timestamptz not null default now(),
  primary key (room_id, problem_no)
);
alter table public.hw_problem_settled enable row level security;
-- 정책 없음 → 클라이언트 직접 접근 차단(정산은 RPC 전용)

-- ════════════════════════════════════════════════════════════════════
-- 점수 지급 — 최종 규칙 (배율 없음)
--   호출 시점: 문제 정산 1회(hw_settle_problem 가 중복 가드하므로 여기선 순수 계산).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.hw_award_scores(
  p_room uuid, p_round_no int, p_problem_no int, p_giver uuid,
  p_solved bool, p_solved_attempt int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_solved then
    -- 정답자: 해결 회차의 정답자 전원 +1
    update hw_scores s set points = points + 1
      from hw_guesses g
      where g.room_id = p_room and g.problem_no = p_problem_no
        and g.attempt_no = p_solved_attempt and g.is_correct
        and g.guesser_id = s.player_id;
    -- 출제자: 실패 회차 누적 = (A-1)·A/2
    update hw_scores set points = points + ((p_solved_attempt - 1) * p_solved_attempt) / 2
      where player_id = p_giver;
  else
    -- 미해결: 출제자 6점(=1+2+3)
    update hw_scores set points = points + 6 where player_id = p_giver;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 문제 정산 + 다음 상태 전이(내부용) — 중복 정산 가드 추가
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

  -- 중복 정산 방지: 이 문제가 처음 정산될 때만 진행(공개·점수·전이 전체 가드)
  insert into hw_problem_settled (room_id, problem_no) values (p_room, v_problem)
    on conflict do nothing;
  if not found then
    return (v_state->>'phase') = 'game_over';  -- 이미 정산됨
  end if;

  -- 이번 라운드 출제자 히든워드 공개
  update hw_player_words set is_revealed = true
    where room_id = p_room and player_id = v_giver and round_no = v_round;

  -- 점수 지급(최종 규칙, 중복 없음)
  perform public.hw_award_scores(p_room, v_round, v_problem, v_giver, p_solved, p_solved_attempt);

  if v_gi + 1 < v_n then
    update hw_rooms set state = v_state || jsonb_build_object(
      'giver_index', v_gi + 1, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null)
      where id = p_room;
    return false;
  elsif v_round < v_rounds then
    update hw_rooms set state = v_state || jsonb_build_object(
      'phase', 'hidden_word_selection', 'round_no', v_round + 1,
      'giver_index', 0, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null)
      where id = p_room;
    return false;
  else
    update hw_player_words set is_revealed = true where room_id = p_room;
    update hw_rooms set status = 'done', state = v_state || jsonb_build_object(
      'phase', 'game_over', 'sub', 'clue',
      'unlocked', false, 'current_hint', null)
      where id = p_room;
    return true;
  end if;
end $$;

-- ── 게임 시작: state 에서 multiplier_cap 키 제거(배율 개념 전면 삭제) ──
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

  v_rounds := least(5, greatest(1, coalesce(p_total_rounds, 1)));  -- 봉투 5단어 → 최대 5라운드

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
      'max_attempts', 3, 'max_hints', 10,
      'unlocked', false, 'current_hint', null)
    where id = v_room.id;

  return json_build_object('ok', true, 'player_count', v_count,
    'total_rounds', v_rounds, 'total_problems', v_count * v_rounds);
end $$;
