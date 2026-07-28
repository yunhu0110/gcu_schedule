-- 0008 · 알림(notifications) + 아이디어 창고(ideas) + 날짜 투표(date_polls/options/votes)
-- 6인 신뢰 그룹이라 알림 fan-out은 클라이언트가 actor=auth.uid()로 직접 insert.

-- ============ notifications ============
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.members (id) on delete cascade,
  actor_id     uuid references public.members (id),
  type         text not null,   -- availability_set | vote_started | vote_cast | date_confirmed | idea_added
  body         text not null,   -- 사람이 읽는 문구(앱에서 생성)
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select using (recipient_id = auth.uid());
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check (actor_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
grant select on public.notifications to authenticated;
grant insert (recipient_id, actor_id, type, body) on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ============ ideas (아이디어 창고 / 가보고싶은 곳) ============
create table if not exists public.ideas (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.ideas enable row level security;
drop policy if exists ideas_read on public.ideas;
create policy ideas_read on public.ideas for select using (public.is_active_member());
drop policy if exists ideas_insert_own on public.ideas;
create policy ideas_insert_own on public.ideas for insert with check (member_id = auth.uid());
drop policy if exists ideas_delete_own on public.ideas;
create policy ideas_delete_own on public.ideas for delete using (member_id = auth.uid());
grant select on public.ideas to authenticated;
grant insert (member_id, body) on public.ideas to authenticated;
grant delete on public.ideas to authenticated;

-- ============ date_polls (그 달 담당자가 진행하는 날짜 투표) ============
create table if not exists public.date_polls (
  id             uuid primary key default gen_random_uuid(),
  year           int not null,
  month          int not null,
  host_id        uuid not null references public.members (id),
  status         text not null default 'open',  -- open | closed
  deadline       date,
  confirmed_date date,
  created_at     timestamptz not null default now()
);
create index if not exists date_polls_ym_idx on public.date_polls (year, month);
alter table public.date_polls enable row level security;
drop policy if exists date_polls_read on public.date_polls;
create policy date_polls_read on public.date_polls for select using (public.is_active_member());
drop policy if exists date_polls_host_write on public.date_polls;
create policy date_polls_host_write on public.date_polls for all
  using (host_id = auth.uid() or public.is_admin())
  with check (host_id = auth.uid() or public.is_admin());
grant select on public.date_polls to authenticated;
grant insert (year, month, host_id, status, deadline) on public.date_polls to authenticated;
grant update (status, deadline, confirmed_date) on public.date_polls to authenticated;

create table if not exists public.date_poll_options (
  id      uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.date_polls (id) on delete cascade,
  date    date not null,
  unique (poll_id, date)
);
alter table public.date_poll_options enable row level security;
drop policy if exists dpo_read on public.date_poll_options;
create policy dpo_read on public.date_poll_options for select using (public.is_active_member());
drop policy if exists dpo_write on public.date_poll_options;
create policy dpo_write on public.date_poll_options for all
  using (exists (select 1 from public.date_polls p where p.id = poll_id and (p.host_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.date_polls p where p.id = poll_id and (p.host_id = auth.uid() or public.is_admin())));
grant select on public.date_poll_options to authenticated;
grant insert (poll_id, date) on public.date_poll_options to authenticated;
grant delete on public.date_poll_options to authenticated;

create table if not exists public.date_poll_votes (
  id        uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.date_poll_options (id) on delete cascade,
  member_id uuid not null references public.members (id),
  unique (option_id, member_id)
);
alter table public.date_poll_votes enable row level security;
drop policy if exists dpv_read on public.date_poll_votes;
create policy dpv_read on public.date_poll_votes for select using (public.is_active_member());
drop policy if exists dpv_insert_own on public.date_poll_votes;
create policy dpv_insert_own on public.date_poll_votes for insert with check (member_id = auth.uid());
drop policy if exists dpv_delete_own on public.date_poll_votes;
create policy dpv_delete_own on public.date_poll_votes for delete using (member_id = auth.uid());
grant select on public.date_poll_votes to authenticated;
grant insert (option_id, member_id) on public.date_poll_votes to authenticated;
grant delete on public.date_poll_votes to authenticated;
