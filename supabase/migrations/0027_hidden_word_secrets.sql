-- 0027 · 히든 워드 보안 수정 — 참가자 secret_token을 '비공개 전용 테이블'로 분리.
-- 이유: 0026에서 hw_players.secret_token 을 컬럼 grant로 숨기려 했으나 anon 직접 조회/realtime 페이로드로
--       노출됨. 토큰은 realtime 미발행 + RLS deny-all(select 정책 없음) 테이블에 두고 RPC(정의자 권한)로만 접근.

-- 깨끗이 시작(0026 검증용 테스트 방 제거 — 전부 임시 데이터).
delete from public.hw_rooms;

-- 비공개 토큰 테이블
create table if not exists public.hw_player_secrets (
  player_id uuid primary key references public.hw_players (id) on delete cascade,
  token     uuid not null default gen_random_uuid()
);
alter table public.hw_player_secrets enable row level security;
-- select 정책 없음 → anon/authenticated 직접 접근 불가(RPC SECURITY DEFINER만 접근). grant도 주지 않음.
revoke all on public.hw_player_secrets from anon, authenticated;

-- RPC 재정의: 토큰은 hw_player_secrets 에 저장/검증.
create or replace function public.hw_create_room(
  p_name text, p_max int, p_nickname text, p_color text, p_host_mode boolean
) returns json
language plpgsql security definer set search_path = public
as $$
declare v_room public.hw_rooms; v_player public.hw_players; v_token uuid;
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

  insert into public.hw_player_secrets (player_id) values (v_player.id) returning token into v_token;

  return json_build_object('room_id', v_room.id, 'code', v_room.code,
    'player_id', v_player.id, 'token', v_token, 'is_host', true);
end $$;

create or replace function public.hw_join_room(
  p_code text, p_nickname text, p_color text
) returns json
language plpgsql security definer set search_path = public
as $$
declare v_room public.hw_rooms; v_count int; v_player public.hw_players; v_token uuid;
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
  values (v_room.id, trim(p_nickname), p_color) returning * into v_player;
  insert into public.hw_player_secrets (player_id) values (v_player.id) returning token into v_token;

  return json_build_object('room_id', v_room.id, 'code', v_room.code,
    'player_id', v_player.id, 'token', v_token, 'is_host', false);
end $$;

create or replace function public.hw_set_ready(p_token uuid, p_ready boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_pid uuid;
begin
  select player_id into v_pid from public.hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  update public.hw_players set is_ready = coalesce(p_ready, false), last_seen = now() where id = v_pid;
end $$;

-- 이제 토큰 컬럼 제거(참가자 테이블은 공개 안전 컬럼만 남김).
alter table public.hw_players drop column if exists secret_token;
