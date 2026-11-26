-- 0039 · 히든워드 게임 진행 RPC (지시서 §8, 확정 A안)
-- 상태(hw_rooms.state) 스키마:
--   { phase: 'envelope_selection'|'hidden_word_selection'|'round'|'game_over',
--     player_order: uuid[], round_index: int, total_rounds: int,
--     round_phase: 'clue'|'guess', unlocked: bool,
--     current_hint: { word, similarity } | null }
-- 모든 쓰기는 SECURITY DEFINER + secret_token 검증으로만.

-- ── 게임 시작(방장): 라운드 수 설정, 봉투 6개(각 5단어) 무작위 생성 ──
create or replace function public.hw_start_game(p_token uuid, p_total_rounds int default 6)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_player hw_players; v_room hw_rooms;
  v_count int; v_pids uuid[]; v_words text[]; v_env uuid; v_i int;
  v_rounds int;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id = v_pid;
  if not v_player.is_host then raise exception '방장만 게임을 시작할 수 있어요'; end if;
  select * into v_room from hw_rooms where id = v_player.room_id;
  if v_room.status <> 'lobby' then raise exception '이미 시작된 게임이에요'; end if;

  select count(*)::int into v_count from hw_players where room_id = v_room.id;
  if v_count < 2 then raise exception '최소 2명이 필요해요'; end if;
  if v_count > 6 then raise exception '최대 6명이에요'; end if;

  v_rounds := least(30, greatest(3, coalesce(p_total_rounds, 6)));

  -- 30개 무작위 단어(카테고리 혼합) → 봉투 6개 × 5
  v_words := public.hw_draw_words(30);
  if v_words is null or array_length(v_words,1) < 30 then
    raise exception '게임용 단어가 부족해요(어휘 적재 확인 필요)';
  end if;
  for v_i in 1..6 loop
    insert into hw_envelopes (room_id, envelope_number) values (v_room.id, v_i)
      returning id into v_env;
    insert into hw_envelope_words (envelope_id, room_id, words)
      values (v_env, v_room.id, v_words[(v_i-1)*5+1 : v_i*5]);
  end loop;

  select array_agg(id) into v_pids
    from (select id from hw_players where room_id = v_room.id order by random()) p;

  insert into hw_scores (player_id, room_id, points)
    select id, v_room.id, 0 from hw_players where room_id = v_room.id
    on conflict (player_id) do update set points = 0;

  update hw_rooms set status = 'playing', settings = settings || jsonb_build_object('total_rounds', v_rounds),
    state = jsonb_build_object(
      'phase','envelope_selection','player_order', to_jsonb(v_pids),
      'round_index',0,'total_rounds',v_rounds,'round_phase','clue',
      'unlocked', false, 'current_hint', null)
    where id = v_room.id;

  return json_build_object('ok', true, 'player_count', v_count, 'total_rounds', v_rounds);
end $$;

-- ── 내가 선택한 봉투의 단어(본인만, #3) ──
create or replace function public.hw_get_my_envelope(p_token uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_room uuid; v_words text[];
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select room_id into v_room from hw_players where id = v_pid;
  select ew.words into v_words
    from hw_envelopes e join hw_envelope_words ew on ew.envelope_id = e.id
    where e.room_id = v_room and e.selected_by = v_pid;
  return v_words;  -- 미선택이면 null
end $$;

-- ── 봉투 선택(단어 노출 없음) ──
create or replace function public.hw_select_envelope(p_token uuid, p_number int)
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_player hw_players; v_room hw_rooms; v_all bool;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id = v_pid;
  select * into v_room from hw_rooms where id = v_player.room_id;
  if (v_room.state->>'phase') <> 'envelope_selection' then raise exception '봉투 선택 단계가 아니에요'; end if;
  if exists (select 1 from hw_envelopes where room_id=v_room.id and selected_by=v_player.id) then
    raise exception '이미 봉투를 선택했어요'; end if;
  if exists (select 1 from hw_envelopes where room_id=v_room.id and envelope_number=p_number and selected_by is not null) then
    raise exception '이미 선택된 봉투예요'; end if;
  update hw_envelopes set selected_by=v_player.id where room_id=v_room.id and envelope_number=p_number;
  if not found then raise exception '봉투를 찾을 수 없어요'; end if;

  -- 모든 참가자가 봉투를 골랐으면 히든워드 선택 단계로
  select (count(*) filter (where selected_by is not null)) >=
         (select count(*) from hw_players where room_id=v_room.id)
    into v_all from hw_envelopes where room_id=v_room.id;
  if v_all then
    update hw_rooms set state = jsonb_set(state,'{phase}','"hidden_word_selection"') where id=v_room.id;
  end if;
  return json_build_object('ok', true, 'phase_advanced', v_all);
end $$;

-- ── 히든워드 선택(본인 봉투 단어 중) ──
create or replace function public.hw_select_hidden_word(p_token uuid, p_word text)
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_room uuid; v_words text[]; v_w text; v_all bool;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select room_id into v_room from hw_players where id=v_pid;
  if (select state->>'phase' from hw_rooms where id=v_room) <> 'hidden_word_selection' then
    raise exception '히든워드 선택 단계가 아니에요'; end if;
  if exists (select 1 from hw_player_words where player_id=v_pid) then
    raise exception '이미 히든워드를 선택했어요'; end if;
  select ew.words into v_words from hw_envelopes e join hw_envelope_words ew on ew.envelope_id=e.id
    where e.room_id=v_room and e.selected_by=v_pid;
  if v_words is null then raise exception '선택한 봉투가 없어요'; end if;
  v_w := public.hw_norm(p_word);
  if not (v_w = any(v_words)) then raise exception '봉투에 없는 단어예요'; end if;

  insert into hw_player_words (player_id, room_id, hidden_word) values (v_pid, v_room, v_w);

  select (select count(*) from hw_player_words where room_id=v_room) >=
         (select count(*) from hw_players where room_id=v_room) into v_all;
  if v_all then
    update hw_rooms set state = jsonb_set(state,'{phase}','"round"') where id=v_room;
  end if;
  return json_build_object('ok', true, 'phase_advanced', v_all);
end $$;

-- ── 내 히든워드 조회(본인) ──
create or replace function public.hw_get_my_word(p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_word text;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select hidden_word into v_word from hw_player_words where player_id=v_pid;
  return v_word;
end $$;

-- ── 힌트 제출(현재 출제자): 유사도 계산·공개, #7 재사용 금지, ≥95 시 추측 개방(#11) ──
create or replace function public.hw_submit_clue(p_token uuid, p_clue text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_player hw_players; v_room hw_rooms; v_state jsonb;
  v_order uuid[]; v_ri int; v_giver uuid; v_hidden text; v_clue text;
  v_sim double precision; v_attempt int; v_unlocked bool;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id=v_pid;
  select * into v_room from hw_rooms where id=v_player.room_id;
  v_state := v_room.state;
  if (v_state->>'phase') <> 'round' then raise exception '라운드 진행 중이 아니에요'; end if;
  if (v_state->>'round_phase') <> 'clue' then raise exception '이미 정답 제출이 열렸어요'; end if;

  select array_agg(x::uuid) into v_order from jsonb_array_elements_text(v_state->'player_order') x;
  v_ri := (v_state->>'round_index')::int;
  v_giver := v_order[(v_ri % array_length(v_order,1)) + 1];
  if v_giver <> v_pid then raise exception '지금은 출제자가 아니에요'; end if;

  v_clue := public.hw_norm(p_clue);
  if coalesce(v_clue,'') = '' then raise exception '힌트를 입력해주세요'; end if;

  select hidden_word into v_hidden from hw_player_words where player_id=v_pid;
  if v_clue = v_hidden then raise exception '히든워드 자체는 힌트로 쓸 수 없어요'; end if;
  -- #7: 이 참가자가 이전에 쓴 힌트 단어 재사용 금지
  if exists (select 1 from hw_clues where room_id=v_room.id and player_id=v_pid and clue_word=v_clue) then
    raise exception '이전에 사용한 힌트예요(재사용 불가)'; end if;

  select score into v_sim from public.hw_word_similarity(v_hidden, v_clue);
  v_sim := coalesce(v_sim, 0);
  select coalesce(max(attempt),0)+1 into v_attempt from hw_clues where room_id=v_room.id and round_index=v_ri;

  insert into hw_clues (room_id, round_index, player_id, clue_word, similarity, attempt)
    values (v_room.id, v_ri, v_pid, v_clue, round(v_sim::numeric,2), v_attempt);

  v_unlocked := v_sim >= 95.0;
  v_state := v_state || jsonb_build_object('current_hint',
                jsonb_build_object('word', v_clue, 'similarity', round(v_sim::numeric,2)));
  if v_unlocked then
    v_state := v_state || jsonb_build_object('round_phase','guess','unlocked',true);
  end if;
  update hw_rooms set state=v_state where id=v_room.id;

  return json_build_object('ok',true,'similarity',round(v_sim::numeric,2),'unlocked',v_unlocked,'attempt',v_attempt);
end $$;

-- ── 추측 제출(출제자 제외, 개방된 뒤에만, #11). 전원 제출 시 라운드 정산·채점 ──
create or replace function public.hw_submit_guess(p_token uuid, p_guess text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_player hw_players; v_room hw_rooms; v_state jsonb;
  v_order uuid[]; v_ri int; v_giver uuid; v_hidden text; v_guess text;
  v_correct bool; v_need int; v_have int; v_ncorrect int; v_hints int;
  v_total int; v_next int; v_bonus int;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id=v_pid;
  select * into v_room from hw_rooms where id=v_player.room_id;
  v_state := v_room.state;
  if (v_state->>'phase') <> 'round' then raise exception '라운드 진행 중이 아니에요'; end if;
  if (v_state->>'round_phase') <> 'guess' or not coalesce((v_state->>'unlocked')::bool,false) then
    raise exception '아직 정답 제출이 열리지 않았어요'; end if;

  select array_agg(x::uuid) into v_order from jsonb_array_elements_text(v_state->'player_order') x;
  v_ri := (v_state->>'round_index')::int;
  v_giver := v_order[(v_ri % array_length(v_order,1)) + 1];
  if v_giver = v_pid then raise exception '출제자는 추측할 수 없어요'; end if;
  if exists (select 1 from hw_guesses where room_id=v_room.id and round_index=v_ri and guesser_id=v_pid) then
    raise exception '이미 추측을 제출했어요'; end if;

  v_guess := public.hw_norm(p_guess);
  if coalesce(v_guess,'') = '' then raise exception '추측 단어를 입력해주세요'; end if;
  select hidden_word into v_hidden from hw_player_words where player_id=v_giver;
  v_correct := (v_guess = v_hidden);

  insert into hw_guesses (room_id, round_index, guesser_id, clue_giver_id, guess_word, is_correct)
    values (v_room.id, v_ri, v_pid, v_giver, v_guess, v_correct);

  -- 출제자 제외 전원 제출?
  select count(*)::int into v_need from hw_players where room_id=v_room.id and id<>v_giver;
  select count(*)::int into v_have from hw_guesses where room_id=v_room.id and round_index=v_ri;
  if v_have < v_need then
    return json_build_object('ok',true,'all_guessed',false);
  end if;

  -- 정산: 추측 공개 + 채점
  update hw_guesses set is_revealed=true where room_id=v_room.id and round_index=v_ri;
  select count(*)::int into v_ncorrect from hw_guesses
    where room_id=v_room.id and round_index=v_ri and is_correct;
  select count(*)::int into v_hints from hw_clues where room_id=v_room.id and round_index=v_ri;

  -- 득점(조정 가능): 정답 추측자 +2 / 출제자 +정답수, +효율보너스 max(0,4-힌트수)
  update hw_scores s set points = points + 2
    from hw_guesses g
    where g.room_id=v_room.id and g.round_index=v_ri and g.is_correct and g.guesser_id=s.player_id;
  v_bonus := greatest(0, 4 - v_hints);
  update hw_scores set points = points + v_ncorrect + v_bonus where player_id=v_giver;

  -- 라운드 공개로 히든워드도 공개
  update hw_player_words set is_revealed=true where player_id=v_giver;

  v_total := (v_state->>'total_rounds')::int;
  v_next := v_ri + 1;
  if v_next >= v_total then
    update hw_player_words set is_revealed=true where room_id=v_room.id;
    update hw_rooms set status='done',
      state = v_state || jsonb_build_object('phase','game_over','round_phase','clue',
                                            'unlocked',false,'current_hint',null)
      where id=v_room.id;
    return json_build_object('ok',true,'all_guessed',true,'game_over',true);
  else
    update hw_rooms set state = v_state || jsonb_build_object(
      'round_index', v_next, 'round_phase','clue','unlocked',false,'current_hint',null)
      where id=v_room.id;
    return json_build_object('ok',true,'all_guessed',true,'game_over',false,'next_round',v_next);
  end if;
end $$;

-- ── 게임 종료(방장) ──
create or replace function public.hw_end_game(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_player hw_players; v_room hw_rooms;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id=v_pid;
  if not v_player.is_host then raise exception '방장만 게임을 종료할 수 있어요'; end if;
  select * into v_room from hw_rooms where id=v_player.room_id;
  update hw_player_words set is_revealed=true where room_id=v_room.id;
  update hw_rooms set status='done',
    state = state || jsonb_build_object('phase','game_over') where id=v_room.id;
  return json_build_object('ok', true);
end $$;

-- ── grants ──
grant execute on function public.hw_start_game(uuid, int)          to anon, authenticated;
grant execute on function public.hw_get_my_envelope(uuid)          to anon, authenticated;
grant execute on function public.hw_select_envelope(uuid, int)     to anon, authenticated;
grant execute on function public.hw_select_hidden_word(uuid, text) to anon, authenticated;
grant execute on function public.hw_get_my_word(uuid)              to anon, authenticated;
grant execute on function public.hw_submit_clue(uuid, text)        to anon, authenticated;
grant execute on function public.hw_submit_guess(uuid, text)       to anon, authenticated;
grant execute on function public.hw_end_game(uuid)                 to anon, authenticated;
-- 내부 전용(직접 호출 차단)
revoke execute on function public.hw_draw_words(int) from anon, authenticated;

-- ── Realtime ──
alter publication supabase_realtime add table public.hw_envelopes;
alter publication supabase_realtime add table public.hw_clues;
alter publication supabase_realtime add table public.hw_guesses;
alter publication supabase_realtime add table public.hw_scores;
