-- 0043 · 게임 draw 풀 확장 (사용자 요청: 명사 다양성 보강)
-- 0040 은 freq >= 2000 (약 8,230개)로 한정했으나, 사용자가 풀을 넓히기로 결정.
-- 명사 104,595개·임베딩은 이미 전부 DB에 적재돼 있으므로 신규 적재 없이 임계값만 완화한다.
-- freq >= 500 → usable·비기타 명사 약 17,100개 (현재의 약 2배).
-- '기타' 제외는 유지(미분류 식별자 배제). usable 전체가 비기타 카테고리를 보유하므로
-- 실질 필터는 freq 임계값이다. #5 무작위 혼합(order by random())은 유지.
create or replace function public.hw_draw_words(n int)
returns text[]
language sql security definer set search_path = public
as $$
  select array_agg(word) from (
    select w.word
    from public.hw_words w
    where w.usable
      and w.freq >= 500
      and exists (
        select 1 from public.hw_word_categories wc
        where wc.word = w.word and wc.category <> '기타'
      )
    order by random()
    limit n
  ) s
$$;

revoke execute on function public.hw_draw_words(int) from anon, authenticated;
