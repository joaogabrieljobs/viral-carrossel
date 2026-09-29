import React, { useState } from 'react';
import { REMIX_TONES } from '../../utils/carousel-remix.js';
import { GenerationScopePicker } from '../GenerationScopePicker.jsx';

export function RemixPanel({ onRemix, busy, hasImages }) {
  const [toneId, setToneId] = useState('');
  const [scope, setScope] = useState('text');
  const tone = REMIX_TONES.find(item => item.id === toneId);
  const effectiveScope = hasImages ? scope : 'text';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div role="group" aria-label="Tom do remix" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {REMIX_TONES.map(opt => (
          <button key={opt.id} type="button" aria-label={opt.label} aria-pressed={toneId === opt.id} disabled={busy} onClick={() => setToneId(opt.id)}
            style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left', padding: 10, borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer', border: `1px solid ${toneId === opt.id ? 'var(--accent)' : 'var(--border)'}`, background: toneId === opt.id ? 'var(--accent-surface)' : 'var(--bg-card)', color: 'var(--text-primary)' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{opt.label}</span>
            <span style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--text-muted)' }}>{opt.blurb}</span>
          </button>
        ))}
      </div>
      <GenerationScopePicker value={effectiveScope} onChange={setScope} disabled={busy} hasImages={hasImages} remix />
      <button type="button" className="vc-btn" disabled={busy || !tone} onClick={() => onRemix(tone.hint, tone.label, { withImages: effectiveScope === 'text_images' })}
        style={{ minHeight: 44, borderRadius: 9999, border: 0, background: 'var(--accent)', color: '#fff', opacity: busy || !tone ? 0.5 : 1, cursor: busy || !tone ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
        {busy ? 'Gerando…' : effectiveScope === 'text' ? 'Refazer só texto' : 'Refazer texto e imagens'}
      </button>
    </div>
  );
}
