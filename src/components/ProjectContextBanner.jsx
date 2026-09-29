import React from 'react';
import { BookOpen } from 'lucide-react';
import { projectContextLabel, styleKitHasContent } from '../utils/style-kit.js';

export function ProjectContextBanner({ styleKit, projectName }) {
  if (!styleKitHasContent(styleKit)) return null;
  const parts = [styleKit.contextMd?.trim() && 'Brief', styleKit.stylePrompt?.trim() && 'Estilo visual', styleKit.refImages?.length && `${styleKit.refImages.length} referências`].filter(Boolean);
  return (
    <div role="status" aria-label="Contexto ativo" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0, padding: '9px 16px', background: 'var(--accent-surface)', borderBottom: '1px solid var(--accent)', color: 'var(--text-primary)', fontSize: 12 }}>
      <BookOpen size={15} aria-hidden="true" />
      <strong style={{ overflowWrap: 'anywhere' }}>{projectContextLabel(styleKit, projectName)} — Contexto ON</strong>
      <span style={{ color: 'var(--text-muted)' }}>{parts.join(' · ')}</span>
    </div>
  );
}
