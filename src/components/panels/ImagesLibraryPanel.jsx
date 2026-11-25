import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ImageOff, Loader2, Package } from 'lucide-react';
import { downloadBlob } from '../../utils/export-helpers.js';
import { accountAiImageRefs, createLoadQueue, fetchImageFromAccount, loadAccountImage } from '../../utils/account-images.js';
import { normalizeAccountUsage } from '../../utils/account-usage.js';

function extDeMime(mime) {
  const raw = String(mime || 'image/png').split('/')[1]?.toLowerCase() || 'png';
  return raw === 'jpeg' ? 'jpg' : raw.replace(/[^a-z0-9]/g, '');
}

function slug(txt) {
  return String(txt || 'carrossel')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 40) || 'carrossel';
}

/**
 * Miniatura da galeria. A imagem que só existe na conta aparece primeiro como
 * "carregando" e, se o download falhar, com o botão de tentar de novo.
 */
export function AccountImageTile({ item, onRetry, onDownload }) {
  const card = String(item.cardNum).padStart(2, '0');
  return (
    <li data-image-key={item.key} style={{
      border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
      background: 'var(--bg-card)', display: 'grid',
    }}>
      <div style={{ aspectRatio: '4 / 5', background: 'var(--bg-pearl)' }}>
        {item.status === 'ready' ? (
          <img
            src={item.url}
            alt={`Imagem do card ${item.cardNum} de ${item.docName}`}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : item.status === 'error' ? (
          <div role="alert" style={{
            height: '100%', padding: 10, display: 'grid', gap: 8, alignContent: 'center', justifyItems: 'center',
            textAlign: 'center', fontSize: 11, lineHeight: 1.4, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
          }}>
            <ImageOff size={16} aria-hidden/>
            Não foi possível carregar esta imagem.
            <button type="button" onClick={() => onRetry?.(item)} style={{
              minHeight: 32, padding: '0 12px', borderRadius: 9999, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)',
              fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
            }}>Tentar de novo</button>
          </div>
        ) : (
          <div aria-busy="true" role="status" aria-label={`Carregando imagem do card ${item.cardNum} de ${item.docName}`} style={{
            height: '100%', display: 'grid', gap: 6, alignContent: 'center', justifyItems: 'center',
            fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
          }}>
            <Loader2 size={16} aria-hidden style={{ animation: 'spin 0.8s linear infinite' }}/>
            Carregando…
          </div>
        )}
      </div>
      <div style={{ padding: '8px 10px', display: 'grid', gap: 6 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.docName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, var(--font-ui))' }}>
            card {card}
          </span>
          <button
            type="button"
            onClick={() => onDownload?.(item)}
            disabled={item.status !== 'ready'}
            aria-label={`Baixar imagem do card ${item.cardNum} de ${item.docName}`}
            title="Baixar imagem"
            style={{
              height: 28, width: 28, borderRadius: 8, cursor: item.status === 'ready' ? 'pointer' : 'default',
              border: '1px solid var(--border)', background: 'var(--bg-base)',
              color: 'var(--text-primary)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', opacity: item.status === 'ready' ? 1 : 0.45,
            }}
          >
            <Download size={12}/>
          </button>
        </div>
      </div>
    </li>
  );
}

/**
 * Imagens geradas por IA nos projetos da conta + consumo do plano.
 * Antes não havia onde ver quantas imagens já tinham sido geradas, quantas
 * faltavam no ciclo, nem como voltar a descarregar uma imagem antiga.
 */
export default function ImagesLibraryPanel({
  library = [],
  imageQuota = null,
  planTier = null,
  isMobile = false,
  useOwnImageKey = false,
  onOpenUsage,
}) {
  const [baixandoTudo, setBaixandoTudo] = useState(false);

  // As referências vêm dos cards de todos os projetos. Os bytes vêm deste
  // navegador ou, quando faltam, da conta: só quando a miniatura aparece na
  // tela e duas por vez, para não baixar a conta inteira ao abrir a galeria.
  const refs = useMemo(() => accountAiImageRefs(library), [library]);
  const refsKey = refs.map((ref) => `${ref.key}:${ref.imageId || ''}:${ref.docName}:${ref.cardNum}`).join('|');
  const [loaded, setLoaded] = useState({});
  const loaderRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const urls = [];
    const abort = new AbortController();
    const queue = createLoadQueue(2);
    const visible = new Set();
    const waiters = new Map();
    const inflight = new Map();
    const show = (key) => {
      visible.add(key);
      waiters.get(key)?.();
      waiters.delete(key);
    };
    const whenVisible = (key) => (visible.has(key)
      ? Promise.resolve()
      : new Promise((resolve) => { waiters.set(key, resolve); }));
    const load = (ref) => {
      if (inflight.has(ref.key)) return inflight.get(ref.key);
      setLoaded((current) => ({ ...current, [ref.key]: { status: 'loading' } }));
      const flight = loadAccountImage(ref, {
        signal: abort.signal,
        fetchFromAccount: async (target, options) => {
          await whenVisible(target.key);
          return queue(() => (cancelled ? null : fetchImageFromAccount(target, options)));
        },
      }).then((image) => {
        if (cancelled) return null;
        const url = URL.createObjectURL(image.blob);
        urls.push(url);
        const item = {
          status: 'ready', url, blob: image.blob,
          nome: `${slug(ref.docName)}-card-${String(ref.cardNum).padStart(2, '0')}.${extDeMime(image.mime || image.blob.type)}`,
        };
        setLoaded((current) => ({ ...current, [ref.key]: item }));
        return item;
      }).catch((error) => {
        // Sem cópia na conta nem bytes locais: fica de fora, como antes.
        if (!cancelled) setLoaded((current) => ({ ...current, [ref.key]: { status: error?.code === 'image_missing' ? 'missing' : 'error' } }));
        return null;
      }).finally(() => { inflight.delete(ref.key); });
      inflight.set(ref.key, flight);
      return flight;
    };
    setLoaded({});
    refs.forEach((ref) => { load(ref); });
    const tiles = [...(listRef.current?.querySelectorAll('[data-image-key]') || [])];
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
        entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
          show(entry.target.getAttribute('data-image-key'));
          observer.unobserve(entry.target);
        });
      }, { rootMargin: '200px' })
      : null;
    if (observer) tiles.forEach((tile) => observer.observe(tile));
    else refs.forEach((ref) => show(ref.key));
    loaderRef.current = { load, show };
    return () => {
      cancelled = true;
      abort.abort();
      observer?.disconnect();
      waiters.forEach((resolve) => resolve());
      urls.forEach((u) => URL.revokeObjectURL(u));
      loaderRef.current = null;
    };
    // `refsKey` resume as referências; a biblioteca muda de identidade a cada gravação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refsKey]);
  const imagens = refs
    .map((ref) => ({ ...ref, status: 'loading', ...(loaded[ref.key] || {}) }))
    .filter((item) => item.status !== 'missing');
  const tentarDeNovo = (item) => {
    loaderRef.current?.show(item.key);
    loaderRef.current?.load(item);
  };

  const usage = normalizeAccountUsage({ imageQuota, planTier });
  const { limit: limite, used: usadas, remaining: restantes } = usage;
  const temQuota = usage.hasUsage && limite > 0;
  const pct = temQuota ? Math.min(100, Math.round((usadas / limite) * 100)) : 0;

  const baixarUma = async (img) => {
    if (img.blob) await downloadBlob(img.blob, img.nome);
  };

  const baixarTudo = async () => {
    if (!imagens.length) return;
    setBaixandoTudo(true);
    try {
      // "Todas" inclui as que ainda não apareceram na tela: baixa o que falta.
      const prontas = [];
      for (const img of imagens) {
        if (img.blob) { prontas.push(img); continue; }
        loaderRef.current?.show(img.key);
        // eslint-disable-next-line no-await-in-loop
        const item = await loaderRef.current?.load(img);
        if (item?.blob) prontas.push(item);
      }
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      prontas.forEach((img) => {
        zip.file(img.nome, img.blob);
      });
      const out = await zip.generateAsync({ type: 'blob' });
      await downloadBlob(out, 'imagens-moont.zip');
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
          Quanto você já usou do plano e as imagens de IA que continuam ligadas aos seus projetos, neste aparelho ou na conta.
        </p>
      </header>

      {/* Consumo do plano */}
      <section style={{
        border: '1px solid var(--border)', borderRadius: 14, padding: isMobile ? 16 : 20,
        background: 'var(--bg-card)', display: 'grid', gap: 12,
      }}>
        {useOwnImageKey ? (
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            Você está usando sua própria chave de imagem, por isso o plano não conta consumo.
            As imagens continuam salvas abaixo.
          </div>
        ) : usage.unlimited && usage.hasUsage ? (
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
            <strong>{usadas}</strong> geradas neste ciclo · <strong>sem limite</strong> de imagens nesta conta.
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
              {usage.planName ? `${usage.planName}. ` : ''}O contador reinicia na renovação da assinatura.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.55 }}>
              O contador registra cada geração concluída. A galeria abaixo mostra somente imagens ainda vinculadas aos cards. As que estão só na conta são baixadas quando aparecem na tela. Imagens substituídas ou removidas continuam no histórico de Uso.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
            {usage.noIncludedImages
              ? 'Seu plano não inclui geração de imagens. Você pode importar imagens ou usar sua própria chave em Configurar IA.'
              : 'Não foi possível confirmar o consumo. Abra Uso para atualizar o saldo.'}
          </div>
        )}
        <button type="button" onClick={onOpenUsage} style={{ minHeight: 40, padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 9999, background: 'var(--accent-surface)', color: 'var(--text-primary)', cursor: 'pointer' }}>Ver uso da conta</button>
      </section>

      {/* Galeria */}
      <section style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-ui)',
            letterSpacing: '-0.011em', color: 'var(--text-primary)',
          }}>
            {imagens.length === 1 ? '1 imagem salva' : `${imagens.length} imagens salvas`}
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
              {baixandoTudo ? 'Preparando…' : 'Baixar todas (.zip)'}
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
            Ainda não há imagens geradas. Crie um carrossel com «Texto + imagem» ou use «Gerar imagem» em um card.
          </div>
        ) : (
          <ul ref={listRef} style={{
            listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12,
            gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(150px, 1fr))',
          }}>
            {imagens.map((img) => (
              <AccountImageTile key={img.key} item={img} onRetry={tentarDeNovo} onDownload={baixarUma}/>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
