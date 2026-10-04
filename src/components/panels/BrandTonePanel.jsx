import React, { useState } from 'react';
import { Fingerprint, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { brandToneIsReady, normalizeBrandTone, buildBrandToneMethod } from '../../utils/brand-tone.js';

/**
 * Home → analisar tom de voz e gravar perfil.
 * O tom acompanha TODOS os modos narrativos (preferência «Falar como minha marca»).
 * Análise devolve rascunho — só grava após confirmar.
 */
export function BrandTonePanel({
  brand,
  setBrand,
  onAnalyze,
  analyzing = false,
  hasOpenAI = false,
  onNeedKeys,
  toast,
}) {
  const tone = normalizeBrandTone(brand?.brandTone);
  const ready = brandToneIsReady(brand);
  const [openEdit, setOpenEdit] = useState(false);
  const [draft, setDraft] = useState(null);

  const patchTone = (partial) => {
    const cur = normalizeBrandTone(brand?.brandTone) || {
      summary: '', traits: [], do: '', dont: '', narrativeArc: '', samplePhrases: [], method: '',
    };
    const merged = { ...cur, ...partial };
    const next = normalizeBrandTone({
      ...merged,
      method: buildBrandToneMethod(merged),
    });
    setBrand?.({
      ...brand,
      brandTone: next,
      useBrandVoice: brand?.useBrandVoice !== false,
      ...(partial.summary != null ? { defaultTone: partial.summary } : {}),
    });
  };

  const clearTone = () => {
    setBrand?.({ ...brand, brandTone: null });
    setDraft(null);
  };

  const runAnalyze = async () => {
    if (!hasOpenAI) { onNeedKeys?.(); return; }
    if (ready && !window.confirm('Isto substitui o tom atual nas próximas gerações. Continuar?')) return;
    const next = await onAnalyze?.();
    if (next) setDraft(next);
  };

  const confirmDraft = () => {
    if (!draft) return;
    setBrand?.({
      ...brand,
      brandTone: draft,
      defaultTone: draft.summary || brand?.defaultTone,
      useBrandVoice: true,
    });
    setDraft(null);
    toast?.('Tom da marca guardado. A voz acompanha qualquer modo narrativo.', 'success', 5500);
  };

  const discardDraft = () => setDraft(null);

  const preview = draft || tone;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
          letterSpacing: '-0.011em', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Fingerprint size={14} /> Tom de voz
        </div>
        <p style={{
          margin: '4px 0 0', fontSize: 11, lineHeight: 1.45, color: 'var(--text-muted)',
        }}>
          Analisa o brief e a identidade. A voz acompanha qualquer modo narrativo — não substitui a estrutura do carrossel.
        </p>
      </div>

      {draft ? (
        <div style={{
          border: '1px solid var(--accent)',
          borderRadius: 12, padding: 12,
          background: 'var(--accent-surface)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            Confirme o tom antes de guardar
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {draft.summary}
          </div>
          {draft.traits?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {draft.traits.map((t) => (
                <span key={t} style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                  textTransform: 'uppercase', padding: '4px 8px', borderRadius: 9999,
                  border: '1px solid var(--hairline)', color: 'var(--text-secondary)',
                }}>{t}</span>
              ))}
            </div>
          ) : null}
          <label className="vc-label-sm">Resumo (editável)</label>
          <input
            className="vc-input"
            value={draft.summary || ''}
            onChange={(e) => setDraft({
              ...draft,
              summary: e.target.value,
              method: buildBrandToneMethod({ ...draft, summary: e.target.value }),
            })}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="vc-btn" onClick={confirmDraft} style={{
              flex: 1, minHeight: 44, borderRadius: 9999, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600,
            }}>
              Guardar tom da marca
            </button>
            <button type="button" className="vc-btn vc-btn-ghost" onClick={discardDraft} style={{ minHeight: 44 }}>
              Descartar
            </button>
          </div>
        </div>
      ) : ready ? (
        <div style={{
          border: '1px solid var(--glass-border-strong)',
          borderRadius: 12, padding: 12,
          background: 'var(--bg-card)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {preview.summary}
          </div>
          {preview.traits?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {preview.traits.map((t) => (
                <span key={t} style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                  textTransform: 'uppercase', padding: '4px 8px', borderRadius: 9999,
                  border: '1px solid var(--hairline)', color: 'var(--text-secondary)',
                }}>{t}</span>
              ))}
            </div>
          ) : null}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.4,
          }}>
            <input
              type="checkbox"
              checked={brand?.useBrandVoice !== false}
              onChange={(e) => setBrand?.({ ...brand, useBrandVoice: e.target.checked })}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--accent)' }}
            />
            <span>Falar como minha marca (aplica a voz em qualquer modo narrativo)</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              disabled={analyzing}
              onClick={runAnalyze}
              style={{ minHeight: 40, flex: 1 }}
            >
              {analyzing ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Analisando…</> : <><Sparkles size={14} /> Reanalisar</>}
            </button>
            <button type="button" className="vc-btn vc-btn-ghost" onClick={() => setOpenEdit((v) => !v)} style={{ minHeight: 40 }}>
              {openEdit ? 'Fechar' : 'Editar'}
            </button>
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              onClick={clearTone}
              aria-label="Remover tom da marca"
              style={{ minHeight: 40, width: 40, padding: 0, color: '#f87171' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="vc-btn"
          disabled={analyzing}
          onClick={runAnalyze}
          style={{
            width: '100%', minHeight: 48, borderRadius: 9999,
            background: 'var(--accent)', color: '#fff', border: 'none',
            fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {analyzing
            ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Analisando tom…</>
            : <><Sparkles size={14} /> Analisar meu tom</>}
        </button>
      )}

      {(openEdit && ready && !draft) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="vc-label-sm">Resumo do tom</label>
            <input className="vc-input" value={tone.summary || ''} onChange={(e) => patchTone({ summary: e.target.value })} placeholder="Ex.: direto, editorial, sem motivacional" />
          </div>
          <div>
            <label className="vc-label-sm">Traços (separados por vírgula)</label>
            <input className="vc-input" value={(tone.traits || []).join(', ')} onChange={(e) => patchTone({ traits: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </div>
          <div>
            <label className="vc-label-sm">Fazer</label>
            <textarea className="vc-input vc-textarea" rows={3} value={tone.do || ''} onChange={(e) => patchTone({ do: e.target.value })} style={{ resize: 'vertical', minHeight: 64 }} />
          </div>
          <div>
            <label className="vc-label-sm">Evitar</label>
            <textarea className="vc-input vc-textarea" rows={3} value={tone.dont || ''} onChange={(e) => patchTone({ dont: e.target.value })} style={{ resize: 'vertical', minHeight: 64 }} />
          </div>
          <div>
            <label className="vc-label-sm">Arco narrativo</label>
            <textarea className="vc-input vc-textarea" rows={3} value={tone.narrativeArc || ''} onChange={(e) => patchTone({ narrativeArc: e.target.value })} style={{ resize: 'vertical', minHeight: 64 }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
