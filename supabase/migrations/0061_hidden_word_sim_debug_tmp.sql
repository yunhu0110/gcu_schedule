create or replace function public.hw_sim_debug(w1 text, w2 text)
returns table (score double precision, semantic double precision, contextual double precision,
  relation double precision, raw_semantic double precision, raw_contextual double precision, raw_relation double precision)
language sql stable security definer set search_path = public as $$ select * from public.hw_word_similarity(w1, w2) $$;
grant execute on function public.hw_sim_debug(text, text) to anon, authenticated;
