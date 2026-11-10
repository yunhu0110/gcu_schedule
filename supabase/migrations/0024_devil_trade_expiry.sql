-- 0024 · 트레이드 신청 24시간 자동 거절 + 진행 중 신청이 있으면 시청기록 저장 차단.
-- 트레이드는 '시청 진도(연속 범위)가 같은 사람끼리'만 가능하므로(0021), 신청이 걸려 있는 동안
-- 어느 한쪽이 시청을 진행해 진도가 바뀌면 안 된다 → 응답/처리 전에는 시청기록 저장을 막는다.

-- 24h 넘은 pending 신청을 자동 거절(무응답 처리). 조회/저장 시점에 실행되어 상태가 갱신된다.
create or replace function public.devil_expire_offers()
returns void
language sql
security definer
set search_path = public
as $$
  update public.devil_trade_offers
     set status = 'rejected', resolved_at = now()
   where status = 'pending'
     and created_at < now() - interval '24 hours';
$$;

-- 내가 당사자인 신청 목록(먼저 만료 처리 후 반환). 닉네임 조인 포함.
create or replace function public.devil_list_offers()
returns table (
  id uuid, proposer_id uuid, target_id uuid,
  offer_contestant_id smallint, request_contestant_id smallint,
  cash integer, status text, created_at timestamptz,
  proposer_nick text, target_nick text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- stable 함수에서 쓰기 불가 → 만료는 별도 volatile 함수로. 여기선 '만료된 것처럼' 필터링만.
  return query
    select o.id, o.proposer_id, o.target_id,
           o.offer_contestant_id, o.request_contestant_id,
           o.cash,
           case when o.status = 'pending' and o.created_at < now() - interval '24 hours'
                then 'rejected' else o.status end as status,
           o.created_at,
           mp.nickname, mt.nickname
      from public.devil_trade_offers o
      join public.members mp on mp.id = o.proposer_id
      join public.members mt on mt.id = o.target_id
     where o.proposer_id = auth.uid() or o.target_id = auth.uid()
     order by o.created_at desc;
end;
$$;

grant execute on function public.devil_expire_offers() to authenticated;
grant execute on function public.devil_list_offers() to authenticated;

-- 시청기록 저장: 만료 처리 → 진행 중(pending, 24h 이내) 신청이 있으면 저장 차단.
create or replace function public.devil_save_watch(p_eps smallint[])
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

  -- 24h 무응답 신청 자동 거절
  perform public.devil_expire_offers();

  -- 내가 받은(응답해야 할) 진행 중 신청이 있으면 저장 불가
  if exists (
    select 1 from public.devil_trade_offers
     where status = 'pending' and target_id = uid
  ) then
    raise exception '받은 트레이드 신청에 먼저 응답해야 시청 기록을 저장할 수 있어요.';
  end if;
  -- 내가 보낸 진행 중 신청이 있으면(진도 바뀌면 안 됨) 처리 후 저장
  if exists (
    select 1 from public.devil_trade_offers
     where status = 'pending' and proposer_id = uid
  ) then
    raise exception '보낸 트레이드 신청이 처리(수락/거절/취소)되어야 시청 기록을 저장할 수 있어요.';
  end if;

  delete from public.devil_watch
   where member_id = uid
     and (p_eps is null or not (episode = any(p_eps)));
  if p_eps is not null then
    insert into public.devil_watch (member_id, episode)
    select uid, e from unnest(p_eps) as e where e between 1 and 14
    on conflict (member_id, episode) do nothing;
  end if;
end;
$$;

grant execute on function public.devil_save_watch(smallint[]) to authenticated;

-- 수락 시에도 만료 재확인(만료된 신청은 수락 불가) — 기존 accept에 만료 가드 추가.
create or replace function public.devil_accept_trade(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  o   public.devil_trade_offers%rowtype;
begin
  if uid is null or not public.is_active_member() then
    raise exception '권한이 없습니다';
  end if;
  perform public.devil_expire_offers();
  select * into o from public.devil_trade_offers where id = p_id for update;
  if not found then raise exception '신청을 찾을 수 없습니다'; end if;
  if o.target_id <> uid then raise exception '수락 권한이 없습니다'; end if;
  if o.status <> 'pending' then raise exception '이미 처리된(또는 만료된) 신청입니다'; end if;

  perform 1 from public.devil_predictions where contestant_id in (o.offer_contestant_id, o.request_contestant_id) for update;
  if not exists (select 1 from public.devil_predictions where member_id = o.proposer_id and contestant_id = o.offer_contestant_id) then
    raise exception '신청자가 해당 선수를 더 이상 보유하고 있지 않습니다';
  end if;
  if not exists (select 1 from public.devil_predictions where member_id = o.target_id and contestant_id = o.request_contestant_id) then
    raise exception '요청한 선수를 더 이상 보유하고 있지 않습니다';
  end if;

  delete from public.devil_predictions where member_id = o.proposer_id and contestant_id = o.offer_contestant_id;
  delete from public.devil_predictions where member_id = o.target_id   and contestant_id = o.request_contestant_id;
  insert into public.devil_predictions (member_id, contestant_id) values
    (o.proposer_id, o.request_contestant_id),
    (o.target_id,   o.offer_contestant_id);
  insert into public.devil_trades (member_id, out_contestant_id, in_contestant_id) values
    (o.proposer_id, o.offer_contestant_id, o.request_contestant_id),
    (o.target_id,   o.request_contestant_id, o.offer_contestant_id);
  update public.devil_trade_offers set status = 'accepted', resolved_at = now() where id = p_id;
  update public.devil_trade_offers
     set status = 'rejected', resolved_at = now()
   where status = 'pending' and id <> p_id
     and (offer_contestant_id in (o.offer_contestant_id, o.request_contestant_id)
       or request_contestant_id in (o.offer_contestant_id, o.request_contestant_id));
end;
$$;

grant execute on function public.devil_accept_trade(uuid) to authenticated;
