-- 0059 · (사용자: "낮은 게 너무 낮아") 낮은·중간대 점수 끌어올리기
--
-- 0057 블렌드는 유지하되, 최종 결합값(0~1)에 감마 곡선 적용: combined := combined^γ, γ=0.75(GAMMA).
--   · γ<1 은 낮은·중간 값을 위로 끌어올리고 상단(≈1)은 거의 그대로 → '약간 관련된' 힌트가
--     덜 가혹하게 낮아진다. 무관어(결합≈0.002)는 여전히 ~1 로 바닥 유지(판별력 보존).
--   예) 0.30→0.41, 0.44→0.54, 0.71→0.77, 0.86→0.90, 0.96→0.97, 0.002→0.009
-- α(블렌드)·γ(바닥 보정) 두 상수로 난이도/바닥을 독립 튜닝.

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
  wavg double precision; inv double precision; nor double precision; n_axes int;
  alpha double precision := 0.85;   -- 블렌드 비율(↑ 쉬움)
  gamma double precision := 0.75;   -- 바닥 보정(↓ 낮은점수 더 끌어올림)
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

  wsum := (case when sem is null then 0 else ws end)
        + (case when ctx is null then 0 else wc end)
        + (case when rel is null then 0 else wr end);
  acc  := (case when sem is null then 0 else ws * sem end)
        + (case when ctx is null then 0 else wc * ctx end)
        + (case when rel is null then 0 else wr * rel end);
  wavg := case when wsum = 0 then 0.0 else acc / wsum end;

  inv := 1.0; n_axes := 0;
  if sem is not null then inv := inv * (1.0 - sem); n_axes := n_axes + 1; end if;
  if ctx is not null then inv := inv * (1.0 - ctx); n_axes := n_axes + 1; end if;
  if rel is not null then inv := inv * (1.0 - rel); n_axes := n_axes + 1; end if;
  nor := case when n_axes = 0 then 0.0 else 1.0 - inv end;

  combined := alpha * nor + (1.0 - alpha) * wavg;
  combined := power(greatest(combined, 0.0), gamma);   -- 바닥 보정

  return query select
    round((100.0 * combined)::numeric, 2)::double precision,
    sem, ctx, rel, r_sem, r_ctx, r_rel;
end;
$$;

-- [임시] 분포 확인용 디버그(0060 에서 drop)
create or replace function public.hw_sim_debug(w1 text, w2 text)
returns table (score double precision, semantic double precision, contextual double precision,
  relation double precision, raw_semantic double precision, raw_contextual double precision,
  raw_relation double precision)
language sql stable security definer set search_path = public as $$
  select * from public.hw_word_similarity(w1, w2)
$$;
grant execute on function public.hw_sim_debug(text, text) to anon, authenticated;
