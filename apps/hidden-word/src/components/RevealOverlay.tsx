/**
 * 방송형 결과 공개 오버레이 — 문제가 정산되면(problem_no 증가) 전원 화면에 극적으로 뜬다.
 * 단계: (0) 타이틀 → (1) 추측 카드 순차 공개 + 정답/오답 도장 → (2) 히든워드 공개 →
 *       (3) 판정(정답자/미해결). 자동 닫힘 + 아무 곳이나 탭하면 스킵.
 * realtime 으로 각 클라이언트가 독립적으로 트리거되므로 타이밍은 근사 동기.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Guess } from '../lib/game';
import type { Player } from '../lib/rooms';
import './RevealOverlay.css';

type Props = {
  giver: Player | undefined;
  hiddenWord: string | undefined;
  guesses: Guess[];      // 결정 회차의 공개된 추측들
  players: Player[];
  onClose: () => void;
};

export function RevealOverlay({ giver, hiddenWord, guesses, players, onClose }: Props) {
  const [step, setStep] = useState(0);
  const playerOf = (id: string) => players.find((p) => p.id === id);
  const anyCorrect = guesses.some((g) => g.is_correct);

  // 단계 타임라인: 추측 카드 수에 비례해 히든워드 공개 시점을 뒤로 민다.
  useEffect(() => {
    const guessWindow = 500 + guesses.length * 360;
    const t1 = setTimeout(() => setStep(1), 800);               // 추측 공개
    const t2 = setTimeout(() => setStep(2), 800 + guessWindow); // 히든워드
    const t3 = setTimeout(() => setStep(3), 800 + guessWindow + 1100); // 판정
    const t4 = setTimeout(onClose, 800 + guessWindow + 1100 + 2600); // 자동 닫힘
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [guesses.length, onClose]);

  return (
    <motion.div
      className="reveal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      onClick={onClose}
      role="button"
      aria-label="결과 공개 — 탭하여 넘기기"
    >
      <motion.span
        className="reveal-overlay__kicker kicker"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
      >
        결과 공개
      </motion.span>
      {giver && (
        <motion.span
          className="reveal-overlay__giver"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <span className="reveal-overlay__gem" style={{ ['--gem' as string]: giver.color }} />
          {giver.nickname}의 히든워드
        </motion.span>
      )}

      {/* 추측 카드 순차 공개 */}
      <div className="reveal-overlay__guesses">
        <AnimatePresence>
          {step >= 1 && guesses.map((g, i) => {
            const gsr = playerOf(g.guesser_id);
            return (
              <motion.div
                key={g.id}
                className={`reveal-overlay__card${g.is_correct ? ' is-correct' : ''}`}
                initial={{ opacity: 0, rotateX: -80, y: 24 }}
                animate={{ opacity: 1, rotateX: 0, y: 0 }}
                transition={{ delay: i * 0.36, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="reveal-overlay__card-gem" style={{ ['--gem' as string]: gsr?.color ?? '#888' }} />
                <span className="reveal-overlay__card-name">{gsr?.nickname ?? '?'}</span>
                <span className="reveal-overlay__card-word">{g.guess_word}</span>
                <motion.span
                  className={`reveal-overlay__stamp ${g.is_correct ? 'is-ok' : 'is-no'}`}
                  initial={{ opacity: 0, scale: 2.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.36 + 0.28, type: 'spring', stiffness: 500, damping: 16 }}
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
        {step >= 2 && (
          <motion.div
            className="reveal-overlay__answer"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          >
            <span className="reveal-overlay__answer-label kicker">정답</span>
            <span className="reveal-overlay__answer-word">{hiddenWord ?? '—'}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 판정 */}
      <AnimatePresence>
        {step >= 3 && (
          <motion.span
            className={`reveal-overlay__verdict ${anyCorrect ? 'is-ok' : 'is-no'}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {anyCorrect ? '정답자 득점!' : '아무도 맞히지 못했어요 — 출제자 득점'}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
