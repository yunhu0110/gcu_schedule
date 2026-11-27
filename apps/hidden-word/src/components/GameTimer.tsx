/**
 * 게임 타이머 — 힌트 15분 / 정답 5분 카운트다운(디지털 패널).
 * deadline(서버 now()+제한) 까지 남은 시간을 매초 표시하고, 0이 되면 hw_tick 을 호출해
 * 서버가 다음 단계로 전이하도록 '넛지'한다(접속 중 아무 클라이언트나 호출 → realtime 반영).
 * deadline 은 오프셋 포함 timestamptz 문자열이라 new Date 로 정확한 시각 파싱이 안전함.
 */
import { useEffect, useRef, useState } from 'react';
import { tickGame } from '../lib/game';
import './GameTimer.css';

type Props = {
  deadline: string | null;
  roomId: string;
  label: string;
};

export function GameTimer({ deadline, roomId, label }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!deadline) return null;
  const end = new Date(deadline).getTime();
  if (Number.isNaN(end)) return null;

  const remainMs = Math.max(0, end - now);
  const remainSec = Math.ceil(remainMs / 1000);

  // 마감 도달 → 서버에 전이 요청(2초에 1번으로 제한, 중복 호출 무해)
  if (remainMs <= 0 && now - lastTick.current > 2000) {
    lastTick.current = now;
    tickGame(roomId).catch(() => { /* realtime 이 상태를 가져옴 */ });
  }

  const mm = Math.floor(remainSec / 60);
  const ss = remainSec % 60;
  const level = remainSec <= 10 ? 'danger' : remainSec <= 60 ? 'warn' : 'ok';

  return (
    <div className={`game-timer game-timer--${level}`}>
      <span className="game-timer__label kicker">{label}</span>
      <span className="game-timer__value mono">
        {mm}:{String(ss).padStart(2, '0')}
      </span>
    </div>
  );
}
