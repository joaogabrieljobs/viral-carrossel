import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock.js';
import { useModalDialog } from '../hooks/useModalDialog.js';

const formatWhen = (timestamp) => {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

/**
 * Revisão das edições que ficaram só neste navegador porque o projeto foi
 * excluído em outro dispositivo. Antes os avisos pediam "revise essa edição"
 * e não existia tela: a fila ficava presa e nem Sync nem Sair concluíam.
 *
 * QA-2411: a mesma tela recebe a edição feita sobre uma versão antiga do
 * projeto (`kind: 'conflict'`: outra aba ou outro aparelho salvou antes), com
 * três saídas: manter a minha, usar a da conta ou salvar como cópia.
 */
export default function DeletedProjectEditReview({ open, reviews = [], busyId = null, onKeep, onDiscard, onResolveConflict, onClose }) {
  useScrollLock(open);
  const { overlayRef, dialogRef, onDialogKeyDown } = useModalDialog({ open, onClose });
  const [confirmDiscardId, setConfirmDiscardId] = useState(null);
  useEffect(() => { if (!open) setConfirmDiscardId(null); }, [open]);
  if (!open || !reviews.length) return null;
  const busy = busyId != null;
  const conflicts = reviews.filter((review) => review.kind === 'conflict').length;
  const deletions = reviews.length - conflicts;
  const title = !conflicts
    ? (reviews.length === 1 ? 'Edição de um projeto excluído' : 'Edições de projetos excluídos')
    : !deletions
      ? (conflicts === 1 ? 'Este projeto tem duas versões' : 'Projetos com duas versões')
      : 'Edições que esperam a sua escolha';
  return (
    <div ref={overlayRef} className="modal-overlay" onClick={busy ? undefined : onClose} role="presentation">
      <div
        ref={dialogRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deleted-edit-review-title"
        aria-describedby="deleted-edit-review-text"
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <AlertTriangle size={18} color="var(--warning, #e4a54d)" aria-hidden="true" />
            <div id="deleted-edit-review-title" style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.022em' }}>
              {title}
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Decidir depois" className="vc-icon-btn">
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: '16px 20px 20px', display: 'grid', gap: 14 }}>
          {deletions > 0 ? (
            <p id="deleted-edit-review-text" style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              {deletions === 1 ? 'Este projeto foi excluído' : 'Estes projetos foram excluídos'} em outro dispositivo, mas este navegador
              ainda guarda uma edição que não chegou à conta. Escolha o que fazer com ela. Nada é recriado sem a sua escolha.
            </p>
          ) : null}
          {conflicts > 0 ? (
            <p id={deletions > 0 ? undefined : 'deleted-edit-review-text'} style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              {conflicts === 1 ? 'Este projeto foi salvo' : 'Estes projetos foram salvos'} em outra aba ou em outro aparelho depois que você
              abriu aqui. Sua edição continua guardada neste navegador. Escolha qual versão fica. Nada é apagado sem a sua escolha.
            </p>
          ) : null}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {reviews.map((review) => {
              const name = review.projectName || 'Projeto sem nome';
              const working = busyId === review.projectId;
              const confirming = confirmDiscardId === review.projectId;
              if (review.kind === 'conflict') {
                return (
                  <li key={review.projectId} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'grid', gap: 10, background: 'var(--bg-card)' }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: 15, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{name}</strong>
                      {formatWhen(review.updatedAt) ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sua edição neste navegador: {formatWhen(review.updatedAt)}</span>
                      ) : null}
                    </div>
                    {confirming ? (
                      <div role="group" aria-label={`Confirmar o uso da versão da conta em ${name}`} style={{ display: 'grid', gap: 8 }}>
                        <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                          A sua edição deste projeto será descartada e a tela passa a mostrar a versão da conta. Isso não pode ser desfeito.
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <button type="button" className="vc-btn" disabled={busy} onClick={() => onResolveConflict?.(review.projectId, 'account')} style={{ background: '#b42318', color: '#ffffff', borderColor: '#ef8a82' }}>
                            {working ? 'Trocando…' : 'Descartar a minha e usar a da conta'}
                          </button>
                          <button type="button" className="vc-btn vc-btn-ghost" disabled={busy} onClick={() => setConfirmDiscardId(null)}>
                            Voltar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button type="button" className="vc-btn vc-btn-primary" disabled={busy} onClick={() => onResolveConflict?.(review.projectId, 'mine')}>
                          {working ? 'Aplicando…' : 'Manter a minha'}
                        </button>
                        <button type="button" className="vc-btn vc-btn-ghost" disabled={busy} onClick={() => setConfirmDiscardId(review.projectId)}>
                          Usar a da conta
                        </button>
                        <button type="button" className="vc-btn vc-btn-ghost" disabled={busy} onClick={() => onResolveConflict?.(review.projectId, 'copy')}>
                          Salvar como cópia
                        </button>
                      </div>
                    )}
                    {!confirming ? (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        Manter a minha troca a versão da conta pela sua edição. Salvar como cópia cria “{review.copyName || `${name} (cópia de conflito)`}” e deixa a versão da conta como está.
                      </span>
                    ) : null}
                  </li>
                );
              }
              return (
                <li key={review.projectId} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'grid', gap: 10, background: 'var(--bg-card)' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 15, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{name}</strong>
                    {formatWhen(review.updatedAt) ? (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Última edição neste navegador: {formatWhen(review.updatedAt)}</span>
                    ) : null}
                  </div>
                  {confirming ? (
                    <div role="group" aria-label={`Confirmar descarte de ${name}`} style={{ display: 'grid', gap: 8 }}>
                      <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                        Esta é a única cópia dessa edição. Descartar não pode ser desfeito.
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button type="button" className="vc-btn" disabled={busy} onClick={() => onDiscard?.(review.projectId)} style={{ background: '#b42318', color: '#ffffff', borderColor: '#ef8a82' }}>
                          {working ? 'Descartando…' : 'Descartar de vez'}
                        </button>
                        <button type="button" className="vc-btn vc-btn-ghost" disabled={busy} onClick={() => setConfirmDiscardId(null)}>
                          Voltar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button type="button" className="vc-btn vc-btn-primary" disabled={busy} onClick={() => onKeep?.(review.projectId)}>
                        {working ? 'Guardando na conta…' : 'Manter como projeto novo'}
                      </button>
                      <button type="button" className="vc-btn vc-btn-ghost" disabled={busy} onClick={() => setConfirmDiscardId(review.projectId)}>
                        Descartar edição
                      </button>
                    </div>
                  )}
                  {!confirming ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Manter cria “{review.copyName || `${name} (cópia de conflito)`}” na sua conta.
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, flex: '1 1 220px' }}>
              Seus outros projetos continuam sendo salvos. Para sair da conta é preciso decidir antes.
            </span>
            <button type="button" className="vc-btn vc-btn-ghost" disabled={busy} onClick={onClose}>Decidir depois</button>
          </div>
        </div>
      </div>
    </div>
  );
}
