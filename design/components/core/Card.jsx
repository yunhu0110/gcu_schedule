import React from 'react';

/**
 * Card — radius 4, paper background, 1px hairline. No drop shadow (print rules, not float).
 * `plate` variant uses the mist section background.
 */
export function Card({ plate = false, padding = 16, interactive = false, children, style = {}, ...rest }) {
  const base = {
    background: plate ? 'var(--surface-plate)' : 'var(--surface-card)',
    border: plate ? 'none' : '1px solid var(--hairline)',
    borderRadius: 'var(--radius-card)',
    padding, boxSizing: 'border-box',
    cursor: interactive ? 'pointer' : 'default',
    transition: 'background .12s',
    ...style,
  };
  return <div style={base} {...rest}>{children}</div>;
}
