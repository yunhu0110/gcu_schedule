/**
 * PC 대형 대시보드(사회자/TV 화면) — 토큰 없는 읽기 전용 관전 뷰.
 * 공개 테이블/RPC 만 읽으므로 히든워드·미공개 답안은 노출되지 않는다(공개된 것만 표시).
 * 폰으로 플레이하는 참가자들과 별개로, 큰 화면에 라운드·출제자·힌트·유사도·점수·타이머를
 * 크게 띄우고, 문제가 정산되면 방송형 공개 오버레이를 함께 보여준다.
 * 접속 중인 TV 화면이 hw_tick 을 호출해 타이머를 진행시키는 역할도 겸한다(GameTimer).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GameTimer } from '../components/GameTimer';
import { RevealOverlay } from '../components/RevealOverlay';
import {
  fetchClues, fetchGuesses, fetchScores, fetchRevealedWords,
  parseGameState, currentClueGiver, subscribeGame, tickGame,
  type Clue, type Guess, type Score, type GameState,
} from '../lib/game';
import { fetchPlayers, fetchRoom, subscribeRoom, type Player, type Room } from '../lib/rooms';
import './DashboardScreen.css';

const UNLOCK_AT = 95.0;

export default function DashboardScreen() {
  const { code = '' } = useParams();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [clues, setClues] = useState<Clue[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [curGuesses, setCurGuesses] = useState<Guess[]>([]);
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(async () => {
    const r = await fetchRoom(code);
    if (!r) { setNotFound(true); return; }
    setRoom(r);
    const gs = parseGameState(r.state);
    setGameState(gs);
    const [pl, cl, sc, rv] = await Promise.all([
      fetchPlayers(r.id), fetchClues(r.id), fetchScores(r.id), fetchRevealedWords(r.id),
    ]);
    setPlayers(pl); setClues(cl); setScores(sc); setRevealed(rv);
    setCurGuesses(gs ? await fetchGuesses(r.id, gs.problem_no) : []);
  }, [code]);

  useEffect(() => {
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
  }, [code, reload]);

  // reveal 보류 마감 넛지(hw_tick) — 접속 중인 TV 화면도 전이 넛지에 동참
  useEffect(() => {
    if (!room || gameState?.sub !== 'reveal' || !gameState.reveal_deadline) return;
    const end = new Date(gameState.reveal_deadline).getTime();
    if (Number.isNaN(end)) return;
    const id = setTimeout(() => { tickGame(room.id).catch(() => {}); }, Math.max(0, end - Date.now()) + 500);
    return () => clearTimeout(id);
  }, [room, gameState?.sub, gameState?.reveal_deadline]);

  const giverId = gameState ? currentClueGiver(gameState) : null;
  const giver = players.find((p) => p.id === giverId);
  const hint = gameState?.current_hint ?? null;
  const pointsOf = (id: string) => scores.find((s) => s.player_id === id)?.points ?? 0;
  const ranked = useMemo(
    () => [...players].sort((a, b) => pointsOf(b.id) - pointsOf(a.id)),
    [players, scores], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const problemNo = gameState?.problem_no ?? 1;
  const attemptNo = gameState?.attempt_no ?? 1;
  const attemptClues = useMemo(
    () => clues
      .filter((c) => c.problem_no === problemNo && c.attempt_no === attemptNo)
      .sort((a, b) => a.hint_index - b.hint_index),
    [clues, problemNo, attemptNo],
  );
  const pct = Math.max(0, Math.min(100, hint?.similarity ?? 0));

  if (notFound) {
    return <div className="dashboard dashboard--empty"><p>방을 찾을 수 없어요 — 코드 {code}</p></div>;
  }
  if (!room || !gameState) {
    return <div className="dashboard dashboard--empty"><p className="dashboard__logo">HIDDEN WORD</p></div>;
  }

  const phase = gameState.phase;
  const isRound = phase === 'round';
  const isGameOver = phase === 'game_over';
  const totalRounds = gameState.configured_rounds;
  const totalProblems = gameState.total_problems;

  return (
    <div className="dashboard">
      <header className="dashboard__top">
        <span className="dashboard__logo">HIDDEN WORD</span>
        <span className="dashboard__progress kicker">
          {isGameOver ? '게임 종료'
            : `라운드 ${gameState.round_no}/${totalRounds} · 문제 ${problemNo}/${totalProblems} · ${attemptNo}/${gameState.max_attempts}회차`}
        </span>
        <span className="dashboard__code">ROOM {room.code}</span>
      </header>

      {isGameOver ? (
        <div className="dashboard__final">
          <p className="dashboard__final-title kicker">최종 순위</p>
          <div className="dashboard__final-rows">
            {ranked.map((p, i) => (
              <motion.div
                key={p.id}
                className={`dashboard__final-row${i === 0 ? ' is-winner' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="dashboard__final-rank">{i === 0 ? '♛' : i + 1}</span>
                <span className="dashboard__gem dashboard__gem--lg" style={{ ['--gem' as string]: p.color }} />
                <span className="dashboard__final-name">{p.nickname}</span>
                <span className="dashboard__final-pts mono">{pointsOf(p.id)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="dashboard__grid">
          {/* 좌: 스테이지 */}
          <section className="dashboard__stage">
            {isRound ? (
              <>
                <div className="dashboard__giver">
                  {giver && (
                    <>
                      <motion.span
                        className="dashboard__gem dashboard__gem--lg"
                        style={{ ['--gem' as string]: giver.color }}
                        animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <span className="dashboard__giver-name">{giver.nickname} 출제 중</span>
                    </>
                  )}
                </div>

                <GameTimer
                  deadline={gameState.sub === 'clue' ? gameState.clue_deadline : gameState.guess_deadline}
                  roomId={room.id}
                  label={gameState.sub === 'clue' ? '힌트 시간' : '정답 시간'}
                />

                <div className={`dashboard__spotlight${gameState.unlocked ? ' is-unlocked' : ''}`}>
                  <span className="kicker">현재 힌트</span>
                  {hint ? (
                    <>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={hint.word}
                          className="dashboard__hint-word"
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -16 }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        >
                          {hint.word}
                        </motion.span>
                      </AnimatePresence>
                      <div className="dashboard__gauge">
                        <div
                          className={`dashboard__gauge-fill${gameState.unlocked ? ' is-hit' : ''}`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className="dashboard__gauge-mark" style={{ left: `${UNLOCK_AT}%` }} />
                      </div>
                      <motion.span
                        key={pct}
                        className={`dashboard__sim mono${gameState.unlocked ? ' is-hit' : ''}`}
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        {(hint.similarity ?? 0).toFixed(1)}
                      </motion.span>
                    </>
                  ) : (
                    <p className="dashboard__waiting">{gameState.sub === 'guess' ? '정답 제출 중…' : '첫 힌트 대기 중…'}</p>
                  )}
                </div>

                {attemptClues.length > 1 && (
                  <div className="dashboard__clue-log">
                    {attemptClues.slice(0, -1).map((c) => (
                      <span key={c.id} className="dashboard__clue-chip">
                        {c.clue_word} <b className="mono">{Number(c.similarity).toFixed(0)}</b>
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="dashboard__prep">
                <p className="dashboard__prep-title">
                  {phase === 'envelope_selection' ? '봉투 선택 중' : '히든워드 선택 중'}
                </p>
                <p className="dashboard__waiting">참가자들이 준비하고 있어요…</p>
              </div>
            )}
          </section>

          {/* 우: 점수판 */}
          <aside className="dashboard__board">
            <p className="kicker">점수판</p>
            <div className="dashboard__board-rows">
              {ranked.map((p) => (
                <div key={p.id} className={`dashboard__board-row${giverId === p.id ? ' is-giver' : ''}`}>
                  <span className="dashboard__gem" style={{ ['--gem' as string]: p.color }} />
                  <span className="dashboard__board-name">{p.nickname}{giverId === p.id ? ' · 출제' : ''}</span>
                  <span className="dashboard__board-pts mono">{pointsOf(p.id)}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      <AnimatePresence>
        {gameState.sub === 'reveal' && gameState.reveal && (
          <RevealOverlay
            kind={gameState.reveal.kind}
            isFinal={gameState.reveal.is_final}
            awaitGiver={gameState.reveal.await_giver}
            revealed={gameState.reveal.revealed}
            isGiver={false}
            giver={giver}
            guesses={curGuesses.filter((g) => g.attempt_no === (gameState.reveal?.attempt ?? attemptNo))}
            hiddenWord={giverId ? revealed[`${giverId}:${gameState.round_no}`] : undefined}
            players={players}
            onReveal={() => { /* PC 대시보드는 읽기 전용 */ }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
