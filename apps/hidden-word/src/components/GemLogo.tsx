/**
 * GemLogo — 히든 워드 보석(크리스탈) 로고. 시안의 보라색 각진 보석을 SVG로 자체 제작(저작권 안전).
 */
export function GemLogo({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 115" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gem-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9d5ff" />
          <stop offset="0.45" stopColor="#c084fc" />
          <stop offset="1" stopColor="#7e22ce" />
        </linearGradient>
        <linearGradient id="gem-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d8b4fe" />
          <stop offset="1" stopColor="#9333ea" />
        </linearGradient>
      </defs>
      {/* 외곽 보석 */}
      <path d="M50 4 L86 30 L74 92 L50 110 L26 92 L14 30 Z" fill="url(#gem-a)" stroke="#e5c158" strokeWidth="2" />
      {/* 상단 컷 */}
      <path d="M50 4 L86 30 L50 42 L14 30 Z" fill="url(#gem-b)" opacity="0.9" />
      {/* 중앙 facet */}
      <path d="M50 42 L74 92 L50 110 L26 92 Z" fill="#a855f7" opacity="0.55" />
      <path d="M50 42 L50 110" stroke="#f3efe6" strokeWidth="1" opacity="0.35" />
      <path d="M26 92 L74 92" stroke="#f3efe6" strokeWidth="1" opacity="0.25" />
      {/* 하이라이트 */}
      <path d="M40 18 L50 12 L50 40 Z" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}
