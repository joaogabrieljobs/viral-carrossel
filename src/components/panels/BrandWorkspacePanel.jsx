import React, { useEffect, useState } from 'react';
import { Building2, Check, Plus } from 'lucide-react';
import { brandHasContext } from '../../utils/brand-context.js';
import { normalizeStyleKit, styleKitHasContent } from '../../utils/style-kit.js';

/**
 * Home · Marcas: escolher marca activa, editar contexto (brief/estilo),
 * ver quantos projetos pertencem a ela. Projetos novos herdam este contexto.
 */
export function BrandWorkspacePanel({
  brandRoster = [],
  activeBrandId = 'default',
  onSelectBrand = () => {},
  onSaveBrandContext = null,
  onOpenBrands = null,
  projectCount = 0,
  toast,
  part = 'all',
}) {
  const active = brandRoster.find((b) => b.id === activeBrandId) || brandRoster[0] || null;
  const [draftBrief, setDraftBrief] = useState('');
  const [draftStyle, setDraftStyle] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const kit = normalizeStyleKit(active?.styleKit);
    setDraftBrief(kit.contextMd || '');
    setDraftStyle(kit.stylePrompt || '');
    setDirty(false);
  }, [active?.id, active?.styleKit?.contextMd, active?.styleKit?.stylePrompt]);

  if (!brandRoster.length) return null;

  const hasCtx = brandHasContext({ styleKit: { contextMd: draftBrief, stylePrompt: draftStyle, refImages: active?.styleKit?.refImages || [] } })
    || styleKitHasContent(active?.styleKit);

  const save = () => {
    if (!active || !onSaveBrandContext) return;
    onSaveBrandContext(active.id, {
      ...(active.styleKit || {}),
      contextMd: draftBrief,
      stylePrompt: draftStyle,
    });
    setDirty(false);
    toast?.('Contexto da marca guardado. Projetos novos herdam isto.', 'success', 3500);
  };

  const editors = (
    <div style={{
      padding: 12,
      borderRadius: 12,
      border: '1px solid var(--hairline)',
      background: 'var(--bg-pearl)',
      display: 'grid',
      gap: 8,
    }}>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Vale para projetos novos desta marca. O projeto aberto continua com o contexto dele.
      </p>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
          letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)',
        }}>
          Brief da marca
        </span>
        <textarea
          className="vc-input"
          rows={3}
          value={draftBrief}
          placeholder="Produto, público, voz, restrições… (herdado por projetos novos)"
          onChange={(e) => { setDraftBrief(e.target.value); setDirty(true); }}
          style={{ resize: 'vertical', minHeight: 64, fontSize: 12, lineHeight: 1.45 }}
        />
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
          letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)',
        }}>
          Estilo visual
        </span>
        <textarea
          className="vc-input"
          rows={2}
          value={draftStyle}
          placeholder="Composição, tipografia, luz, atmosfera…"
          onChange={(e) => { setDraftStyle(e.target.value); setDirty(true); }}
          style={{ resize: 'vertical', minHeight: 48, fontSize: 12, lineHeight: 1.45 }}
        />
      </label>
      {onSaveBrandContext ? (
        <button
          type="button"
          className="vc-btn"
          disabled={!dirty}
          onClick={save}
          style={{
            minHeight: 36,
            borderRadius: 9999,
            border: 'none',
            background: dirty ? 'var(--accent)' : 'var(--bg-pearl)',
            color: dirty ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: 12,
            opacity: dirty ? 1 : 0.7,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Check size={13} />
          Guardar contexto da marca
        </button>
      ) : null}
    </div>
  );

  if (part === 'editors') {
    return active ? editors : null;
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: part === 'switcher' ? 0 : 12 }}>
      {part === 'all' ? (
        <>
          <div style={{
            fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
          }}>
            Marcas
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Cada marca tem um contexto. Ao criar um projeto nela, o brief e o estilo já vêm preenchidos.
          </p>
        </>
      ) : null}

      <div
        role="listbox"
        aria-label="Marcas"
        style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {brandRoster.map((b) => {
          const on = b.id === (active?.id || activeBrandId);
          const ctx = brandHasContext(b);
          return (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => onSelectBrand(b.id)}
              style={{
                flex: '0 0 auto',
                minHeight: 36,
                padding: '0 12px',
                borderRadius: 9999,
                border: on ? '1px solid var(--accent)' : '1px solid var(--glass-border-strong)',
                background: on ? 'var(--accent-surface)' : 'var(--bg-card)',
                color: on ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-ui)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <Building2 size={12} color={on ? 'var(--accent)' : 'currentColor'} />
              {b.name || 'Sem nome'}
              {ctx ? (
                <span style={{
                  width: 6, height: 6, borderRadius: 99,
                  background: 'var(--success)', flexShrink: 0,
                }} title="Com contexto" />
              ) : null}
            </button>
          );
        })}
        {onOpenBrands ? (
          <button
            type="button"
            onClick={onOpenBrands}
            aria-label="Gerir marcas"
            style={{
              flex: '0 0 auto',
              minHeight: 36,
              padding: '0 12px',
              borderRadius: 9999,
              border: '1px dashed var(--glass-border-strong)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={12} /> Gerir
          </button>
        ) : null}
      </div>

      {active && part === 'switcher' ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {projectCount} projeto{projectCount === 1 ? '' : 's'}
          {hasCtx ? ' · contexto da marca ligado' : ' · sem brief de marca'}
        </div>
      ) : null}
      {active && part === 'all' ? editors : null}
    </section>
  );
}
