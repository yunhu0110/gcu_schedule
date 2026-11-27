-- 0057 · 유사도 '중간' 밸런싱 (사용자: 가중평균은 너무 어려움, noisy-OR 는 너무 쉬움 → 중간)
--
-- 결합을 둘의 블렌드로: combined = α·noisyOR + (1−α)·weightedAvg,  α = 0.85 (ALPHA 상수).
--   · weightedAvg(0037): 강한 의미를 약한 축이 희석 → 좋은 힌트도 60~90(너무 어려움)
--   · noisyOR(0054): 가장 강한 축만 반영 → 느슨한 관련어도 95(너무 쉬움)
--   · 블렌드(α=0.85): 명확히 좋은 힌트(동의어·강한 공생)는 95 도달, 느슨한 관련어는 85~94,
--     무관어는 ~0 유지. α 하나로 난이도 조절 가능(↑쉬움 / ↓어려움).
-- 두 결합 모두 관측된(비NULL) 축만 사용(§5-4 기권). 축 raw·캘리브레이션은 0037 그대로.

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
  alpha double precision := 0.85;   -- 블렌드 비율(↑ 쉬움). 난이도 튜닝 지점.
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

  -- 가중평균(관측 축만)
  wsum := (case when sem is null then 0 else ws end)
        + (case when ctx is null then 0 else wc end)
        + (case when rel is null then 0 else wr end);
  acc  := (case when sem is null then 0 else ws * sem end)
        + (case when ctx is null then 0 else wc * ctx end)
        + (case when rel is null then 0 else wr * rel end);
  wavg := case when wsum = 0 then 0.0 else acc / wsum end;

  -- noisy-OR(관측 축만)
  inv := 1.0; n_axes := 0;
  if sem is not null then inv := inv * (1.0 - sem); n_axes := n_axes + 1; end if;
  if ctx is not null then inv := inv * (1.0 - ctx); n_axes := n_axes + 1; end if;
  if rel is not null then inv := inv * (1.0 - rel); n_axes := n_axes + 1; end if;
  nor := case when n_axes = 0 then 0.0 else 1.0 - inv end;

  combined := alpha * nor + (1.0 - alpha) * wavg;

  return query select
    round((100.0 * combined)::numeric, 2)::double precision,
    sem, ctx, rel, r_sem, r_ctx, r_rel;
end;
$$;

-- [임시] 분포 확인용 디버그(0058 에서 drop). 읽기전용·어휘만.
create or replace function public.hw_sim_debug(w1 text, w2 text)
returns table (score double precision, semantic double precision, contextual double precision,
  relation double precision, raw_semantic double precision, raw_contextual double precision,
  raw_relation double precision)
language sql stable security definer set search_path = public as $$
  select * from public.hw_word_similarity(w1, w2)
$$;
grant execute on function public.hw_sim_debug(text, text) to anon, authenticated;
