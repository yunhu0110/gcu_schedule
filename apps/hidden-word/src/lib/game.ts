/**
 * 게임 진행 API — 봉투(번호만) 선택 → 라운드마다 히든워드 선택 → 문제(회차 재도전) → 종료.
 * 개념(0045/0046 엔진):
 *   · 라운드(round_no)   = 바퀴. 한 바퀴 = 전원이 각자 1번씩 출제. 방장이 1~5 설정.
 *   · 문제(problem_no)   = 전역 출제 단위. total_problems = 인원 × 라운드.
 *   · 회차(attempt_no)   = 한 문제의 재도전 단위(최대 3). 회차마다 힌트→추측 1사이클.
 *   · 힌트(hint_index)   = 회차 내 힌트 제출 차수(최대 10). 소진 시 회차 실패.
 * 출제자가 힌트를 하나씩 제출 → 매 힌트 유사도(히든워드↔힌트) 서버 계산·전원 공개(§9·§10).
 * 유사도 ≥ 95.0 이면 그 회차 '정답 제출'이 열린다(§11). 출제자 외 참가자가 추측 → 정답자 득점.
 * 쓰기는 모두 SECURITY DEFINER RPC 경유. 봉투 단어·히든워드는 공개 테이블에 없고 토큰 RPC로만 조회(§3).
 */
import { supabase } from './supabase';

export type GamePhase =
  | 'lobby'
  | 'envelope_selection'
  | 'hidden_word_selection'
  | 'round'
  | 'game_over';

/** round 단계의 세부 상태 */
export type RoundSub = 'clue' | 'guess';

export type CurrentHint = { word: string; similarity: number } | null;

export type GameState = {
  phase: GamePhase;
  player_order: string[];
  participant_count: number;
  configured_rounds: number;
  total_problems: number;
  round_no: number;       // 현재 바퀴 (1-based)
  problem_no: number;     // 전역 문제 번호 (1-based)
  giver_index: number;    // 현재 라운드 내 출제자 위치 (0-based)
  sub: RoundSub;
  attempt_no: number;     // 회차 (1-based)
  hints_this_attempt: number;
  max_attempts: number;
  max_hints: number;
  unlocked: boolean;
  current_hint: CurrentHint;
  /** 힌트 단계 마감 시각(ISO, 서버 now()+15분). clue 단계에서만 유효, 아니면 null. */
  clue_deadline: string | null;
  /** 정답 단계 마감 시각(ISO, 서버 now()+5분). guess 단계에서만 유효, 아니면 null. */
  guess_deadline: string | null;
};

/** 공개 봉투 — 번호·선택자만. 단어는 선택 전까지 비공개(§3). 매 라운드 새로 생성, 개수 = 참가자 수. */
export type Envelope = {
  id: string;
  room_id: string;
  round_no: number;
  envelope_number: number;
  selected_by: string | null;
};

/** 힌트 — 유사도 전원 공개(§10). 문제·회차·힌트차수로 식별. */
export type Clue = {
  id: string;
  room_id: string;
  round_no: number;
  problem_no: number;
  attempt_no: number;
  hint_index: number;
  player_id: string;
  clue_word: string;
  similarity: number;
  submitted_at: string;
};

export type Guess = {
  id: string;
  room_id: string;
  round_no: number;
  problem_no: number;
  attempt_no: number;
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

export type ClueResult = {
  similarity: number;
  unlocked: boolean;
  attempt: number;
  hint_index?: number;
  attempt_failed?: boolean;
  next_attempt?: number;
  problem_over?: boolean;
  solved?: boolean;
  game_over?: boolean;
};

export type GuessResult = {
  all_guessed: boolean;
  solved?: boolean;
  attempt?: number;
  next_attempt?: number;
  problem_over?: boolean;
  game_over?: boolean;
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

/** 내가 이전 라운드들에 이미 쓴 히든워드(재사용 방지용). */
export async function getMyUsedWords(token: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('hw_get_my_used_words', { p_token: token });
  if (error) throw new Error(error.message);
  return (data as string[] | null) ?? [];
}

export async function selectHiddenWord(token: string, word: string): Promise<void> {
  const { error } = await supabase.rpc('hw_select_hidden_word', { p_token: token, p_word: word });
  if (error) throw new Error(error.message);
}

/** 내 이번 라운드 히든워드(본인). */
export async function getMyWord(token: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('hw_get_my_word', { p_token: token });
  if (error) throw new Error(error.message);
  return data as string | null;
}

/** 힌트 제출(출제자). 유사도 + 개방/회차실패/문제종료 여부. */
export async function submitClue(token: string, clue: string): Promise<ClueResult> {
  const { data, error } = await supabase.rpc('hw_submit_clue', { p_token: token, p_clue: clue });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Partial<ClueResult>;
  return {
    similarity: d.similarity ?? 0,
    unlocked: !!d.unlocked,
    attempt: d.attempt ?? 0,
    hint_index: d.hint_index,
    attempt_failed: d.attempt_failed,
    next_attempt: d.next_attempt,
    problem_over: d.problem_over,
    solved: d.solved,
    game_over: d.game_over,
  };
}

/** 추측 제출(출제자 외). 전원 제출/해결/다음 회차/게임오버 여부. */
export async function submitGuess(token: string, guess: string): Promise<GuessResult> {
  const { data, error } = await supabase.rpc('hw_submit_guess', { p_token: token, p_guess: guess });
  if (error) throw new Error(error.message);
  return (data ?? { all_guessed: false }) as GuessResult;
}

export async function endGame(token: string): Promise<void> {
  const { error } = await supabase.rpc('hw_end_game', { p_token: token });
  if (error) throw new Error(error.message);
}

/** 타이머 진행 — 힌트 15분/정답 5분 마감이 지났으면 서버가 다음 단계로 전이.
 *  토큰 불필요(서버 now() 기준으로 만료된 단계만 진행). 접속 중 아무 클라이언트나 호출. */
export async function tickGame(roomId: string): Promise<{ advanced: boolean; to?: string }> {
  const { data, error } = await supabase.rpc('hw_tick', { p_room: roomId });
  if (error) throw new Error(error.message);
  return (data ?? { advanced: false }) as { advanced: boolean; to?: string };
}

// ----------------------------------------------------------------
// 읽기 (공개 테이블 직접 조회)
// ----------------------------------------------------------------

/** 현재 라운드 봉투만. 봉투는 라운드마다 새로 생성되므로 round 로 필터(§3). */
export async function fetchEnvelopes(roomId: string, roundNo?: number): Promise<Envelope[]> {
  let q = supabase
    .from('hw_envelopes')
    .select('id, room_id, round_no, envelope_number, selected_by')
    .eq('room_id', roomId);
  if (roundNo != null) q = q.eq('round_no', roundNo);
  const { data, error } = await q.order('envelope_number', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Envelope[];
}

export async function fetchClues(roomId: string): Promise<Clue[]> {
  const { data, error } = await supabase
    .from('hw_clues')
    .select('id, room_id, round_no, problem_no, attempt_no, hint_index, player_id, clue_word, similarity, submitted_at')
    .eq('room_id', roomId)
    .order('problem_no', { ascending: true })
    .order('attempt_no', { ascending: true })
    .order('hint_index', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Clue[];
}

/** 특정 문제의 공개된 추측(정산 완료 회차만 is_revealed=true). */
export async function fetchGuesses(roomId: string, problemNo: number): Promise<Guess[]> {
  const { data, error } = await supabase
    .from('hw_guesses')
    .select('id, room_id, round_no, problem_no, attempt_no, guesser_id, clue_giver_id, guess_word, is_correct, is_revealed, submitted_at')
    .eq('room_id', roomId)
    .eq('problem_no', problemNo)
    .eq('is_revealed', true)
    .order('attempt_no', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Guess[];
}

/** 공개된(정산/게임오버) 히든워드만. 키 = `${player_id}:${round_no}`. 아직 비공개면 미포함(§3). */
export async function fetchRevealedWords(roomId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.rpc('hw_revealed_words', { p_room: roomId });
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { player_id: string; round_no: number; hidden_word: string }[]) {
    out[`${r.player_id}:${r.round_no}`] = r.hidden_word;
  }
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
// Realtime 구독
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
  const n = (k: string, d = 0) => (raw[k] as number) ?? d;
  const hint = raw.current_hint as { word?: string; similarity?: number } | null | undefined;
  return {
    phase: (raw.phase as GamePhase) ?? 'lobby',
    player_order: (raw.player_order as string[]) ?? [],
    participant_count: n('participant_count'),
    configured_rounds: n('configured_rounds'),
    total_problems: n('total_problems'),
    round_no: n('round_no', 1),
    problem_no: n('problem_no', 1),
    giver_index: n('giver_index'),
    sub: (raw.sub as RoundSub) ?? 'clue',
    attempt_no: n('attempt_no', 1),
    hints_this_attempt: n('hints_this_attempt'),
    max_attempts: n('max_attempts', 3),
    max_hints: n('max_hints', 10),
    unlocked: Boolean(raw.unlocked),
    current_hint: hint && hint.word != null
      ? { word: hint.word, similarity: Number(hint.similarity ?? 0) }
      : null,
    clue_deadline: (raw.clue_deadline as string | null) ?? null,
    guess_deadline: (raw.guess_deadline as string | null) ?? null,
  };
}

/** 현재 출제자 ID */
export function currentClueGiver(state: GameState): string | null {
  if (!state.player_order.length) return null;
  return state.player_order[state.giver_index] ?? null;
}
