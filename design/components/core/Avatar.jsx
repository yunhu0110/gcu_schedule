import React from 'react';

const SIZES = { xs: 24, sm: 32, md: 44, lg: 64, xl: 96 };

function initials(name = '') {
  const n = name.trim();
  if (!n) return '?';
  // Korean: last 1–2 chars read naturally; else first letter.
  return /[가-힣]/.test(n) ? n.slice(-2) : n[0].toUpperCase();
}

/**
 * Avatar — circle, image or initials fallback. `dimmed` = greyed state for members
 * who have not entered their schedule yet.
 */
export function Avatar({ name = '', src, size = 'md', dimmed = false, ring = false, style = {}, ...rest }) {
  const px = SIZES[size] || (typeof size === 'number' ? size : 44);
  const base = {
    width: px, height: px, borderRadius: '50%', flex: '0 0 auto',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', background: 'var(--mist)', color: 'var(--slate)',
    fontFamily: 'var(--font-body)', fontWeight: 600,
    fontSize: Math.max(11, Math.round(px * 0.34)),
    border: ring ? '2px solid var(--paper)' : '1px solid var(--hairline)',
    filter: dimmed ? 'grayscale(1)' : 'none',
    opacity: dimmed ? 0.45 : 1,
    boxSizing: 'border-box', ...style,
  };
  return (
    <span style={base} aria-label={name} {...rest}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}
    </span>
  );
}
