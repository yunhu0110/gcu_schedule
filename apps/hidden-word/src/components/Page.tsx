/**
 * 화면 전환 래퍼 — 라우트가 바뀔 때 페이드+슬라이드. App의 AnimatePresence와 함께 동작.
 * 모든 화면 루트를 감싸 일관된 전환을 준다.
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="page-motion"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
