import React, { useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { getAIGenerationCount, subscribeAIGeneration } from '../utils/generation-control.js';

/** Sempre visível, inclusive sobre modais e depois de trocar de aba. */
export function GenerationStatus({ progress, onCancel }) {
  const active = useSyncExternalStore(subscribeAIGeneration, getAIGenerationCount, getAIGenerationCount);
  if (!active) return null;
  return (
    <div role="region" aria-label="Geração em andamento" style={{ position: 'fixed', bottom: 16, left: 12, right: 12, zIndex: 9999, pointerEvents: 'none' }}>
      <div style={{ maxWidth: 560, margin: 'auto', padding: 14, borderRadius: 14, background: '#17171d', color: '#fff', border: '1px solid #555', boxShadow: '0 8px 32px #0005', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <span role="status" style={{ flex: 1, fontSize: 13 }}>{progress?.label || 'Geração em andamento…'}</span>
          <button type="button" onClick={onCancel} style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, background: '#fff', color: '#17171d', border: 0, fontWeight: 600, cursor: 'pointer' }}>Cancelar geração</button>
        </div>
        {progress?.phase === 'images' && <p style={{ margin: '8px 0 0', fontSize: 11, color: '#ccc' }}>O cancelamento mantém os cards concluídos. Uma imagem já enviada ao gerador ainda pode consumir crédito.</p>}
      </div>
    </div>
  );
}
