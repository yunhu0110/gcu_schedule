-- 0016 · 게임(보드게임) — 운영자가 직접 만든 게임을 등록해 카드로 나열. 누르면 웹 링크로 이동.
-- 등록은 운영자(is_admin)만. 일반 멤버는 앱에서 '요청하기'로 관리자에게 알림을 보낸다(별도 테이블 없음).
-- 썸네일은 covers 버킷 재사용.
create table if not exists public.games (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members (id) on delete cascade,
  title         text not null,
  url           text not null,
  description   text,
  genre         text,
  thumbnail_url text,
  created_at    timestamptz not null default now()
);
create index if not exists games_created_idx on public.games (created_at desc);

alter table public.games enable row level security;
-- 읽기: 활성 멤버 전원
drop policy if exists games_read on public.games;
create policy games_read on public.games for select using (public.is_active_member());
-- 쓰기/수정/삭제: 운영자만
drop policy if exists games_insert_admin on public.games;
create policy games_insert_admin on public.games for insert with check (public.is_admin());
drop policy if exists games_update_admin on public.games;
create policy games_update_admin on public.games for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists games_delete_admin on public.games;
create policy games_delete_admin on public.games for delete using (public.is_admin());

grant select on public.games to authenticated;
grant insert (member_id, title, url, description, genre, thumbnail_url) on public.games to authenticated;
grant update (title, url, description, genre, thumbnail_url) on public.games to authenticated;
grant delete on public.games to authenticated;
