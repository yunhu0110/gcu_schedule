import React from 'react';

const PRESETS = {
  display: { fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'var(--fs-display)', lineHeight: 'var(--lh-display)', letterSpacing: '-0.01em' },
  h1:      { fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', letterSpacing: '-0.01em' },
  h2:      { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--fs-h2)', lineHeight: 'var(--lh-h2)' },
  body:    { fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-body)' },
  bodySm:  { fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--fs-bodysm)', lineHeight: 'var(--lh-bodysm)' },
  caption: { fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-caption)' },
  mono:    { fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 'var(--fs-mono)', lineHeight: 'var(--lh-mono)', letterSpacing: 'var(--tracking-mono)', textTransform: 'uppercase' },
};

const DEFAULT_TAG = { display: 'h1', h1: 'h1', h2: 'h2', body: 'p', bodySm: 'p', caption: 'span', mono: 'span' };

/**
 * Role-based typography. Display/h1 use the serif; everything else Pretendard;
 * mono is uppercase + tracked for numbers, dates, Vol. numbers.
 */
export function Text({ variant = 'body', as, color, weight, align, children, style = {}, ...rest }) {
  const Tag = as || DEFAULT_TAG[variant] || 'span';
  const merged = {
    margin: 0,
    color: color ? `var(--${color}, ${color})` : 'var(--text-body)',
    ...PRESETS[variant],
    ...(weight ? { fontWeight: weight } : null),
    ...(align ? { textAlign: align } : null),
    ...style,
  };
  return <Tag style={merged} {...rest}>{children}</Tag>;
}
