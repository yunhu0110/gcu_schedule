-- 0019 · 최종 우승자 등록을 '마지막 화(14화) 등록' 방식으로.
-- 관리자 전용 대신, 탈락자 등록처럼 '먼저 본 사람 누구나'(활성 멤버) 등록할 수 있게 RPC 제공.
-- devil_final 쓰기 RLS는 관리자로 두되, SECURITY DEFINER RPC가 우회해 멤버 등록을 허용한다.
create or replace function public.devil_set_winner(p_id smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.is_active_member() then
    raise exception '권한이 없습니다';
  end if;
  if p_id is not null and not exists (select 1 from public.devil_contestants where id = p_id) then
    raise exception '존재하지 않는 출연자입니다';
  end if;
  update public.devil_final
     set winner_contestant_id = p_id,
         updated_at = now()
   where id = true;
end;
$$;

grant execute on function public.devil_set_winner(smallint) to authenticated;
