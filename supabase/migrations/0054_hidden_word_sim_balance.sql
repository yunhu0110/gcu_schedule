-- 0054 · 유사도 밸런싱 (사용자 지시: 가중치/결합 방식 재조정)
--
-- 문제(0037 가중평균의 결함): 좋은 힌트인데도 '약하지만 존재하는' 축이 평균을 깎아 95 에 못 닿음.
--   예) 죽음~사망: 의미 0.881(강)·관계 0.001(약한 3홉 경로가 존재) → 평균 46 (관계축이 희석)
--       자동차~차량: 의미 0.999·관계 0.004(존재) → 66.  반면 바다~파도(관계 NULL=기권) → 99.7
--   → 관련 힌트가 오히려 낮게 나와, request 1(95 미달=무득점)과 겹치면 게임이 '무득점 패스'만 반복.
--
-- 해법: 3축 결합을 '가중평균' → 'noisy-OR(소프트 OR)' 로 변경.
--   score = 100 · (1 − Π(1 − axis_i))   (관측된 축만, NULL 은 기권=곱에서 제외)
--   어느 한 축이라도 강하면(동의어든 공생이든 관계든) 점수가 높다 = '가장 강한 증거' 반영.
--   · 무관어: 모든 축 ~0/NULL → 0 유지(판별력 보존)
--   · 좋은 힌트: 의미·공생·관계 중 하나만 강해도 ≥90~100 도달(95 게이트 실질 도달 가능)
-- 축 raw 지표·캘리브레이션(center/scale)·동일어 100 단락은 0037 그대로 둔다(결합만 교체).

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
  inv double precision; n_axes int;
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

  -- noisy-OR: 관측된 축만 결합. inv = Π(1 − axis). 하나라도 강하면 점수 높음.
  inv := 1.0; n_axes := 0;
  if sem is not null then inv := inv * (1.0 - sem); n_axes := n_axes + 1; end if;
  if ctx is not null then inv := inv * (1.0 - ctx); n_axes := n_axes + 1; end if;
  if rel is not null then inv := inv * (1.0 - rel); n_axes := n_axes + 1; end if;

  return query select
    case when n_axes = 0 then 0.0
         else round((100.0 * (1.0 - inv))::numeric, 2)::double precision end,
    sem, ctx, rel, r_sem, r_ctx, r_rel;
end;
$$;
