-- 0028 · 히든 워드 게임 테이블 + 게임 진행 RPC
-- 봉투(hw_envelopes), 히든워드(hw_player_words, 비밀), 힌트(hw_clues), 추측(hw_guesses), 피스(hw_pieces)
-- 게임 상태머신은 hw_rooms.state JSONB 로 관리.
-- 추측(hw_guesses)은 is_revealed=true 가 될 때까지 anon 조회 불가.

-- ============================================================
-- 봉투 (반공개 — 단어 목록은 semi-public)
-- ============================================================
create table if not exists public.hw_envelopes (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.hw_rooms(id) on delete cascade,
  envelope_number int  not null check (envelope_number >= 1),
  words           text[] not null,
  selected_by     uuid references public.hw_players(id),
  unique (room_id, envelope_number)
);
create index if not exists hw_envelopes_room_idx on public.hw_envelopes (room_id);

-- ============================================================
-- 플레이어 히든워드 (비밀 — select 정책 없음)
-- ============================================================
create table if not exists public.hw_player_words (
  player_id    uuid primary key references public.hw_players(id) on delete cascade,
  room_id      uuid not null references public.hw_rooms(id) on delete cascade,
  hidden_word  text not null,
  is_revealed  boolean not null default false
);
create index if not exists hw_player_words_room_idx on public.hw_player_words (room_id);

-- ============================================================
-- 힌트 (공개)
-- ============================================================
create table if not exists public.hw_clues (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.hw_rooms(id) on delete cascade,
  round_index  int  not null,
  player_id    uuid not null references public.hw_players(id),
  clue_word    text not null,
  submitted_at timestamptz not null default now(),
  unique (room_id, round_index, player_id)
);
create index if not exists hw_clues_room_idx on public.hw_clues (room_id);

-- ============================================================
-- 추측 (is_revealed=true 가 될 때까지 비공개)
-- ============================================================
create table if not exists public.hw_guesses (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.hw_rooms(id) on delete cascade,
  round_index      int  not null,
  guesser_id       uuid not null references public.hw_players(id),
  clue_giver_id    uuid not null references public.hw_players(id),
  guess_word       text not null,
  similarity_score numeric(5,2),    -- 0.00~100.00, null = 미계산(pgvector 연동 전 임시)
  is_revealed      boolean not null default false,
  submitted_at     timestamptz not null default now(),
  unique (room_id, round_index, guesser_id)
);
create index if not exists hw_guesses_room_idx on public.hw_guesses (room_id);

-- ============================================================
-- 피스 (점수, 공개)
-- ============================================================
create table if not exists public.hw_pieces (
  player_id     uuid primary key references public.hw_players(id) on delete cascade,
  room_id       uuid not null references public.hw_rooms(id) on delete cascade,
  pieces        int  not null default 3,
  is_eliminated boolean not null default false
);
create index if not exists hw_pieces_room_idx on public.hw_pieces (room_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.hw_envelopes    enable row level security;
alter table public.hw_player_words enable row level security;
alter table public.hw_clues        enable row level security;
alter table public.hw_guesses      enable row level security;
alter table public.hw_pieces       enable row level security;

-- 봉투: anon 전체 읽기 허용
drop policy if exists hw_envelopes_read on public.hw_envelopes;
create policy hw_envelopes_read on public.hw_envelopes for select using (true);

-- 히든워드: select 정책 없음 → 직접 접근 불가 (RPC only)

-- 힌트: 전체 공개
drop policy if exists hw_clues_read on public.hw_clues;
create policy hw_clues_read on public.hw_clues for select using (true);

-- 추측: revealed 된 것만 공개
drop policy if exists hw_guesses_read on public.hw_guesses;
create policy hw_guesses_read on public.hw_guesses for select using (is_revealed = true);

-- 피스: 전체 공개
drop policy if exists hw_pieces_read on public.hw_pieces;
create policy hw_pieces_read on public.hw_pieces for select using (true);

grant select on public.hw_envelopes to anon, authenticated;
grant select on public.hw_clues     to anon, authenticated;
grant select on public.hw_guesses   to anon, authenticated;
grant select on public.hw_pieces    to anon, authenticated;
-- hw_player_words: grant 없음

-- ============================================================
-- 단어 풀 헬퍼 (10 테마 × 5 단어)
-- ============================================================
create or replace function public.hw_word_pool(p_index int)
returns text[]
language sql immutable
as $$
  select case p_index
    when 1  then array['강','바다','산','하늘','숲']
    when 2  then array['사랑','우정','행복','슬픔','분노']
    when 3  then array['고양이','강아지','말','소','새']
    when 4  then array['봄','여름','가을','겨울','장마']
    when 5  then array['피아노','기타','북','피리','나팔']
    when 6  then array['빨강','파랑','초록','노랑','흰색']
    when 7  then array['밥','떡','국수','빵','과자']
    when 8  then array['집','학교','시장','공원','병원']
    when 9  then array['아침','낮','저녁','밤','새벽']
    when 10 then array['엄마','아빠','형','누나','동생']
    else         array['사과','배','포도','딸기','수박']
  end
$$;

-- ============================================================
-- RPC: 게임 시작 (방장만)
-- hw_rooms.state = {
--   phase: 'envelope_selection' | 'hidden_word_selection' | 'round' | 'game_over',
--   player_order: uuid[],
--   round_index: int,     -- 0-based, clue_giver = player_order[round_index % len]
--   round_phase: 'clue' | 'guess'
-- }
-- ============================================================
create or replace function public.hw_start_game(p_token uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pid    uuid;
  v_player hw_players;
  v_room   hw_rooms;
  v_count  int;
  v_pids   uuid[];
  v_state  jsonb;
  v_i      int;
  v_pool   int[];
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;

  select * into v_player from hw_players where id = v_pid;
  if not v_player.is_host then raise exception '방장만 게임을 시작할 수 있어요'; end if;

  select * into v_room from hw_rooms where id = v_player.room_id;
  if v_room.status <> 'lobby' then raise exception '이미 시작된 게임이에요'; end if;

  select count(*)::int into v_count from hw_players where room_id = v_room.id;
  if v_count < 2 then raise exception '최소 2명이 필요해요'; end if;

  -- 단어 풀 인덱스 랜덤 선택 (10개 중 v_count개, 중복 없음)
  select array_agg(n) into v_pool
    from (select n from generate_series(1, 10) n order by random() limit v_count) sub;

  -- 봉투 생성
  for v_i in 1..v_count loop
    insert into hw_envelopes (room_id, envelope_number, words)
    values (v_room.id, v_i, hw_word_pool(v_pool[v_i]));
  end loop;

  -- 플레이어 순서 랜덤 셔플
  select array_agg(p.id) into v_pids
    from (select id from hw_players where room_id = v_room.id order by random()) p;

  -- 피스 초기화
  insert into hw_pieces (player_id, room_id, pieces)
  select id, v_room.id, 3 from hw_players where room_id = v_room.id
  on conflict (player_id) do nothing;

  v_state := jsonb_build_object(
    'phase', 'envelope_selection',
    'player_order', to_jsonb(v_pids),
    'round_index', 0,
    'round_phase', 'clue'
  );

  update hw_rooms set status = 'playing', state = v_state where id = v_room.id;

  return json_build_object('ok', true, 'player_count', v_count);
end $$;

-- ============================================================
-- RPC: 봉투 선택
-- ============================================================
create or replace function public.hw_select_envelope(p_token uuid, p_number int)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pid          uuid;
  v_player       hw_players;
  v_room         hw_rooms;
  v_all_selected bool;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;

  select * into v_player from hw_players where id = v_pid;
  select * into v_room   from hw_rooms   where id = v_player.room_id;

  if (v_room.state->>'phase') <> 'envelope_selection' then
    raise exception '봉투 선택 단계가 아니에요';
  end if;
  if not exists (select 1 from hw_envelopes where room_id = v_room.id and envelope_number = p_number) then
    raise exception '봉투를 찾을 수 없어요';
  end if;
  if exists (select 1 from hw_envelopes where room_id = v_room.id and selected_by = v_player.id) then
    raise exception '이미 봉투를 선택했어요';
  end if;
  if exists (select 1 from hw_envelopes where room_id = v_room.id and envelope_number = p_number and selected_by is not null) then
    raise exception '이미 선택된 봉투에요';
  end if;

  update hw_envelopes set selected_by = v_player.id
    where room_id = v_room.id and envelope_number = p_number;

  -- 모두 선택 완료 → hidden_word_selection 으로
  select not exists (
    select 1 from hw_envelopes where room_id = v_room.id and selected_by is null
  ) into v_all_selected;

  if v_all_selected then
    update hw_rooms set state = jsonb_set(state, '{phase}', '"hidden_word_selection"')
      where id = v_room.id;
  end if;

  return json_build_object('ok', true, 'phase_advanced', v_all_selected);
end $$;

-- ============================================================
-- RPC: 히든워드 선택 (본인 봉투 단어 중)
-- ============================================================
create or replace function public.hw_select_hidden_word(p_token uuid, p_word text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pid      uuid;
  v_player   hw_players;
  v_room     hw_rooms;
  v_envelope hw_envelopes;
  v_pcount   int;
  v_wcount   int;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;

  select * into v_player from hw_players where id = v_pid;
  select * into v_room   from hw_rooms   where id = v_player.room_id;

  if (v_room.state->>'phase') <> 'hidden_word_selection' then
    raise exception '히든워드 선택 단계가 아니에요';
  end if;
  if exists (select 1 from hw_player_words where player_id = v_player.id) then
    raise exception '이미 히든워드를 선택했어요';
  end if;

  select * into v_envelope from hw_envelopes
    where room_id = v_room.id and selected_by = v_player.id;
  if not found then raise exception '선택한 봉투가 없어요'; end if;
  if not (trim(p_word) = any(v_envelope.words)) then
    raise exception '봉투에 없는 단어에요';
  end if;

  insert into hw_player_words (player_id, room_id, hidden_word)
  values (v_player.id, v_room.id, trim(p_word));

  -- 모두 선택 → round 시작
  select count(*)::int into v_pcount from hw_players where room_id = v_room.id;
  select count(*)::int into v_wcount from hw_player_words where room_id = v_room.id;

  if v_wcount >= v_pcount then
    update hw_rooms set state = jsonb_set(state, '{phase}', '"round"')
      where id = v_room.id;
  end if;

  return json_build_object('ok', true, 'phase_advanced', (v_wcount >= v_pcount));
end $$;

-- ============================================================
-- RPC: 내 히든워드 조회 (본인 토큰만)
-- ============================================================
create or replace function public.hw_get_my_word(p_token uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_pid  uuid;
  v_word text;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select hidden_word into v_word from hw_player_words where player_id = v_pid;
  return v_word;
end $$;

-- ============================================================
-- RPC: 힌트 제출 (현재 출제자만)
-- ============================================================
create or replace function public.hw_submit_clue(p_token uuid, p_clue text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pid           uuid;
  v_player        hw_players;
  v_room          hw_rooms;
  v_state         jsonb;
  v_order         uuid[];
  v_round_index   int;
  v_clue_giver_id uuid;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;

  select * into v_player from hw_players where id = v_pid;
  select * into v_room   from hw_rooms   where id = v_player.room_id;
  v_state := v_room.state;

  if (v_state->>'phase') <> 'round' then raise exception '라운드 진행 중이 아니에요'; end if;
  if (v_state->>'round_phase') <> 'clue'  then raise exception '힌트 제출 단계가 아니에요'; end if;
  if coalesce(trim(p_clue),'') = ''        then raise exception '힌트를 입력해주세요'; end if;

  select array_agg(x::uuid) into v_order
    from jsonb_array_elements_text(v_state->'player_order') x;
  v_round_index   := (v_state->>'round_index')::int;
  v_clue_giver_id := v_order[(v_round_index % array_length(v_order, 1)) + 1];

  if v_clue_giver_id <> v_player.id then raise exception '지금은 출제자가 아니에요'; end if;

  insert into hw_clues (room_id, round_index, player_id, clue_word)
  values (v_room.id, v_round_index, v_player.id, trim(p_clue));

  update hw_rooms set state = jsonb_set(v_state, '{round_phase}', '"guess"')
    where id = v_room.id;

  return json_build_object('ok', true);
end $$;

-- ============================================================
-- RPC: 추측 제출 (출제자 제외 전원)
-- ============================================================
create or replace function public.hw_submit_guess(p_token uuid, p_guess text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pid           uuid;
  v_player        hw_players;
  v_room          hw_rooms;
  v_state         jsonb;
  v_order         uuid[];
  v_round_index   int;
  v_clue_giver_id uuid;
  v_pcount        int;
  v_gcount        int;
  v_new_state     jsonb;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;

  select * into v_player from hw_players where id = v_pid;
  select * into v_room   from hw_rooms   where id = v_player.room_id;
  v_state := v_room.state;

  if (v_state->>'phase') <> 'round'  then raise exception '라운드 진행 중이 아니에요'; end if;
  if (v_state->>'round_phase') <> 'guess' then raise exception '추측 단계가 아니에요'; end if;
  if coalesce(trim(p_guess),'') = ''       then raise exception '추측 단어를 입력해주세요'; end if;

  select array_agg(x::uuid) into v_order
    from jsonb_array_elements_text(v_state->'player_order') x;
  v_round_index   := (v_state->>'round_index')::int;
  v_clue_giver_id := v_order[(v_round_index % array_length(v_order, 1)) + 1];

  if v_clue_giver_id = v_player.id then raise exception '출제자는 추측할 수 없어요'; end if;
  if exists (select 1 from hw_guesses
    where room_id = v_room.id and round_index = v_round_index and guesser_id = v_player.id)
  then raise exception '이미 추측을 제출했어요'; end if;

  -- similarity_score: TODO pgvector 연동 전까지 null
  insert into hw_guesses (room_id, round_index, guesser_id, clue_giver_id, guess_word)
  values (v_room.id, v_round_index, v_player.id, v_clue_giver_id, trim(p_guess));

  -- 출제자 제외 전원이 제출했는지 확인
  select count(*)::int into v_pcount from hw_players
    where room_id = v_room.id and id <> v_clue_giver_id;
  select count(*)::int into v_gcount from hw_guesses
    where room_id = v_room.id and round_index = v_round_index;

  if v_gcount >= v_pcount then
    -- 추측 공개 + 다음 라운드로
    update hw_guesses set is_revealed = true
      where room_id = v_room.id and round_index = v_round_index;

    v_new_state := v_state
      || jsonb_build_object('round_index', v_round_index + 1, 'round_phase', 'clue');
    update hw_rooms set state = v_new_state where id = v_room.id;
  end if;

  return json_build_object('ok', true, 'all_guessed', (v_gcount >= v_pcount));
end $$;

-- ============================================================
-- RPC: 게임 종료 (방장만)
-- ============================================================
create or replace function public.hw_end_game(p_token uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_pid    uuid;
  v_player hw_players;
  v_room   hw_rooms;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;

  select * into v_player from hw_players where id = v_pid;
  if not v_player.is_host then raise exception '방장만 게임을 종료할 수 있어요'; end if;

  select * into v_room from hw_rooms where id = v_player.room_id;
  if v_room.status <> 'playing' then raise exception '진행 중인 게임이 없어요'; end if;

  -- 모든 히든워드 공개
  update hw_player_words set is_revealed = true where room_id = v_room.id;

  update hw_rooms
    set status = 'done',
        state  = jsonb_set(state, '{phase}', '"game_over"')
    where id = v_room.id;

  return json_build_object('ok', true);
end $$;

-- grant execute
grant execute on function public.hw_start_game(uuid)             to anon, authenticated;
grant execute on function public.hw_select_envelope(uuid, int)   to anon, authenticated;
grant execute on function public.hw_select_hidden_word(uuid, text) to anon, authenticated;
grant execute on function public.hw_get_my_word(uuid)            to anon, authenticated;
grant execute on function public.hw_submit_clue(uuid, text)      to anon, authenticated;
grant execute on function public.hw_submit_guess(uuid, text)     to anon, authenticated;
grant execute on function public.hw_end_game(uuid)               to anon, authenticated;

-- Realtime
alter publication supabase_realtime add table public.hw_envelopes;
alter publication supabase_realtime add table public.hw_clues;
alter publication supabase_realtime add table public.hw_guesses;
alter publication supabase_realtime add table public.hw_pieces;
