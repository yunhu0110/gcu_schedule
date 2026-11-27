-- 0052 · 규칙 업데이트 (사용자 지시 4건)
--   1) 95%를 10힌트(또는 15분) 안에 못 넘기면(below_95) → 아무도 점수 없이 '다음 문제'로.
--      (기존: below_95 가 회차 실패로 다음 회차 진행 + 최종 출제자 6점 → 폐지)
--      회차(attempt) 재도전은 이제 'no_winner'(95 도달했으나 아무도 못 맞힘)에서만 발생.
--   2) 추측 수정: 전원 제출(=판정) 전까지 본인 추측을 바꿀 수 있다(hw_update_guess).
--   3) solved 는 출제자가 '정답 공개하기'를 눌러야만 공개 — 자동공개 안전상한(120s) 제거.
--   4) 문제(봉투) 단어에 고유명사 금지 — WSD 에 NNG(일반명사) 의미가 있는 단어만 추출.
--      (freq 임계값만으론 케플러·싱가포르·헤이그 등 통과 → NNG 긍정증거로 확실히 배제)

-- ════════════════════════════════════════════════════════════════════
-- (4) 고유명사 배제: common_noun 플래그 사전 계산(틱 내 draw 성능 위해 서브쿼리 대신 컬럼)
-- ════════════════════════════════════════════════════════════════════
alter table public.hw_words add column if not exists common_noun boolean not null default false;
update public.hw_words w set common_noun =
  exists (select 1 from public.hw_word_senses s where s.word = w.word and s.pos = 'NNG');
create index if not exists hw_words_common_draw_idx
  on public.hw_words(freq) where usable and common_noun;

-- ── 봉투 단어 추출(0049 기반) + common_noun 필터 추가 ──
drop function if exists public.hw_draw_envelopes(uuid, int);
create or replace function public.hw_draw_envelopes(p_room uuid, n_env int)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  v_result text[] := '{}';
  v_used   text[];
  v_need int := n_env * 5;
  v_avail int;
  v_pool int;
  v_pw text[];
  v_pc text[];
  v_env int; v_i int; v_cnt int;
  v_cats text[];
begin
  select coalesce(array_agg(w), '{}') into v_used
    from (select distinct unnest(words) as w from public.hw_envelope_words where room_id = p_room) u;

  -- 공급 가능 단어 수(고유명사 제외: common_noun) 사전 점검
  select count(*) into v_avail from public.hw_words w
    where w.usable and w.common_noun and w.freq >= 500
      and not (w.word = any(v_used))
      and exists (select 1 from public.hw_word_categories wc
                  where wc.word = w.word and wc.category <> '기타');
  if v_avail < v_need then
    raise exception '게임용 단어가 부족해요. 필요 %개, 사용가능 %개(부족 %개). 라운드 수를 줄여주세요.',
      v_need, v_avail, v_need - v_avail;
  end if;

  v_pool := least(v_avail, greatest(v_need * 12, 120));
  select array_agg(word), array_agg(cat) into v_pw, v_pc from (
    with pool as (
      select w.word
      from public.hw_words w
      where w.usable and w.common_noun and w.freq >= 500
        and not (w.word = any(v_used))
        and exists (select 1 from public.hw_word_categories wc
                    where wc.word = w.word and wc.category <> '기타')
      order by random()
      limit v_pool
    )
    select p.word,
           (select wc.category from public.hw_word_categories wc
             where wc.word = p.word and wc.category <> '기타'
             order by random() limit 1) as cat
    from pool p
  ) q;

  for v_env in 1..n_env loop
    v_cats := '{}'; v_cnt := 0;
    for v_i in 1..coalesce(array_length(v_pw, 1), 0) loop
      continue when v_pw[v_i] is null;
      continue when v_pc[v_i] is null;
      continue when v_pc[v_i] = any(v_cats);
      v_result := v_result || v_pw[v_i];
      v_cats   := v_cats   || v_pc[v_i];
      v_pw[v_i] := null;
      v_cnt := v_cnt + 1;
      exit when v_cnt = 5;
    end loop;
    if v_cnt < 5 then
      raise exception '카테고리 다양성 부족으로 봉투 구성 실패(봉투 %). 다시 시도하거나 라운드 수를 줄여주세요.', v_env;
    end if;
  end loop;

  return v_result;
end $$;
revoke execute on function public.hw_draw_envelopes(uuid, int) from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- (1) 점수 정산 — 3가지 결말: solved / unsolved(no_winner 최종) / aborted(below_95)
--   · solved@A      : 정답자 전원 +1, 출제자 (A-1)·A/2 (앞선 A-1 no_winner 누적)
--   · unsolved      : 3회차까지 no_winner → 출제자 6 (=1+2+3)
--   · aborted       : below_95 → 아무도 점수 없음
-- below_95 는 즉시 문제 종료이므로 회차 누적 지점이 아니다(앞선 회차는 모두 no_winner).
-- ════════════════════════════════════════════════════════════════════
drop function if exists public.hw_settle_problem(uuid, bool, int);
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

  -- 중복 정산 방지(0047)
  insert into hw_problem_settled (room_id, problem_no) values (p_room, v_problem)
    on conflict do nothing;
  if not found then
    return (v_state->>'phase') = 'game_over';
  end if;

  update hw_player_words set is_revealed = true
    where room_id = p_room and player_id = v_giver and round_no = v_round;

  -- 점수(모드별)
  if p_mode = 'solved' then
    update hw_guesses set is_revealed = true
      where room_id = p_room and problem_no = v_problem and attempt_no = p_attempt;
    update hw_scores s set points = points + 1
      from hw_guesses g
      where g.room_id = p_room and g.problem_no = v_problem
        and g.attempt_no = p_attempt and g.is_correct and g.guesser_id = s.player_id;
    update hw_scores set points = points + ((p_attempt - 1) * p_attempt) / 2
      where player_id = v_giver;
  elsif p_mode = 'unsolved' then
    update hw_scores set points = points + 6 where player_id = v_giver;
  end if;  -- aborted(below_95): 점수 없음

  if v_gi + 1 < v_n then
    update hw_rooms set state = v_state || jsonb_build_object(
      'giver_index', v_gi + 1, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null,
      'reveal', null, 'reveal_deadline', null,
      'clue_deadline', public.hw_deadline(900), 'guess_deadline', null)
      where id = p_room;
    return false;
  elsif v_round < v_rounds then
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
revoke execute on function public.hw_settle_problem(uuid,text,int) from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- (1)(3) hw_conclude: below_95 는 항상 종료(is_final); solved 는 버튼 전까지 데드라인 없음
-- ════════════════════════════════════════════════════════════════════
create or replace function public.hw_conclude(p_room uuid, p_kind text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_state jsonb; v_order uuid[]; v_gi int; v_giver uuid;
  v_round int; v_problem int; v_attempt int; v_maxa int;
  v_is_final bool;
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
    -- 출제자 버튼 대기(자동공개 없음, §3 지시). 히든워드는 버튼 누를 때 공개.
    update hw_rooms set state = v_state || jsonb_build_object(
      'sub','reveal','unlocked',false,
      'reveal', jsonb_build_object('kind','solved','attempt',v_attempt,
                 'is_final',true,'await_giver',true,'revealed',false),
      'reveal_deadline', null,                 -- 버튼 눌러야만 공개·전이
      'clue_deadline', null, 'guess_deadline', null)
      where id = p_room;
    return json_build_object('kind','solved','attempt',v_attempt,'await_giver',true);
  end if;

  -- below_95: 95 미달 → 즉시 문제 종료(아무도 점수). no_winner: 3회차면 종료.
  if p_kind = 'below_95' then
    v_is_final := true;
  else  -- no_winner
    v_is_final := (v_attempt >= v_maxa);
  end if;

  if v_is_final then
    update hw_player_words set is_revealed = true
      where room_id = p_room and player_id = v_giver and round_no = v_round;
  end if;

  update hw_rooms set state = v_state || jsonb_build_object(
    'sub','reveal','unlocked',false,
    'reveal', jsonb_build_object('kind',p_kind,'attempt',v_attempt,
               'is_final',v_is_final,'await_giver',false,'revealed',v_is_final),
    'reveal_deadline', public.hw_deadline(case when p_kind='below_95' then 6 else 7 end),
    'clue_deadline', null, 'guess_deadline', null)
    where id = p_room;
  return json_build_object('kind',p_kind,'attempt',v_attempt,'is_final',v_is_final);
end $$;
revoke execute on function public.hw_conclude(uuid, text) from anon, authenticated;

-- ── hw_advance_after_reveal: 결말을 모드로 매핑 ──
create or replace function public.hw_advance_after_reveal(p_room uuid)
returns bool language plpgsql security definer set search_path = public as $$
declare v_state jsonb; v_rev jsonb; v_kind text; v_attempt int; v_is_final bool;
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
    return public.hw_settle_problem(p_room, 'aborted', v_attempt);   -- 아무도 점수 없음
  elsif v_is_final then
    return public.hw_settle_problem(p_room, 'unsolved', v_attempt);  -- 3회차 no_winner → 6점
  else
    -- no_winner 비마지막 → 같은 출제자 다음 회차
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

-- ── hw_reveal: solved 공개 버튼(0051과 동일, 유지) ──
-- (변경 없음 — 0051 정의 사용)

-- ════════════════════════════════════════════════════════════════════
-- (2) 추측 수정: 전원 제출 전(sub='guess')까지 본인 추측 변경
-- ════════════════════════════════════════════════════════════════════
create or replace function public.hw_update_guess(p_token uuid, p_guess text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_room hw_rooms; v_state jsonb;
  v_order uuid[]; v_gi int; v_giver uuid; v_round int; v_problem int; v_attempt int;
  v_hidden text; v_guess text; v_correct bool;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select r.* into v_room from hw_rooms r join hw_players p on p.room_id=r.id where p.id=v_pid for update;
  v_state := v_room.state;
  if (v_state->>'phase') <> 'round' or (v_state->>'sub') <> 'guess'
     or not coalesce((v_state->>'unlocked')::bool,false) then
    raise exception '지금은 정답을 수정할 수 없어요'; end if;

  select array_agg(x::uuid) into v_order from jsonb_array_elements_text(v_state->'player_order') x;
  v_gi      := (v_state->>'giver_index')::int;
  v_giver   := v_order[v_gi + 1];
  if v_giver = v_pid then raise exception '출제자는 추측하지 않아요'; end if;
  v_round   := (v_state->>'round_no')::int;
  v_problem := (v_state->>'problem_no')::int;
  v_attempt := (v_state->>'attempt_no')::int;
  if not exists (select 1 from hw_guesses where room_id=v_room.id and problem_no=v_problem
                   and attempt_no=v_attempt and guesser_id=v_pid) then
    raise exception '먼저 정답을 제출해주세요'; end if;

  v_guess := public.hw_norm(p_guess);
  if coalesce(v_guess,'') = '' then raise exception '추측 단어를 입력해주세요'; end if;
  select hidden_word into v_hidden from hw_player_words where player_id=v_giver and round_no=v_round;
  v_correct := (v_guess = v_hidden);

  update hw_guesses set guess_word = v_guess, is_correct = v_correct, submitted_at = now()
    where room_id=v_room.id and problem_no=v_problem and attempt_no=v_attempt and guesser_id=v_pid;
  return json_build_object('ok', true);
end $$;
grant execute on function public.hw_update_guess(uuid, text) to anon, authenticated;

-- ── 본인 현재 회차 추측 조회(새로고침 복원·수정 프리필용, 본인만) ──
create or replace function public.hw_my_guess(p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_room hw_rooms; v_state jsonb; v_problem int; v_attempt int; v_w text;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then return null; end if;
  select r.* into v_room from hw_rooms r join hw_players p on p.room_id=r.id where p.id=v_pid;
  v_state := v_room.state;
  v_problem := (v_state->>'problem_no')::int;
  v_attempt := (v_state->>'attempt_no')::int;
  select guess_word into v_w from hw_guesses
    where room_id=v_room.id and problem_no=v_problem and attempt_no=v_attempt and guesser_id=v_pid;
  return v_w;
end $$;
grant execute on function public.hw_my_guess(uuid) to anon, authenticated;
