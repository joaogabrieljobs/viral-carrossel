import React, { useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { getAIGenerationCount, subscribeAIGeneration } from '../utils/generation-control.js';

/** Sempre visível, inclusive sobre modais e depois de trocar de aba. */
export function GenerationStatus({ progress, onCancel }) {
  const active = useSyncExternalStore(subscribeAIGeneration, getAIGenerationCount, getAIGenerationCount);
  const isImport = progress?.phase === 'import';
  if (!active && !isImport) return null;

  const toneAnalysis = progress?.phase === 'tone';
  const genericOperation = !progress?.phase;
  const total = Number(progress?.total) || 0;
  const current = Math.min(total, Math.max(0, Number(progress?.current) || 0));
  const showBar = (isImport || progress?.phase === 'images') && total > 0;
  const pct = showBar ? Math.round((current / total) * 100) : null;

  const regionLabel = toneAnalysis
    ? 'Análise de tom em andamento'
    : isImport
      ? 'Importação de fotos em andamento'
      : genericOperation
        ? 'Operação de IA em andamento'
        : 'Geração em andamento';

  const cancelLabel = toneAnalysis
    ? 'Cancelar análise'
    : isImport
      ? 'Cancelar importação'
      : genericOperation
        ? 'Cancelar operação'
        : 'Cancelar geração';

  return (
    <div
      role="region"
      aria-label={regionLabel}
      style={{ position: 'fixed', bottom: 16, left: 12, right: 12, zIndex: 9999, pointerEvents: 'none' }}
    >
      <div style={{
        maxWidth: 560,
        margin: 'auto',
        padding: 14,
        borderRadius: 14,
        background: '#17171d',
        color: '#fff',
        border: '1px solid #555',
        boxShadow: '0 8px 32px #0005',
        pointerEvents: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} aria-hidden />
          <span role="status" style={{ flex: 1, fontSize: 13 }}>
            {progress?.label || (isImport ? 'A importar fotos…' : 'Operação de IA em andamento…')}
          </span>
          <button
            type="button"
            onClick={onCancel}
            style={{
              minHeight: 44,
              padding: '8px 12px',
              borderRadius: 8,
              background: '#fff',
              color: '#17171d',
              border: 0,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
        </div>
        {showBar ? (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={isImport ? 'Progresso da importação' : 'Progresso das imagens'}
            style={{
              marginTop: 10,
              height: 6,
              borderRadius: 9999,
              background: 'rgba(255,255,255,0.12)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: 9999,
                background: '#fff',
                transition: 'width 0.25s ease-out',
              }}
            />
          </div>
        ) : null}
        {progress?.phase === 'images' && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#ccc' }}>
            O cancelamento mantém os cards concluídos. Uma imagem já enviada ao gerador ainda pode consumir crédito.
          </p>
        )}
        {isImport && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#ccc' }}>
            Fotos já aplicadas ficam nos cards. Cancelar interrompe as que faltam.
          </p>
        )}
      </div>
    </div>
  );
}
