import React from 'react';

const SIZES = {
  md: { minHeight: 44, padding: '0 20px', fontSize: 16 },
  sm: { minHeight: 36, padding: '0 14px', fontSize: 14 },
  lg: { minHeight: 52, padding: '0 24px', fontSize: 17 },
};

/**
 * Button — primary (cobalt fill), secondary (hairline outline), ghost.
 * Text says what will happen ("날짜 확정하기"), never "제출".
 */
export function Button({
  variant = 'primary', size = 'md', block = false, disabled = false,
  loading = false, iconLeft, iconRight, children, style = {}, ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'var(--font-body)', fontWeight: 600, lineHeight: 1,
    borderRadius: 'var(--radius-button)', border: '1px solid transparent',
    cursor: disabled || loading ? 'default' : 'pointer',
    width: block ? '100%' : 'auto', minHeight: s.minHeight, padding: s.padding,
    fontSize: s.fontSize, transition: 'background .12s, border-color .12s, opacity .12s',
    opacity: disabled ? 0.4 : 1, WebkitTapHighlightColor: 'transparent', ...style,
  };
  const variants = {
    primary:   { background: 'var(--cobalt)', color: 'var(--paper)' },
    secondary: { background: 'transparent', color: 'var(--ink)', borderColor: 'var(--hairline-strong)' },
    ghost:     { background: 'transparent', color: 'var(--cobalt)' },
    danger:    { background: 'var(--ink)', color: 'var(--paper)' },
  };
  return (
    <button type="button" disabled={disabled || loading} style={{ ...base, ...variants[variant] }} {...rest}>
      {loading ? <span style={{ opacity: 0.7 }}>…</span> : (<>
        {iconLeft}<span>{children}</span>{iconRight}
      </>)}
    </button>
  );
}
