-- 0062 · (사용자 지시 2건)
--   ① 카테고리 유사도: 같은 분야인데 의미/공생/관계가 약해 낮게 나오는 쌍(기쁨~분노 48, 의사~교사 24)
--      → 공유 카테고리 축을 4번째 축으로 추가(noisy-OR/가중평균 양쪽).
--   ② 출제자 점수 증분 지급: '회차를 넘길 때마다' 지급 → 1회차 통과(no_winner) 후 2회차가 below_95 로
--      끝나도 1회차 점수(+1)가 유지된다. (기존: 문제 종료 때 한 번에 계산 → below_95 로 끝나면 0 이 됨)

-- ════════════════════════════════════════════════════════════════════
-- ① 카테고리 축 + 4축 유사도
-- ════════════════════════════════════════════════════════════════════
-- 공유 '기타' 아닌 카테고리 개수 → [0,1] (0이면 NULL=기권). 캘리브레이션 없이 직접 사용.
create or replace function public.hw_axis_category(w1 text, w2 text)
returns double precision language sql stable security definer set search_path = public as $$
  select case when c = 0 then null else least(0.80, 0.45 + 0.13 * (c - 1)) end
  from (
    select count(*)::int as c from (
      select category from public.hw_word_categories where word = w1 and category <> '기타'
      intersect
      select category from public.hw_word_categories where word = w2 and category <> '기타'
    ) s
  ) q
$$;
revoke execute on function public.hw_axis_category(text, text) from anon, authenticated;

create or replace function public.hw_word_similarity(w1 text, w2 text)
returns table (
  score     double precision,
  semantic  double precision,
  contextual double precision,
  relation  double precision,
  raw_semantic double precision,
  raw_contextual double precision,
  raw_relation double precision
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  cs record; cc record; cr record;
  r_sem double precision; r_ctx double precision; r_rel double precision;
  sem double precision; ctx double precision; rel double precision; cat double precision;
  ws double precision := 0.40; wc double precision := 0.35; wr double precision := 0.25; wk double precision := 0.25;
  wsum double precision; acc double precision;
  wavg double precision; inv double precision; nor double precision; n_axes int;
  alpha double precision := 0.85;   -- 블렌드(↑쉬움)
  gamma double precision := 0.75;   -- 바닥 보정(↓일수록 낮은점수 ↑)
  combined double precision;
begin
  if w1 = w2 then
    return query select 100.0::double precision, 1.0::double precision, 1.0::double precision,
                        1.0::double precision, 1.0::double precision, 1.0::double precision, 1.0::double precision;
    return;
  end if;

  select center, scale into cs from public.hw_sim_calibration where axis = 'semantic';
  select center, scale into cc from public.hw_sim_calibration where axis = 'contextual';
  select center, scale into cr from public.hw_sim_calibration where axis = 'relation';

  r_sem := public.hw_axis_semantic(w1, w2);
  r_ctx := public.hw_axis_contextual(w1, w2);
  r_rel := public.hw_axis_relation(w1, w2);

  sem := case when r_sem is null then null else public.hw_calibrate(r_sem, cs.center, cs.scale) end;
  ctx := case when r_ctx is null then null else public.hw_calibrate(r_ctx, cc.center, cc.scale) end;
  rel := case when r_rel is null then null else public.hw_calibrate(r_rel, cr.center, cr.scale) end;
  cat := public.hw_axis_category(w1, w2);   -- 이미 [0,1] 또는 NULL

  -- 가중평균(관측 축만)
  wsum := (case when sem is null then 0 else ws end) + (case when ctx is null then 0 else wc end)
        + (case when rel is null then 0 else wr end) + (case when cat is null then 0 else wk end);
  acc  := (case when sem is null then 0 else ws * sem end) + (case when ctx is null then 0 else wc * ctx end)
        + (case when rel is null then 0 else wr * rel end) + (case when cat is null then 0 else wk * cat end);
  wavg := case when wsum = 0 then 0.0 else acc / wsum end;

  -- noisy-OR(관측 축만)
  inv := 1.0; n_axes := 0;
  if sem is not null then inv := inv * (1.0 - sem); n_axes := n_axes + 1; end if;
  if ctx is not null then inv := inv * (1.0 - ctx); n_axes := n_axes + 1; end if;
  if rel is not null then inv := inv * (1.0 - rel); n_axes := n_axes + 1; end if;
  if cat is not null then inv := inv * (1.0 - cat); n_axes := n_axes + 1; end if;
  nor := case when n_axes = 0 then 0.0 else 1.0 - inv end;

  combined := alpha * nor + (1.0 - alpha) * wavg;
  combined := power(greatest(combined, 0.0), gamma);

  return query select
    round((100.0 * combined)::numeric, 2)::double precision,
    sem, ctx, rel, r_sem, r_ctx, r_rel;
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- ② 출제자 점수 증분 지급
--   규칙: no_winner(95 도달·아무도 못 맞힘) 회차를 '넘길' 때마다 출제자 += 회차번호.
--     · 1·2회차 no_winner → 각 +1, +2 (다음 회차로 넘어갈 때 지급)
--     · 3회차 no_winner(최종) → +3  (합계 최대 6)
--     · below_95(95 미달) → 그 회차는 지급 없이 문제 종료. 단 앞서 넘긴 no_winner 점수는 유지.
--     · solved → 정답자 +1, 출제자는 앞서 넘긴 회차 점수만 유지(추가 없음).
--   (room,problem,attempt) 당 1회만 지급(중복 방지).
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.hw_attempt_awarded (
  room_id    uuid not null references public.hw_rooms(id) on delete cascade,
  problem_no int  not null,
  attempt_no int  not null,
  primary key (room_id, problem_no, attempt_no)
);
alter table public.hw_attempt_awarded enable row level security;  -- 정책 없음(클라 차단)

create or replace function public.hw_award_giver_attempt(
  p_room uuid, p_problem int, p_attempt int, p_giver uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.hw_attempt_awarded (room_id, problem_no, attempt_no)
    values (p_room, p_problem, p_attempt) on conflict do nothing;
  if found then
    update public.hw_scores set points = points + p_attempt where player_id = p_giver;
  end if;
end $$;
revoke execute on function public.hw_award_giver_attempt(uuid,int,int,uuid) from anon, authenticated;

-- 정산: solved → 정답자 +1 / unsolved(3회차 no_winner) → 출제자 += 회차 / aborted(below_95) → 없음
create or replace function public.hw_settle_problem(
  p_room uuid, p_mode text, p_attempt int)
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

  insert into hw_problem_settled (room_id, problem_no) values (p_room, v_problem) on conflict do nothing;
  if not found then
    return (v_state->>'phase') = 'game_over';
  end if;

  update hw_player_words set is_revealed = true
    where room_id = p_room and player_id = v_giver and round_no = v_round;

  if p_mode = 'solved' then
    update hw_guesses set is_revealed = true
      where room_id = p_room and problem_no = v_problem and attempt_no = p_attempt;
    update hw_scores s set points = points + 1
      from hw_guesses g
      where g.room_id = p_room and g.problem_no = v_problem
        and g.attempt_no = p_attempt and g.is_correct and g.guesser_id = s.player_id;
  elsif p_mode = 'unsolved' then
    -- 3회차 no_winner(최종) → 출제자 += 회차번호(앞 회차는 advance 에서 이미 증분 지급됨)
    perform public.hw_award_giver_attempt(p_room, v_problem, p_attempt, v_giver);
  end if;  -- aborted(below_95): 추가 지급 없음

  if v_gi + 1 < v_n then
    update hw_rooms set state = v_state || jsonb_build_object(
      'giver_index', v_gi + 1, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null, 'reveal', null, 'reveal_deadline', null,
      'clue_deadline', public.hw_deadline(900), 'guess_deadline', null)
      where id = p_room;
    return false;
  elsif v_round < v_rounds then
    update hw_rooms set state = v_state || jsonb_build_object(
      'phase', 'envelope_selection', 'round_no', v_round + 1,
      'giver_index', 0, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null, 'reveal', null, 'reveal_deadline', null,
      'clue_deadline', null, 'guess_deadline', null)
      where id = p_room;
    perform public.hw_begin_round(p_room);
    return false;
  else
    update hw_player_words set is_revealed = true where room_id = p_room;
    update hw_rooms set status = 'done', state = v_state || jsonb_build_object(
      'phase', 'game_over', 'sub', 'clue',
      'unlocked', false, 'current_hint', null, 'reveal', null, 'reveal_deadline', null,
      'clue_deadline', null, 'guess_deadline', null)
      where id = p_room;
    return true;
  end if;
end $$;
revoke execute on function public.hw_settle_problem(uuid,text,int) from anon, authenticated;

-- 전이: no_winner 비마지막 → 출제자 += 회차 지급 후 다음 회차. (solved/below_95/no_winner-최종 은 settle)
create or replace function public.hw_advance_after_reveal(p_room uuid)
returns bool language plpgsql security definer set search_path = public as $$
declare
  v_state jsonb; v_rev jsonb; v_kind text; v_attempt int; v_is_final bool;
  v_order uuid[]; v_gi int; v_giver uuid; v_problem int;
begin
  select state into v_state from hw_rooms where id = p_room;
  v_rev := v_state->'reveal';
  if v_rev is null or (v_state->>'sub') <> 'reveal' then
    return (v_state->>'phase') = 'game_over';
  end if;
  v_kind     := v_rev->>'kind';
  v_attempt  := (v_rev->>'attempt')::int;
  v_is_final := coalesce((v_rev->>'is_final')::bool, false);

  if v_kind = 'solved' then
    return public.hw_settle_problem(p_room, 'solved', v_attempt);
  elsif v_kind = 'below_95' then
    return public.hw_settle_problem(p_room, 'aborted', v_attempt);
  elsif v_is_final then
    return public.hw_settle_problem(p_room, 'unsolved', v_attempt);
  else
    -- no_winner 비마지막: 이 회차를 '넘기므로' 출제자 += 회차번호
    select array_agg(x::uuid) into v_order from jsonb_array_elements_text(v_state->'player_order') x;
    v_gi := (v_state->>'giver_index')::int; v_giver := v_order[v_gi + 1];
    v_problem := (v_state->>'problem_no')::int;
    perform public.hw_award_giver_attempt(p_room, v_problem, v_attempt, v_giver);
    update hw_rooms set state = v_state || jsonb_build_object(
      'attempt_no', v_attempt + 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null, 'reveal', null, 'reveal_deadline', null,
      'clue_deadline', public.hw_deadline(900), 'guess_deadline', null)
      where id = p_room;
    return false;
  end if;
end $$;
revoke execute on function public.hw_advance_after_reveal(uuid) from anon, authenticated;
