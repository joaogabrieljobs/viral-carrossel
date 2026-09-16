import React, { useMemo, useState } from 'react';
import { Download, ImageOff, Loader2, Package } from 'lucide-react';
import { downloadBlob } from '../../utils/export-helpers.js';

/** data URL → Blob, para descarregar com nome próprio. */
function dataUrlToBlob(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) return null;
  const bin = atob(m[2]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: m[1] || 'image/png' });
}

function extDe(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/([a-z0-9+]+)/i);
  const raw = (m?.[1] || 'png').toLowerCase();
  return raw === 'jpeg' ? 'jpg' : raw;
}

function slug(txt) {
  return String(txt || 'carrossel')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 40) || 'carrossel';
}

/**
 * Imagens geradas por IA nos projetos deste navegador + consumo do plano.
 * Antes não havia onde ver quantas imagens já tinham sido geradas, quantas
 * faltavam no ciclo, nem como voltar a descarregar uma imagem antiga.
 */
export default function ImagesLibraryPanel({
  library = [],
  imageQuota = null,
  planTier = null,
  isMobile = false,
  useOwnImageKey = false,
}) {
  const [baixandoTudo, setBaixandoTudo] = useState(false);

  const imagens = useMemo(() => {
    const vistas = new Set();
    const out = [];
    for (const entry of library) {
      const slides = Array.isArray(entry?.doc?.slides) ? entry.doc.slides : [];
      slides.forEach((s, i) => {
        const url = s?.bgImage;
        if (!url || typeof url !== 'string' || !url.startsWith('data:image')) return;
        if (s.bgImageSource !== 'ai') return;
        if (vistas.has(url)) return;
        vistas.add(url);
        out.push({
          url,
          docId: entry.id,
          docName: entry.name || 'Sem título',
          cardNum: i + 1,
          atualizado: entry.updatedAt || entry.createdAt || 0,
          nome: `${slug(entry.name)}-card-${String(i + 1).padStart(2, '0')}.${extDe(url)}`,
        });
      });
    }
    return out.sort((a, b) => b.atualizado - a.atualizado);
  }, [library]);

  const limite = Number(imageQuota?.limit);
  const usadas = Number(imageQuota?.used);
  const restantes = Number(imageQuota?.remaining);
  const temQuota = Number.isFinite(limite) && limite > 0;
  const pct = temQuota ? Math.min(100, Math.round((usadas / limite) * 100)) : 0;

  const baixarUma = async (img) => {
    const blob = dataUrlToBlob(img.url);
    if (blob) await downloadBlob(blob, img.nome);
  };

  const baixarTudo = async () => {
    if (!imagens.length) return;
    setBaixandoTudo(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      imagens.forEach((img) => {
        const blob = dataUrlToBlob(img.url);
        if (blob) zip.file(img.nome, blob);
      });
      const out = await zip.generateAsync({ type: 'blob' });
      await downloadBlob(out, 'imagens-viral-carrossel.zip');
    } finally {
      setBaixandoTudo(false);
    }
  };

  return (
    <>
      <header>
        <p className="vc-eyebrow" style={{ margin: '0 0 8px' }}>Imagens</p>
        <h2 style={{
          margin: 0, fontSize: isMobile ? 24 : 28, fontWeight: 600,
          letterSpacing: '-0.024em', fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)', lineHeight: 1.15,
        }}>
          Imagens geradas
        </h2>
        <p style={{
          margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)',
        }}>
          Quanto já usou do plano e todas as imagens que a IA criou nos seus projetos.
        </p>
      </header>

      {/* Consumo do plano */}
      <section style={{
        border: '1px solid var(--border)', borderRadius: 14, padding: isMobile ? 16 : 20,
        background: 'var(--bg-card)', display: 'grid', gap: 12,
      }}>
        {useOwnImageKey ? (
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            Está a usar a sua própria chave de imagem, por isso o plano não conta consumo.
            As imagens continuam guardadas abaixo.
          </div>
        ) : temQuota ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{
                fontSize: isMobile ? 20 : 24, fontWeight: 600, fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em', color: 'var(--text-primary)',
              }}>
                {usadas} de {limite} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>usadas neste ciclo</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: restantes > 0 ? 'var(--text-primary)' : '#ff5470', fontFamily: 'var(--font-ui)' }}>
                {restantes > 0 ? `${restantes} restantes` : 'Sem imagens restantes'}
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 9999, background: 'var(--bg-pearl)', overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 9999,
                background: restantes > 0 ? 'var(--accent)' : '#ff5470', transition: 'width 0.2s',
              }}/>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              {planTier ? `Plano ${planTier}. ` : ''}O contador reinicia na renovação da assinatura.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
            {imageQuota === null
              ? 'A carregar o consumo do plano…'
              : 'O seu plano não inclui geração de imagens. Faça upgrade para o Criador, ou use a sua própria chave em Configurar IA.'}
          </div>
        )}
      </section>

      {/* Galeria */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-ui)',
            letterSpacing: '-0.011em', color: 'var(--text-primary)',
          }}>
            {imagens.length === 1 ? '1 imagem guardada' : `${imagens.length} imagens guardadas`}
          </h3>
          {imagens.length > 0 && (
            <button
              type="button"
              onClick={baixarTudo}
              disabled={baixandoTudo}
              style={{
                height: 36, padding: '0 14px', borderRadius: 9999,
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--font-ui)', cursor: baixandoTudo ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {baixandoTudo ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }}/> : <Package size={13}/>}
              {baixandoTudo ? 'A preparar…' : 'Baixar todas (.zip)'}
            </button>
          )}
        </div>

        {imagens.length === 0 ? (
          <div style={{
            border: '1px dashed var(--border)', borderRadius: 14, padding: 28,
            display: 'grid', gap: 8, justifyItems: 'center', textAlign: 'center',
            color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: 13,
          }}>
            <ImageOff size={20} aria-hidden/>
            Ainda não há imagens geradas. Crie um carrossel com «Texto + imagem», ou use «Gerar imagem» num card.
          </div>
        ) : (
          <ul style={{
            listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12,
            gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(150px, 1fr))',
          }}>
            {imagens.map((img) => (
              <li key={`${img.docId}-${img.cardNum}`} style={{
                border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
                background: 'var(--bg-card)', display: 'grid',
              }}>
                <div style={{ aspectRatio: '4 / 5', background: 'var(--bg-pearl)' }}>
                  <img
                    src={img.url}
                    alt={`Imagem do card ${img.cardNum} de ${img.docName}`}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div style={{ padding: '8px 10px', display: 'grid', gap: 6 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {img.docName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, var(--font-ui))' }}>
                      card {String(img.cardNum).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      onClick={() => baixarUma(img)}
                      aria-label={`Baixar imagem do card ${img.cardNum} de ${img.docName}`}
                      title="Baixar imagem"
                      style={{
                        height: 28, width: 28, borderRadius: 8, cursor: 'pointer',
                        border: '1px solid var(--border)', background: 'var(--bg-base)',
                        color: 'var(--text-primary)', display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Download size={12}/>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
