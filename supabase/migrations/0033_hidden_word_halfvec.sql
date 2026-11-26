-- 0033 · 의미축 벡터를 halfvec(fp16)로 전환 — 스토리지 절감 우선
-- KR-SBERT 768차원을 vector(float32, 3072B/행) → halfvec(float16, 1536B/행)로 바꿔
-- 테이블/HNSW 인덱스 저장량을 약 절반으로 줄인다. 코사인 품질 손실은 무시할 수준.
-- hw_word_vectors 는 아직 0행이므로 컬럼을 안전하게 재생성한다.
-- (halfvec 미지원 pgvector면 이 마이그레이션 대신 0032의 vector(768) 유지로 폴백)

drop index if exists public.hw_word_vectors_vec_idx;
alter table public.hw_word_vectors drop column vec;
alter table public.hw_word_vectors add  column vec extensions.halfvec(768) not null;
create index hw_word_vectors_vec_idx
  on public.hw_word_vectors using hnsw (vec extensions.halfvec_cosine_ops);

-- RPC 재정의 — 벡터 선언만 halfvec(768)로. 블렌드 로직은 0032와 동일.
create or replace function public.hw_similarity(p_a text, p_b text)
returns numeric
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  na text := lower(trim(p_a));
  nb text := lower(trim(p_b));
  va extensions.halfvec(768);
  vb extensions.halfvec(768);
  sem        real;   has_sem boolean := false;  w_sem constant real := 0.55;
  ctx        real := 0;                          w_ctx constant real := 0.20;
  rel        real := 0;                          w_rel constant real := 0.25;
  has_rel    boolean := false;
  is_antonym boolean := false;
  ppmi_cap   constant real := 8.0;
  wsum       real := 0;
  acc        real := 0;
  score01    real;
begin
  if na = '' or nb = '' then return null; end if;
  if na = nb then return 100.00; end if;

  select vec into va from hw_word_vectors where word = na;
  if va is null then return null; end if;   -- 엔진 데이터 미적재 → 현행 동작

  select vec into vb from hw_word_vectors where word = nb;
  if vb is not null then
    sem := greatest(0.0, 1.0 - (va <=> vb));
    has_sem := true;
  end if;

  select least(1.0, ppmi / ppmi_cap) into ctx
    from hw_word_cooc
   where word_a = least(na, nb) and word_b = greatest(na, nb);
  ctx := coalesce(ctx, 0);

  select
      coalesce(max(case relation
        when 'synonym' then 1.0 * weight
        when 'hypernym' then 0.7 * weight
        when 'hyponym'  then 0.7 * weight
        else 0 end), 0),
      bool_or(relation = 'antonym')
    into rel, is_antonym
    from hw_word_relations
   where (word = na and related = nb) or (word = nb and related = na);
  rel := coalesce(rel, 0);
  is_antonym := coalesce(is_antonym, false);
  if rel > 0 then has_rel := true; end if;

  if has_sem then wsum := wsum + w_sem; acc := acc + w_sem * sem; end if;
  if ctx > 0 then wsum := wsum + w_ctx; acc := acc + w_ctx * ctx; end if;
  if has_rel then wsum := wsum + w_rel; acc := acc + w_rel * rel; end if;

  if wsum = 0 then return 0.00; end if;
  score01 := acc / wsum;

  if is_antonym then score01 := least(score01 * 0.20, 0.12); end if;

  return round((100.0 * greatest(0.0, least(1.0, score01)))::numeric, 2);
end $$;

revoke all on function public.hw_similarity(text, text) from anon, authenticated;
