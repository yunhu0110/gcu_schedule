-- 0037 · 히든워드 유사도 엔진 (지시서 §5·§8·§9·§11)
-- 출제자 히든워드 ↔ 출제자 제출 힌트의 유사도를 서버에서 계산해 0~100 으로 반환(규칙 #9·#10).
-- 유사도 ≥ 95.0 일 때만 정답 제출을 여는 게이트의 기준값(규칙 #11)도 이 점수.
--
-- 3축(§5, meronym 데이터 없음 → §5-4 부분전체/기타 제외 후 재정규화된 가중치):
--   · 의미(semantic) 0.40  : word2vec 임베딩 코사인 (hw_word_embeddings, halfvec)
--   · 문맥(contextual) 0.35 : 말뭉치 공생 NPMI (hw_word_cooc)
--   · 관계(relation) 0.25   : NIKLex 그래프 3홉 최적경로 (hw_word_relations)
-- 각 축 raw 값을 로지스틱(캘리브레이션 center/scale)으로 [0,1] 정규화(§5 MAD/z/sigmoid 계열) 후 가중합.
--   center/scale 은 hw_sim_calibration 에 축별로 저장(랜덤쌍 분포 기준 적합, Phase 7 캘리브레이션 스크립트가 갱신).
--
-- 접근: 데이터 테이블은 RLS 전면차단(0036) → 본 함수들은 security definer 로 소유자 권한으로 조회.
--       유사도 계산은 클라이언트가 아니라 서버(이 함수)에서만 수행(§5).

-- ── 캘리브레이션 상수(축별 로지스틱) ─────────────────────────────
create table if not exists public.hw_sim_calibration (
  axis    text primary key,          -- 'semantic' | 'contextual' | 'relation'
  center  double precision not null,  -- 로지스틱 중심(이 raw 값에서 0.5)
  scale   double precision not null,  -- 기울기 스케일(작을수록 가파름)
  updated timestamptz not null default now()
);
-- 기본값(캘리브레이션 전에도 동작). 스크립트가 분포 기반으로 덮어씀.
insert into public.hw_sim_calibration(axis, center, scale) values
  ('semantic',   0.45, 0.12),
  ('contextual', 0.20, 0.10),
  ('relation',   0.35, 0.15)
on conflict (axis) do nothing;

alter table public.hw_sim_calibration enable row level security;
revoke all on public.hw_sim_calibration from anon, authenticated;

-- ── 축별 raw 지표 ────────────────────────────────────────────────

-- 의미축: 임베딩 코사인(음수는 0 클램프). 한쪽이라도 임베딩 없으면 NULL.
create or replace function public.hw_axis_semantic(w1 text, w2 text)
returns double precision
language sql stable security definer
set search_path = public, extensions
as $$
  select greatest(0.0, 1.0 - (a.vec <=> b.vec))
  from public.hw_word_embeddings a, public.hw_word_embeddings b
  where a.word = w1 and b.word = w2
$$;

-- 문맥축: NPMI(canonical a<b). 없으면 NULL(공생 관측 없음 → 호출부에서 0 취급).
create or replace function public.hw_axis_contextual(w1 text, w2 text)
returns double precision
language sql stable security definer
set search_path = public
as $$
  select npmi from public.hw_word_cooc
  where a = least(w1, w2) and b = greatest(w1, w2)
$$;

-- 관계축: NIKLex 무방향 3홉 최적경로. 간선가중 = rel기반 × (0.5+0.5·strength),
--   경로가중 = 간선가중들의 곱(홉이 길수록 자연 감쇠). 최대 3홉. 경로 없으면 NULL.
create or replace function public.hw_axis_relation(w1 text, w2 text)
returns double precision
language sql stable security definer
set search_path = public
as $$
  with recursive e as (
    select a as src, b as dst, rel, strength from public.hw_word_relations
    union all
    select b as src, a as dst, rel, strength from public.hw_word_relations
  ),
  ew as (  -- 간선 1개의 가중(rel 유형별 기준 × 합의도 보정)
    select src, dst,
           (case rel when 'synonym' then 1.00
                     when 'hypernym' then 0.85
                     when 'antonym' then 0.60
                     else 0.50 end) * (0.5 + 0.5 * strength) as w
    from e
  ),
  walk(dst, hops, score, path) as (
    select dst, 1, w, array[src, dst]
    from ew where src = w1
    union all
    select n.dst, w.hops + 1, w.score * n.w, w.path || n.dst
    from walk w join ew n on n.src = w.dst
    where w.hops < 3 and n.dst <> all(w.path)
  )
  select max(score) from walk where dst = w2
$$;

-- ── 로지스틱 캘리브레이션 ────────────────────────────────────────
create or replace function public.hw_calibrate(raw double precision, c_center double precision, c_scale double precision)
returns double precision
language sql immutable
as $$
  select 1.0 / (1.0 + exp(-((raw - c_center) / nullif(c_scale, 0))))
$$;

-- ── 합성 유사도(0~100) + 축 분해(규칙 #10: 전원 동일 공개용) ──────
create or replace function public.hw_word_similarity(w1 text, w2 text)
returns table (
  score     double precision,  -- 0~100
  semantic  double precision,  -- 캘리브레이션 후 [0,1]
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
  -- 동일어 즉시 만점(힌트=히든워드)
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

  -- 축 결측(NULL)은 '0(무관)'이 아니라 '기권'으로 본다(§5-4 결측 재정규화 철학).
  --   동의어는 서로 치환되어 같은 문맥에 공기하지 않으므로 문맥 NPMI 가 없는 게 정상 —
  --   이를 0 으로 깎으면 완벽한 힌트도 ≥95 에 못 닿는다. 관측이 있는 축만 가중합·재정규화.
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

-- 게임 로직(security definer RPC)만 호출. 직접 데이터 접근은 여전히 차단.
grant execute on function public.hw_word_similarity(text, text) to authenticated;
revoke execute on function public.hw_axis_semantic(text, text) from anon, authenticated;
revoke execute on function public.hw_axis_contextual(text, text) from anon, authenticated;
revoke execute on function public.hw_axis_relation(text, text) from anon, authenticated;
