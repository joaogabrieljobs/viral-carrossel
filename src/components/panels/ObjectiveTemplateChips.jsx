import React from 'react';
import { OBJECTIVE_TEMPLATES, applyObjectiveTemplate } from '../../utils/objective-templates.js';
import { trackEvent } from '../../utils/telemetry.js';

/**
 * Chips de template por objetivo (Fatia 3).
 * Preenche o pedido e sugere modo narrativo — não troca o projeto.
 */
export function ObjectiveTemplateChips({
  activeId = null,
  quickPrompt = '',
  onApply,
  compact = false,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>
        Objetivo do post
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {OBJECTIVE_TEMPLATES.map((t) => {
          const active = activeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className="vc-btn"
              title={t.desc}
              onClick={() => {
                const applied = applyObjectiveTemplate(t.id, { quickPrompt });
                if (!applied) return;
                trackEvent('objective_template', { id: t.id });
                onApply?.(applied);
              }}
              style={{
                minHeight: compact ? 32 : 36,
                padding: compact ? '0 10px' : '0 12px',
                borderRadius: 9999,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--hairline)'}`,
                background: active ? 'var(--accent-surface)' : 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: active ? 600 : 480,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
