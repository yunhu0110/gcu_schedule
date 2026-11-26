-- 0041 · 관계축 성능 유계화 (지시서 §5-3 3홉 경로, 게임 중 매 힌트 호출 → 반드시 bounded)
-- 문제: 0037 의 hw_axis_relation 은 재귀 CTE 가 매 호출마다 간선(14.5만)을 재구성 + 고차수 허브
--       (차수 최대 1475, 231개 노드가 ≥50)에서 3홉 경로가 500→25만→1.2억으로 폭발 → statement timeout.
-- 해결:
--   (1) 간선을 '무방향·가중·노드별 top-K(=40)' 로 사전 구축한 hw_rel_edges 테이블로 1회 materialize.
--       노드 99%(차수 ≤37=p99)는 무손실, 허브만 강한 간선 40개로 제한 → 3홉 최악 40³ 로 유계.
--       허브 하위 co-hyponym(예: 호랑이~사자) 일부 경로 손실은 의미·문맥축이 보완(§5-4 다축 설계).
--   (2) 함수는 테이블을 걷기만(간선 재구성 없음) → 인게임 단일 호출 수 ms.
--   간선 수(상한 후)는 수만 행·수 MB 수준 → §9 용량 영향 미미.

-- 간선 가중: rel 유형 기준값 × (0.5 + 0.5·strength). strength 결측은 0.5 가정.
create table if not exists public.hw_rel_edges (
  src text not null,
  dst text not null,
  w   real not null,
  primary key (src, dst)
);

truncate public.hw_rel_edges;
insert into public.hw_rel_edges (src, dst, w)
with e as (
  select a as src, b as dst, rel, coalesce(strength, 0.5) as strength from public.hw_word_relations
  union all
  select b as src, a as dst, rel, coalesce(strength, 0.5) as strength from public.hw_word_relations
),
ew as (
  select src, dst,
         (case rel when 'synonym' then 1.00 when 'hypernym' then 0.85
                   when 'antonym' then 0.60 else 0.50 end) * (0.5 + 0.5 * strength) as w,
         row_number() over (
           partition by src
           order by (case rel when 'synonym' then 1.00 when 'hypernym' then 0.85
                              when 'antonym' then 0.60 else 0.50 end) * (0.5 + 0.5 * strength) desc,
                    dst
         ) as rn
  from e
)
select src, dst, max(w) as w
from ew
where rn <= 40
group by src, dst;  -- 같은 (src,dst) 다중 rel 이면 최강 가중만

create index if not exists hw_rel_edges_src_idx on public.hw_rel_edges(src);

alter table public.hw_rel_edges enable row level security;
revoke all on public.hw_rel_edges from anon, authenticated;  -- RPC(정의자 권한) 전용

-- 관계축: 사전구축 간선을 3홉까지 걷고 최대 경로점수(간선가중 곱) 반환. 경로 없으면 NULL.
create or replace function public.hw_axis_relation(w1 text, w2 text)
returns double precision
language sql stable security definer
set search_path = public
as $$
  with recursive walk(dst, hops, score, path) as (
    select dst, 1, w, array[src, dst]
    from public.hw_rel_edges where src = w1
    union all
    select n.dst, w.hops + 1, w.score * n.w, w.path || n.dst
    from walk w
    join public.hw_rel_edges n on n.src = w.dst
    where w.hops < 3 and n.dst <> all(w.path)
  )
  select max(score) from walk where dst = w2
$$;

revoke execute on function public.hw_axis_relation(text, text) from anon, authenticated;
