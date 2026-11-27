/**
 * 방송형 결과 공개 오버레이 (§7) — 서버 'reveal' 보류 단계 동안 전원 화면에 표시된다.
 * 연출: (0) 두구두구두구… (≈2.5s) → (1) 정적(≈1s) → (2) 판정 문구 → (3) 결말.
 *   · solved     : '정답자가 있습니다!' → 출제자에게만 '정답 공개하기' 버튼.
 *                  출제자가 누르면(서버) revealed=true → 히든워드·정답자·추측 공개.
 *   · no_winner  : '정답자가 없습니다' → (비마지막) 다음 회차 / (마지막) 히든워드 공개·차례 종료.
 *   · below_95   : '95% 이상 유사도에 도달하지 못했어요' → 동일.
 * 전이(다음 회차/문제)는 서버(hw_reveal/hw_tick)가 수행한다. 이 컴포넌트는 표시만 담당.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Guess } from '../lib/game';
import type { Player } from '../lib/rooms';
import './RevealOverlay.css';

type Props = {
  kind: 'solved' | 'no_winner' | 'below_95';
  isFinal: boolean;
  awaitGiver: boolean;
  revealed: boolean;
  isGiver: boolean;
  giver: Player | undefined;
  guesses: Guess[];           // 이번 회차의 공개된 추측들(below_95 는 없음)
  hiddenWord: string | undefined;
  players: Player[];
  onReveal: () => void;       // 출제자 '정답 공개하기'
};

// 연출 타임라인(ms) — §7-4 권장값에 맞춤
const T_HUSH = 2500;    // 두구두구 종료 → 정적
const T_VERDICT = 3400; // 정적 종료 → 판정 문구
const T_RESOLVE = 4700; // 판정 → 결말

type Stage = 'drum' | 'hush' | 'verdict' | 'resolve';

export function RevealOverlay({
  kind, isFinal, awaitGiver, revealed, isGiver, giver, guesses, hiddenWord, players, onReveal,
}: Props) {
  const [stage, setStage] = useState<Stage>('drum');
  const [pressed, setPressed] = useState(false);
  const playerOf = (id: string) => players.find((p) => p.id === id);
  const winners = guesses.filter((g) => g.is_correct).map((g) => playerOf(g.guesser_id)).filter(Boolean) as Player[];

  useEffect(() => {
    const t1 = setTimeout(() => setStage('hush'), T_HUSH);
    const t2 = setTimeout(() => setStage('verdict'), T_VERDICT);
    const t3 = setTimeout(() => setStage('resolve'), T_RESOLVE);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, []);

  const verdictText =
    kind === 'solved' ? '정답자가 있습니다!'
    : kind === 'below_95' ? '95% 이상 유사도에 도달하지 못했어요'
    : '정답자가 없습니다';
  const verdictTone = kind === 'solved' ? 'is-ok' : 'is-no';

  // 히든워드/추측을 지금 보여줘도 되는지: solved 는 공개 후(revealed), 그 외는 마지막 회차에만.
  const showAnswer = stage === 'resolve' && (kind === 'solved' ? revealed : isFinal) && !!hiddenWord;
  const showCards = stage === 'resolve' && kind !== 'below_95' && (kind === 'solved' ? revealed : true);

  // 결말 하단 안내 문구
  let tail = '';
  if (stage === 'resolve') {
    if (kind === 'solved') tail = revealed ? '정답자 득점!' : '';
    else if (isFinal) tail = '이번 출제자의 차례가 끝났어요';
    else tail = '다음 회차로 이동합니다';
  }

  function handlePress() {
    if (pressed) return;
    setPressed(true);
    onReveal();
  }

  return (
    <motion.div
      className="reveal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      role="dialog"
      aria-label="결과 공개"
    >
      {/* 0·1단계: 두구두구 + 정적 */}
      <AnimatePresence>
        {(stage === 'drum' || stage === 'hush') && (
          <motion.div
            key="drum"
            className="reveal-overlay__drum"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.4 }}
          >
            {stage === 'drum' ? (
              <motion.span
                className="reveal-overlay__drum-text"
                animate={{ scale: [1, 1.12, 1], opacity: [0.75, 1, 0.75] }}
                transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                두구두구두구…
              </motion.span>
            ) : (
              <motion.span
                className="reveal-overlay__drum-hush"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                …
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2단계+: 출제자 + 판정 */}
      {stage !== 'drum' && stage !== 'hush' && (
        <>
          {giver && (
            <motion.span
              className="reveal-overlay__giver"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <span className="reveal-overlay__gem" style={{ ['--gem' as string]: giver.color }} />
              {giver.nickname}의 히든워드
            </motion.span>
          )}
          <motion.span
            className={`reveal-overlay__verdict ${verdictTone}`}
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            {verdictText}
          </motion.span>
        </>
      )}

      {/* 추측 카드(solved 공개 후 / no_winner) */}
      <div className="reveal-overlay__guesses">
        <AnimatePresence>
          {showCards && guesses.map((g, i) => {
            const gsr = playerOf(g.guesser_id);
            return (
              <motion.div
                key={g.id}
                className={`reveal-overlay__card${g.is_correct ? ' is-correct' : ''}`}
                initial={{ opacity: 0, rotateX: -80, y: 24 }}
                animate={{ opacity: 1, rotateX: 0, y: 0 }}
                transition={{ delay: i * 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="reveal-overlay__card-gem" style={{ ['--gem' as string]: gsr?.color ?? '#888' }} />
                <span className="reveal-overlay__card-name">{gsr?.nickname ?? '?'}</span>
                <span className="reveal-overlay__card-word">{g.guess_word}</span>
                <motion.span
                  className={`reveal-overlay__stamp ${g.is_correct ? 'is-ok' : 'is-no'}`}
                  initial={{ opacity: 0, scale: 2.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.3 + 0.26, type: 'spring', stiffness: 500, damping: 16 }}
                >
                  {g.is_correct ? '정답' : '오답'}
                </motion.span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* 히든워드 공개 */}
      <AnimatePresence>
        {showAnswer && (
          <motion.div
            className="reveal-overlay__answer"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          >
            <span className="reveal-overlay__answer-label kicker">정답</span>
            <span className="reveal-overlay__answer-word">{hiddenWord}</span>
            {kind === 'solved' && winners.length > 0 && (
              <span className="reveal-overlay__winners">
                정답자 {winners.map((w) => w.nickname).join(', ')}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* solved: 출제자 공개 버튼 / 대기 안내 */}
      {stage === 'resolve' && kind === 'solved' && awaitGiver && !revealed && (
        isGiver ? (
          <motion.button
            className="btn btn--primary reveal-overlay__reveal-btn"
            onClick={handlePress}
            disabled={pressed}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
          >
            {pressed ? '공개 중…' : '정답 공개하기'}
          </motion.button>
        ) : (
          <motion.span
            className="reveal-overlay__waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            출제자가 정답을 공개하려 합니다…
          </motion.span>
        )
      )}

      {/* 결말 안내 */}
      <AnimatePresence>
        {tail && (
          <motion.span
            className={`reveal-overlay__tail ${verdictTone}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          >
            {tail}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
