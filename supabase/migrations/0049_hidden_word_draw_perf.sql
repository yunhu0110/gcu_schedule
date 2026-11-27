-- 0049: 봉투 단어 추첨 성능 수정
--
-- 문제: 0048 의 hw_draw_envelopes 는 봉투 슬롯(=인원×5)마다 17,110개 풀을
-- `order by random() limit 1`(+카테고리 lateral) 로 전체 스캔했다. 슬롯당 ~190ms →
-- 6인 라운드1 = 30슬롯 ≈ 5.8s 로 anon 역할의 statement_timeout(3s)을 초과해
-- 게임 시작 시 "canceling statement due to statement timeout" 발생.
-- (playtest 는 statement_timeout=0 을 걸어 이 회귀를 가렸음.)
--
-- 수정: 전체 스캔을 라운드당 1회로. 무작위 후보 풀을 한 번에 뽑아 각 단어에
-- 비-'기타' 카테고리 1개를 부여한 뒤, plpgsql 메모리에서 탐욕적으로 배정한다.
--   · 봉투당 5개 카테고리 서로 다름(§3) — 배정 시 카테고리 중복 스킵
--   · 전역 비중복(§3) — 풀은 과거 라운드 단어 전부 제외 + 배정된 단어는 소진 처리
--   · 단어 부족/다양성 부족 시 임의 중복 없이 명확히 예외(필요·가용·부족 수 안내)

drop function if exists public.hw_draw_envelopes(uuid, int);
create or replace function public.hw_draw_envelopes(p_room uuid, n_env int)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  v_result text[] := '{}';
  v_used   text[];
  v_need int := n_env * 5;
  v_avail int;
  v_pool int;
  v_pw text[];          -- 후보 단어(무작위 순서)
  v_pc text[];          -- 각 후보의 대표 카테고리(비-'기타')
  v_env int; v_i int; v_cnt int;
  v_cats text[];
begin
  -- 이 방에서 과거 라운드 포함 이미 쓴 모든 봉투 단어(전역 중복 금지)
  select coalesce(array_agg(w), '{}') into v_used
    from (select distinct unnest(words) as w from public.hw_envelope_words where room_id = p_room) u;

  -- 공급 가능한 단어 수 사전 점검(부족 시 중복 없이 안내) — 전체 1회 스캔
  select count(*) into v_avail from public.hw_words w
    where w.usable and w.freq >= 500
      and not (w.word = any(v_used))
      and exists (select 1 from public.hw_word_categories wc
                  where wc.word = w.word and wc.category <> '기타');
  if v_avail < v_need then
    raise exception '게임용 단어가 부족해요. 필요 %개, 사용가능 %개(부족 %개). 라운드 수를 줄여주세요.',
      v_need, v_avail, v_need - v_avail;
  end if;

  -- 무작위 후보 풀을 1회만 추출. 필요량의 넉넉한 배수(카테고리 다양성 여유분)로 뽑되
  -- 가용량을 넘지 않게. order by random() 전체 스캔은 라운드당 이 1회뿐.
  v_pool := least(v_avail, greatest(v_need * 12, 120));
  select array_agg(word), array_agg(cat) into v_pw, v_pc from (
    with pool as (
      select w.word
      from public.hw_words w
      where w.usable and w.freq >= 500
        and not (w.word = any(v_used))
        and exists (select 1 from public.hw_word_categories wc
                    where wc.word = w.word and wc.category <> '기타')
      order by random()
      limit v_pool
    )
    select p.word,
           (select wc.category from public.hw_word_categories wc
             where wc.word = p.word and wc.category <> '기타'
             order by random() limit 1) as cat
    from pool p
  ) q;

  -- 메모리 내 탐욕 배정: 봉투마다 서로 다른 5개 카테고리로 채운다.
  -- 배정된 풀 항목은 null 로 소진해 draw 내에서도 단어가 겹치지 않는다.
  for v_env in 1..n_env loop
    v_cats := '{}'; v_cnt := 0;
    for v_i in 1..coalesce(array_length(v_pw, 1), 0) loop
      continue when v_pw[v_i] is null;              -- 이미 소진
      continue when v_pc[v_i] is null;              -- 비-'기타' 카테고리 없음
      continue when v_pc[v_i] = any(v_cats);        -- 이 봉투에 이미 쓴 카테고리
      v_result := v_result || v_pw[v_i];
      v_cats   := v_cats   || v_pc[v_i];
      v_pw[v_i] := null;                            -- 소진
      v_cnt := v_cnt + 1;
      exit when v_cnt = 5;
    end loop;
    if v_cnt < 5 then
      raise exception '카테고리 다양성 부족으로 봉투 구성 실패(봉투 %). 다시 시도하거나 라운드 수를 줄여주세요.', v_env;
    end if;
  end loop;

  return v_result;
end $$;
revoke execute on function public.hw_draw_envelopes(uuid, int) from anon, authenticated;
