/**
 * 방/참가자 API — Supabase RPC(쓰기) + 공개 조회 + Realtime 구독.
 * 쓰기는 전부 SECURITY DEFINER RPC 경유(검증). 비밀 토큰은 RPC 반환값으로만 받는다.
 */
import { supabase } from './supabase';

export type Player = {
  id: string; room_id: string; nickname: string; color: string;
  is_host: boolean; is_ready: boolean; order_index: number | null; online: boolean;
};
export type Room = {
  id: string; code: string; name: string; max_players: number;
  host_mode: boolean; status: 'lobby' | 'playing' | 'done'; host_player_id: string | null;
  state: Record<string, unknown> | null;
};
export type JoinResult = { room_id: string; code: string; player_id: string; token: string; is_host: boolean };

export async function createRoom(args: {
  name: string; maxPlayers: number; nickname: string; color: string; hostMode: boolean;
}): Promise<JoinResult> {
  const { data, error } = await supabase.rpc('hw_create_room', {
    p_name: args.name, p_max: args.maxPlayers, p_nickname: args.nickname,
    p_color: args.color, p_host_mode: args.hostMode,
  });
  if (error) throw new Error(error.message);
  return data as JoinResult;
}

export async function joinRoom(args: { code: string; nickname: string; color: string }): Promise<JoinResult> {
  const { data, error } = await supabase.rpc('hw_join_room', {
    p_code: args.code.toUpperCase(), p_nickname: args.nickname, p_color: args.color,
  });
  if (error) throw new Error(error.message);
  return data as JoinResult;
}

export async function setReady(token: string, ready: boolean): Promise<void> {
  const { error } = await supabase.rpc('hw_set_ready', { p_token: token, p_ready: ready });
  if (error) throw new Error(error.message);
}

export async function fetchRoom(code: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('hw_rooms')
    .select('id, code, name, max_players, host_mode, status, host_player_id, state')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Room) ?? null;
}

export async function fetchPlayers(roomId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('hw_players')
    .select('id, room_id, nickname, color, is_host, is_ready, order_index, online')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Player[];
}

/** 방/참가자 실시간 변경 구독. 변경 시 onChange() 호출(재조회 트리거). */
export function subscribeRoom(roomId: string, onChange: () => void) {
  const name = `hw-room-${roomId}-${Math.random().toString(36).slice(2, 8)}`;
  const ch = supabase
    .channel(name)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_players', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_rooms', filter: `id=eq.${roomId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
