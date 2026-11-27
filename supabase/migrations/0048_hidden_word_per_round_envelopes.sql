-- 0048 · 히든워드 봉투 모델 재설계 (사용자 확정 §2~§4)
-- 변경 요지:
--   · 라운드 최대 수 제한 제거. 방 생성자가 자유롭게 설정(봉투 5단어는 "한 라운드의 히든워드 후보 5개"일 뿐,
--     전체 라운드 수가 아니다). 단어가 부족하면 임의 중복 없이 부족 수량을 안내한다.           [§2]
--   · 봉투는 매 라운드 새로 생성. 개수 = 참가자 수. 라운드마다 전원이 다시 봉투를 선택.        [§3]
--   · 한 방의 모든 라운드에 걸쳐 봉투에 담긴 단어 전체가 서로 중복되지 않는다(이전 히든워드만이 아니라
--     이전 라운드의 모든 봉투 단어 전부 재사용 금지).                                           [§3]
--   · 출제 순서(player_order)는 시작 시 1회만 추첨, 모든 라운드 동일 유지(이미 보장) — 재셔플 안 함. [§4]
-- 멱등/안전: 전이테이블 구조만 ALTER. 영속 자산·점수(0047) 불변.

-- ── hw_envelopes: 라운드별로 구분 ──
alter table public.hw_envelopes add column if not exists round_no int not null default 1;
alter table public.hw_envelopes drop constraint if exists hw_envelopes_room_id_envelope_number_key;
alter table public.hw_envelopes add constraint hw_envelopes_room_round_num_key
  unique (room_id, round_no, envelope_number);
create index if not exists hw_envelopes_room_round_idx on public.hw_envelopes(room_id, round_no);

-- ════════════════════════════════════════════════════════════════════
-- 봉투 단어 추출 — 방 단위로 과거 라운드 포함 이미 쓴 단어 전부 제외(§3).
--   n_env개 봉투 × 5단어. 봉투마다 5개 서로 다른 카테고리(§5). 부족 시 명확히 안내(임의 중복 금지).
-- ════════════════════════════════════════════════════════════════════
drop function if exists public.hw_draw_envelopes(int);
create or replace function public.hw_draw_envelopes(p_room uuid, n_env int)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  v_result text[] := '{}';
  v_used   text[];
  v_env int; v_i int; v_word text; v_cat text;
  v_need int := n_env * 5;
  v_avail int;
begin
  -- 이 방에서 과거 라운드 포함 이미 쓴 모든 봉투 단어(전역 중복 금지)
  select coalesce(array_agg(w), '{}') into v_used
    from (select distinct unnest(words) as w from public.hw_envelope_words where room_id = p_room) u;

  -- 공급 가능한 단어 수 사전 점검(부족 시 중복 없이 안내)
  select count(*) into v_avail from public.hw_words w
    where w.usable and w.freq >= 500
      and not (w.word = any(v_used))
      and exists (select 1 from public.hw_word_categories wc
                  where wc.word = w.word and wc.category <> '기타');
  if v_avail < v_need then
    raise exception '게임용 단어가 부족해요. 필요 %개, 사용가능 %개(부족 %개). 라운드 수를 줄여주세요.',
      v_need, v_avail, v_need - v_avail;
  end if;

  for v_env in 1..n_env loop
    declare v_cats text[] := '{}';
    begin
      for v_i in 1..5 loop
        select w.word, c.category into v_word, v_cat
        from public.hw_words w
        cross join lateral (
          select wc.category
          from public.hw_word_categories wc
          where wc.word = w.word and wc.category <> '기타'
            and not (wc.category = any(v_cats))
          order by random() limit 1
        ) c
        where w.usable and w.freq >= 500
          and not (w.word = any(v_used))
        order by random() limit 1;

        if v_word is null then
          raise exception '게임용 단어 추출 실패(카테고리 다양성 부족). 라운드 수를 줄여주세요.';
        end if;
        v_used   := v_used   || v_word;
        v_cats   := v_cats   || v_cat;
        v_result := v_result || v_word;
      end loop;
    end;
  end loop;
  return v_result;
end $$;
revoke execute on function public.hw_draw_envelopes(uuid, int) from anon, authenticated;

-- ── 라운드 시작: 현재 라운드용 봉투(=인원수) 새로 생성(내부용) ──
create or replace function public.hw_begin_round(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_count int; v_round int; v_words text[]; v_env uuid; v_i int;
begin
  select (state->>'participant_count')::int, (state->>'round_no')::int
    into v_count, v_round from hw_rooms where id = p_room;
  v_words := public.hw_draw_envelopes(p_room, v_count);  -- 과거 라운드 단어 제외
  for v_i in 1..v_count loop
    insert into hw_envelopes (room_id, round_no, envelope_number)
      values (p_room, v_round, v_i) returning id into v_env;
    insert into hw_envelope_words (envelope_id, room_id, words)
      values (v_env, p_room, v_words[(v_i-1)*5+1 : v_i*5]);
  end loop;
end $$;
revoke execute on function public.hw_begin_round(uuid) from anon, authenticated;

-- ── 게임 시작(방장): 라운드 상한 없음. 라운드1 봉투는 hw_begin_round 로 생성 ──
create or replace function public.hw_start_game(p_token uuid, p_total_rounds int default 1)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_player hw_players; v_room hw_rooms;
  v_count int; v_pids uuid[]; v_rounds int;
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

  v_rounds := greatest(1, coalesce(p_total_rounds, 1));  -- 상한 없음(단어 부족 시 draw 에서 안내)

  -- 출제 순서: 시작 시 1회만 추첨(모든 라운드 동일 유지, §4)
  select array_agg(id) into v_pids
    from (select id from hw_players where room_id = v_room.id order by random()) p;

  insert into hw_scores (player_id, room_id, points)
    select id, v_room.id, 0 from hw_players where room_id = v_room.id
    on conflict (player_id) do update set points = 0;

  update hw_rooms set status = 'playing',
    settings = settings || jsonb_build_object('total_rounds', v_rounds,
                 'total_problems', v_count * v_rounds),
    state = jsonb_build_object(
      'phase','envelope_selection',
      'player_order', to_jsonb(v_pids),
      'participant_count', v_count,
      'configured_rounds', v_rounds,
      'total_problems', v_count * v_rounds,
      'round_no', 1, 'problem_no', 1, 'giver_index', 0,
      'sub','clue', 'attempt_no', 1, 'hints_this_attempt', 0,
      'max_attempts', 3, 'max_hints', 10,
      'unlocked', false, 'current_hint', null)
    where id = v_room.id;

  perform public.hw_begin_round(v_room.id);  -- 라운드1 봉투 생성(상태 설정 후)

  return json_build_object('ok', true, 'player_count', v_count,
    'total_rounds', v_rounds, 'total_problems', v_count * v_rounds);
end $$;

-- ── 문제 정산 + 전이: 라운드 종료 시 봉투 재생성 + 봉투 선택 단계로(§3) ──
create or replace function public.hw_settle_problem(
  p_room uuid, p_solved bool, p_solved_attempt int)
returns bool language plpgsql security definer set search_path = public as $$
declare
  v_state jsonb; v_order uuid[]; v_n int;
  v_round int; v_problem int; v_gi int; v_rounds int; v_giver uuid;
begin
  select state into v_state from hw_rooms where id = p_room;
  select array_agg(x::uuid) into v_order from jsonb_array_elements_text(v_state->'player_order') x;
  v_n       := array_length(v_order,1);
  v_round   := (v_state->>'round_no')::int;
  v_problem := (v_state->>'problem_no')::int;
  v_gi      := (v_state->>'giver_index')::int;
  v_rounds  := (v_state->>'configured_rounds')::int;
  v_giver   := v_order[v_gi + 1];

  -- 중복 정산 방지(0047): 이 문제가 처음 정산될 때만 진행
  insert into hw_problem_settled (room_id, problem_no) values (p_room, v_problem)
    on conflict do nothing;
  if not found then
    return (v_state->>'phase') = 'game_over';
  end if;

  -- 이번 라운드 출제자 히든워드 공개
  update hw_player_words set is_revealed = true
    where room_id = p_room and player_id = v_giver and round_no = v_round;

  -- 점수 지급(0047 최종 규칙)
  perform public.hw_award_scores(p_room, v_round, v_problem, v_giver, p_solved, p_solved_attempt);

  if v_gi + 1 < v_n then
    -- 같은 라운드, 다음 출제자
    update hw_rooms set state = v_state || jsonb_build_object(
      'giver_index', v_gi + 1, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null)
      where id = p_room;
    return false;
  elsif v_round < v_rounds then
    -- 라운드 종료 → 새 봉투 생성 + 봉투 선택 단계(§3)
    update hw_rooms set state = v_state || jsonb_build_object(
      'phase', 'envelope_selection', 'round_no', v_round + 1,
      'giver_index', 0, 'problem_no', v_problem + 1,
      'attempt_no', 1, 'hints_this_attempt', 0, 'sub', 'clue',
      'unlocked', false, 'current_hint', null)
      where id = p_room;
    perform public.hw_begin_round(p_room);  -- 다음 라운드 봉투(과거 단어 제외)
    return false;
  else
    -- 전체 종료 → 모든 히든워드 공개 + 게임오버
    update hw_player_words set is_revealed = true where room_id = p_room;
    update hw_rooms set status = 'done', state = v_state || jsonb_build_object(
      'phase', 'game_over', 'sub', 'clue',
      'unlocked', false, 'current_hint', null)
      where id = p_room;
    return true;
  end if;
end $$;

-- ── 봉투 선택: 현재 라운드 봉투에 한정 ──
create or replace function public.hw_select_envelope(p_token uuid, p_number int)
returns json language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_player hw_players; v_room hw_rooms; v_round int; v_all bool;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select * into v_player from hw_players where id = v_pid;
  select * into v_room from hw_rooms where id = v_player.room_id;
  if (v_room.state->>'phase') <> 'envelope_selection' then raise exception '봉투 선택 단계가 아니에요'; end if;
  v_round := (v_room.state->>'round_no')::int;
  if exists (select 1 from hw_envelopes where room_id=v_room.id and round_no=v_round and selected_by=v_player.id) then
    raise exception '이미 봉투를 선택했어요'; end if;
  if exists (select 1 from hw_envelopes where room_id=v_room.id and round_no=v_round and envelope_number=p_number and selected_by is not null) then
    raise exception '이미 선택된 봉투예요'; end if;
  update hw_envelopes set selected_by=v_player.id
    where room_id=v_room.id and round_no=v_round and envelope_number=p_number;
  if not found then raise exception '봉투를 찾을 수 없어요'; end if;

  -- 전원 선택 완료 → 히든워드 선택 단계
  select (count(*) filter (where selected_by is not null)) >=
         (select count(*) from hw_players where room_id=v_room.id)
    into v_all from hw_envelopes where room_id=v_room.id and round_no=v_round;
  if v_all then
    update hw_rooms set state = jsonb_set(state,'{phase}','"hidden_word_selection"') where id=v_room.id;
  end if;
  return json_build_object('ok', true, 'phase_advanced', v_all);
end $$;

-- ── 내가 선택한 봉투의 단어(현재 라운드, 본인만, §3) ──
create or replace function public.hw_get_my_envelope(p_token uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare v_pid uuid; v_room uuid; v_round int; v_words text[];
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select room_id into v_room from hw_players where id = v_pid;
  select (state->>'round_no')::int into v_round from hw_rooms where id = v_room;
  select ew.words into v_words
    from hw_envelopes e join hw_envelope_words ew on ew.envelope_id = e.id
    where e.room_id = v_room and e.round_no = v_round and e.selected_by = v_pid;
  return v_words;  -- 미선택이면 null
end $$;

-- ── 히든워드 선택: 현재 라운드 봉투 단어 중 ──
create or replace function public.hw_select_hidden_word(p_token uuid, p_word text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid; v_room hw_rooms; v_words text[]; v_w text; v_round int; v_all bool;
begin
  select player_id into v_pid from hw_player_secrets where token=p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;
  select r.* into v_room from hw_rooms r join hw_players p on p.room_id=r.id where p.id=v_pid;
  if (v_room.state->>'phase') <> 'hidden_word_selection' then
    raise exception '히든워드 선택 단계가 아니에요'; end if;
  v_round := (v_room.state->>'round_no')::int;
  if exists (select 1 from hw_player_words where player_id=v_pid and round_no=v_round) then
    raise exception '이미 이번 라운드 히든워드를 선택했어요'; end if;
  select ew.words into v_words from hw_envelopes e join hw_envelope_words ew on ew.envelope_id=e.id
    where e.room_id=v_room.id and e.round_no=v_round and e.selected_by=v_pid;
  if v_words is null then raise exception '선택한 봉투가 없어요'; end if;
  v_w := public.hw_norm(p_word);
  if not (v_w = any(v_words)) then raise exception '봉투에 없는 단어예요'; end if;
  if exists (select 1 from hw_player_words where room_id=v_room.id and player_id=v_pid and hidden_word=v_w) then
    raise exception '이전 라운드에 쓴 단어예요(재사용 불가)'; end if;

  insert into hw_player_words (room_id, player_id, round_no, hidden_word)
    values (v_room.id, v_pid, v_round, v_w);

  -- 전원이 이번 라운드 단어를 골랐으면 라운드 진행 시작
  select (select count(*) from hw_player_words where room_id=v_room.id and round_no=v_round) >=
         (select count(*) from hw_players where room_id=v_room.id) into v_all;
  if v_all then
    update hw_rooms set state = v_room.state || jsonb_build_object(
      'phase','round','sub','clue','giver_index',0,
      'attempt_no',1,'hints_this_attempt',0,'unlocked',false,'current_hint',null)
      where id=v_room.id;
  end if;
  return json_build_object('ok', true, 'phase_advanced', v_all);
end $$;

-- ── grants (재생성 함수) ──
grant execute on function public.hw_start_game(uuid, int)          to anon, authenticated;
grant execute on function public.hw_select_envelope(uuid, int)     to anon, authenticated;
grant execute on function public.hw_get_my_envelope(uuid)          to anon, authenticated;
grant execute on function public.hw_select_hidden_word(uuid, text) to anon, authenticated;
revoke execute on function public.hw_settle_problem(uuid,bool,int) from anon, authenticated;
