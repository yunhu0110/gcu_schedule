/**
 * 게임 진행 API — 봉투 선택 → 히든워드 선택 → 라운드(힌트/추측) → 종료.
 * 쓰기는 모두 SECURITY DEFINER RPC 경유. 읽기는 공개 테이블 직접 조회.
 */
import { supabase } from './supabase';

export type GamePhase =
  | 'lobby'
  | 'envelope_selection'
  | 'hidden_word_selection'
  | 'round'
  | 'game_over';

export type RoundPhase = 'clue' | 'guess';

export type GameState = {
  phase: GamePhase;
  player_order: string[];
  round_index: number;
  round_phase: RoundPhase;
};

export type Envelope = {
  id: string;
  room_id: string;
  envelope_number: number;
  words: string[];
  selected_by: string | null;
};

export type Clue = {
  id: string;
  room_id: string;
  round_index: number;
  player_id: string;
  clue_word: string;
  submitted_at: string;
};

export type Guess = {
  id: string;
  room_id: string;
  round_index: number;
  guesser_id: string;
  clue_giver_id: string;
  guess_word: string;
  similarity_score: number | null;
  is_revealed: boolean;
  submitted_at: string;
};

export type Piece = {
  player_id: string;
  room_id: string;
  pieces: number;
  is_eliminated: boolean;
};

// ----------------------------------------------------------------
// 쓰기 (RPC)
// ----------------------------------------------------------------

export async function startGame(token: string): Promise<void> {
  const { error } = await supabase.rpc('hw_start_game', { p_token: token });
  if (error) throw new Error(error.message);
}

export async function selectEnvelope(token: string, number: number): Promise<void> {
  const { error } = await supabase.rpc('hw_select_envelope', { p_token: token, p_number: number });
  if (error) throw new Error(error.message);
}

export async function selectHiddenWord(token: string, word: string): Promise<void> {
  const { error } = await supabase.rpc('hw_select_hidden_word', { p_token: token, p_word: word });
  if (error) throw new Error(error.message);
}

export async function getMyWord(token: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('hw_get_my_word', { p_token: token });
  if (error) throw new Error(error.message);
  return data as string | null;
}

export async function submitClue(token: string, clue: string): Promise<void> {
  const { error } = await supabase.rpc('hw_submit_clue', { p_token: token, p_clue: clue });
  if (error) throw new Error(error.message);
}

export async function submitGuess(token: string, guess: string): Promise<void> {
  const { error } = await supabase.rpc('hw_submit_guess', { p_token: token, p_guess: guess });
  if (error) throw new Error(error.message);
}

export async function endGame(token: string): Promise<void> {
  const { error } = await supabase.rpc('hw_end_game', { p_token: token });
  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------------
// 읽기 (공개 테이블 직접 조회)
// ----------------------------------------------------------------

export async function fetchEnvelopes(roomId: string): Promise<Envelope[]> {
  const { data, error } = await supabase
    .from('hw_envelopes')
    .select('id, room_id, envelope_number, words, selected_by')
    .eq('room_id', roomId)
    .order('envelope_number', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Envelope[];
}

export async function fetchClues(roomId: string): Promise<Clue[]> {
  const { data, error } = await supabase
    .from('hw_clues')
    .select('id, room_id, round_index, player_id, clue_word, submitted_at')
    .eq('room_id', roomId)
    .order('round_index', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Clue[];
}

export async function fetchGuesses(roomId: string, roundIndex: number): Promise<Guess[]> {
  const { data, error } = await supabase
    .from('hw_guesses')
    .select('id, room_id, round_index, guesser_id, clue_giver_id, guess_word, similarity_score, is_revealed, submitted_at')
    .eq('room_id', roomId)
    .eq('round_index', roundIndex)
    .eq('is_revealed', true);
  if (error) throw new Error(error.message);
  return (data ?? []) as Guess[];
}

export async function fetchPieces(roomId: string): Promise<Piece[]> {
  const { data, error } = await supabase
    .from('hw_pieces')
    .select('player_id, room_id, pieces, is_eliminated')
    .eq('room_id', roomId);
  if (error) throw new Error(error.message);
  return (data ?? []) as Piece[];
}

// ----------------------------------------------------------------
// Realtime 구독 (게임 진행 중 상태 변경)
// ----------------------------------------------------------------

export function subscribeGame(roomId: string, onChange: () => void) {
  const name = `hw-game-${roomId}-${Math.random().toString(36).slice(2, 8)}`;
  const ch = supabase
    .channel(name)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_envelopes',    filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_clues',        filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_guesses',      filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_pieces',       filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ----------------------------------------------------------------
// 헬퍼
// ----------------------------------------------------------------

/** room.state JSONB → GameState 타입 변환 */
export function parseGameState(raw: Record<string, unknown> | null): GameState | null {
  if (!raw) return null;
  return {
    phase: (raw.phase as GamePhase) ?? 'lobby',
    player_order: (raw.player_order as string[]) ?? [],
    round_index: (raw.round_index as number) ?? 0,
    round_phase: (raw.round_phase as RoundPhase) ?? 'clue',
  };
}

/** 현재 출제자 ID */
export function currentClueGiver(state: GameState): string | null {
  if (!state.player_order.length) return null;
  return state.player_order[state.round_index % state.player_order.length];
}
