import React from 'react';

const SLOT_COLOR = {
  available: 'var(--cobalt)',
  unavailable: 'var(--ink)',
  maybe: 'var(--amber)',
  empty: 'var(--mist)',
};

/**
 * GaugeCell — the signature 6-slot availability calendar cell.
 * `slots` is an array of exactly 6 statuses: 'available' | 'unavailable' | 'maybe' | 'empty'.
 * When all 6 are available the whole cell fills neon with an inverted white number.
 * A slot may be given as { status, recurring:true } to render a hatch (from a repeat rule).
 */
export function GaugeCell({ day, slots = [], muted = false, today = false, selected = false, onClick, style = {} }) {
  const norm = slots.map((s) => (typeof s === 'string' ? { status: s } : s));
  const allAvailable = norm.length === 6 && norm.every((s) => s.status === 'available');

  const cell = {
    position: 'relative', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'space-between',
    aspectRatio: '1 / 1.15', minWidth: 40, padding: '6px 4px 5px',
    background: allAvailable ? 'var(--neon)' : 'var(--paper)',
    border: `1px solid ${selected ? 'var(--ink)' : 'var(--hairline)'}`,
    borderWidth: selected ? 2 : 1,
    borderRadius: 'var(--radius-card)',
    cursor: onClick ? 'pointer' : 'default',
    opacity: muted ? 0.35 : 1, boxSizing: 'border-box',
    WebkitTapHighlightColor: 'transparent', ...style,
  };
  const numStyle = {
    fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 14, lineHeight: 1,
    color: allAvailable ? 'var(--paper)' : 'var(--ink)',
  };
  const label = allAvailable
    ? `${day}일, 6명 모두 가능`
    : `${day}일, 가능 ${norm.filter((s) => s.status === 'available').length}명`;

  return (
    <div style={cell} onClick={onClick} role={onClick ? 'button' : undefined} aria-label={label}>
      {today && <span style={{ position: 'absolute', top: 5, right: 5, width: 4, height: 4, borderRadius: '50%', background: allAvailable ? 'var(--paper)' : 'var(--cobalt)' }} />}
      <span style={numStyle}>{day}</span>
      {allAvailable ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: 1, color: 'var(--paper)', textTransform: 'uppercase' }}>ALL</span>
      ) : (
        <div style={{ display: 'flex', gap: 1.5, width: '100%', height: 6 }}>
          {Array.from({ length: 6 }).map((_, i) => {
            const s = norm[i] || { status: 'empty' };
            const bg = SLOT_COLOR[s.status] || SLOT_COLOR.empty;
            const hatch = s.recurring
              ? { backgroundImage: 'repeating-linear-gradient(45deg, var(--ink) 0 1.5px, transparent 1.5px 3px)' }
              : null;
            return <span key={i} style={{ flex: 1, background: bg, borderRadius: 1, ...hatch }} />;
          })}
        </div>
      )}
    </div>
  );
}
