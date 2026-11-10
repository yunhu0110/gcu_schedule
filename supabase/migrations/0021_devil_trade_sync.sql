-- 0021 · P2P 트레이드는 '시청 기록이 싱크 맞는' 참여자끼리만.
-- 싱크 기준 = 연속 시청 완료 범위(devil_watch_through)가 동일. (결과 열람 범위가 같아 스포일러 비대칭 없음)
-- 시청 기록은 본인만 조회 가능(RLS)하므로, 누가 나와 싱크인지는 SECURITY DEFINER 함수로 계산해 반환.

create or replace function public.devil_members_in_sync()
returns table (member_id uuid, watch_through int)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, public.devil_watch_through(m.id)
    from public.members m
   where m.is_active
     and m.id <> auth.uid()
     and public.devil_watch_through(m.id) = public.devil_watch_through(auth.uid());
$$;

grant execute on function public.devil_members_in_sync() to authenticated;

-- 신청 시 서버에서도 싱크 강제(위 함수와 동일 기준).
create or replace function public.devil_propose_trade(p_offer smallint, p_request smallint, p_cash integer default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_target uuid;
begin
  if uid is null or not public.is_active_member() then
    raise exception '권한이 없습니다';
  end if;
  if p_offer = p_request then
    raise exception '같은 선수는 교환할 수 없습니다';
  end if;
  if coalesce(p_cash, 0) < 0 then
    raise exception '현금은 0원 이상이어야 합니다';
  end if;
  if not exists (select 1 from public.devil_predictions where member_id = uid and contestant_id = p_offer) then
    raise exception '보유하지 않은 선수입니다';
  end if;
  select member_id into v_target from public.devil_predictions where contestant_id = p_request;
  if v_target is null then
    raise exception 'FA 선수입니다. FA 트레이드를 이용하세요';
  end if;
  if v_target = uid then
    raise exception '이미 본인이 보유한 선수입니다';
  end if;
  -- 시청 진도 싱크 강제
  if public.devil_watch_through(uid) <> public.devil_watch_through(v_target) then
    raise exception '시청 진도가 같은 참여자와만 트레이드할 수 있습니다';
  end if;
  if exists (select 1 from public.devil_eliminations where contestant_id in (p_offer, p_request)) then
    raise exception '탈락한 선수는 교환할 수 없습니다';
  end if;
  if exists (
    select 1 from public.devil_trade_offers
     where proposer_id = uid and offer_contestant_id = p_offer
       and request_contestant_id = p_request and status = 'pending'
  ) then
    raise exception '이미 신청한 트레이드입니다';
  end if;
  insert into public.devil_trade_offers (proposer_id, target_id, offer_contestant_id, request_contestant_id, cash)
  values (uid, v_target, p_offer, p_request, coalesce(p_cash, 0));
end;
$$;

grant execute on function public.devil_propose_trade(smallint, smallint, integer) to authenticated;
