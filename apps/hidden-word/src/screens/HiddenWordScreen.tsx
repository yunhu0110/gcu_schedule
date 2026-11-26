/**
 * 히든워드 선택 — 본인 봉투의 단어 5개 중 하나를 비밀 단어로 선택.
 * 선택 후 다른 플레이어들이 고를 때까지 대기.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import '../components/ScreenHeader.css';
import { fetchEnvelopes, selectHiddenWord, subscribeGame, parseGameState, type Envelope } from '../lib/game';
import { fetchRoom, subscribeRoom } from '../lib/rooms';
import { getSession } from '../lib/session';
import './HiddenWordScreen.css';

export default function HiddenWordScreen() {
  const nav = useNavigate();
  const { code = '' } = useParams();
  const session = useMemo(() => getSession(code), [code]);

  const [myEnvelope, setMyEnvelope] = useState<Envelope | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!session) return;
    const r = await fetchRoom(code);
    if (!r) return;
    const envs = await fetchEnvelopes(r.id);
    setMyEnvelope(envs.find((e) => e.selected_by === session.playerId) ?? null);

    const gs = parseGameState(r.state);
    if (gs?.phase === 'round' || gs?.phase === 'game_over') nav(`/room/${code}/play`);
    else if (gs?.phase === 'envelope_selection') nav(`/room/${code}/envelopes`);
  }, [code, nav, session]);

  useEffect(() => {
    if (!session) { nav(`/join/${code}`, { replace: true }); return; }
    let unsubRoom = () => {};
    let unsubGame = () => {};
    reload().then(() => {
      fetchRoom(code).then((r) => {
        if (!r) return;
        unsubRoom = subscribeRoom(r.id, reload);
        unsubGame = subscribeGame(r.id, reload);
      });
    });
    return () => { unsubRoom(); unsubGame(); };
  }, [code, reload, nav, session]);

  async function handleConfirm() {
    if (!session || !selected || busy) return;
    setBusy(true);
    try {
      await selectHiddenWord(session.token, selected);
      setConfirmed(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="screen hw-screen">
      <ScreenHeader title="히든워드 선택" />

      {confirmed ? (
        <div className="hw-screen__done">
          <div className="hw-screen__done-badge">✓</div>
          <p className="hw-screen__done-title" style={{ fontFamily: 'var(--font-serif)' }}>
            선택 완료
          </p>
          <p className="muted hw-screen__done-word">
            나의 히든워드: <strong style={{ color: 'var(--gold)' }}>{selected}</strong>
          </p>
          <p className="muted" style={{ fontSize: 13, marginTop: 24 }}>
            다른 플레이어들이 선택하는 중입니다…
          </p>
        </div>
      ) : (
        <>
          <p className="kicker" style={{ textAlign: 'center', marginBottom: 6 }}>
            나의 봉투 #{myEnvelope?.envelope_number}
          </p>
          <p className="muted hw-screen__sub">
            아무도 모르게 하나를 선택하세요. 이 단어가 게임 내내 당신의 비밀입니다.
          </p>

          {!myEnvelope ? (
            <p className="muted" style={{ textAlign: 'center', marginTop: 40 }}>봉투를 불러오는 중…</p>
          ) : (
            <div className="hw-screen__words">
              {myEnvelope.words.map((w) => (
                <button
                  key={w}
                  className={`hw-word-btn${selected === w ? ' is-selected' : ''}`}
                  onClick={() => setSelected(w)}
                >
                  <span className="hw-word-btn__text">{w}</span>
                  {selected === w && <span className="hw-word-btn__check">✓</span>}
                </button>
              ))}
            </div>
          )}

          <div className="hw-screen__footer">
            <button
              className="btn btn--primary"
              disabled={!selected || busy}
              onClick={handleConfirm}
            >
              {busy ? '확인 중…' : selected ? `"${selected}" 선택하기` : '단어를 선택하세요'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
