-- 0036 · 히든워드 재구축 데이터 스키마 (지시서 §10 데이터 축)
-- Phase 2~5 산출(어휘·의미·카테고리·관계·공생·임베딩)을 담는 신규 테이블.
-- ※ 이 Supabase 프로젝트는 GCU 앱과 공유 → 모든 테이블 hw_ 접두로 이름 충돌 방지.
-- ※ RLS 전면 활성화 + 정책 없음 = anon/authenticated 직접접근 차단(유사도는 RPC security definer 로만).
-- ※ 원본 말뭉치는 적재하지 않는다(§9). 여기엔 가공 결과만.

create extension if not exists vector with schema extensions;

-- 카테고리(§2-2, 20종 + 기타)
create table if not exists public.hw_categories (
  id    text primary key,
  label text not null
);

insert into public.hw_categories(id, label) values
  ('자연','자연'),('식물','식물'),('동물','동물'),('음식','음식'),('신체','신체'),
  ('감정','감정'),('행동','행동'),('사람','사람'),('사회','사회'),('문화','문화'),
  ('경제','경제'),('정치','정치'),('과학','과학'),('기술','기술'),('도구','도구'),
  ('사물','사물'),('장소','장소'),('건축','건축'),('시간','시간'),('공간','공간'),
  ('기타','기타')
on conflict (id) do nothing;

-- 어휘(명사 표제어). usable=true 만 히든워드(봉투) 후보. 비교(힌트)용은 전체.
create table if not exists public.hw_words (
  word          text primary key,
  freq          integer not null default 0,
  freq_written  integer not null default 0,
  freq_spoken   integer not null default 0,
  usable        boolean not null default false
);
create index if not exists hw_words_usable_idx on public.hw_words(usable) where usable;

-- 의미(다의어 분리, 다층위 WSD)
create table if not exists public.hw_word_senses (
  word     text not null,
  sense_id text not null,
  pos      text not null,
  cnt      integer not null default 0,
  primary key (word, sense_id)
);

-- 단어-카테고리(복수 허용). via: seed|hypernym|embedding
create table if not exists public.hw_word_categories (
  word     text not null,
  category text not null references public.hw_categories(id),
  via      text not null,
  primary key (word, category)
);
create index if not exists hw_word_categories_cat_idx on public.hw_word_categories(category);

-- 관계 그래프(NIKLex). rel: synonym|antonym|hypernym, dir: sym|a_isa_b(a IS-A b)
-- 적재 시 양 끝이 모두 hw_words 에 있는 간선만(§9 공간 절감).
create table if not exists public.hw_word_relations (
  a        text not null,
  b        text not null,
  rel      text not null,
  dir      text not null,
  strength real not null,
  primary key (a, b, rel, dir)
);
create index if not exists hw_word_relations_a_idx on public.hw_word_relations(a);
create index if not exists hw_word_relations_b_idx on public.hw_word_relations(b);

-- 문맥 공생(NPMI, 도메인 결합). a<b canonical. 적재 시 양 끝 모두 어휘 내.
create table if not exists public.hw_word_cooc (
  a    text not null,
  b    text not null,
  npmi real not null,
  primary key (a, b)
);
create index if not exists hw_word_cooc_a_idx on public.hw_word_cooc(a);
create index if not exists hw_word_cooc_b_idx on public.hw_word_cooc(b);

-- 의미 임베딩(word2vec 200차원, halfvec fp16 = 400B/행). 쌍거리만 쓰므로 ANN 인덱스 불필요.
create table if not exists public.hw_word_embeddings (
  word text primary key,
  vec  extensions.halfvec(200) not null
);

-- RLS 전면 차단(데이터 축 테이블은 클라이언트 직접접근 금지, RPC 전용)
do $$
declare t text;
begin
  foreach t in array array[
    'hw_categories','hw_words','hw_word_senses','hw_word_categories',
    'hw_word_relations','hw_word_cooc','hw_word_embeddings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
