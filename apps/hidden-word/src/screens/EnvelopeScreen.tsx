/**
 * 봉투 선택 — 각 플레이어가 봉투 하나를 선택. 봉투 안 단어는 선택 전까지 절대 비공개(#3).
 * 번호만 보고 고르고, 선택한 봉투의 단어는 다음(히든워드 선택) 화면에서 본인에게만 공개된다.
 * 취한 봉투는 선택자 닉네임 표시 + 비활성. 선택 완료 후 대기 화면.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScreenHeader } from '../components/ScreenHeader';
import '../components/ScreenHeader.css';
import { fetchEnvelopes, selectEnvelope, subscribeGame, parseGameState, type Envelope } from '../lib/game';
import { fetchPlayers, fetchRoom, subscribeRoom, type Player } from '../lib/rooms';
import { getSession } from '../lib/session';
import './EnvelopeScreen.css';

export default function EnvelopeScreen() {
  const nav = useNavigate();
  const { code = '' } = useParams();
  const session = useMemo(() => getSession(code), [code]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [busy, setBusy] = useState(false);

  const myEnvelope = envelopes.find((e) => e.selected_by === session?.playerId);

  const reload = useCallback(async () => {
    if (!session) return;
    const r = await fetchRoom(code);
    if (!r) return;
    const [pl, env] = await Promise.all([fetchPlayers(r.id), fetchEnvelopes(r.id)]);
    setPlayers(pl);
    setEnvelopes(env);

    const gs = parseGameState(r.state);
    if (gs?.phase === 'hidden_word_selection') nav(`/room/${code}/hidden`);
    else if (gs?.phase === 'round' || gs?.phase === 'game_over') nav(`/room/${code}/play`);
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

  async function handleSelect(num: number) {
    if (!session || busy || myEnvelope) return;
    setBusy(true);
    try {
      await selectEnvelope(session.token, num);
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  }

  const getPlayer = (id: string | null) => players.find((p) => p.id === id);

  return (
    <div className="screen env-screen">
      <ScreenHeader title="봉투 선택" />

      <p className="kicker" style={{ textAlign: 'center', marginBottom: 6 }}>
        {myEnvelope ? `봉투 ${myEnvelope.envelope_number} 선택 완료` : '봉투를 선택하세요'}
      </p>
      <p className="muted env-screen__sub">
        {myEnvelope
          ? '다른 플레이어가 선택하는 중입니다…'
          : '안의 단어는 선택 후에만 당신에게 공개됩니다. 번호로 봉투를 고르세요.'}
      </p>

      <div className="env-screen__grid">
        {envelopes.map((env, i) => {
          const owner = getPlayer(env.selected_by);
          const isMine = env.selected_by === session?.playerId;
          const isTaken = !!env.selected_by && !isMine;
          const isAvailable = !env.selected_by && !myEnvelope;

          return (
            <motion.button
              key={env.id}
              className={`env-card${isMine ? ' is-mine' : ''}${isTaken ? ' is-taken' : ''}${isAvailable ? ' is-available' : ''}`}
              disabled={isTaken || !!myEnvelope || busy}
              onClick={() => handleSelect(env.envelope_number)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              whileTap={isAvailable ? { scale: 0.97 } : undefined}
            >
              <div className="env-card__seal" aria-hidden>✉</div>
              <div className="env-card__num mono">#{env.envelope_number}</div>
              {owner && (
                <motion.div
                  className="env-card__owner"
                  style={{ ['--gem' as string]: owner.color }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                >
                  <span className="env-card__gem" />
                  <span>{isMine ? '나' : owner.nickname}</span>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="env-screen__status">
        <span className="muted">
          {envelopes.filter((e) => e.selected_by).length} / {envelopes.length}명 선택 완료
        </span>
      </div>
    </div>
  );
}
