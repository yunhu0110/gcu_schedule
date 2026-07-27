import React from 'react';

/* Meetup status + achievement badges. Small, mono-ish, hairline or filled. */
const TONES = {
  proposed:  { label: '제안', bg: 'var(--surface-plate)', fg: 'var(--slate)', border: 'transparent' },
  voting:    { label: '날짜 투표', bg: 'var(--amber-24)', fg: 'var(--ink)', border: 'transparent' },
  confirmed: { label: '확정', bg: 'var(--cobalt)', fg: 'var(--paper)', border: 'transparent' },
  done:      { label: '완료', bg: 'transparent', fg: 'var(--slate)', border: 'var(--hairline-strong)' },
  canceled:  { label: '취소', bg: 'transparent', fg: 'var(--slate)', border: 'var(--hairline)' },
  neon:      { label: '', bg: 'var(--neon)', fg: 'var(--paper)', border: 'transparent' },
  neutral:   { label: '', bg: 'var(--surface-plate)', fg: 'var(--ink)', border: 'transparent' },
};

/**
 * Badge — status pill. Pass `status` for a meetup-status preset, or `tone`+children for custom.
 */
export function Badge({ status, tone = 'neutral', children, style = {}, ...rest }) {
  const t = TONES[status] || TONES[tone] || TONES.neutral;
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 11,
    letterSpacing: 'var(--tracking-mono)', textTransform: 'uppercase',
    height: 22, padding: '0 8px', borderRadius: 'var(--radius-pill)',
    background: t.bg, color: t.fg, border: `1px solid ${t.border}`,
    whiteSpace: 'nowrap', ...style,
  };
  return <span style={base} {...rest}>{children || t.label}</span>;
}
