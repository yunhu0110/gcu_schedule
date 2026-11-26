-- 0030 · 히든 워드 유사도 엔진 — 3축 분리 저장소
-- 추측 단어 ↔ 출제자 히든워드의 유사도를 서버에서 계산하기 위한 사전계산 데이터 저장.
-- 축1 의미(fastText cc.ko.300 벡터) · 축2 문맥(위키 PPMI 공생) · 축3 관계(ConceptNet/WordNet).
--
-- 데이터 자체는 오프라인 파이프라인(scripts/hw-similarity/)이 적재한다. 이 마이그레이션은 '그릇'만 만든다.
-- 적재 전에는 테이블이 비어 있고, hw_similarity()는 null을 돌려주므로 게임 동작은 현행과 동일.
--
-- 보안: 세 테이블 모두 anon/authenticated 직접 조회 금지(히든워드 역추론 방지). 접근은 RPC(SECURITY DEFINER)로만.

-- pgvector (Supabase 권장: extensions 스키마에 설치)
create extension if not exists vector with schema extensions;

-- ============================================================
-- 축1 · 의미 벡터 (fastText cc.ko.300, 300차원)
--   히든워드 풀 단어 + 사전계산한 대규모 명사 어휘를 모두 담는다.
--   추측 단어가 여기 있으면 의미 유사도(cosine)가 계산된다.
-- ============================================================
create table if not exists public.hw_word_vectors (
  word    text primary key,
  vec     extensions.vector(300) not null,
  is_noun boolean not null default true
);
-- 근사 최근접(HNSW)까지는 불필요(단건 조회 위주). cosine 거리 인덱스만 보조로.
create index if not exists hw_word_vectors_vec_idx
  on public.hw_word_vectors using hnsw (vec extensions.vector_cosine_ops);

-- ============================================================
-- 축2 · 문맥 공생 (위키 말뭉치 PPMI)
--   예: 나무↔버섯 — 의미는 멀지만 함께 자주 등장. 무방향 쌍으로 저장(word_a < word_b).
-- ============================================================
create table if not exists public.hw_word_cooc (
  word_a text not null,
  word_b text not null,
  ppmi   real not null,            -- 양의 PMI (>=0). 클수록 강한 공생.
  primary key (word_a, word_b),
  check (word_a < word_b)
);
create index if not exists hw_word_cooc_b_idx on public.hw_word_cooc (word_b);

-- ============================================================
-- 축3 · 어휘 관계 (ConceptNet 5 Korean + Open Korean WordNet)
--   relation: 'synonym'(유의어) | 'antonym'(반의어) | 'hypernym'(상위어) | 'hyponym'(하위어)
--   예: 나무→소나무(hyponym), 소나무→나무(hypernym), 뜨겁다↔차갑다(antonym)
--   방향이 있는 관계는 양쪽을 각각 적재(상위/하위 짝)한다.
-- ============================================================
create table if not exists public.hw_word_relations (
  word     text not null,
  related  text not null,
  relation text not null check (relation in ('synonym','antonym','hypernym','hyponym')),
  weight   real not null default 1.0,   -- 소스 신뢰도(0~1). ConceptNet edge weight 등.
  primary key (word, related, relation)
);
create index if not exists hw_word_relations_related_idx on public.hw_word_relations (related);

-- ============================================================
-- RLS — 직접 조회 전면 차단. RPC(SECURITY DEFINER)로만 접근.
--   히든워드 풀 단어의 이웃을 긁어 역추론하는 것을 막는다.
-- ============================================================
alter table public.hw_word_vectors   enable row level security;
alter table public.hw_word_cooc       enable row level security;
alter table public.hw_word_relations  enable row level security;
-- select 정책 없음 = 접근 불가. 명시적으로 grant도 회수.
revoke all on public.hw_word_vectors  from anon, authenticated;
revoke all on public.hw_word_cooc      from anon, authenticated;
revoke all on public.hw_word_relations from anon, authenticated;
