import React, { useState } from 'react';
import { Link2, Loader2, RefreshCw, Users } from 'lucide-react';
import {
  createProjectShare,
  joinProjectShare,
  pullProjectShare,
  pushProjectShare,
} from '../../utils/project-share.js';

/**
 * Partilha o projeto actual com a equipa (código de 8 caracteres).
 * Requer sessão activa. Publicar inclui fotos dos cards; ao entrar/puxar abrem no browser.
 */
export function TeamSharePanel({
  doc,
  projectName = 'Projeto',
  shareCode = '',
  shareRevision = 0,
  onShareLinked = () => {},
  onDocPulled = () => {},
  toast,
}) {
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [localCode, setLocalCode] = useState(shareCode || '');

  const linked = Boolean(localCode || shareCode);

  const run = async (fn, okMsg) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await fn();
      const msg = typeof okMsg === 'function' ? okMsg(result) : okMsg;
      if (msg) toast?.(msg, 'success', 4500);
      return result;
    } catch (e) {
      toast?.(e?.message || 'Não foi possível sincronizar com a equipa.', 'error', 6000);
      return null;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>
        Equipa · mesmo projeto
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Partilhe um código com a equipa. Ao <strong>Publicar</strong>, o Moont envia texto e fotos dos cards.
        No outro computador: <strong>Entrar</strong> ou <strong>Puxar alterações</strong> — as imagens abrem sozinhas.
      </p>

      {linked ? (
        <div style={{
          padding: 12, borderRadius: 12, border: '1px solid var(--hairline)',
          background: 'var(--bg-pearl)', display: 'grid', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={14} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Código: {localCode || shareCode}</span>
            {shareRevision ? (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>rev. {shareRevision}</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="vc-btn"
              disabled={busy}
              onClick={() => run(async () => {
                const code = localCode || shareCode;
                const res = await pushProjectShare({ code, doc, name: projectName });
                onShareLinked({
                  code: res.code,
                  revision: res.revision,
                  updatedAt: res.updatedAt,
                });
                setLocalCode(res.code);
                return res;
              }, (res) => (
                res?.packedImages
                  ? `Publicado com ${res.packedImages} foto${res.packedImages === 1 ? '' : 's'} para a equipa.`
                  : 'Alterações publicadas para a equipa.'
              ))}
              style={{
                minHeight: 40, padding: '0 14px', borderRadius: 9999, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 12,
              }}
            >
              {busy ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <RefreshCw size={14} />}
              Publicar alterações
            </button>
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              disabled={busy}
              onClick={() => run(async () => {
                const code = localCode || shareCode;
                const res = await pullProjectShare(code);
                await onDocPulled(res);
                onShareLinked({
                  code: res.code,
                  revision: res.revision,
                  updatedAt: res.updatedAt,
                });
                return res;
              }, 'Projeto e imagens actualizados a partir da equipa.')}
              style={{ minHeight: 40, fontSize: 12 }}
            >
              Puxar alterações
            </button>
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              disabled={busy}
              onClick={async () => {
                const code = localCode || shareCode;
                try {
                  await navigator.clipboard.writeText(code);
                  toast?.('Código copiado.', 'success', 2500);
                } catch {
                  toast?.(code, 'info', 5000);
                }
              }}
              style={{ minHeight: 40, fontSize: 12 }}
            >
              <Link2 size={14} /> Copiar código
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="vc-btn"
            disabled={busy || !doc}
            onClick={() => run(async () => {
              const res = await createProjectShare({ doc, name: projectName });
              setLocalCode(res.code);
              onShareLinked({
                code: res.code,
                revision: res.revision,
                updatedAt: res.updatedAt,
              });
              try { await navigator.clipboard.writeText(res.code); } catch { /* ignore */ }
              return res;
            }, (res) => {
              if (res?.packedImages) {
                return `Código copiado · ${res.packedImages} foto${res.packedImages === 1 ? '' : 's'} incluída${res.packedImages === 1 ? '' : 's'}. Envie à equipa.`;
              }
              if (res?.imagesOmitted) {
                return 'Código criado (só texto — fotos grandes omitidas). Envie à equipa; pode Publicar depois com imagens mais leves.';
              }
              return 'Código criado e copiado. Envie à equipa.';
            })}
            style={{
              minHeight: 44, borderRadius: 9999, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 12,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {busy ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Users size={14} />}
            Criar partilha com a equipa
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="vc-input"
          aria-label="Código da equipa para entrar"
          placeholder="Código (ex.: AB12CD34)"
          value={joinCode}
          disabled={busy}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
          style={{ flex: 1, minHeight: 40, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
        />
        <button
          type="button"
          className="vc-btn vc-btn-ghost"
          disabled={busy || joinCode.length < 6}
          onClick={() => run(async () => {
            const res = await joinProjectShare(joinCode);
            setLocalCode(res.code);
            await onDocPulled(res);
            onShareLinked({
              code: res.code,
              revision: res.revision,
              updatedAt: res.updatedAt,
            });
            setJoinCode('');
            return res;
          }, 'Entrou no projeto — imagens a abrir neste browser.')}
          style={{ minHeight: 40, fontSize: 12, whiteSpace: 'nowrap' }}
        >
          Entrar
        </button>
      </div>
    </section>
  );
}
