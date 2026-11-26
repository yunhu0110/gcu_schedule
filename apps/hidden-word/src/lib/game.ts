/**
 * 게임 진행 API — 봉투(번호만) 선택 → 히든워드 선택 → 라운드 → 종료.
 * 라운드 방식(A안): 라운드마다 출제자 1명이 자기 히든워드를 가지고, 힌트 단어를 한 번에 하나씩
 *   반복 제출. 매 힌트마다 서버가 유사도(히든워드↔힌트)를 계산·전원 공개(#9·#10). 어떤 힌트가
 *   유사도 ≥ 95.0 이면 그 라운드의 '정답 제출'이 열린다(#11). 출제자 외 참가자가 추측 → 정답자 득점.
 * 쓰기는 모두 SECURITY DEFINER RPC 경유. 봉투 단어·히든워드는 공개 테이블에 없고 토큰 RPC로만 조회(#3).
 */
import { supabase } from './supabase';

export type GamePhase =
  | 'lobby'
  | 'envelope_selection'
  | 'hidden_word_selection'
  | 'round'
  | 'game_over';

export type RoundPhase = 'clue' | 'guess';

export type CurrentHint = { word: string; similarity: number } | null;

export type GameState = {
  phase: GamePhase;
  player_order: string[];
  round_index: number;
  round_phase: RoundPhase;
  total_rounds: number;
  unlocked: boolean;
  current_hint: CurrentHint;
};

/** 공개 봉투 — 번호·선택자만. 단어는 선택 전까지 비공개(#3). */
export type Envelope = {
  id: string;
  room_id: string;
  envelope_number: number;
  selected_by: string | null;
};

/** 힌트 — 유사도 전원 공개(#10). 라운드당 여러 번(attempt). */
export type Clue = {
  id: string;
  room_id: string;
  round_index: number;
  player_id: string;
  clue_word: string;
  similarity: number;
  attempt: number;
  submitted_at: string;
};

export type Guess = {
  id: string;
  room_id: string;
  round_index: number;
  guesser_id: string;
  clue_giver_id: string;
  guess_word: string;
  is_correct: boolean;
  is_revealed: boolean;
  submitted_at: string;
};

export type Score = {
  player_id: string;
  room_id: string;
  points: number;
};

// ----------------------------------------------------------------
// 쓰기 (RPC)
// ----------------------------------------------------------------

export async function startGame(token: string, totalRounds: number): Promise<void> {
  const { error } = await supabase.rpc('hw_start_game', { p_token: token, p_total_rounds: totalRounds });
  if (error) throw new Error(error.message);
}

export async function selectEnvelope(token: string, number: number): Promise<void> {
  const { error } = await supabase.rpc('hw_select_envelope', { p_token: token, p_number: number });
  if (error) throw new Error(error.message);
}

/** 내가 선택한 봉투의 단어 5개(본인만). 미선택이면 null. */
export async function getMyEnvelope(token: string): Promise<string[] | null> {
  const { data, error } = await supabase.rpc('hw_get_my_envelope', { p_token: token });
  if (error) throw new Error(error.message);
  return (data as string[] | null) ?? null;
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

/** 힌트 제출(출제자). 반환: 계산된 유사도 + ≥95 개방 여부. */
export async function submitClue(
  token: string,
  clue: string,
): Promise<{ similarity: number; unlocked: boolean; attempt: number }> {
  const { data, error } = await supabase.rpc('hw_submit_clue', { p_token: token, p_clue: clue });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as { similarity?: number; unlocked?: boolean; attempt?: number };
  return { similarity: d.similarity ?? 0, unlocked: !!d.unlocked, attempt: d.attempt ?? 0 };
}

/** 추측 제출(출제자 외). 반환: 전원 제출 완료/게임오버 여부. */
export async function submitGuess(
  token: string,
  guess: string,
): Promise<{ all_guessed: boolean; game_over?: boolean; next_round?: number }> {
  const { data, error } = await supabase.rpc('hw_submit_guess', { p_token: token, p_guess: guess });
  if (error) throw new Error(error.message);
  return (data ?? { all_guessed: false }) as { all_guessed: boolean; game_over?: boolean; next_round?: number };
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
    .select('id, room_id, envelope_number, selected_by')
    .eq('room_id', roomId)
    .order('envelope_number', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Envelope[];
}

export async function fetchClues(roomId: string): Promise<Clue[]> {
  const { data, error } = await supabase
    .from('hw_clues')
    .select('id, room_id, round_index, player_id, clue_word, similarity, attempt, submitted_at')
    .eq('room_id', roomId)
    .order('round_index', { ascending: true })
    .order('attempt', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Clue[];
}

export async function fetchGuesses(roomId: string, roundIndex: number): Promise<Guess[]> {
  const { data, error } = await supabase
    .from('hw_guesses')
    .select('id, room_id, round_index, guesser_id, clue_giver_id, guess_word, is_correct, is_revealed, submitted_at')
    .eq('room_id', roomId)
    .eq('round_index', roundIndex)
    .eq('is_revealed', true);
  if (error) throw new Error(error.message);
  return (data ?? []) as Guess[];
}

/** 공개된(정산/게임오버) 히든워드만. 아직 비공개면 포함되지 않음(#3). player_id→단어 맵. */
export async function fetchRevealedWords(roomId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.rpc('hw_revealed_words', { p_room: roomId });
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { player_id: string; hidden_word: string }[]) out[r.player_id] = r.hidden_word;
  return out;
}

export async function fetchScores(roomId: string): Promise<Score[]> {
  const { data, error } = await supabase
    .from('hw_scores')
    .select('player_id, room_id, points')
    .eq('room_id', roomId);
  if (error) throw new Error(error.message);
  return (data ?? []) as Score[];
}

// ----------------------------------------------------------------
// Realtime 구독 (게임 진행 중 상태 변경)
// ----------------------------------------------------------------

export function subscribeGame(roomId: string, onChange: () => void) {
  const name = `hw-game-${roomId}-${Math.random().toString(36).slice(2, 8)}`;
  const ch = supabase
    .channel(name)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_envelopes', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_clues',     filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_guesses',   filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_scores',    filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ----------------------------------------------------------------
// 헬퍼
// ----------------------------------------------------------------

/** room.state JSONB → GameState 타입 변환 */
export function parseGameState(raw: Record<string, unknown> | null): GameState | null {
  if (!raw) return null;
  const hint = raw.current_hint as { word?: string; similarity?: number } | null | undefined;
  return {
    phase: (raw.phase as GamePhase) ?? 'lobby',
    player_order: (raw.player_order as string[]) ?? [],
    round_index: (raw.round_index as number) ?? 0,
    round_phase: (raw.round_phase as RoundPhase) ?? 'clue',
    total_rounds: (raw.total_rounds as number) ?? 0,
    unlocked: Boolean(raw.unlocked),
    current_hint: hint && hint.word != null
      ? { word: hint.word, similarity: Number(hint.similarity ?? 0) }
      : null,
  };
}

/** 현재 출제자 ID */
export function currentClueGiver(state: GameState): string | null {
  if (!state.player_order.length) return null;
  return state.player_order[state.round_index % state.player_order.length];
}
