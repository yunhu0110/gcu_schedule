-- 0040 · 게임 단어 추출 품질 개선 (지시서 규칙 #4·#5, CLAUDE.md "UI/UX가 존재 이유")
-- 문제: 0038 의 hw_draw_words 가 usable 전체(51,494)에서 무작위 추출 → 고유명사·음차 표기
--       (튀니스/프로코피예프/프라이탁/리쭝우 등)가 다수 뽑혀 '단어 맞히기' 게임에 부적합.
-- 개선: 게임용 풀을 (a) 말뭉치 빈도 freq ≥ 2000 (희귀·고유명사 배제)
--              AND (b) '기타' 가 아닌 실제 카테고리 1개 이상 보유(추상 식별자·미분류 배제)
--       로 한정 → 약 8,200개 흔한 일반명사. #5 무작위 혼합은 order by random() 유지.
create or replace function public.hw_draw_words(n int)
returns text[]
language sql security definer set search_path = public
as $$
  select array_agg(word) from (
    select w.word
    from public.hw_words w
    where w.usable
      and w.freq >= 2000
      and exists (
        select 1 from public.hw_word_categories wc
        where wc.word = w.word and wc.category <> '기타'
      )
    order by random()
    limit n
  ) s
$$;

revoke execute on function public.hw_draw_words(int) from anon, authenticated;
