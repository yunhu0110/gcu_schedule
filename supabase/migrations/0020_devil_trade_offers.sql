-- 0020 · 상대와의 트레이드(수락 기반). 신청자가 '내 선수 ↔ 상대 보유 선수' 교환을 신청하고,
-- 상대가 수락해야 성사된다. 모든 검증/교체는 SECURITY DEFINER RPC에서 트랜잭션으로.
create table if not exists public.devil_trade_offers (
  id            uuid primary key default gen_random_uuid(),
  proposer_id   uuid not null references public.members (id) on delete cascade,
  target_id     uuid not null references public.members (id) on delete cascade,
  offer_contestant_id   smallint not null references public.devil_contestants (id), -- 신청자가 내놓는 선수
  request_contestant_id smallint not null references public.devil_contestants (id), -- 신청자가 원하는(상대 보유) 선수
  cash          integer not null default 0 check (cash >= 0), -- 신청자가 얹는 현금(제안용, 실제 송금은 앱 밖). 0이면 선수 대 선수.
  status        text not null default 'pending' check (status in ('pending','accepted','rejected','canceled')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index if not exists devil_offers_target_idx   on public.devil_trade_offers (target_id, status);
create index if not exists devil_offers_proposer_idx on public.devil_trade_offers (proposer_id, status);

alter table public.devil_trade_offers enable row level security;

-- 조회: 당사자(신청자/상대)만.
drop policy if exists devil_offers_read on public.devil_trade_offers;
create policy devil_offers_read on public.devil_trade_offers for select
  using (proposer_id = auth.uid() or target_id = auth.uid());

grant select on public.devil_trade_offers to authenticated;
-- insert/update 는 RPC(정의자 권한)로만.

-- ── 신청 ─────────────────────────────────────────────
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
  -- 내가 offer 선수를 보유해야 함
  if not exists (select 1 from public.devil_predictions where member_id = uid and contestant_id = p_offer) then
    raise exception '보유하지 않은 선수입니다';
  end if;
  -- request 선수의 보유자 = 상대
  select member_id into v_target from public.devil_predictions where contestant_id = p_request;
  if v_target is null then
    raise exception 'FA 선수입니다. FA 트레이드를 이용하세요';
  end if;
  if v_target = uid then
    raise exception '이미 본인이 보유한 선수입니다';
  end if;
  -- 탈락자는 교환 대상 제외
  if exists (select 1 from public.devil_eliminations where contestant_id in (p_offer, p_request)) then
    raise exception '탈락한 선수는 교환할 수 없습니다';
  end if;
  -- 동일한 대기중 신청 중복 방지
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

-- ── 수락(상대만) ─────────────────────────────────────
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
  select * into o from public.devil_trade_offers where id = p_id for update;
  if not found then raise exception '신청을 찾을 수 없습니다'; end if;
  if o.target_id <> uid then raise exception '수락 권한이 없습니다'; end if;
  if o.status <> 'pending' then raise exception '이미 처리된 신청입니다'; end if;

  -- 보유 상태 재검증(그 사이 바뀌었을 수 있음) + 행 잠금
  perform 1 from public.devil_predictions where contestant_id in (o.offer_contestant_id, o.request_contestant_id) for update;
  if not exists (select 1 from public.devil_predictions where member_id = o.proposer_id and contestant_id = o.offer_contestant_id) then
    raise exception '신청자가 해당 선수를 더 이상 보유하고 있지 않습니다';
  end if;
  if not exists (select 1 from public.devil_predictions where member_id = o.target_id and contestant_id = o.request_contestant_id) then
    raise exception '요청한 선수를 더 이상 보유하고 있지 않습니다';
  end if;

  -- 교체(양쪽 픽 스왑)
  delete from public.devil_predictions where member_id = o.proposer_id and contestant_id = o.offer_contestant_id;
  delete from public.devil_predictions where member_id = o.target_id   and contestant_id = o.request_contestant_id;
  insert into public.devil_predictions (member_id, contestant_id) values
    (o.proposer_id, o.request_contestant_id),
    (o.target_id,   o.offer_contestant_id);

  -- 이력(양쪽)
  insert into public.devil_trades (member_id, out_contestant_id, in_contestant_id) values
    (o.proposer_id, o.offer_contestant_id, o.request_contestant_id),
    (o.target_id,   o.request_contestant_id, o.offer_contestant_id);

  update public.devil_trade_offers set status = 'accepted', resolved_at = now() where id = p_id;
  -- 해당 선수가 걸린 다른 대기중 신청은 자동 거절(스테일 방지)
  update public.devil_trade_offers
     set status = 'rejected', resolved_at = now()
   where status = 'pending' and id <> p_id
     and (offer_contestant_id in (o.offer_contestant_id, o.request_contestant_id)
       or request_contestant_id in (o.offer_contestant_id, o.request_contestant_id));
end;
$$;

-- ── 거절(상대만) / 취소(신청자만) ────────────────────
create or replace function public.devil_reject_trade(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid(); o public.devil_trade_offers%rowtype;
begin
  select * into o from public.devil_trade_offers where id = p_id for update;
  if not found then raise exception '신청을 찾을 수 없습니다'; end if;
  if o.target_id <> uid then raise exception '거절 권한이 없습니다'; end if;
  if o.status <> 'pending' then raise exception '이미 처리된 신청입니다'; end if;
  update public.devil_trade_offers set status = 'rejected', resolved_at = now() where id = p_id;
end;
$$;

create or replace function public.devil_cancel_trade(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid(); o public.devil_trade_offers%rowtype;
begin
  select * into o from public.devil_trade_offers where id = p_id for update;
  if not found then raise exception '신청을 찾을 수 없습니다'; end if;
  if o.proposer_id <> uid then raise exception '취소 권한이 없습니다'; end if;
  if o.status <> 'pending' then raise exception '이미 처리된 신청입니다'; end if;
  update public.devil_trade_offers set status = 'canceled', resolved_at = now() where id = p_id;
end;
$$;

grant execute on function public.devil_propose_trade(smallint, smallint, integer) to authenticated;
grant execute on function public.devil_accept_trade(uuid) to authenticated;
grant execute on function public.devil_reject_trade(uuid) to authenticated;
grant execute on function public.devil_cancel_trade(uuid) to authenticated;
