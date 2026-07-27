-- 0001 · members + 6인 정원 트리거 + RLS (단순 회원가입, ADR-009)
-- 초대코드/Edge Function 없음. 링크를 아는 6명만 가입한다.
-- 정원은 트리거로, 소유권은 RLS(id = auth.uid())로 강제한다. is_admin/is_active는 클라이언트가 못 건드린다.
-- 참조: 02-DATA-MODEL.md, 01-PRD F8, ADR-009

-- ============================================================
-- members : auth.users 1:1. 표시 정보(닉네임/프사)만 수집.
-- ============================================================
create table if not exists public.members (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null,
  avatar_url text,
  is_active  boolean not null default true,
  is_admin   boolean not null default false,
  joined_at  timestamptz not null default now()
);

-- 6인 하드 제한: 활성 멤버가 이미 6명이면 새 활성 멤버 insert 차단
create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
as $$
begin
  if new.is_active and (select count(*) from public.members where is_active) >= 6 then
    raise exception '정원이 가득 찼습니다 (6명)';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_member_limit on public.members;
create trigger trg_member_limit
  before insert on public.members
  for each row execute function public.enforce_member_limit();

-- ============================================================
-- 헬퍼 (SECURITY DEFINER: members 정책의 자기참조 재귀 방지)
-- ============================================================
create or replace function public.is_active_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.members where id = auth.uid() and is_active);
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.members where id = auth.uid() and is_admin and is_active);
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.members enable row level security;

-- 읽기: 활성 멤버는 전체를 읽는다(단일 그룹)
drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select using (public.is_active_member());

-- 가입: 본인 id로만 members 행 생성. 정원 초과는 trg_member_limit 트리거가 막는다.
-- (앱: supabase.auth.signUp 성공 후 세션이 생긴 상태에서 이 insert를 수행 → 이메일 확인 OFF 필요, SETUP 참조)
drop policy if exists members_insert_self on public.members;
create policy members_insert_self on public.members
  for insert with check (id = auth.uid());

-- 수정: 본인 행만
drop policy if exists members_update_own on public.members;
create policy members_update_own on public.members
  for update using (id = auth.uid()) with check (id = auth.uid());
-- delete 정책 없음 → 삭제 금지(기록 보존, is_active=false로 비활성).

-- ============================================================
-- 컬럼 권한: insert/update 모두 nickname/avatar_url(+insert 시 id)만 허용.
-- is_admin/is_active는 grant에서 제외 → 클라이언트가 절대 못 바꾼다(관리자 지정은 SQL seed로만).
-- ============================================================
grant select on public.members to authenticated;
grant insert (id, nickname, avatar_url) on public.members to authenticated;
grant update (nickname, avatar_url) on public.members to authenticated;
