import React from 'react';

/**
 * SectionHeader — mono uppercase eyebrow label with a short ink bar on the left.
 * Optional trailing action (link/segment) on the right.
 */
export function SectionHeader({ label, trailing, style = {}, ...rest }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, ...style }} {...rest}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 3, height: 13, background: 'var(--ink)', borderRadius: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 'var(--fs-mono)', letterSpacing: 'var(--tracking-mono)', textTransform: 'uppercase', color: 'var(--ink)' }}>
          {label}
        </span>
      </div>
      {trailing ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{trailing}</div> : null}
    </div>
  );
}
