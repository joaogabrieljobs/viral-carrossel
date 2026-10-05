import React from 'react';
import { BookOpen, Undo2 } from 'lucide-react';
import { projectContextLabel, styleKitHasContent } from '../utils/style-kit.js';

export function ProjectContextBanner({ styleKit, projectName, onUndo, canUndo = false }) {
  if (!styleKitHasContent(styleKit)) return null;
  const parts = [styleKit.contextMd?.trim() && 'Brief', styleKit.stylePrompt?.trim() && 'Estilo visual', styleKit.refImages?.length && `${styleKit.refImages.length} referências`].filter(Boolean);
  return (
    <div role="status" aria-label="Contexto ativo" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0, padding: '9px 16px', background: 'var(--accent-surface)', borderBottom: '1px solid var(--accent)', color: 'var(--text-primary)', fontSize: 12 }}>
      <BookOpen size={15} aria-hidden="true" />
      <strong style={{ overflowWrap: 'anywhere' }}>{projectContextLabel(styleKit, projectName)} — Contexto ON</strong>
      <span style={{ color: 'var(--text-muted)' }}>{parts.join(' · ')}</span>
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Desfazer última alteração"
        title="Desfazer última alteração (⌘Z)"
        style={{
          marginLeft: 'auto', minHeight: 30, padding: '0 11px', borderRadius: 999,
          border: '1px solid var(--border)', background: 'var(--bg-card)',
          color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6,
          cursor: canUndo ? 'pointer' : 'not-allowed', opacity: canUndo ? 1 : 0.42,
          fontSize: 11, fontWeight: 600,
        }}
      >
        <Undo2 size={13} aria-hidden="true" /> Desfazer
      </button>
    </div>
  );
}
