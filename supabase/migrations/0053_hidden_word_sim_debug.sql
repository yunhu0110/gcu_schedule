-- 0053 · [임시] 유사도 밸런싱용 축 분해 디버그 RPC. 0054 에서 drop·revoke 한다.
--   읽기 전용(어휘만), 사용자 데이터 無. 밸런싱 데이터 수집 목적.
create or replace function public.hw_sim_debug(w1 text, w2 text)
returns table (score double precision, semantic double precision, contextual double precision,
  relation double precision, raw_semantic double precision, raw_contextual double precision,
  raw_relation double precision)
language sql stable security definer set search_path = public as $$
  select * from public.hw_word_similarity(w1, w2)
$$;
grant execute on function public.hw_sim_debug(text, text) to anon, authenticated;
