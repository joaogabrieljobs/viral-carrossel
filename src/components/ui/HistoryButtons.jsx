import React from 'react';

const UNDO_PATH = <><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-7L3 9" /></>;
const REDO_PATH = <><path d="M21 7v6h-6" /><path d="M21 13a9 9 0 1 1-3-7l3 3" /></>;

const icon = (path, size) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{path}</svg>
);

/** Aparência comum: ativo tem contraste de texto; desabilitado é tracejado e apagado. */
function historyButtonStyle(enabled, extra) {
  return {
    minHeight: 44, borderRadius: 9999, flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    border: enabled ? '1px solid var(--glass-border-strong, var(--border))' : '1px dashed var(--border)',
    background: enabled ? 'var(--bg-card)' : 'transparent',
    color: enabled ? 'var(--text-primary)' : 'var(--text-muted)',
    opacity: enabled ? 1 : 0.6,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, letterSpacing: '-0.011em',
    ...extra,
  };
}

/**
 * Desfazer e Refazer do editor — o mesmo histórico (⌘Z / ⌘⇧Z) em todo lugar.
 * Havia três desfazer com aparências diferentes (ícone na faixa "Contexto ON",
 * círculo na fila de miniaturas e ícone no topo do desktop) chamando a mesma
 * função; agora há um só por tela, com rótulo, alvo de 44 px e estado
 * desabilitado claro. O aviso de uma ação (toast) continua com o próprio
 * "Desfazer", que também volta ao estado anterior pelo mesmo histórico.
 */
export function HistoryButtons({ onUndo, onRedo, canUndo = false, canRedo = false, style = null }) {
  return (
    <div role="group" aria-label="Histórico de alterações" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, ...style }}>
      <button
        type="button"
        onClick={() => onUndo?.()}
        disabled={!canUndo}
        aria-label="Desfazer"
        title={canUndo ? 'Desfazer a última alteração (⌘Z)' : 'Nada para desfazer'}
        data-vc-history="undo"
        style={historyButtonStyle(canUndo, { padding: '0 14px 0 12px' })}
      >
        {icon(UNDO_PATH, 16)}
        <span>Desfazer</span>
      </button>
      <button
        type="button"
        onClick={() => onRedo?.()}
        disabled={!canRedo}
        aria-label="Refazer"
        title={canRedo ? 'Refazer (⌘⇧Z)' : 'Nada para refazer'}
        data-vc-history="redo"
        style={historyButtonStyle(canRedo, { minWidth: 44, padding: 0 })}
      >
        {icon(REDO_PATH, 16)}
      </button>
    </div>
  );
}
