/**
 * 메인 게임 화면 — round phase 관리.
 * 출제자: 힌트 단어 입력. 추측자: 힌트 확인 후 단어 추측. 출제자는 추측 불가.
 * 힌트 이력(라운드별 누적), 현재 출제자/라운드 표시, 결과(추측 공개) 표시.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ScreenHeader } from '../components/ScreenHeader';
import '../components/ScreenHeader.css';
import {
  fetchClues, fetchGuesses, fetchPieces, getMyWord,
  submitClue, submitGuess, endGame, subscribeGame,
  parseGameState, currentClueGiver,
  type Clue, type Guess, type Piece, type GameState,
} from '../lib/game';
import { fetchPlayers, fetchRoom, subscribeRoom, type Player, type Room } from '../lib/rooms';
import { getSession } from '../lib/session';
import './GameScreen.css';

export default function GameScreen() {
  const nav = useNavigate();
  const { code = '' } = useParams();
  const session = useMemo(() => getSession(code), [code]);

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [clues, setClues] = useState<Clue[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [myWord, setMyWord] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const cluesRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    if (!session) return;
    const r = await fetchRoom(code);
    if (!r) return;
    setRoom(r);

    const gs = parseGameState(r.state);
    setGameState(gs);

    if (gs?.phase === 'envelope_selection') { nav(`/room/${code}/envelopes`); return; }
    if (gs?.phase === 'hidden_word_selection') { nav(`/room/${code}/hidden`); return; }

    const [pl, cl, pc] = await Promise.all([
      fetchPlayers(r.id),
      fetchClues(r.id),
      fetchPieces(r.id),
    ]);
    setPlayers(pl);
    setClues(cl);
    setPieces(pc);

    // 현재 라운드 추측 (공개된 것만)
    if (gs) {
      const gu = await fetchGuesses(r.id, gs.round_index > 0 ? gs.round_index - 1 : 0);
      setGuesses(gu);
    }
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
      // 내 히든워드 (1회만)
      if (session.token) {
        getMyWord(session.token).then(setMyWord).catch(() => {});
      }
    });
    return () => { unsubRoom(); unsubGame(); };
  }, [code, reload, nav, session]);

  // 힌트 목록 스크롤 하단 고정
  useEffect(() => {
    if (cluesRef.current) cluesRef.current.scrollTop = cluesRef.current.scrollHeight;
  }, [clues]);

  const me = players.find((p) => p.id === session?.playerId);
  const cluGiverId = gameState ? currentClueGiver(gameState) : null;
  const isCluGiver = cluGiverId === session?.playerId;
  const cluGiver = players.find((p) => p.id === cluGiverId);

  const curRoundIndex = gameState?.round_index ?? 0;
  const roundPhase = gameState?.round_phase ?? 'clue';
  const isGameOver = gameState?.phase === 'game_over';

  // 내가 이번 라운드에 힌트/추측을 제출했는지
  const mySubmittedClue = clues.find(
    (c) => c.round_index === curRoundIndex && c.player_id === session?.playerId,
  );
  const alreadySubmitted = submitted || !!mySubmittedClue;

  async function handleSubmitClue() {
    if (!session || busy || !input.trim()) return;
    setBusy(true);
    try {
      await submitClue(session.token, input.trim());
      setInput('');
      setSubmitted(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitGuess() {
    if (!session || busy || !input.trim()) return;
    setBusy(true);
    try {
      await submitGuess(session.token, input.trim());
      setInput('');
      setSubmitted(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEndGame() {
    if (!session || !me?.is_host) return;
    setBusy(true);
    try { await endGame(session.token); } catch (e) { alert(e instanceof Error ? e.message : '오류'); }
    finally { setBusy(false); setConfirmEnd(false); }
  }

  // 라운드 변경 시 submitted 초기화
  useEffect(() => { setSubmitted(false); }, [curRoundIndex, roundPhase]);

  const getPlayer = (id: string) => players.find((p) => p.id === id);
  const getPieces = (playerId: string) => pieces.find((p) => p.player_id === playerId)?.pieces ?? '—';

  if (!room || !gameState) {
    return <div className="screen"><ScreenHeader title="히든 워드" /></div>;
  }

  // 게임 종료 화면
  if (isGameOver) {
    const pieceOf = (id: string) => pieces.find((p) => p.player_id === id)?.pieces ?? 0;
    const rankedPlayers = [...players].sort((a, b) => pieceOf(b.id) - pieceOf(a.id));
    return (
      <div className="screen game-screen">
        <ScreenHeader title="게임 종료" />
        <div className="game-screen__over">
          <motion.p
            className="kicker"
            style={{ textAlign: 'center', marginBottom: 12 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            결과
          </motion.p>
          <div className="game-screen__scores">
            {rankedPlayers.map((p, i) => (
              <motion.div
                key={p.id}
                className={`game-screen__score-row panel${i === 0 ? ' is-winner' : ''}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {i === 0 && <span className="game-screen__crown">♛</span>}
                <span className="game-screen__score-gem" style={{ ['--gem' as string]: p.color }} />
                <span className="game-screen__score-name">{p.nickname}</span>
                <span className="game-screen__score-pieces mono">{getPieces(p.id)}</span>
                <span className="muted" style={{ fontSize: 12 }}>피스</span>
              </motion.div>
            ))}
          </div>
          <motion.button
            className="btn"
            style={{ marginTop: 24 }}
            onClick={() => nav('/')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 + rankedPlayers.length * 0.12 + 0.2 }}
          >
            처음으로
          </motion.button>
        </div>
      </div>
    );
  }

  // 힌트 이력 — 현재 라운드까지 (출제자별 힌트 목록)
  const cluesByRound: Record<number, Clue[]> = {};
  clues.forEach((c) => {
    if (!cluesByRound[c.round_index]) cluesByRound[c.round_index] = [];
    cluesByRound[c.round_index].push(c);
  });

  return (
    <div className="screen game-screen">
      <ScreenHeader title="히든 워드" />

      {/* 현재 상태 배지 */}
      <div className="game-screen__status">
        <span className="game-screen__round kicker">라운드 {curRoundIndex + 1}</span>
        {cluGiver && (
          <span className="game-screen__giver">
            <motion.span
              className="game-screen__giver-gem"
              style={{ ['--gem' as string]: cluGiver.color }}
              animate={{ opacity: [1, 0.4, 1], scale: [1, 1.25, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            {isCluGiver ? '나' : cluGiver.nickname} 출제 중
          </span>
        )}
      </div>

      {/* 내 히든워드 (항상 표시) */}
      {myWord && (
        <div className="game-screen__my-word panel">
          <span className="kicker" style={{ fontSize: 10 }}>내 히든워드</span>
          <span className="game-screen__my-word-val mono">{myWord}</span>
        </div>
      )}

      {/* 힌트 이력 */}
      <div className="game-screen__clue-log" ref={cluesRef}>
        {Object.keys(cluesByRound).length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13, padding: '12px 0' }}>
            아직 힌트가 없어요
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {Object.entries(cluesByRound).map(([ri, cs]) => {
              const giver = getPlayer(cs[0].player_id);
              return (
                <motion.div
                  key={ri}
                  className="game-screen__clue-row"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className="game-screen__clue-gem" style={{ ['--gem' as string]: giver?.color ?? '#888' }} />
                  <div className="game-screen__clue-body">
                    <span className="game-screen__clue-who muted">{giver?.nickname ?? '?'} · R{Number(ri) + 1}</span>
                    <span className="game-screen__clue-word">{cs[0].clue_word}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* 직전 라운드 추측 결과 (공개된 것) */}
      <AnimatePresence>
        {guesses.length > 0 && (
          <motion.div
            className="game-screen__guesses panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="kicker" style={{ fontSize: 10, marginBottom: 8 }}>이전 라운드 추측 결과</p>
            {guesses.map((g, i) => {
              const gsr = getPlayer(g.guesser_id);
              return (
                <motion.div
                  key={g.id}
                  className="game-screen__guess-row"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                >
                  <span className="game-screen__clue-gem" style={{ ['--gem' as string]: gsr?.color ?? '#888' }} />
                  <span className="game-screen__guess-word">{g.guess_word}</span>
                  {g.similarity_score != null ? (
                    <motion.span
                      className="mono glow-green"
                      style={{ fontSize: 14 }}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.08 + 0.15, type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      {g.similarity_score.toFixed(0)}
                    </motion.span>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>—</span>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 입력 영역 */}
      <div className="game-screen__input-area">
        {roundPhase === 'guess' && isCluGiver ? (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13, padding: '8px 0' }}>
            플레이어들이 추측하는 중입니다…
          </p>
        ) : alreadySubmitted ? (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13, padding: '8px 0' }}>
            {roundPhase === 'clue' ? '힌트를 제출했어요. 대기 중…' : '추측을 제출했어요. 결과 대기 중…'}
          </p>
        ) : roundPhase === 'clue' && isCluGiver ? (
          <>
            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              당신의 히든워드와 관련된 단어를 하나 힌트로 제출하세요.
            </p>
            <div className="game-screen__input-row">
              <input
                className="field"
                placeholder="힌트 단어"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitClue(); }}
                maxLength={20}
                autoFocus
              />
              <button className="btn btn--primary" disabled={!input.trim() || busy} onClick={handleSubmitClue}>
                제출
              </button>
            </div>
          </>
        ) : roundPhase === 'clue' && !isCluGiver ? (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13, padding: '8px 0' }}>
            {cluGiver?.nickname ?? '출제자'}의 힌트를 기다리는 중…
          </p>
        ) : roundPhase === 'guess' && !isCluGiver ? (
          <>
            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              {cluGiver?.nickname ?? '출제자'}의 히든워드를 추측하세요.
            </p>
            <div className="game-screen__input-row">
              <input
                className="field"
                placeholder="추측 단어"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitGuess(); }}
                maxLength={20}
                autoFocus
              />
              <button className="btn btn--primary" disabled={!input.trim() || busy} onClick={handleSubmitGuess}>
                제출
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* 방장: 게임 종료 버튼 + 인라인 확인 */}
      {me?.is_host && (
        <AnimatePresence mode="wait" initial={false}>
          {confirmEnd ? (
            <motion.div
              key="confirm"
              className="game-screen__end-confirm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="muted game-screen__end-ask">게임을 종료하고 결과를 확인할까요?</span>
              <div className="game-screen__end-actions">
                <button className="btn btn--ghost" onClick={() => setConfirmEnd(false)} disabled={busy}>
                  취소
                </button>
                <button className="btn btn--primary" onClick={handleEndGame} disabled={busy}>
                  {busy ? '종료 중…' : '종료'}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="end"
              className="btn btn--ghost"
              style={{ marginTop: 10 }}
              onClick={() => setConfirmEnd(true)}
              disabled={busy}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              게임 종료
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
