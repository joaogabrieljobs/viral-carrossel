import React from 'react';
import { BookOpen } from 'lucide-react';
import { projectContextLabel, styleKitHasContent } from '../utils/style-kit.js';

// O desfazer saiu desta faixa (27/11): era o mesmo histórico do botão
// "Desfazer" do editor (fila de miniaturas no celular, topo no desktop).
export function ProjectContextBanner({ styleKit, projectName, compact = false }) {
  if (!styleKitHasContent(styleKit)) return null;
  if (compact) {
    // Celular: uma linha só, para o card ganhar a altura (João, 19/11).
    const refs = styleKit.refImages?.length || 0;
    return (
      <div role="status" aria-label="Contexto ativo" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, padding: '2px 4px 2px 12px', minHeight: 40, background: 'var(--accent-surface)', borderBottom: '1px solid var(--accent)', color: 'var(--text-primary)', fontSize: 12 }}>
        <BookOpen size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
        <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectContextLabel(styleKit, projectName)} — Contexto ON</strong>
        {refs > 0 && <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>· {refs} ref.</span>}
      </div>
    );
  }
  const parts = [styleKit.contextMd?.trim() && 'Brief', styleKit.stylePrompt?.trim() && 'Estilo visual', styleKit.refImages?.length && `${styleKit.refImages.length} referências`].filter(Boolean);
  return (
    <div role="status" aria-label="Contexto ativo" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0, padding: '9px 16px', background: 'var(--accent-surface)', borderBottom: '1px solid var(--accent)', color: 'var(--text-primary)', fontSize: 12 }}>
      <BookOpen size={15} aria-hidden="true" />
      <strong style={{ overflowWrap: 'anywhere' }}>{projectContextLabel(styleKit, projectName)} — Contexto ON</strong>
      <span style={{ color: 'var(--text-muted)' }}>{parts.join(' · ')}</span>
    </div>
  );
}
