-- 0018 · 데블스 플랜 이벤트 — 예측/FA·트레이드/회차 시청/스포일러 결과/최종 결과.
-- 핵심 원칙(09-DEVIL-RULES):
--  1) 시청 기록은 '시청 완료 등록하기' 버튼(= devil_save_watch RPC)으로만 저장.
--  2) 결과 공개 범위 = 1화부터 연속 시청 완료한 최대 회차. 스포일러 차단은 '서버 RLS'로 강제.
--  3) FA/트레이드는 contestant_id UNIQUE + RPC 트랜잭션으로 중복 배정 방지.
-- 출연자는 1..16 고정 시드(앱의 CONTESTANTS와 id 일치). 회차는 1..14.

-- ============================================================
-- 출연자 (공개 데이터 — 활성 멤버 전원 읽기)
-- ============================================================
create table if not exists public.devil_contestants (
  id   smallint primary key,
  name text not null,
  sort smallint not null
);

-- ============================================================
-- 예측(픽) — 멤버당 최대 2명. 출연자는 전역에서 한 멤버에게만(UNIQUE).
-- ============================================================
create table if not exists public.devil_predictions (
  member_id     uuid     not null references public.members (id) on delete cascade,
  contestant_id smallint not null references public.devil_contestants (id),
  created_at    timestamptz not null default now(),
  primary key (member_id, contestant_id),
  unique (contestant_id)  -- 한 출연자는 한 멤버에게만 배정
);
create index if not exists devil_pred_member_idx on public.devil_predictions (member_id);

-- ============================================================
-- 회차 시청 기록 — 계정별 독립. (member_id, episode) 유일.
-- ============================================================
create table if not exists public.devil_watch (
  member_id  uuid     not null references public.members (id) on delete cascade,
  episode    smallint not null check (episode between 1 and 14),
  watched_at timestamptz not null default now(),
  primary key (member_id, episode)
);

-- ============================================================
-- 탈락 결과(스포일러) — 한 출연자는 한 번 탈락. 먼저 본 사람 누구나 등록(앱 요구).
-- ⚠️ 이 테이블의 SELECT는 '내 연속 시청 범위'로 RLS 필터된다 → 미시청 회차 행은 응답에 없음.
-- ============================================================
create table if not exists public.devil_eliminations (
  contestant_id smallint primary key references public.devil_contestants (id),
  episode       smallint not null check (episode between 1 and 14),
  registered_by uuid references public.members (id),
  created_at    timestamptz not null default now()
);
create index if not exists devil_elim_episode_idx on public.devil_eliminations (episode);

-- ============================================================
-- 최종 결과(스포일러 최상위) — 단일 행. 전체 시청 완료 또는 별도 동의 시에만 공개.
-- ============================================================
create table if not exists public.devil_final (
  id                  boolean primary key default true check (id),
  winner_contestant_id smallint references public.devil_contestants (id),
  updated_at          timestamptz not null default now()
);

-- 최종 결과 스포일러 동의(회차 접근 권한과 분리)
create table if not exists public.devil_spoiler_consent (
  member_id   uuid primary key references public.members (id) on delete cascade,
  consented_at timestamptz not null default now()
);

-- ============================================================
-- 트레이드 이력 — 누가 어떤 출연자를 교체했는지.
-- ============================================================
create table if not exists public.devil_trades (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members (id) on delete cascade,
  out_contestant_id smallint not null references public.devil_contestants (id),
  in_contestant_id  smallint not null references public.devil_contestants (id),
  created_at    timestamptz not null default now()
);
create index if not exists devil_trades_created_idx on public.devil_trades (created_at desc);

-- ============================================================
-- 함수
-- ============================================================
-- 연속 시청 완료 범위: 1화부터 연속으로 시청한 최대 회차. (중간 미시청 시 그 직전까지)
create or replace function public.devil_watch_through(p_uid uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select min(g.n) - 1
       from generate_series(1, 15) as g(n)
      where not exists (
        select 1 from public.devil_watch w
         where w.member_id = p_uid and w.episode = g.n
      )),
    14);
$$;

-- 최종 결과 공개 가능 여부: 14화 전체 시청 OR 별도 동의 OR 관리자.
create or replace function public.devil_can_see_final(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
      or public.devil_watch_through(p_uid) >= 14
      or exists (select 1 from public.devil_spoiler_consent where member_id = p_uid);
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.devil_contestants      enable row level security;
alter table public.devil_predictions       enable row level security;
alter table public.devil_watch             enable row level security;
alter table public.devil_eliminations      enable row level security;
alter table public.devil_final             enable row level security;
alter table public.devil_spoiler_consent   enable row level security;
alter table public.devil_trades            enable row level security;

-- 출연자: 읽기 전원. 쓰기는 시드/관리자만.
drop policy if exists devil_contestants_read on public.devil_contestants;
create policy devil_contestants_read on public.devil_contestants for select using (public.is_active_member());

-- 예측: 읽기 전원(다른 참여자 픽 확인). 쓰기/삭제는 본인 것만.
drop policy if exists devil_pred_read on public.devil_predictions;
create policy devil_pred_read on public.devil_predictions for select using (public.is_active_member());
drop policy if exists devil_pred_insert_own on public.devil_predictions;
create policy devil_pred_insert_own on public.devil_predictions for insert with check (member_id = auth.uid());
drop policy if exists devil_pred_delete_own on public.devil_predictions;
create policy devil_pred_delete_own on public.devil_predictions for delete using (member_id = auth.uid());

-- 시청 기록: 본인 것만 읽기/쓰기/삭제. (타인 시청 상태 변경 불가)
drop policy if exists devil_watch_own on public.devil_watch;
create policy devil_watch_own on public.devil_watch for select using (member_id = auth.uid());
drop policy if exists devil_watch_insert_own on public.devil_watch;
create policy devil_watch_insert_own on public.devil_watch for insert with check (member_id = auth.uid());
drop policy if exists devil_watch_delete_own on public.devil_watch;
create policy devil_watch_delete_own on public.devil_watch for delete using (member_id = auth.uid());

-- 탈락 결과(스포일러): 읽기는 '내 연속 시청 범위 이하' 회차만(또는 관리자). 등록은 활성 멤버 누구나.
drop policy if exists devil_elim_read_gated on public.devil_eliminations;
create policy devil_elim_read_gated on public.devil_eliminations for select
  using (public.is_admin() or episode <= public.devil_watch_through(auth.uid()));
drop policy if exists devil_elim_insert_member on public.devil_eliminations;
create policy devil_elim_insert_member on public.devil_eliminations for insert with check (public.is_active_member());

-- 최종 결과: 공개 조건 충족 시에만 읽기. 쓰기는 관리자만.
drop policy if exists devil_final_read_gated on public.devil_final;
create policy devil_final_read_gated on public.devil_final for select using (public.devil_can_see_final(auth.uid()));
drop policy if exists devil_final_write_admin on public.devil_final;
create policy devil_final_write_admin on public.devil_final for all using (public.is_admin()) with check (public.is_admin());

-- 동의: 본인 것만.
drop policy if exists devil_consent_own on public.devil_spoiler_consent;
create policy devil_consent_own on public.devil_spoiler_consent for select using (member_id = auth.uid());
drop policy if exists devil_consent_insert_own on public.devil_spoiler_consent;
create policy devil_consent_insert_own on public.devil_spoiler_consent for insert with check (member_id = auth.uid());

-- 트레이드 이력: 읽기 전원, 삽입은 RPC(정의자 권한)에서만 수행.
drop policy if exists devil_trades_read on public.devil_trades;
create policy devil_trades_read on public.devil_trades for select using (public.is_active_member());

-- ============================================================
-- 컬럼 권한 (grant)
-- ============================================================
grant select on public.devil_contestants to authenticated;

grant select on public.devil_predictions to authenticated;
grant insert (member_id, contestant_id) on public.devil_predictions to authenticated;
grant delete on public.devil_predictions to authenticated;

grant select on public.devil_watch to authenticated;
grant insert (member_id, episode) on public.devil_watch to authenticated;
grant delete on public.devil_watch to authenticated;

grant select on public.devil_eliminations to authenticated;
grant insert (contestant_id, episode, registered_by) on public.devil_eliminations to authenticated;

grant select on public.devil_final to authenticated;
grant select, insert, update, delete on public.devil_final to authenticated; -- RLS로 관리자만 실제 허용

grant select on public.devil_spoiler_consent to authenticated;
grant insert (member_id) on public.devil_spoiler_consent to authenticated;

grant select on public.devil_trades to authenticated;

-- ============================================================
-- RPC: 시청 기록 저장 (버튼 클릭 시 호출) — 전달한 회차 집합으로 교체(없는 건 삭제).
-- ============================================================
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
  -- 전달 집합에 없는 기존 기록 삭제
  delete from public.devil_watch
   where member_id = uid
     and (p_eps is null or not (episode = any(p_eps)));
  -- 새로 추가된 회차 삽입
  if p_eps is not null then
    insert into public.devil_watch (member_id, episode)
    select uid, e
      from unnest(p_eps) as e
     where e between 1 and 14
    on conflict (member_id, episode) do nothing;
  end if;
end;
$$;

-- ============================================================
-- RPC: 최초 예측 저장 — 내 픽을 전달한 2명으로 설정(이미 배정/탈락된 출연자 거부).
-- ============================================================
create or replace function public.devil_set_picks(p_ids smallint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid smallint;
begin
  if uid is null or not public.is_active_member() then
    raise exception '권한이 없습니다';
  end if;
  if array_length(p_ids, 1) is distinct from 2 then
    raise exception '예측은 정확히 2명을 선택해야 합니다';
  end if;
  -- 유효성: 탈락자 불가, 다른 멤버가 이미 가진 출연자 불가
  foreach cid in array p_ids loop
    if exists (select 1 from public.devil_eliminations where contestant_id = cid) then
      raise exception '탈락한 출연자는 선택할 수 없습니다';
    end if;
    if exists (select 1 from public.devil_predictions where contestant_id = cid and member_id <> uid) then
      raise exception '이미 다른 참여자가 선택한 출연자입니다';
    end if;
  end loop;
  -- 내 기존 픽 비우고 새로 설정(트랜잭션 — 중복 배정 방지)
  delete from public.devil_predictions where member_id = uid;
  insert into public.devil_predictions (member_id, contestant_id)
  select uid, unnest(p_ids);
end;
$$;

-- ============================================================
-- RPC: 트레이드 — 내 출연자 out 을 FA 출연자 in 으로 교체(트랜잭션).
-- ============================================================
create or replace function public.devil_trade(p_out smallint, p_in smallint)
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
  -- 동시성: 대상 출연자 행 잠금(없으면 FA)
  perform 1 from public.devil_predictions where contestant_id = p_in for update;
  -- out 은 내 픽이어야 함
  if not exists (select 1 from public.devil_predictions where member_id = uid and contestant_id = p_out) then
    raise exception '보유하지 않은 출연자입니다';
  end if;
  -- in 은 FA(아무에게도 배정 안 됨)여야 함
  if exists (select 1 from public.devil_predictions where contestant_id = p_in) then
    raise exception '이미 다른 참여자가 보유한 출연자입니다';
  end if;
  -- in 은 탈락자가 아니어야 함
  if exists (select 1 from public.devil_eliminations where contestant_id = p_in) then
    raise exception '탈락한 출연자는 영입할 수 없습니다';
  end if;
  -- 교체: out 제거 → in 추가(기존 out 은 자동으로 FA 로)
  delete from public.devil_predictions where member_id = uid and contestant_id = p_out;
  insert into public.devil_predictions (member_id, contestant_id) values (uid, p_in);
  insert into public.devil_trades (member_id, out_contestant_id, in_contestant_id)
  values (uid, p_out, p_in);
end;
$$;

grant execute on function public.devil_watch_through(uuid) to authenticated;
grant execute on function public.devil_can_see_final(uuid) to authenticated;
grant execute on function public.devil_save_watch(smallint[]) to authenticated;
grant execute on function public.devil_set_picks(smallint[]) to authenticated;
grant execute on function public.devil_trade(smallint, smallint) to authenticated;

-- ============================================================
-- 시드: 출연자 16명 (앱 CONTESTANTS와 id 일치)
-- ============================================================
insert into public.devil_contestants (id, name, sort) values
  (1,'김동재',1),(2,'넉살',2),(3,'서출구',3),(4,'스텔라장',4),
  (5,'신동',5),(6,'오현민',6),(7,'유리사',7),(8,'이도',8),
  (9,'장동민',9),(10,'재재',10),(11,'정원영',11),(12,'정현규',12),
  (13,'존박',13),(14,'하석진',14),(15,'현경렬',15),(16,'홍진호',16)
on conflict (id) do nothing;

-- 최종 결과 단일 행(우승자 미정) 준비
insert into public.devil_final (id, winner_contestant_id) values (true, null)
on conflict (id) do nothing;
