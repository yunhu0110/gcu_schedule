-- 0003 · 가용성(availabilities) — 달력 일정 입력의 저장소
-- 참조: 02-DATA-MODEL.md §availabilities, 05-SCHEDULING-LOGIC.md
-- 상태는 available/unavailable/maybe 3종. 행이 없으면 '미입력'(maybe와 다르게 취급).
-- 날짜는 date 타입(문자열 YYYY-MM-DD). 소유권은 RLS(member_id = auth.uid()), 읽기는 활성 멤버 전체.

-- 1) 상태 enum
do $$ begin
  create type public.availability_status as enum ('available', 'unavailable', 'maybe');
exception when duplicate_object then null; end $$;

-- 2) 테이블
create table if not exists public.availabilities (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  date       date not null,
  status     public.availability_status not null,
  note       text,
  updated_at timestamptz not null default now(),
  unique (member_id, date)
);
create index if not exists availabilities_date_idx on public.availabilities (date);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_avail_touch on public.availabilities;
create trigger trg_avail_touch
  before insert or update on public.availabilities
  for each row execute function public.touch_updated_at();

-- 3) RLS
alter table public.availabilities enable row level security;

-- 읽기: 활성 멤버는 전체를 읽는다(달력 집계용)
drop policy if exists avail_read on public.availabilities;
create policy avail_read on public.availabilities
  for select using (public.is_active_member());

-- 쓰기: 본인 것만 (insert/update/delete)
drop policy if exists avail_write_own on public.availabilities;
create policy avail_write_own on public.availabilities
  for all using (member_id = auth.uid()) with check (member_id = auth.uid());

grant select on public.availabilities to authenticated;
grant insert (member_id, date, status, note) on public.availabilities to authenticated;
-- upsert(ON CONFLICT DO UPDATE)는 payload 전 컬럼을 SET하므로 update 권한도 동일 컬럼에 필요.
-- 남의 행 변경은 RLS(member_id = auth.uid())가 막는다(컬럼권한과 별개).
grant update (member_id, date, status, note) on public.availabilities to authenticated;
grant delete on public.availabilities to authenticated;

-- 4) 월별 집계 함수 — 앱은 달력에서 이 함수 하나만 호출한다(02-DATA-MODEL §헬퍼).
--    합은 항상 활성 멤버 수. missing = 활성멤버수 - (해당일 입력 행 수). all_available = available == 활성멤버수.
create or replace function public.availability_summary(p_from date, p_to date)
returns table (
  d date,
  available_count int,
  unavailable_count int,
  maybe_count int,
  missing_count int,
  all_available boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with active as (
    select count(*)::int as n from public.members where is_active
  ),
  days as (
    select generate_series(p_from, p_to, interval '1 day')::date as d
  )
  select
    days.d,
    coalesce(sum((a.status = 'available')::int), 0)::int,
    coalesce(sum((a.status = 'unavailable')::int), 0)::int,
    coalesce(sum((a.status = 'maybe')::int), 0)::int,
    (active.n - coalesce(count(a.*), 0))::int,
    (coalesce(sum((a.status = 'available')::int), 0) = active.n and active.n > 0)
  from days
  cross join active
  left join public.availabilities a on a.date = days.d
  group by days.d, active.n
  order by days.d;
$$;

grant execute on function public.availability_summary(date, date) to authenticated;

-- 5) 실시간: 다른 멤버 입력이 들어오면 달력 게이지를 갱신(05 §7)
do $$ begin
  alter publication supabase_realtime add table public.availabilities;
exception when duplicate_object then null; when undefined_object then null; end $$;
