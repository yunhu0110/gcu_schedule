-- 0011 · 메모장(홈) — 글 작성/수정/삭제 + 대댓글(1단계) + 시간. 메신저 형태.
create table if not exists public.memos (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  parent_id  uuid references public.memos (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists memos_parent_idx on public.memos (parent_id, created_at);

drop trigger if exists trg_memos_touch on public.memos;
create trigger trg_memos_touch before insert or update on public.memos
  for each row execute function public.touch_updated_at();

alter table public.memos enable row level security;
drop policy if exists memos_read on public.memos;
create policy memos_read on public.memos for select using (public.is_active_member());
drop policy if exists memos_insert_own on public.memos;
create policy memos_insert_own on public.memos for insert with check (member_id = auth.uid());
drop policy if exists memos_update_own on public.memos;
create policy memos_update_own on public.memos for update using (member_id = auth.uid()) with check (member_id = auth.uid());
drop policy if exists memos_delete_own on public.memos;
create policy memos_delete_own on public.memos for delete using (member_id = auth.uid());
grant select on public.memos to authenticated;
grant insert (member_id, parent_id, body) on public.memos to authenticated;
grant update (body, updated_at) on public.memos to authenticated;
grant delete on public.memos to authenticated;
