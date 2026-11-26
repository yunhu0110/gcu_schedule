/**
 * 방 만들기 — 방이름/인원/방장 닉네임/색상/사회자 모드. (2단계: 폼 UI + 로컬 상태)
 * 실제 방 생성(Supabase hw_rooms insert + RPC)은 3단계에서 연결한다.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import '../components/ScreenHeader.css';
import { ColorPicker, type PlayerColor } from '../components/ColorPicker';
import '../components/ColorPicker.css';
import { createRoom } from '../lib/rooms';
import { saveSession } from '../lib/session';
import './Form.css';

export default function CreateRoomScreen() {
  const nav = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [nickname, setNickname] = useState('');
  const [color, setColor] = useState<PlayerColor | null>(null);
  const [hostMode, setHostMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const canCreate = !!(roomName.trim() && nickname.trim() && color) && !busy;

  async function onCreate() {
    if (!color) return;
    setBusy(true);
    try {
      const r = await createRoom({ name: roomName, maxPlayers, nickname, color, hostMode });
      saveSession({ roomCode: r.code, playerId: r.player_id, token: r.token, isHost: true });
      nav(`/room/${r.code}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : '방을 만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <ScreenHeader title="방 만들기" />

      <div className="form">
        <label className="form__label">방 이름</label>
        <input className="field" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="예: 목요일 히든워드" maxLength={20} />

        <label className="form__label">참가 인원 (최대 10명 · 봉투는 참가 인원 수만큼)</label>
        <div className="seg seg--wrap">
          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button key={n} className={`seg__item${maxPlayers === n ? ' is-on' : ''}`} onClick={() => setMaxPlayers(n)}>{n}</button>
          ))}
        </div>

        <label className="form__label">방장 닉네임</label>
        <input className="field" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" maxLength={12} />

        <label className="form__label">플레이어 색상</label>
        <ColorPicker value={color} onChange={setColor} />

        <label className="form__toggle">
          <span>사회자 모드 (PC 대시보드)</span>
          <input type="checkbox" checked={hostMode} onChange={(e) => setHostMode(e.target.checked)} />
          <span className={`switch${hostMode ? ' is-on' : ''}`} />
        </label>
        <p className="muted form__hint">켜면 PC 대형 화면용 대시보드 접속 링크를 제공합니다. 꺼도 스마트폰만으로 게임 전체 진행 가능.</p>
      </div>

      <div className="form__footer">
        <button className="btn btn--primary" disabled={!canCreate} onClick={onCreate}>
          {busy ? '만드는 중…' : '방 만들기'}
        </button>
      </div>
    </div>
  );
}
