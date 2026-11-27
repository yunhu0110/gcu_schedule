-- 0056 · (사용자 지시) ① 유사도 보정 되돌리기(noisy-OR → 기존 가중평균) ② 오답 결과 화면 연장
--
-- ① 0054 의 noisy-OR 가 점수를 너무 높게 올림(관련어가 쉽게 95) → 0037 의 가중평균으로 원복.
--    의미 0.40 · 문맥 0.35 · 관계 0.25, 관측된(비NULL) 축만 가중합·재정규화(§5-4 기권 철학 유지).
-- ② no_winner/below_95(오답·95미달) 결과 연출이 너무 짧다 → reveal 보류 시간 연장.
--    no_winner 7→11s, below_95 6→10s. (solved 는 출제자 버튼+5s 유지, 지시 범위 밖)

-- ── ① hw_word_similarity: 0037 가중평균으로 원복 ──
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
  sem double precision; ctx double precision; rel double precision;
  ws double precision := 0.40; wc double precision := 0.35; wr double precision := 0.25;
  wsum double precision; acc double precision;
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

  wsum := (case when sem is null then 0 else ws end)
        + (case when ctx is null then 0 else wc end)
        + (case when rel is null then 0 else wr end);
  acc  := (case when sem is null then 0 else ws * sem end)
        + (case when ctx is null then 0 else wc * ctx end)
        + (case when rel is null then 0 else wr * rel end);

  return query select
    case when wsum = 0 then 0.0
         else round((100.0 * acc / wsum)::numeric, 2)::double precision end,
    sem, ctx, rel, r_sem, r_ctx, r_rel;
end;
$$;

-- ── ② hw_conclude: 오답 결과 보류 시간 연장(no_winner 11s / below_95 10s) ──
--    (0052 정의와 동일, 보류 시간만 변경)
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
    update hw_rooms set state = v_state || jsonb_build_object(
      'sub','reveal','unlocked',false,
      'reveal', jsonb_build_object('kind','solved','attempt',v_attempt,
                 'is_final',true,'await_giver',true,'revealed',false),
      'reveal_deadline', null,
      'clue_deadline', null, 'guess_deadline', null)
      where id = p_room;
    return json_build_object('kind','solved','attempt',v_attempt,'await_giver',true);
  end if;

  if p_kind = 'below_95' then
    v_is_final := true;
  else
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
    'reveal_deadline', public.hw_deadline(case when p_kind='below_95' then 10 else 11 end),
    'clue_deadline', null, 'guess_deadline', null)
    where id = p_room;
  return json_build_object('kind',p_kind,'attempt',v_attempt,'is_final',v_is_final);
end $$;
revoke execute on function public.hw_conclude(uuid, text) from anon, authenticated;
