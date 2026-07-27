import React from 'react';

/**
 * DdayPill — mono D-day counter, e.g. D-19 / D-DAY / D+3.
 * `urgent` turns it amber when the deadline is close.
 */
export function DdayPill({ days, urgent = false, style = {}, ...rest }) {
  let label;
  if (days === 0) label = 'D-DAY';
  else if (days > 0) label = `D-${days}`;
  else label = `D+${Math.abs(days)}`;
  const base = {
    display: 'inline-flex', alignItems: 'center',
    fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13,
    letterSpacing: 'var(--tracking-mono)',
    height: 24, padding: '0 8px', borderRadius: 'var(--radius-button)',
    background: urgent ? 'var(--amber)' : 'var(--ink)',
    color: urgent ? 'var(--ink)' : 'var(--paper)', ...style,
  };
  return <span style={base} {...rest}>{label}</span>;
}
