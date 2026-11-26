/**
 * 방 입장 — 방 코드(또는 QR URL의 :code) + 닉네임 + 색상. (2단계: 폼 UI)
 * 실제 입장(코드 검증 + hw_players insert + 닉네임 중복검사)은 3단계에서 연결.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import '../components/ScreenHeader.css';
import { ColorPicker, type PlayerColor } from '../components/ColorPicker';
import '../components/ColorPicker.css';
import { joinRoom } from '../lib/rooms';
import { saveSession } from '../lib/session';
import './Form.css';

export default function JoinRoomScreen() {
  const nav = useNavigate();
  const { code: codeParam } = useParams();
  const [code, setCode] = useState((codeParam ?? '').toUpperCase());
  const [nickname, setNickname] = useState('');
  const [color, setColor] = useState<PlayerColor | null>(null);
  const [busy, setBusy] = useState(false);

  const canJoin = !!(code.trim().length >= 4 && nickname.trim() && color) && !busy;

  async function onJoin() {
    if (!color) return;
    setBusy(true);
    try {
      const r = await joinRoom({ code, nickname, color });
      saveSession({ roomCode: r.code, playerId: r.player_id, token: r.token, isHost: false });
      nav(`/room/${r.code}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : '입장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <ScreenHeader title="방 입장" />
      <div className="form">
        <label className="form__label">방 코드</label>
        <input
          className="field"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="6자리 코드"
          maxLength={6}
          autoCapitalize="characters"
          style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.3em', textAlign: 'center' }}
        />

        <label className="form__label">닉네임</label>
        <input className="field" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임" maxLength={12} />

        <label className="form__label">플레이어 색상</label>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <div className="form__footer">
        <button className="btn btn--primary" disabled={!canJoin} onClick={onJoin}>
          {busy ? '입장 중…' : '입장하기'}
        </button>
      </div>
    </div>
  );
}
