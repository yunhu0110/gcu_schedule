-- 0044 · "라운드" 정의를 턴→바퀴로 변경 (사용자 확정)
-- 기존: total_rounds = 출제 "턴" 수 (round_index 가 total_rounds 에 닿으면 종료).
-- 변경: total_rounds = "바퀴" 수. 한 바퀴 = 전원이 각자 1번씩 출제.
--       3명·3라운드 = 3명이 각자 3번씩 = 9턴. 종료 조건을 total_rounds × 인원수 로.
--       출제자 로테이션(round_index % 인원수)은 그대로 두면 바퀴가 자동으로 돈다.
-- 기본값도 6→1 라운드, 범위 3~30 → 1~10 으로 조정.

-- 0028 유래 구버전 1-인자 오버로드 제거(2-인자 버전과의 호출 모호성 방지).
drop function if exists public.hw_start_game(uuid);

-- ── 게임 시작(방장): 라운드(바퀴) 수 설정, 봉투 6개(각 5단어) 무작위 생성 ──
create or replace function public.hw_start_game(p_token uuid, p_total_rounds int default 1)
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

  v_rounds := least(10, greatest(1, coalesce(p_total_rounds, 1)));  -- 바퀴 수 (1~10, 기본 1)

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

-- ── 추측 제출 + 라운드 정산 (종료 조건만 '바퀴' 기준으로 변경) ──
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

  -- 턴 종료 → 해당 출제자 히든워드 공개
  update hw_player_words set is_revealed=true where player_id=v_giver;

  -- 총 턴 수 = 바퀴 수 × 인원수. 마지막 턴이면 게임오버.
  v_total := (v_state->>'total_rounds')::int * array_length(v_order,1);
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
