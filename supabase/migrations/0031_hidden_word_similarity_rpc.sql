-- 0031 · 히든 워드 유사도 채점 RPC + 추측 제출 연결
-- hw_similarity(히든워드, 추측어) → 0.00~100.00 (3축 가중 블렌드). 데이터 미적재 시 null.
-- hw_submit_guess 가 추측 저장 시 이 점수를 함께 기록한다. 히든워드는 함수 내부에서만 읽혀 노출되지 않는다.

-- ============================================================
-- 3축 블렌드 채점기
--   p_a = 정답(히든워드, 풀 단어 → 적재되면 항상 벡터 존재)
--   p_b = 추측어(자유 입력 명사 → 벡터 없을 수 있음=OOV)
--
--   축1 의미 cosine, 축2 문맥 PPMI, 축3 관계(유의/상하위어=+, 반의어=강한 감점).
--   사용 가능한 축만으로 가중 정규화. 정답 벡터 자체가 없으면(=엔진 미적재) null 반환 → 현행 동작 유지.
-- ============================================================
create or replace function public.hw_similarity(p_a text, p_b text)
returns numeric
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  na text := lower(trim(p_a));
  nb text := lower(trim(p_b));
  va extensions.vector(300);
  vb extensions.vector(300);
  -- 축별 성분(0~1)과 가중치
  sem        real;   has_sem boolean := false;  w_sem constant real := 0.55;
  ctx        real := 0;                          w_ctx constant real := 0.20;
  rel        real := 0;                          w_rel constant real := 0.25;
  has_rel    boolean := false;
  is_antonym boolean := false;
  ppmi_cap   constant real := 8.0;   -- 이 이상의 PPMI는 1.0으로 포화
  wsum       real := 0;
  acc        real := 0;
  score01    real;
begin
  if na = '' or nb = '' then return null; end if;
  if na = nb then return 100.00; end if;

  select vec into va from hw_word_vectors where word = na;
  if va is null then
    -- 정답 단어의 벡터조차 없음 = 엔진 데이터 미적재. 점수 미계산(현행 동작).
    return null;
  end if;

  -- 축1 · 의미 (cosine). 추측어 벡터가 있을 때만.
  select vec into vb from hw_word_vectors where word = nb;
  if vb is not null then
    sem := greatest(0.0, 1.0 - (va <=> vb));   -- <=> cosine 거리(0~2) → 유사도(0~1)
    has_sem := true;
  end if;

  -- 축2 · 문맥 (PPMI, 무방향 쌍)
  select least(1.0, ppmi / ppmi_cap) into ctx
    from hw_word_cooc
   where word_a = least(na, nb) and word_b = greatest(na, nb);
  ctx := coalesce(ctx, 0);

  -- 축3 · 관계 (양방향 조회). 유의어=1.0, 상/하위어=0.7, 반의어=페널티 플래그.
  select
      coalesce(max(case relation
        when 'synonym' then 1.0 * weight
        when 'hypernym' then 0.7 * weight
        when 'hyponym'  then 0.7 * weight
        else 0 end), 0),
      bool_or(relation = 'antonym')
    into rel, is_antonym
    from hw_word_relations
   where (word = na and related = nb) or (word = nb and related = na);
  rel := coalesce(rel, 0);
  is_antonym := coalesce(is_antonym, false);
  if rel > 0 then has_rel := true; end if;

  -- 사용 가능한 축만으로 가중 정규화
  if has_sem then wsum := wsum + w_sem; acc := acc + w_sem * sem; end if;
  if ctx > 0 then wsum := wsum + w_ctx; acc := acc + w_ctx * ctx; end if;
  if has_rel then wsum := wsum + w_rel; acc := acc + w_rel * rel; end if;

  if wsum = 0 then
    -- 정답 벡터는 있는데 추측어는 어느 축에도 안 걸림 = 매우 동떨어진 추측.
    return 0.00;
  end if;
  score01 := acc / wsum;

  -- 반의어는 fastText 상 가깝게 나오지만 게임에선 '먼' 단어 → 강하게 눌러준다.
  if is_antonym then score01 := least(score01 * 0.20, 0.12); end if;

  return round((100.0 * greatest(0.0, least(1.0, score01)))::numeric, 2);
end $$;

-- 내부 전용: anon/authenticated 에게 execute 부여하지 않는다(임의 쌍 탐침 차단).
revoke all on function public.hw_similarity(text, text) from anon, authenticated;

-- ============================================================
-- 추측 제출 RPC 재정의 — similarity_score 를 함께 기록.
-- (0028 의 본문과 동일하되, insert 시 점수 계산 추가)
-- ============================================================
create or replace function public.hw_submit_guess(p_token uuid, p_guess text)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_pid           uuid;
  v_player        hw_players;
  v_room          hw_rooms;
  v_state         jsonb;
  v_order         uuid[];
  v_round_index   int;
  v_clue_giver_id uuid;
  v_hidden        text;
  v_score         numeric(5,2);
  v_pcount        int;
  v_gcount        int;
  v_new_state     jsonb;
begin
  select player_id into v_pid from hw_player_secrets where token = p_token;
  if v_pid is null then raise exception '세션을 찾을 수 없어요'; end if;

  select * into v_player from hw_players where id = v_pid;
  select * into v_room   from hw_rooms   where id = v_player.room_id;
  v_state := v_room.state;

  if (v_state->>'phase') <> 'round'  then raise exception '라운드 진행 중이 아니에요'; end if;
  if (v_state->>'round_phase') <> 'guess' then raise exception '추측 단계가 아니에요'; end if;
  if coalesce(trim(p_guess),'') = ''       then raise exception '추측 단어를 입력해주세요'; end if;

  select array_agg(x::uuid) into v_order
    from jsonb_array_elements_text(v_state->'player_order') x;
  v_round_index   := (v_state->>'round_index')::int;
  v_clue_giver_id := v_order[(v_round_index % array_length(v_order, 1)) + 1];

  if v_clue_giver_id = v_player.id then raise exception '출제자는 추측할 수 없어요'; end if;
  if exists (select 1 from hw_guesses
    where room_id = v_room.id and round_index = v_round_index and guesser_id = v_player.id)
  then raise exception '이미 추측을 제출했어요'; end if;

  -- 출제자의 히든워드를 함수 내부에서만 읽어 유사도 계산(외부 노출 없음). 미적재 시 null.
  select hidden_word into v_hidden from hw_player_words where player_id = v_clue_giver_id;
  v_score := hw_similarity(v_hidden, trim(p_guess));

  insert into hw_guesses (room_id, round_index, guesser_id, clue_giver_id, guess_word, similarity_score)
  values (v_room.id, v_round_index, v_player.id, v_clue_giver_id, trim(p_guess), v_score);

  -- 출제자 제외 전원이 제출했는지 확인
  select count(*)::int into v_pcount from hw_players
    where room_id = v_room.id and id <> v_clue_giver_id;
  select count(*)::int into v_gcount from hw_guesses
    where room_id = v_room.id and round_index = v_round_index;

  if v_gcount >= v_pcount then
    update hw_guesses set is_revealed = true
      where room_id = v_room.id and round_index = v_round_index;

    v_new_state := v_state
      || jsonb_build_object('round_index', v_round_index + 1, 'round_phase', 'clue');
    update hw_rooms set state = v_new_state where id = v_room.id;
  end if;

  return json_build_object('ok', true, 'all_guessed', (v_gcount >= v_pcount));
end $$;

grant execute on function public.hw_submit_guess(uuid, text) to anon, authenticated;
