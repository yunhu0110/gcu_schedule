/**
 * 메인 게임 화면 — A안 라운드 진행.
 * 라운드마다 출제자 1명이 자기 히든워드에 대한 힌트를 한 번에 하나씩 반복 제출.
 * 매 힌트의 유사도(히든워드↔힌트)를 전원에게 공개(#9·#10). 어떤 힌트가 ≥95.0 이면(#11)
 * 그 라운드의 '정답 제출'이 열리고, 출제자 외 참가자가 히든워드를 추측 → 정답자 득점.
 * 점수판·현재 힌트 스포트라이트·직전 라운드 결과(공개된 추측 + 정답) 표시.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ScreenHeader } from '../components/ScreenHeader';
import '../components/ScreenHeader.css';
import { GameTimer } from '../components/GameTimer';
import { RevealOverlay } from '../components/RevealOverlay';
import {
  fetchClues, fetchGuesses, fetchScores, fetchRevealedWords, getMyWord,
  submitClue, submitGuess, updateGuess, fetchMyGuess, endGame, revealAnswer, tickGame, subscribeGame,
  parseGameState, currentClueGiver,
  type Clue, type Guess, type Score, type GameState,
} from '../lib/game';
import { fetchPlayers, fetchRoom, subscribeRoom, type Player, type Room } from '../lib/rooms';
import { getSession } from '../lib/session';
import './GameScreen.css';

const UNLOCK_AT = 95.0; // #11

export default function GameScreen() {
  const nav = useNavigate();
  const { code = '' } = useParams();
  const session = useMemo(() => getSession(code), [code]);

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [clues, setClues] = useState<Clue[]>([]);
  const [prevGuesses, setPrevGuesses] = useState<Guess[]>([]);
  const [curGuesses, setCurGuesses] = useState<Guess[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [myWord, setMyWord] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [guessedRound, setGuessedRound] = useState<number | null>(null);
  const [myGuessWord, setMyGuessWord] = useState<string | null>(null);
  const [editingGuess, setEditingGuess] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const reload = useCallback(async () => {
    if (!session) return;
    const r = await fetchRoom(code);
    if (!r) return;
    setRoom(r);

    const gs = parseGameState(r.state);
    setGameState(gs);

    if (gs?.phase === 'envelope_selection') { nav(`/room/${code}/envelopes`); return; }
    if (gs?.phase === 'hidden_word_selection') { nav(`/room/${code}/hidden`); return; }

    const [pl, cl, sc, rv] = await Promise.all([
      fetchPlayers(r.id),
      fetchClues(r.id),
      fetchScores(r.id),
      fetchRevealedWords(r.id),
    ]);
    setPlayers(pl);
    setClues(cl);
    setScores(sc);
    setRevealed(rv);

    // 내 이번 라운드 히든워드(라운드마다 바뀌므로 매 갱신 시 재조회)
    if (session.token) getMyWord(session.token).then(setMyWord).catch(() => {});

    // 직전 문제(정산 완료) 추측 결과 — 공개된 것만
    if (gs && gs.problem_no > 1) {
      setPrevGuesses(await fetchGuesses(r.id, gs.problem_no - 1));
    } else {
      setPrevGuesses([]);
    }
    // 현재 문제의 공개된 추측(§7 reveal 연출용)
    setCurGuesses(gs ? await fetchGuesses(r.id, gs.problem_no) : []);

    // 내 현재 회차 추측 복원(수정 프리필·새로고침 대응)
    if (gs?.phase === 'round' && gs.sub === 'guess' && session.token) {
      const mg = await fetchMyGuess(session.token).catch(() => null);
      setMyGuessWord(mg);
      setGuessedRound(mg != null ? gs.problem_no * 100 + gs.attempt_no : null);
    } else {
      setMyGuessWord(null);
      setEditingGuess(false);
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
    });
    return () => { unsubRoom(); unsubGame(); };
  }, [code, reload, nav, session]);

  // reveal 보류 단계: 마감(reveal_deadline)이 지나면 서버에 전이 요청(hw_tick). 접속 중 아무나 넛지.
  useEffect(() => {
    if (!room || gameState?.sub !== 'reveal' || !gameState.reveal_deadline) return;
    const end = new Date(gameState.reveal_deadline).getTime();
    if (Number.isNaN(end)) return;
    const id = setTimeout(() => { tickGame(room.id).catch(() => {}); }, Math.max(0, end - Date.now()) + 500);
    return () => clearTimeout(id);
  }, [room, gameState?.sub, gameState?.reveal_deadline]);

  const me = players.find((p) => p.id === session?.playerId);
  const giverId = gameState ? currentClueGiver(gameState) : null;
  const isGiver = giverId === session?.playerId;
  const giver = players.find((p) => p.id === giverId);

  const curRound = gameState?.round_no ?? 1;
  const totalRounds = gameState?.configured_rounds ?? 0;
  const nPlayers = gameState?.participant_count || (gameState?.player_order.length ?? 0);
  const problemNo = gameState?.problem_no ?? 1;
  const totalProblems = gameState?.total_problems ?? 0;
  const turnInRound = (gameState?.giver_index ?? 0) + 1;
  const attemptNo = gameState?.attempt_no ?? 1;
  const maxAttempts = gameState?.max_attempts ?? 3;
  const maxHints = gameState?.max_hints ?? 10;
  const unlocked = !!gameState?.unlocked;
  const hint = gameState?.current_hint ?? null;
  const isGameOver = gameState?.phase === 'game_over';

  // 현재 문제·현재 회차 힌트 이력(출제자 반복 제출)
  const attemptClues = useMemo(
    () => clues
      .filter((c) => c.problem_no === problemNo && c.attempt_no === attemptNo)
      .sort((a, b) => a.hint_index - b.hint_index),
    [clues, problemNo, attemptNo],
  );
  const hintsUsed = attemptClues.length;

  const iGuessedThisAttempt = guessedRound === problemNo * 100 + attemptNo;

  const getPlayer = (id: string) => players.find((p) => p.id === id);
  const pointsOf = (id: string) => scores.find((s) => s.player_id === id)?.points ?? 0;

  async function handleSubmitClue() {
    if (!session || busy || !input.trim()) return;
    setBusy(true);
    try {
      const r = await submitClue(session.token, input.trim());
      setInput('');
      if (!r.unlocked) {
        // 아직 95 미만 — 계속 제출 가능 (상태는 realtime 으로 갱신)
      }
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
      setMyGuessWord(input.trim());
      setInput('');
      setGuessedRound(problemNo * 100 + attemptNo);
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateGuess() {
    if (!session || busy || !input.trim()) return;
    setBusy(true);
    try {
      await updateGuess(session.token, input.trim());
      setMyGuessWord(input.trim());
      setInput('');
      setEditingGuess(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReveal() {
    if (!session || busy) return;
    setBusy(true);
    try { await revealAnswer(session.token); }
    catch (e) { alert(e instanceof Error ? e.message : '오류가 발생했어요.'); }
    finally { setBusy(false); }
  }

  async function handleEndGame() {
    if (!session || !me?.is_host) return;
    setBusy(true);
    try { await endGame(session.token); } catch (e) { alert(e instanceof Error ? e.message : '오류'); }
    finally { setBusy(false); setConfirmEnd(false); }
  }

  if (!room || !gameState) {
    return <div className="screen"><ScreenHeader title="히든 워드" /></div>;
  }

  // ─── 게임 종료 화면 (누적 점수 순위) ───
  if (isGameOver) {
    const ranked = [...players].sort((a, b) => pointsOf(b.id) - pointsOf(a.id));
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
            최종 순위
          </motion.p>
          <div className="game-screen__scores">
            {ranked.map((p, i) => (
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
                <span className="game-screen__score-pieces mono">{pointsOf(p.id)}</span>
                <span className="muted" style={{ fontSize: 12 }}>점</span>
              </motion.div>
            ))}
          </div>
          <motion.button
            className="btn"
            style={{ marginTop: 24 }}
            onClick={() => nav('/')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 + ranked.length * 0.12 + 0.2 }}
          >
            처음으로
          </motion.button>
        </div>
      </div>
    );
  }

  // 직전 문제 출제자 & 정답(공개된 경우)
  const prevProblem = problemNo - 1;
  const prevRound = nPlayers ? Math.floor((prevProblem - 1) / nPlayers) + 1 : 1;
  const prevGiverIdx = nPlayers ? (prevProblem - 1) % nPlayers : 0;
  const prevGiverId = prevProblem >= 1 && gameState.player_order.length
    ? gameState.player_order[prevGiverIdx]
    : null;
  const prevAnswer = prevGiverId ? revealed[`${prevGiverId}:${prevRound}`] : undefined;
  const pct = Math.max(0, Math.min(100, hint?.similarity ?? 0));

  return (
    <div className="screen game-screen">
      <ScreenHeader title="히든 워드" />

      {/* 상태 배지 */}
      <div className="game-screen__status">
        <span className="game-screen__round kicker">
          라운드 {curRound}{totalRounds ? `/${totalRounds}` : ''}
          {nPlayers ? ` · ${turnInRound}/${nPlayers}번째 출제` : ''}
          {totalProblems ? ` · 문제 ${problemNo}/${totalProblems}` : ''}
          {` · ${attemptNo}/${maxAttempts}회차`}
        </span>
        {giver && (
          <span className="game-screen__giver">
            <motion.span
              className="game-screen__giver-gem"
              style={{ ['--gem' as string]: giver.color }}
              animate={{ opacity: [1, 0.4, 1], scale: [1, 1.25, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            {isGiver ? '내가 출제 중' : `${giver.nickname} 출제 중`}
          </span>
        )}
      </div>

      {/* 단계 타이머 — 힌트 15분 / 정답 5분. 0 도달 시 서버 전이(hw_tick) */}
      {gameState.sub === 'clue' ? (
        <GameTimer deadline={gameState.clue_deadline} roomId={room.id} label="힌트 시간" />
      ) : (
        <GameTimer deadline={gameState.guess_deadline} roomId={room.id} label="정답 시간" />
      )}

      {/* 내 히든워드 — 출제자일 때만 의미 있음(모두에게 자기 단어는 비밀 유지) */}
      {myWord && isGiver && (
        <div className="game-screen__my-word panel">
          <span className="kicker" style={{ fontSize: 10 }}>내 히든워드</span>
          <span className="game-screen__my-word-val mono">{myWord}</span>
        </div>
      )}

      {/* 현재 힌트 스포트라이트 + 유사도 게이지 */}
      <div className={`game-screen__spotlight panel${unlocked ? ' is-unlocked' : ''}`}>
        <span className="kicker" style={{ fontSize: 10 }}>현재 힌트</span>
        {hint ? (
          <>
            <AnimatePresence mode="wait">
              <motion.span
                key={hint.word}
                className="game-screen__spotlight-word"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {hint.word}
              </motion.span>
            </AnimatePresence>
            <div className="game-screen__gauge">
              <motion.div
                className={`game-screen__gauge-fill${unlocked ? ' is-hit' : ''}`}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
              <span className="game-screen__gauge-mark" style={{ left: `${UNLOCK_AT}%` }} />
            </div>
            <div className="game-screen__gauge-labels">
              <motion.span
                key={pct}
                className={`mono game-screen__sim${unlocked ? ' glow-green' : ''}`}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                {(hint.similarity ?? 0).toFixed(1)}
              </motion.span>
              <span className="muted" style={{ fontSize: 11 }}>
                {unlocked ? '정답 제출이 열렸습니다!' : `${UNLOCK_AT} 도달·시간·힌트 소진 시 추측`}
              </span>
            </div>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 13, padding: '10px 0', textAlign: 'center' }}>
            {isGiver ? '첫 힌트를 제출하세요.' : `${giver?.nickname ?? '출제자'}의 힌트를 기다리는 중…`}
          </p>
        )}
      </div>

      {/* 이번 회차 힌트 이력 */}
      {attemptClues.length > 1 && (
        <div className="game-screen__clue-log">
          <AnimatePresence initial={false}>
            {attemptClues.slice(0, -1).map((c) => (
              <motion.div
                key={c.id}
                className="game-screen__clue-row"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="game-screen__clue-gem" style={{ ['--gem' as string]: giver?.color ?? '#888' }} />
                <div className="game-screen__clue-body">
                  <span className="game-screen__clue-who muted">힌트 {c.hint_index}</span>
                  <span className="game-screen__clue-word">{c.clue_word}</span>
                </div>
                <span className="mono" style={{ fontSize: 14, color: 'var(--text-2)' }}>
                  {Number(c.similarity).toFixed(1)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 직전 라운드 결과 */}
      <AnimatePresence>
        {prevGuesses.length > 0 && (
          <motion.div
            className="game-screen__guesses panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="kicker" style={{ fontSize: 10, marginBottom: 8 }}>
              이전 문제 결과{prevAnswer ? ` · 정답 "${prevAnswer}"` : ''}
            </p>
            {prevGuesses.map((g, i) => {
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
                  <span
                    className={`mono ${g.is_correct ? 'glow-green' : 'muted'}`}
                    style={{ fontSize: 14 }}
                  >
                    {g.is_correct ? '정답 ✓' : '✗'}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 점수판 */}
      <div className="game-screen__board">
        {[...players].sort((a, b) => pointsOf(b.id) - pointsOf(a.id)).map((p) => (
          <div key={p.id} className="game-screen__board-row">
            <span className="game-screen__clue-gem" style={{ ['--gem' as string]: p.color }} />
            <span className="game-screen__board-name">{p.id === session?.playerId ? '나' : p.nickname}</span>
            <span className="mono game-screen__board-pts">{pointsOf(p.id)}</span>
          </div>
        ))}
      </div>

      {/* 입력 영역 */}
      <div className="game-screen__input-area">
        {isGiver ? (
          unlocked ? (
            <p className="muted" style={{ textAlign: 'center', fontSize: 13, padding: '8px 0' }}>
              참가자들이 추측하는 중입니다…
            </p>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                히든워드와 가까운 단어를 힌트로 제출하세요. 유사도 {UNLOCK_AT} 도달, 또는 힌트 {maxHints}개·제한시간(15분) 소진 시 추측이 열립니다.
                {' '}(힌트 {hintsUsed}/{maxHints} · {attemptNo}/{maxAttempts}회차)
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
          )
        ) : unlocked ? (
          iGuessedThisAttempt && !editingGuess ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <p className="muted" style={{ fontSize: 13 }}>
                추측 제출됨{myGuessWord ? ` · "${myGuessWord}"` : ''}. 다른 참가자 대기 중…
              </p>
              <button
                className="btn btn--ghost"
                style={{ marginTop: 8 }}
                onClick={() => { setInput(myGuessWord ?? ''); setEditingGuess(true); }}
              >
                정답 수정
              </button>
            </div>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                {editingGuess
                  ? '정답을 수정하세요. (전원 제출 전까지 가능)'
                  : `${giver?.nickname ?? '출제자'}의 히든워드를 추측하세요. (제출 후 수정 가능)`}
              </p>
              <div className="game-screen__input-row">
                <input
                  className="field"
                  placeholder="추측 단어"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (editingGuess ? handleUpdateGuess() : handleSubmitGuess()); }}
                  maxLength={20}
                  autoFocus
                />
                <button
                  className="btn btn--primary"
                  disabled={!input.trim() || busy}
                  onClick={editingGuess ? handleUpdateGuess : handleSubmitGuess}
                >
                  {editingGuess ? '수정' : '제출'}
                </button>
                {editingGuess && (
                  <button className="btn btn--ghost" disabled={busy} onClick={() => { setEditingGuess(false); setInput(''); }}>
                    취소
                  </button>
                )}
              </div>
            </>
          )
        ) : (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13, padding: '8px 0' }}>
            {giver?.nickname ?? '출제자'}가 힌트를 고르는 중…
          </p>
        )}
      </div>

      {/* 방장: 게임 종료 */}
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

      {/* 방송형 결과 공개 오버레이 (§7) — 서버 reveal 보류 단계 동안 */}
      <AnimatePresence>
        {gameState.sub === 'reveal' && gameState.reveal && (
          <RevealOverlay
            kind={gameState.reveal.kind}
            isFinal={gameState.reveal.is_final}
            awaitGiver={gameState.reveal.await_giver}
            revealed={gameState.reveal.revealed}
            isGiver={isGiver}
            giver={giver}
            guesses={curGuesses.filter((g) => g.attempt_no === (gameState.reveal?.attempt ?? attemptNo))}
            hiddenWord={giverId ? revealed[`${giverId}:${curRound}`] : undefined}
            players={players}
            onReveal={handleReveal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
