-- 0045 · 히든워드 게임 엔진 재구축 (지시서 §1~§11, Phase 1: 엔진)
-- 핵심 개념 분리:
--   · 라운드(round_no)   = "바퀴". 한 바퀴 = 전원이 각자 1번씩 출제. 방장이 1~5 설정.
--   · 문제(problem_no)   = 전역 출제 단위. total_problems = 참가자수 × 라운드수.
--   · 회차(attempt_no)   = 한 문제의 재도전 단위(최대 3). 회차마다 힌트→추측 1사이클.
--   · 힌트(hint_index)   = 한 회차 내 힌트 제출 차수(최대 10).
-- 변경점(기존 대비):
--   · 봉투 개수 = 참가자 수 (기존 고정 6 → 인원수).            [§4]
--   · 봉투 단어 = 카테고리 혼합(봉투당 5개 서로 다른 카테고리). [§5]
--   · 히든워드 = 라운드마다 각자 1개씩 선택, 재사용 불가.        [§6]
--   · 출제 순서(player_order)는 게임 시작 시 1회 고정·영속.      [§2]
--   · 한 문제 최대 3회차 재도전. 회차별 추측은 독립.             [§2]
--   · 힌트 10개 소진(또는 Phase2 타이머)까지 ≥95 미도달 시 회차 실패.
--   · 점수 지급은 hw_award_scores() 1곳으로 격리(값은 추후 확정).
-- 멱등/안전: 전이 게임테이블만 drop & recreate. 영속 자산(hw_words/임베딩/카테고리/관계/
--   hw_rooms/hw_players/hw_player_secrets)은 건드리지 않는다. 구(舊) state 로 멈춘 방은
--   lobby 로 되돌려 깨진 상태를 방지(닉네임·색·방코드 등 사용자 데이터는 보존).

-- 과거 publication 등록 해제(테이블 drop 전) — 없으면 무시
do $$ begin
  begin alter publication supabase_realtime drop table public.hw_envelopes; exception when others then null; end;
  begin alter publication supabase_realtime drop table public.hw_clues;     exception when others then null; end;
  begin alter publication supabase_realtime drop table public.hw_guesses;   exception when others then null; end;
  begin alter publication supabase_realtime drop table public.hw_scores;    exception when others then null; end;
end $$;

drop table if exists public.hw_guesses       cascade;
drop table if exists public.hw_clues         cascade;
drop table if exists public.hw_player_words  cascade;
drop table if exists public.hw_envelope_words cascade;
drop table if exists public.hw_envelopes     cascade;
drop table if exists public.hw_scores        cascade;

-- ── 봉투(공개): 단어 없음. 번호·선택자만. 내용 비공개(§3) ──
--    봉투 개수 = 참가자 수(≤6)이므로 번호 1~6 범위 유지.
create table public.hw_envelopes (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.hw_rooms(id) on delete cascade,
  envelope_number int  not null check (envelope_number between 1 and 6),
  selected_by     uuid references public.hw_players(id),
  unique (room_id, envelope_number)
);
create index hw_envelopes_room_idx on public.hw_envelopes(room_id);

-- ── 봉투 단어(비공개): RLS deny-all, RPC 전용(§3). 봉투당 5단어 ──
create table public.hw_envelope_words (
  envelope_id uuid primary key references public.hw_envelopes(id) on delete cascade,
  room_id     uuid not null references public.hw_rooms(id) on delete cascade,
  words       text[] not null check (array_length(words,1) = 5)
);

-- ── 히든워드(비공개): 라운드마다 1개. select 정책 없음(§3·§6) ──
--    (player_id, round_no) 유일. 같은 방에서 같은 단어 재사용 금지(§6).
create table public.hw_player_words (
  room_id     uuid not null references public.hw_rooms(id) on delete cascade,
  player_id   uuid not null references public.hw_players(id) on delete cascade,
  round_no    int  not null,
  hidden_word text not null,
  is_revealed boolean not null default false,
  primary key (player_id, round_no)
);
create index hw_player_words_room_idx on public.hw_player_words(room_id);
create unique index hw_player_words_no_reuse on public.hw_player_words(room_id, player_id, hidden_word);

-- ── 힌트(공개): 문제·회차·힌트차수. 유사도 포함(§9·§10) ──
create table public.hw_clues (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.hw_rooms(id) on delete cascade,
  round_no     int  not null,
  problem_no   int  not null,
  attempt_no   int  not null,                 -- 회차(1~3)
  hint_index   int  not null,                 -- 회차 내 힌트 차수(1~10)
  player_id    uuid not null references public.hw_players(id),  -- 출제자
  clue_word    text not null,
  similarity   numeric(5,2) not null,         -- 0.00~100.00 (히든워드↔힌트)
  submitted_at timestamptz not null default now(),
  unique (room_id, problem_no, attempt_no, hint_index)
);
create index hw_clues_room_idx on public.hw_clues(room_id);
-- §7: 한 참가자가 한 방에서 같은 힌트 단어를 재사용 금지(문제·회차·라운드 교차 포함)
create unique index hw_clues_no_reuse on public.hw_clues(room_id, player_id, clue_word);

-- ── 추측(공개 시점 제한): 문제·회차별 독립 ──
create table public.hw_guesses (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.hw_rooms(id) on delete cascade,
  round_no      int  not null,
  problem_no    int  not null,
  attempt_no    int  not null,
  guesser_id    uuid not null references public.hw_players(id),
  clue_giver_id uuid not null references public.hw_players(id),
  guess_word    text not null,
  is_correct    boolean not null,
  is_revealed   boolean not null default false,
  submitted_at  timestamptz not null default now(),
  unique (room_id, problem_no, attempt_no, guesser_id)
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
-- hw_envelope_words, hw_player_words: 정책 없음 → 직접 접근 차단(RPC 전용, §3)

grant select on public.hw_envelopes to anon, authenticated;
grant select on public.hw_clues     to anon, authenticated;
grant select on public.hw_guesses   to anon, authenticated;
grant select on public.hw_scores    to anon, authenticated;

-- ── 봉투 단어 추출: n_env개 봉투 × 5단어, 전역 distinct, 봉투마다 5개 서로 다른 카테고리(§5) ──
--    대표 카테고리(단어의 비'기타' 카테고리 중 무작위 1개)가 봉투 내에서 겹치지 않도록 채운다.
--    → 봉투마다 항상 5개 distinct 카테고리(지시서의 "≥4 distinct, ≤2 same" 를 더 강하게 만족).
--    freq>=500·비'기타' 풀(~17,100개)에서 추출. 게임 시작 1회성이므로 순차 추출로 충분.
create or replace function public.hw_draw_envelopes(n_env int)
returns text[]
language plpgsql security definer set search_path = public as $$
declare
  v_result text[] := '{}';
  v_used   text[] := '{}';
  v_env int; v_i int; v_word text; v_cat text;
begin
  for v_env in 1..n_env loop
    declare v_cats text[] := '{}';
    begin
      for v_i in 1..5 loop
        select w.word, c.category into v_word, v_cat
        from public.hw_words w
        cross join lateral (
          select wc.category
          from public.hw_word_categories wc
          where wc.word = w.word and wc.category <> '기타'
            and not (wc.category = any(v_cats))
          order by random() limit 1
        ) c
        where w.usable and w.freq >= 500
          and not (w.word = any(v_used))
        order by random() limit 1;

        if v_word is null then
          raise exception '게임용 단어가 부족해요(어휘 적재 확인 필요)';
        end if;
        v_used   := v_used   || v_word;
        v_cats   := v_cats   || v_cat;
        v_result := v_result || v_word;
      end loop;
    end;
  end loop;
  return v_result;
end $$;

revoke execute on function public.hw_draw_envelopes(int) from anon, authenticated;

-- ── 정규화(힌트/추측 비교용) ──
create or replace function public.hw_norm(t text)
returns text language sql immutable as $$ select btrim(t) $$;

-- ── 구(舊) state 로 멈춘 방 정리: 전이테이블을 비웠으므로 lobby 로 되돌린다 ──
--    (사용자 데이터인 닉네임/색/방코드는 그대로. 진행 중 게임만 초기화.)
update public.hw_rooms
   set status = 'lobby', state = '{}'::jsonb
 where status is distinct from 'lobby';
