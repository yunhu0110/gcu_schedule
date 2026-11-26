/**
 * 플레이어 세션 — 게스트 식별. join 시 서버가 준 token/playerId를 방 코드별로 localStorage 보관.
 * 새로고침/재접속 시 이 세션으로 복구한다. 토큰은 비공개(공개 데이터에 넣지 않음).
 */
export type Session = { roomCode: string; playerId: string; token: string; isHost: boolean };

const key = (code: string) => `hw_session_${code.toUpperCase()}`;

export function saveSession(s: Session): void {
  sessionStorage.setItem(key(s.roomCode), JSON.stringify(s));
}
export function getSession(code: string): Session | null {
  const raw = sessionStorage.getItem(key(code));
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}
export function clearSession(code: string): void {
  sessionStorage.removeItem(key(code));
}
