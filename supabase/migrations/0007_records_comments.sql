-- 0007 · 기록(월별 표지 피드) — 담당자 커버 편집 + 댓글 + 커버 이미지 버킷
-- 표지 콘텐츠는 hosts.cover_image_url / cover_message 를 그대로 쓴다(월별 1장+글).
-- 댓글은 hosts(표지) 한 개를 대상으로 활성 멤버 누구나 작성.

-- 1) 담당자(그 달 host)가 자기 달 표지 필드를 수정할 수 있게 (관리자 write는 0006 유지)
drop policy if exists hosts_host_update on public.hosts;
create policy hosts_host_update on public.hosts
  for update using (member_id = auth.uid()) with check (member_id = auth.uid());

-- 2) comments
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references public.hosts (id) on delete cascade,
  member_id  uuid not null references public.members (id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_host_idx on public.comments (host_id, created_at);

alter table public.comments enable row level security;

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments
  for select using (public.is_active_member());

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
  for insert with check (member_id = auth.uid());

-- 본인 댓글 삭제 허용(soft-delete 대신 단순 삭제 — 기록 앱이지만 댓글은 가벼우니)
drop policy if exists comments_delete_own on public.comments;
create policy comments_delete_own on public.comments
  for delete using (member_id = auth.uid());

grant select on public.comments to authenticated;
grant insert (host_id, member_id, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

-- 3) 커버 이미지 버킷 (본인 폴더만 쓰기, 공개 읽기)
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists covers_read on storage.objects;
create policy covers_read on storage.objects for select using (bucket_id = 'covers');

drop policy if exists covers_write_own on storage.objects;
create policy covers_write_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists covers_update_own on storage.objects;
create policy covers_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
