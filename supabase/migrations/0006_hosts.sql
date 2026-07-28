-- 0006 · hosts(월별 담당자/모임장). 참조: 02-DATA-MODEL §hosts.
-- (year, month) 유니크. 담당자 지정(로테이션)은 관리자만. 읽기는 활성 멤버 전체.

create table if not exists public.hosts (
  id              uuid primary key default gen_random_uuid(),
  year            int not null,
  month           int not null,
  member_id       uuid not null references public.members (id),
  cover_message   text,
  theme_color     text,
  cover_image_url text,
  unique (year, month)
);

alter table public.hosts enable row level security;

drop policy if exists hosts_read on public.hosts;
create policy hosts_read on public.hosts
  for select using (public.is_active_member());

-- 담당자 지정/변경은 관리자만 (표지 필드 편집 권한 세분화는 이후 마일스톤)
drop policy if exists hosts_admin_write on public.hosts;
create policy hosts_admin_write on public.hosts
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.hosts to authenticated;
grant insert (year, month, member_id, cover_message, theme_color, cover_image_url) on public.hosts to authenticated;
grant update (member_id, cover_message, theme_color, cover_image_url) on public.hosts to authenticated;
