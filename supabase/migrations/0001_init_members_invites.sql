-- 0001 · members / invite_codes + 6인 정원 트리거 + RLS
-- 원칙: 모든 테이블 RLS 활성화 후 정책 작성. 삭제 대신 비활성화(기록 보존).
-- 참조: 02-DATA-MODEL.md, 01-PRD F8

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
-- invite_codes : 관리자 발급 1회용 코드. join Edge Function이 검증/소모.
-- ============================================================
create table if not exists public.invite_codes (
  code       text primary key,
  created_by uuid references public.members (id),
  used_by    uuid references public.members (id),
  used_at    timestamptz,
  expires_at timestamptz
);

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
alter table public.invite_codes enable row level security;

-- members 읽기: 활성 멤버는 전체를 읽는다(단일 그룹)
drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select using (public.is_active_member());

-- members 쓰기: 본인 행만. 단, 컬럼 권한으로 nickname/avatar_url만 수정 가능하게 제한(아래 grant).
drop policy if exists members_update_own on public.members;
create policy members_update_own on public.members
  for update using (id = auth.uid()) with check (id = auth.uid());
-- insert/delete 정책 없음 → authenticated는 불가. 가입은 join(service_role)에서만, 삭제는 금지.

-- invite_codes: 관리자만 (join Edge Function은 service_role로 RLS 우회)
drop policy if exists invites_admin_all on public.invite_codes;
create policy invites_admin_all on public.invite_codes
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 컬럼 권한: 본인 프로필에서 nickname/avatar_url만 갱신. is_admin/is_active는 아무도 못 바꾼다.
-- ============================================================
grant select on public.members to authenticated;
grant update (nickname, avatar_url) on public.members to authenticated;
grant select, insert, update, delete on public.invite_codes to authenticated; -- 실제 허용은 RLS(is_admin)가 결정
