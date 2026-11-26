-- 0038 · 히든워드 게임 로직 재구축 (지시서 §8 + 규칙 #3~#7, #9~#11)
-- 확정된 라운드 방식(A안):
--   · 라운드마다 출제자(player_order[round_index]) 1명이 자기 히든워드를 가짐.
--   · 출제자가 힌트 단어를 '한 번에 하나씩' 반복 제출 → 매 힌트마다 유사도(히든워드↔힌트)를
--     서버(hw_word_similarity)로 계산해 저장·전원 공개(규칙 #9·#10).
--   · 어떤 힌트가 유사도 ≥ 95.0 이면 그 라운드의 '정답 제출'이 열린다(규칙 #11).
--   · 출제자를 제외한 참가자들이 히든워드를 추측 → 정확히 맞히면 득점.
--   · 라운드 수는 방장이 설정(3~30, 기본 6, 규칙 #6). 소진되면 game_over.
--
-- 규칙 매핑:
--   #3 봉투 내용은 선택 전까지 절대 비공개 → 단어는 hw_envelope_words(RLS deny-all)에 두고
--      본인이 선택한 봉투만 토큰 RPC(hw_get_my_envelope)로 조회. 공개 hw_envelopes 엔 단어 없음.
--   #4 봉투 6개 × 서로 다른 단어 5개(총 30개 distinct).
--   #5 카테고리로 묶이지 않게 무작위 — hw_words(usable)에서 random()으로 30개 추출 후 봉투 배분.
--   #7 참가자는 이전 라운드에 쓴 힌트 단어를 재사용 불가 → hw_clues 전체에서 (player, clue_word) 중복 거부.
--   #9 유사도 = 출제자 히든워드 ↔ 출제자 제출 힌트.
--
-- 멱등: 0035 에서 게임테이블 truncate 됨. 여기선 구조를 새로 맞추기 위해 drop & recreate.

-- 과거 publication 등록 해제(테이블 drop 전) — 없으면 무시
do $$ begin
  begin alter publication supabase_realtime drop table public.hw_envelopes; exception when others then null; end;
  begin alter publication supabase_realtime drop table public.hw_clues;     exception when others then null; end;
  begin alter publication supabase_realtime drop table public.hw_guesses;   exception when others then null; end;
  begin alter publication supabase_realtime drop table public.hw_pieces;    exception when others then null; end;
end $$;

drop table if exists public.hw_pieces        cascade;
drop table if exists public.hw_guesses       cascade;
drop table if exists public.hw_clues         cascade;
drop table if exists public.hw_player_words  cascade;
drop table if exists public.hw_envelopes     cascade;

-- ── 봉투(공개): 단어 없음. 번호·선택자만. 내용 비공개(#3) ──
create table public.hw_envelopes (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.hw_rooms(id) on delete cascade,
  envelope_number int  not null check (envelope_number between 1 and 6),
  selected_by     uuid references public.hw_players(id),
  unique (room_id, envelope_number)
);
create index hw_envelopes_room_idx on public.hw_envelopes(room_id);

-- ── 봉투 단어(비공개): RLS deny-all, RPC 전용(#3) ──
create table public.hw_envelope_words (
  envelope_id uuid primary key references public.hw_envelopes(id) on delete cascade,
  room_id     uuid not null references public.hw_rooms(id) on delete cascade,
  words       text[] not null check (array_length(words,1) = 5)
);

-- ── 히든워드(비공개): select 정책 없음 ──
create table public.hw_player_words (
  player_id   uuid primary key references public.hw_players(id) on delete cascade,
  room_id     uuid not null references public.hw_rooms(id) on delete cascade,
  hidden_word text not null,
  is_revealed boolean not null default false
);
create index hw_player_words_room_idx on public.hw_player_words(room_id);

-- ── 힌트(공개): 라운드당 여러 번. 유사도 포함(#9·#10) ──
create table public.hw_clues (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.hw_rooms(id) on delete cascade,
  round_index  int  not null,
  player_id    uuid not null references public.hw_players(id),  -- 출제자
  clue_word    text not null,
  similarity   numeric(5,2) not null,          -- 0.00~100.00 (히든워드↔힌트)
  attempt      int not null,                    -- 해당 라운드 내 제출 차수(1-based)
  submitted_at timestamptz not null default now(),
  unique (room_id, round_index, attempt)
);
create index hw_clues_room_idx on public.hw_clues(room_id);
-- 규칙 #7: 한 참가자가 한 방에서 같은 힌트 단어를 재사용 금지(라운드 교차 포함)
create unique index hw_clues_no_reuse on public.hw_clues(room_id, player_id, clue_word);

-- ── 추측(공개 시점 제한): 정답 여부 포함 ──
create table public.hw_guesses (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.hw_rooms(id) on delete cascade,
  round_index   int  not null,
  guesser_id    uuid not null references public.hw_players(id),
  clue_giver_id uuid not null references public.hw_players(id),
  guess_word    text not null,
  is_correct    boolean not null,
  is_revealed   boolean not null default false,
  submitted_at  timestamptz not null default now(),
  unique (room_id, round_index, guesser_id)
);
create index hw_guesses_room_idx on public.hw_guesses(room_id);

-- ── 점수(공개) ──
create table public.hw_scores (
  player_id uuid primary key references public.hw_players(id) on delete cascade,
  room_id   uuid not null references public.hw_rooms(id) on delete cascade,
  points    int  not null default 0
);
create index hw_scores_room_idx on public.hw_scores(room_id);

-- ── RLS ──
alter table public.hw_envelopes      enable row level security;
alter table public.hw_envelope_words enable row level security;
alter table public.hw_player_words   enable row level security;
alter table public.hw_clues          enable row level security;
alter table public.hw_guesses        enable row level security;
alter table public.hw_scores         enable row level security;

create policy hw_envelopes_read on public.hw_envelopes for select using (true);
create policy hw_clues_read     on public.hw_clues     for select using (true);
create policy hw_guesses_read   on public.hw_guesses   for select using (is_revealed = true);
create policy hw_scores_read    on public.hw_scores    for select using (true);
-- hw_envelope_words, hw_player_words: 정책 없음 → 직접 접근 차단(RPC 전용)

grant select on public.hw_envelopes to anon, authenticated;
grant select on public.hw_clues     to anon, authenticated;
grant select on public.hw_guesses   to anon, authenticated;
grant select on public.hw_scores    to anon, authenticated;

-- ── 단어 추출 헬퍼: usable 어휘에서 n개 무작위(카테고리 혼합, #5) ──
create or replace function public.hw_draw_words(n int)
returns text[]
language sql security definer set search_path = public
as $$
  select array_agg(word) from (
    select word from public.hw_words where usable order by random() limit n
  ) s
$$;

-- ── 정규화(힌트/추측 비교용) ──
create or replace function public.hw_norm(t text)
returns text language sql immutable as $$ select btrim(t) $$;
