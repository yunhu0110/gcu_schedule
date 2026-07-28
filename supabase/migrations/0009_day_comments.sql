-- 0009 · 날짜 코멘트 — 달력에서 특정 날짜에 다는 코멘트(맨션 지원은 앱에서 파싱).
create table if not exists public.day_comments (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  member_id  uuid not null references public.members (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists day_comments_date_idx on public.day_comments (date, created_at);

alter table public.day_comments enable row level security;
drop policy if exists day_comments_read on public.day_comments;
create policy day_comments_read on public.day_comments for select using (public.is_active_member());
drop policy if exists day_comments_insert_own on public.day_comments;
create policy day_comments_insert_own on public.day_comments for insert with check (member_id = auth.uid());
drop policy if exists day_comments_delete_own on public.day_comments;
create policy day_comments_delete_own on public.day_comments for delete using (member_id = auth.uid());
grant select on public.day_comments to authenticated;
grant insert (date, member_id, body) on public.day_comments to authenticated;
grant delete on public.day_comments to authenticated;
