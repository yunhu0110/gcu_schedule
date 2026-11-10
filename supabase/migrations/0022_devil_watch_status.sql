-- 0022 · 회차 시청 현황 — 각 멤버가 회차별로 '시청 완료 등록'한 시각을 전원 조회.
-- 시청 기록은 결과(탈락자/우승자)가 아니므로 스포일러가 아니다 → 활성 멤버는 전원의 기록을 읽을 수 있다.
-- (쓰기는 여전히 본인만: devil_watch RLS. 읽기만 SECURITY DEFINER RPC로 개방.)
create or replace function public.devil_watch_status()
returns table (member_id uuid, nickname text, episode smallint, watched_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select w.member_id, m.nickname, w.episode, w.watched_at
    from public.devil_watch w
    join public.members m on m.id = w.member_id
   where public.is_active_member()
   order by w.episode, w.watched_at;
$$;

grant execute on function public.devil_watch_status() to authenticated;
