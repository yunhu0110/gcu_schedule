-- 0010 · 비밀번호 재설정(관리자 인증코드 방식)
-- 사용자가 코드 요청 → 관리자에게 알림으로 코드 전달 → 사용자가 코드+새 비번 입력 → 변경.
-- service_role/Edge Function 없이 SECURITY DEFINER 함수로 처리(6인 신뢰 그룹).

create table if not exists public.password_reset_codes (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  code       text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used       boolean not null default false
);
-- RLS 켜두되 정책 없음 → 클라이언트 직접 접근 차단(오직 아래 DEFINER 함수로만).
alter table public.password_reset_codes enable row level security;

-- 코드 요청: 코드 생성·저장 + 관리자에게 알림. 코드는 클라이언트로 반환하지 않는다.
create or replace function public.request_password_reset(p_email text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid;
  v_nick text;
  v_code text;
begin
  select m.id, m.nickname into v_uid, v_nick
  from public.members m join auth.users u on u.id = m.id
  where lower(u.email) = lower(p_email) limit 1;

  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into public.password_reset_codes(email, code, expires_at)
  values (lower(p_email), v_code, now() + interval '30 minutes');

  insert into public.notifications(recipient_id, actor_id, type, body)
  select m.id, v_uid, 'password_reset',
         coalesce(v_nick, p_email) || '님의 비밀번호 재설정 인증코드: ' || v_code || ' (30분 유효)'
  from public.members m where m.is_admin and m.is_active;
end $$;

-- 코드로 비번 변경: 코드 검증 후 auth.users 비번(bcrypt) 갱신.
create or replace function public.reset_password_with_code(p_email text, p_code text, p_new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code_id uuid;
  v_uid uuid;
begin
  if p_new_password is null or length(p_new_password) < 6 then
    return false;
  end if;
  select id into v_code_id from public.password_reset_codes
  where lower(email) = lower(p_email) and code = upper(p_code) and not used and expires_at > now()
  order by created_at desc limit 1;
  if v_code_id is null then return false; end if;

  select id into v_uid from auth.users where lower(email) = lower(p_email) limit 1;
  if v_uid is null then return false; end if;

  update auth.users set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')) where id = v_uid;
  update public.password_reset_codes set used = true where id = v_code_id;
  return true;
end $$;

grant execute on function public.request_password_reset(text) to anon, authenticated;
grant execute on function public.reset_password_with_code(text, text, text) to anon, authenticated;
