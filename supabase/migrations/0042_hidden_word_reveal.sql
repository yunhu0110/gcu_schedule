-- 0042 · 공개된 히든워드 조회 RPC
-- hw_player_words 는 RLS deny-all(비밀 보존) 이라 클라이언트가 직접 못 읽는다.
-- 라운드 정산/게임오버 시 is_revealed=true 로 바뀐 히든워드만 노출하는 읽기 전용 RPC.
-- (아직 비공개인 단어는 절대 반환하지 않음 → #3 유지.)
create or replace function public.hw_revealed_words(p_room uuid)
returns table (player_id uuid, hidden_word text, round_index int)
language sql stable security definer set search_path = public
as $$
  select pw.player_id, pw.hidden_word,
         -- 이 플레이어가 출제자였던 라운드(player_order 상 위치) 계산용: 클라이언트가 참조
         null::int
  from public.hw_player_words pw
  where pw.room_id = p_room and pw.is_revealed = true
$$;

grant execute on function public.hw_revealed_words(uuid) to anon, authenticated;
