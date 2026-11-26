/**
 * 히든워드 선택 — 본인 봉투의 단어 5개 중 하나를 비밀 단어로 선택.
 * 선택 후 다른 플레이어들이 고를 때까지 대기.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScreenHeader } from '../components/ScreenHeader';
import '../components/ScreenHeader.css';
import { fetchEnvelopes, getMyEnvelope, selectHiddenWord, subscribeGame, parseGameState, type Envelope } from '../lib/game';
import { fetchRoom, subscribeRoom } from '../lib/rooms';
import { getSession } from '../lib/session';
import './HiddenWordScreen.css';

export default function HiddenWordScreen() {
  const nav = useNavigate();
  const { code = '' } = useParams();
  const session = useMemo(() => getSession(code), [code]);

  const [myEnvelope, setMyEnvelope] = useState<Envelope | null>(null);
  const [words, setWords] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!session) return;
    const r = await fetchRoom(code);
    if (!r) return;
    const envs = await fetchEnvelopes(r.id);
    setMyEnvelope(envs.find((e) => e.selected_by === session.playerId) ?? null);
    // 봉투 단어는 본인 전용 RPC로만 조회(#3) — 1회 로드
    if (words == null) {
      try { setWords(await getMyEnvelope(session.token)); } catch { /* 대기 */ }
    }

    const gs = parseGameState(r.state);
    if (gs?.phase === 'round' || gs?.phase === 'game_over') nav(`/room/${code}/play`);
    else if (gs?.phase === 'envelope_selection') nav(`/room/${code}/envelopes`);
  }, [code, nav, session, words]);

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
          <motion.div
            className="hw-screen__done-badge"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
          >
            ✓
          </motion.div>
          <motion.p
            className="hw-screen__done-title"
            style={{ fontFamily: 'var(--font-serif)' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            선택 완료
          </motion.p>
          <motion.p
            className="muted hw-screen__done-word"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            나의 히든워드: <strong style={{ color: 'var(--gold)' }}>{selected}</strong>
          </motion.p>
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

          {!words ? (
            <p className="muted" style={{ textAlign: 'center', marginTop: 40 }}>봉투를 불러오는 중…</p>
          ) : (
            <div className="hw-screen__words">
              {words.map((w, i) => (
                <motion.button
                  key={w}
                  className={`hw-word-btn${selected === w ? ' is-selected' : ''}`}
                  onClick={() => setSelected(w)}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="hw-word-btn__text">{w}</span>
                  {selected === w && <span className="hw-word-btn__check">✓</span>}
                </motion.button>
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
