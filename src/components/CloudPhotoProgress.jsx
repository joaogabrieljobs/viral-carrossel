import React from 'react';

/** Download de fotos da conta, separado do estado salvo do projeto. */
export default function CloudPhotoProgress({ progress, compact = false, announce = true }) {
  if (!progress || !progress.total) return null;
  const completed = Math.min(progress.total, Math.max(0, progress.completed || 0));
  const percent = Math.round((completed / progress.total) * 100);
  const failed = Math.min(progress.total, Math.max(0, progress.missing || 0));
  const label = progress.status === 'error'
    ? `Fotos: ${completed} de ${progress.total} · carregamento interrompido`
    : `Fotos: ${completed} de ${progress.total}`;

  return (
    <div role={announce ? 'status' : undefined} aria-live={announce ? 'polite' : 'off'} style={{
      width: '100%', minWidth: 0, padding: compact ? '7px 12px' : '10px 12px',
      borderRadius: 10, border: '1px solid var(--hairline)',
      background: 'var(--bg-card)', color: 'var(--text-secondary)',
      fontFamily: 'var(--font-ui)', fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{percent}%</span>
      </div>
      <div role="progressbar" aria-hidden={!announce} aria-label="Carregamento das fotos" aria-valuemin={0}
        aria-valuemax={progress.total} aria-valuenow={completed}
        style={{ height: 4, borderRadius: 999, background: 'var(--hairline)', overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', borderRadius: 'inherit', background: 'var(--accent)', transition: 'width 180ms ease-out' }} />
      </div>
      {progress.status === 'complete' && failed > 0 && (
        <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
          {failed} {failed === 1 ? 'foto indisponível' : 'fotos indisponíveis'} nesta conta.
        </div>
      )}
    </div>
  );
}
