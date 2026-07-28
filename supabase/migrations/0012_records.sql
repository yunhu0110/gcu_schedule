-- 0012 · 기록 개편 — 담당자 제한 없이 누구나 표지(사진/동영상+글)를 올리고 월별로 정리.
-- 커버 이미지/동영상은 covers 버킷 재사용. 코멘트는 record_comments.
create table if not exists public.records (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  year       int not null,
  month      int not null,
  media_url  text,
  body       text,
  created_at timestamptz not null default now()
);
create index if not exists records_ym_idx on public.records (year desc, month desc, created_at desc);

alter table public.records enable row level security;
drop policy if exists records_read on public.records;
create policy records_read on public.records for select using (public.is_active_member());
drop policy if exists records_insert_own on public.records;
create policy records_insert_own on public.records for insert with check (member_id = auth.uid());
drop policy if exists records_update_own on public.records;
create policy records_update_own on public.records for update using (member_id = auth.uid()) with check (member_id = auth.uid());
drop policy if exists records_delete_own on public.records;
create policy records_delete_own on public.records for delete using (member_id = auth.uid());
grant select on public.records to authenticated;
grant insert (member_id, year, month, media_url, body) on public.records to authenticated;
grant update (media_url, body) on public.records to authenticated;
grant delete on public.records to authenticated;

create table if not exists public.record_comments (
  id         uuid primary key default gen_random_uuid(),
  record_id  uuid not null references public.records (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists record_comments_idx on public.record_comments (record_id, created_at);
alter table public.record_comments enable row level security;
drop policy if exists rc_read on public.record_comments;
create policy rc_read on public.record_comments for select using (public.is_active_member());
drop policy if exists rc_insert_own on public.record_comments;
create policy rc_insert_own on public.record_comments for insert with check (member_id = auth.uid());
drop policy if exists rc_delete_own on public.record_comments;
create policy rc_delete_own on public.record_comments for delete using (member_id = auth.uid());
grant select on public.record_comments to authenticated;
grant insert (record_id, member_id, body) on public.record_comments to authenticated;
grant delete on public.record_comments to authenticated;
