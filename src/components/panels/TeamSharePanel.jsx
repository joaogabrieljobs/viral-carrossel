import React, { useState } from 'react';
import { Link2, Loader2, RefreshCw, Users } from 'lucide-react';
import {
  buildTeamShareInviteUrl,
  createProjectShare,
  joinProjectShare,
  pullProjectShare,
  pushProjectShare,
} from '../../utils/project-share.js';

/**
 * Partilha o projeto actual com a equipa (código + link ?share=).
 * Requer sessão activa. Publicar inclui fotos dos cards; ao entrar/puxar abrem no browser.
 */
export function TeamSharePanel({
  doc,
  projectName = 'Projeto',
  shareCode = '',
  shareRevision = 0,
  onShareLinked = () => {},
  onDocPulled = () => {},
  /** Entrar / convite: cria ou reabre projeto na biblioteca (não sobrescreve outro). */
  onShareJoined = null,
  toast,
}) {
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [localCode, setLocalCode] = useState(shareCode || '');

  const linked = Boolean(localCode || shareCode);
  const activeCode = localCode || shareCode;
  const inviteUrl = buildTeamShareInviteUrl(activeCode);

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

  const copyInviteLink = async (code, { announce = true } = {}) => {
    const url = buildTeamShareInviteUrl(code);
    if (!url) return false;
    try {
      await navigator.clipboard.writeText(url);
      if (announce) toast?.('Link de convite copiado. Envie à equipa.', 'success', 3500);
      return true;
    } catch {
      if (announce) toast?.(url, 'info', 8000);
      return false;
    }
  };

  const applyJoined = async (res) => {
    if (typeof onShareJoined === 'function') {
      await onShareJoined(res);
    } else {
      await onDocPulled(res);
    }
    onShareLinked({
      code: res.code,
      revision: res.revision,
      updatedAt: res.updatedAt,
    });
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
        Envie o <strong>link</strong> à equipa. Quem abrir entra com a conta Moont e o projeto
        aparece na biblioteca. Depois: <strong>Publicar</strong> / <strong>Puxar alterações</strong>.
      </p>

      {linked ? (
        <div style={{
          padding: 12, borderRadius: 12, border: '1px solid var(--hairline)',
          background: 'var(--bg-pearl)', display: 'grid', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Users size={14} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Código: {activeCode}</span>
            {shareRevision ? (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>rev. {shareRevision}</span>
            ) : null}
          </div>
          {inviteUrl ? (
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all',
              fontFamily: 'var(--font-mono)', lineHeight: 1.4,
            }}>
              {inviteUrl}
            </div>
          ) : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="vc-btn"
              disabled={busy}
              onClick={() => run(async () => {
                const res = await pushProjectShare({ code: activeCode, doc, name: projectName });
                onShareLinked({
                  code: res.code,
                  revision: res.revision,
                  updatedAt: res.updatedAt,
                });
                setLocalCode(res.code);
                return res;
              }, (res) => {
                if (res?.imagesOmitted) {
                  return `Publicado. ${res.imagesOmitted} foto${res.imagesOmitted === 1 ? '' : 's'} grande${res.imagesOmitted === 1 ? '' : 's'} a outra conta lê ao puxar.`;
                }
                return res?.packedImages
                  ? `Publicado com ${res.packedImages} foto${res.packedImages === 1 ? '' : 's'} para a equipa.`
                  : 'Alterações publicadas para a equipa.';
              })}
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
                const res = await pullProjectShare(activeCode);
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
              onClick={() => copyInviteLink(activeCode)}
              style={{ minHeight: 40, fontSize: 12 }}
            >
              <Link2 size={14} /> Copiar link
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
              await copyInviteLink(res.code, { announce: false });
              return res;
            }, (res) => {
              const omitted = res?.imagesOmitted
                ? ` ${res.imagesOmitted} foto${res.imagesOmitted === 1 ? '' : 's'} grande${res.imagesOmitted === 1 ? '' : 's'} entra${res.imagesOmitted === 1 ? '' : 'm'} quando a outra conta puxar.`
                : '';
              if (res?.packedImages) {
                return `Link copiado · ${res.packedImages} foto${res.packedImages === 1 ? '' : 's'} incluída${res.packedImages === 1 ? '' : 's'}.${omitted} Envie à equipa.`;
              }
              if (res?.imagesOmitted) {
                return `Link copiado.${omitted} Envie à equipa e peça para puxar as alterações.`;
              }
              return 'Link de convite copiado. Envie à equipa.';
            })}
            style={{
              minHeight: 44, borderRadius: 9999, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 12,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {busy ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Users size={14} />}
            Criar link para a equipa
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="vc-input"
          aria-label="Código da equipa para entrar"
          placeholder="Ou cole o código (ex.: AB12CD34)"
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
            await applyJoined(res);
            setJoinCode('');
            return res;
          }, 'Entrou no projeto — está na sua biblioteca.')}
          style={{ minHeight: 40, fontSize: 12, whiteSpace: 'nowrap' }}
        >
          Entrar
        </button>
      </div>
    </section>
  );
}
