-- 0013 · 정원 6 → 7 (관리자 1 + 개인계정 6). 관리자는 별도 계정.
create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
as $$
begin
  if new.is_active and (select count(*) from public.members where is_active) >= 7 then
    raise exception '정원이 가득 찼습니다 (7명: 관리자 1 + 멤버 6)';
  end if;
  return new;
end;
$$;
