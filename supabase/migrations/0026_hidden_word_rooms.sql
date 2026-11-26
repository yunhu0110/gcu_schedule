-- 0026 · 히든 워드 게임 — 방/참가자(로비) 기반. 기존 GCU 데이터와 무관한 hw_ 접두사 테이블.
-- 게스트 플레이(로그인 없음): 참가자 식별은 join 시 발급되는 secret_token(클라 localStorage 보관)으로.
-- 공개 게임 상태(방/참가자)는 anon 읽기 허용. 쓰기는 SECURITY DEFINER RPC로만(검증).
-- 비밀 데이터(히든워드 등)는 이후 마이그레이션에서 token 검증 RPC로만 접근하도록 추가한다.

-- ============================================================
-- 방
-- ============================================================
create table if not exists public.hw_rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  max_players   int  not null check (max_players between 2 and 10),
  host_mode     boolean not null default false,       -- PC 대시보드 사용 여부
  status        text not null default 'lobby' check (status in ('lobby','playing','done')),
  host_player_id uuid,                                 -- 방장 참가자(hw_players)
  settings      jsonb not null default '{}'::jsonb,    -- 미확정 규칙 설정값(피스 등)
  state         jsonb not null default '{}'::jsonb,    -- 공개 게임 상태(라운드/차수/현재출제자/phaseEndsAt 등)
  created_at    timestamptz not null default now()
);
create index if not exists hw_rooms_code_idx on public.hw_rooms (code);

-- ============================================================
-- 참가자
-- ============================================================
create table if not exists public.hw_players (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.hw_rooms (id) on delete cascade,
  nickname      text not null,
  color         text not null,
  is_host       boolean not null default false,
  is_ready      boolean not null default false,
  order_index   int,                                   -- 출제 순서(추첨 결과)
  online        boolean not null default true,
  last_seen     timestamptz not null default now(),
  joined_at     timestamptz not null default now(),
  secret_token  uuid not null default gen_random_uuid(), -- 본인 식별 토큰(공개 금지)
  unique (room_id, nickname),
  unique (room_id, color)
);
create index if not exists hw_players_room_idx on public.hw_players (room_id);

-- ============================================================
-- RLS — 공개 상태는 anon 읽기. secret_token은 공개 쿼리에서 제외(컬럼 grant로 제한).
-- ============================================================
alter table public.hw_rooms   enable row level security;
alter table public.hw_players enable row level security;

drop policy if exists hw_rooms_read on public.hw_rooms;
create policy hw_rooms_read on public.hw_rooms for select using (true);

drop policy if exists hw_players_read on public.hw_players;
create policy hw_players_read on public.hw_players for select using (true);

-- 읽기 컬럼 권한: secret_token 은 제외하고 grant → 공개 조회로 토큰이 새지 않음.
grant select (id, room_id, nickname, color, is_host, is_ready, order_index, online, last_seen, joined_at)
  on public.hw_players to anon, authenticated;
grant select on public.hw_rooms to anon, authenticated;
-- 직접 insert/update/delete 권한은 주지 않는다(모두 RPC 경유).

-- ============================================================
-- 방 코드 생성(혼동 문자 제외)
-- ============================================================
create or replace function public.hw_gen_code()
returns text language plpgsql as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from public.hw_rooms where code = c);
  end loop;
  return c;
end $$;

-- ============================================================
-- RPC: 방 생성 (방장 = 참가자)
-- ============================================================
create or replace function public.hw_create_room(
  p_name text, p_max int, p_nickname text, p_color text, p_host_mode boolean
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.hw_rooms; v_player public.hw_players;
begin
  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_nickname),'') = '' then
    raise exception '방 이름과 닉네임을 입력해주세요';
  end if;
  if p_max < 2 or p_max > 10 then raise exception '참가 인원은 2~10명입니다'; end if;

  insert into public.hw_rooms (code, name, max_players, host_mode)
  values (public.hw_gen_code(), trim(p_name), p_max, coalesce(p_host_mode, false))
  returning * into v_room;

  insert into public.hw_players (room_id, nickname, color, is_host)
  values (v_room.id, trim(p_nickname), p_color, true)
  returning * into v_player;

  update public.hw_rooms set host_player_id = v_player.id where id = v_room.id;

  return json_build_object(
    'room_id', v_room.id, 'code', v_room.code,
    'player_id', v_player.id, 'token', v_player.secret_token, 'is_host', true
  );
end $$;

-- ============================================================
-- RPC: 방 입장 (코드/닉네임/색상 검증)
-- ============================================================
create or replace function public.hw_join_room(
  p_code text, p_nickname text, p_color text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.hw_rooms; v_count int; v_player public.hw_players;
begin
  select * into v_room from public.hw_rooms where code = upper(trim(p_code));
  if not found then raise exception '방을 찾을 수 없어요'; end if;
  if v_room.status <> 'lobby' then raise exception '이미 시작된 게임이에요'; end if;

  if coalesce(trim(p_nickname),'') = '' then raise exception '닉네임을 입력해주세요'; end if;
  if exists (select 1 from public.hw_players where room_id = v_room.id and nickname = trim(p_nickname)) then
    raise exception '이미 사용 중인 닉네임이에요';
  end if;
  if exists (select 1 from public.hw_players where room_id = v_room.id and color = p_color) then
    raise exception '이미 선택된 색상이에요';
  end if;

  select count(*) into v_count from public.hw_players where room_id = v_room.id;
  if v_count >= v_room.max_players then raise exception '방이 가득 찼어요'; end if;

  insert into public.hw_players (room_id, nickname, color)
  values (v_room.id, trim(p_nickname), p_color)
  returning * into v_player;

  return json_build_object(
    'room_id', v_room.id, 'code', v_room.code,
    'player_id', v_player.id, 'token', v_player.secret_token, 'is_host', false
  );
end $$;

-- ============================================================
-- RPC: 준비 상태 토글 (토큰 검증)
-- ============================================================
create or replace function public.hw_set_ready(p_token uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.hw_players set is_ready = coalesce(p_ready, false), last_seen = now()
   where secret_token = p_token;
  if not found then raise exception '세션을 찾을 수 없어요'; end if;
end $$;

grant execute on function public.hw_create_room(text, int, text, text, boolean) to anon, authenticated;
grant execute on function public.hw_join_room(text, text, text) to anon, authenticated;
grant execute on function public.hw_set_ready(uuid, boolean) to anon, authenticated;

-- ============================================================
-- Realtime — 로비 동기화(방/참가자 변경 브로드캐스트)
-- ============================================================
alter publication supabase_realtime add table public.hw_rooms;
alter publication supabase_realtime add table public.hw_players;
