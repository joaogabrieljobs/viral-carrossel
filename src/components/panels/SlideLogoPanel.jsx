import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import {
  storeSlideLogo,
  resolveLogoControls,
  clearSlideLogoLayout,
  resolveLogoDataUrl,
  brandLogoInsertPatch,
  stampLogoVisibleOnSlides,
  hideLogoOnSlides,
  LOGO_SIZE_MIN,
  LOGO_SIZE_MAX,
  LOGO_SIZE_DEFAULT,
} from '../../utils/slide-logo.js';
import { origemParaBlob } from '../../utils/image-store.js';
import { Slider } from '../ui/primitives.jsx';

const POS = [
  { id: 'tl', label: '↖' },
  { id: 'tr', label: '↗' },
  { id: 'bl', label: '↙' },
  { id: 'br', label: '↘' },
];

/**
 * Único painel de logo: padrão da marca + overrides do card ativo.
 * - Ajustes “padrão” escrevem na marca e limpam override do card ativo
 * - “Ocultar neste card” usa logoHidden (não apaga a marca)
 * - “Inserir logo em todos os cards” promove projeto→marca e deixa todos visíveis
 */
export function SlideLogoPanel({
  slide,
  updateSlide,
  toast,
  styleKit,
  setStyleKit,
  brand,
  setBrand,
  setSlides,
  cardIndex = 0,
  selectedSlideIds = null,
}) {
  const brandFile = useRef(null);
  const cardFile = useRef(null);
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const ctrl = resolveLogoControls(brand, slide);
  const hidden = !!slide.logoHidden;
  const hasCustom = !!(slide.logoImageId && !hidden);
  const cardN = cardIndex + 1;
  const hasLogoSource = !!(brand?.logo || styleKit?.logo?.imageId);
  const logoOnGenerate = styleKit?.logoOnGenerate !== false;

  const setBrandLogo = (partial) => {
    if (!setBrand) return;
    setBrand({ ...brand, ...partial });
    // Card ativo deixa de travar o padrão antigo
    updateSlide(clearSlideLogoLayout());
  };

  const setCardLayout = (partial) => {
    updateSlide({ ...partial, logoHidden: false });
  };

  /** Promove logo do projeto/marca → marca e deixa todos (ou seleção) com ela visível. */
  const insertLogoOnAllCards = async (onlySelected = false) => {
    if (!setBrand || !setSlides) {
      toast?.('Não foi possível aplicar a logo em todos os cards.', 'error');
      return;
    }
    const ids = onlySelected && selectedSlideIds?.length ? selectedSlideIds : null;
    if (onlySelected && !ids?.length) {
      toast?.('Selecione cards na lista para aplicar a logo só neles.', 'info');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resolveLogoDataUrl(brand, styleKit);
      if (!alive.current) return;
      if (!dataUrl) {
        toast?.('Carrega uma logo da marca ou do projeto primeiro.', 'error');
        return;
      }
      setBrand({ ...brand, ...brandLogoInsertPatch(dataUrl, brand) });
      setSlides((list) => stampLogoVisibleOnSlides(list, ids));
      setStyleKit?.((prev) => ({ ...prev, logoOnGenerate: true }));
      toast?.(
        ids
          ? `Logo aplicada em ${ids.length} card${ids.length === 1 ? '' : 's'} selecionado${ids.length === 1 ? '' : 's'}. Desfazer: Cmd+Z.`
          : 'Logo inserida em todos os cards. Desfazer: Cmd+Z.',
        'success',
        5500,
      );
    } catch (error) {
      if (alive.current) toast?.(error.message || 'Falha ao inserir a logo.', 'error');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const removeLogoFromCards = (onlySelected = false) => {
    if (!setSlides) return;
    const ids = onlySelected && selectedSlideIds?.length ? selectedSlideIds : null;
    if (onlySelected && !ids?.length) {
      toast?.('Selecione cards na lista para remover a logo só neles.', 'info');
      return;
    }
    setSlides((list) => hideLogoOnSlides(list, ids));
    toast?.(
      ids
        ? `Logo ocultada em ${ids.length} card${ids.length === 1 ? '' : 's'}. Desfazer: Cmd+Z.`
        : 'Logo removida de todos os cards (a marca mantém-se). Desfazer: Cmd+Z.',
      'success',
      5500,
    );
  };

  const onBrandUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !setBrand) return;
    if (file.size > 2 * 1024 * 1024) {
      toast?.('Imagem muito grande. Máximo 2MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBrand({
        ...brand,
        logo: reader.result,
        logoSize: brand.logoSize ?? LOGO_SIZE_DEFAULT,
        logoOpacity: brand.logoOpacity ?? 90,
        logoPosition: brand.logoPosition || 'tr',
      });
      setSlides?.((list) => stampLogoVisibleOnSlides(list));
      setStyleKit?.((prev) => ({ ...prev, logoOnGenerate: true }));
      updateSlide({ ...clearSlideLogoLayout(), logoHidden: false });
      toast?.('Logo da marca aplicada em todos os cards.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const onCardUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const patch = await storeSlideLogo(file);
      if (!alive.current) { URL.revokeObjectURL(patch.logoImage); return; }
      setStyleKit?.(prev => ({ ...prev, logo: { imageId: patch.logoImageId, name: file.name } }));
      updateSlide({
        ...patch,
        logoPosition: slide.logoPosition || brand?.logoPosition || 'tr',
        logoSize: slide.logoSize ?? brand?.logoSize ?? LOGO_SIZE_DEFAULT,
        logoOpacity: slide.logoOpacity ?? brand?.logoOpacity ?? 90,
      });
      toast?.(`Logo só no card ${cardN}.`, 'success');
    } catch (error) {
      if (alive.current) toast?.(error.message, 'error');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const applyProjectOrBrandToCard = async () => {
    if (styleKit?.logo?.imageId) {
      updateSlide({
        logoImageId: styleKit.logo.imageId,
        logoImage: null,
        logoHidden: false,
        logoPosition: slide.logoPosition || brand?.logoPosition || 'tr',
        logoSize: slide.logoSize ?? brand?.logoSize ?? LOGO_SIZE_DEFAULT,
        logoOpacity: slide.logoOpacity ?? brand?.logoOpacity ?? 90,
      });
      toast?.(`Logo do projeto só no card ${cardN}.`, 'success');
      return;
    }
    if (!brand?.logo) return;
    setBusy(true);
    try {
      const patch = await storeSlideLogo(await origemParaBlob(brand.logo));
      if (!alive.current) { URL.revokeObjectURL(patch.logoImage); return; }
      setStyleKit?.(prev => ({ ...prev, logo: { imageId: patch.logoImageId, name: 'Logo da marca' } }));
      updateSlide({
        ...patch,
        logoPosition: brand.logoPosition || 'tr',
        logoSize: brand.logoSize ?? LOGO_SIZE_DEFAULT,
        logoOpacity: brand.logoOpacity ?? 90,
      });
      toast?.(`Cópia da logo da marca só no card ${cardN}.`, 'success');
    } catch (error) {
      if (alive.current) toast?.(error.message, 'error');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Padrão da marca ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
          letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
        }}>
          Padrão em todos os cards
        </div>

        {brand?.logo ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-card)', border: '1px solid var(--glass-border-strong)',
            borderRadius: 10, padding: 10,
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: 6, flexShrink: 0,
              background: `url(${brand.logo}) center/contain no-repeat`,
              border: '1px solid var(--border)',
              backgroundColor: 'rgba(255,255,255,0.04)',
            }} />
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Logo da marca ativa
            </div>
            {setBrand ? (
              <button
                type="button"
                onClick={() => setBrand({ ...brand, logo: null })}
                aria-label="Remover logo da marca"
                title="Remove de todos os cards (exceto overrides)"
                style={{
                  width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)', color: '#f87171', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="vc-btn vc-btn-ghost"
            onClick={() => brandFile.current?.click()}
            style={{ width: '100%', minHeight: 48, justifyRadius: 12 }}
          >
            <Upload size={14} /> Carregar logo da marca (PNG)
          </button>
        )}
        <input
          ref={brandFile}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          aria-label="Arquivo da logo da marca"
          style={{ display: 'none' }}
          onChange={onBrandUpload}
        />

        {brand?.logo && setBrand ? (
          <>
            <div>
              <label className="vc-label-sm">Posição padrão</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                {POS.map((p) => {
                  const on = (brand.logoPosition || 'tr') === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`vc-seg-item${on ? ' active' : ''}`}
                      aria-pressed={on}
                      onClick={() => setBrandLogo({ logoPosition: p.id })}
                      style={{ minHeight: 40, fontSize: 14 }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Slider
              label="Tamanho padrão"
              value={brand.logoSize ?? LOGO_SIZE_DEFAULT}
              min={LOGO_SIZE_MIN}
              max={LOGO_SIZE_MAX}
              onChange={(v) => setBrandLogo({ logoSize: v })}
            />
            <Slider
              label="Opacidade padrão"
              value={brand.logoOpacity ?? 90}
              min={10}
              max={100}
              onChange={(v) => setBrandLogo({ logoOpacity: v })}
            />
          </>
        ) : null}

        {hasLogoSource && setBrand && setSlides ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              className="vc-btn"
              disabled={busy}
              onClick={() => insertLogoOnAllCards(false)}
              style={{
                width: '100%', minHeight: 48, borderRadius: 9999,
                background: 'var(--accent)', color: 'var(--accent-on-dark, #fff)',
                border: 'none', fontWeight: 600, fontSize: 13,
              }}
            >
              {busy ? 'Inserindo…' : 'Aplicar em todos'}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                className="vc-btn"
                disabled={busy}
                onClick={() => removeLogoFromCards(false)}
                style={{
                  minHeight: 40, borderRadius: 10, fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--glass-border-strong)', background: 'var(--bg-card)',
                }}
              >
                Remover de todos
              </button>
              <button
                type="button"
                className="vc-btn"
                disabled={busy || !(selectedSlideIds?.length)}
                onClick={() => insertLogoOnAllCards(true)}
                title={selectedSlideIds?.length ? undefined : 'Selecione cards na lista Controles → Cards'}
                style={{
                  minHeight: 40, borderRadius: 10, fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--glass-border-strong)', background: 'var(--bg-card)',
                  opacity: selectedSlideIds?.length ? 1 : 0.45,
                }}
              >
                Só nos selecionados
              </button>
            </div>
            {selectedSlideIds?.length ? (
              <button
                type="button"
                className="vc-btn vc-btn-ghost"
                disabled={busy}
                onClick={() => removeLogoFromCards(true)}
                style={{ minHeight: 36, fontSize: 12 }}
              >
                Remover dos {selectedSlideIds.length} selecionados
              </button>
            ) : null}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.4,
            }}>
              <input
                type="checkbox"
                checked={logoOnGenerate}
                onChange={(e) => setStyleKit?.((prev) => ({ ...prev, logoOnGenerate: e.target.checked }))}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--accent)' }}
              />
              <span>
                Aplicar a logo nos novos cards deste projeto
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Preferência do projeto — pode desativar a qualquer momento.
                </span>
              </span>
            </label>
          </div>
        ) : null}
      </div>

      {/* ── Este card ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        paddingTop: 12, borderTop: '1px solid var(--glass-border)',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
          letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)',
        }}>
          Só no card {cardN}
        </div>

        {(brand?.logo || styleKit?.logo?.imageId || hasCustom) ? (
          <button
            type="button"
            className="vc-btn"
            onClick={() => {
              if (hidden) {
                updateSlide({ logoHidden: false });
                toast?.(`Logo visível no card ${cardN}.`, 'success');
              } else {
                updateSlide({ logoHidden: true });
                toast?.(`Logo ocultada só no card ${cardN}.`, 'success');
              }
            }}
            style={{
              width: '100%', minHeight: 44, borderRadius: 10,
              border: `1px solid ${hidden ? 'var(--accent)' : 'var(--glass-border-strong)'}`,
              background: hidden ? 'var(--accent-surface)' : 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            {hidden ? `Mostrar logo no card ${cardN}` : `Ocultar logo só no card ${cardN}`}
          </button>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Carrega a logo da marca acima — ou importa um PNG só para este card.
          </p>
        )}

        {!hidden && (brand?.logo || hasCustom) ? (
          <>
            <div>
              <label className="vc-label-sm">Posição neste card</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                {POS.map((p) => {
                  const on = ctrl.logoPosition === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`vc-seg-item${on ? ' active' : ''}`}
                      aria-pressed={on}
                      onClick={() => setCardLayout({ logoPosition: p.id })}
                      style={{ minHeight: 40, fontSize: 14 }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Slider
              label={`Tamanho no card ${cardN}`}
              value={ctrl.logoSize}
              min={LOGO_SIZE_MIN}
              max={LOGO_SIZE_MAX}
              onChange={(v) => setCardLayout({ logoSize: v })}
            />
            <Slider
              label={`Opacidade no card ${cardN}`}
              value={ctrl.logoOpacity}
              min={10}
              max={100}
              onChange={(v) => setCardLayout({ logoOpacity: v })}
            />
          </>
        ) : null}

        {!hidden ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(styleKit?.logo?.imageId || brand?.logo) && !hasCustom ? (
              <button
                type="button"
                className="vc-btn vc-btn-ghost"
                disabled={busy}
                onClick={applyProjectOrBrandToCard}
                style={{ width: '100%', minHeight: 40 }}
              >
                {styleKit?.logo?.imageId ? 'Usar logo do projeto só neste card' : 'Duplicar logo da marca só neste card'}
              </button>
            ) : null}
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              disabled={busy}
              onClick={() => cardFile.current?.click()}
              style={{ width: '100%', minHeight: 40 }}
            >
              {busy ? 'Importando…' : hasCustom ? 'Trocar PNG deste card' : 'Importar PNG só neste card'}
            </button>
            <input
              ref={cardFile}
              type="file"
              accept="image/png"
              aria-label="Arquivo PNG da logo deste card"
              style={{ display: 'none' }}
              onChange={onCardUpload}
            />
            {hasCustom ? (
              <>
                {slide.logoImage ? (
                  <img
                    src={slide.logoImage}
                    alt={`Logo do card ${cardN}`}
                    style={{
                      width: 64, height: 64, objectFit: 'contain', alignSelf: 'center',
                      background: 'repeating-conic-gradient(#aaa 0% 25%, #ddd 0% 50%) 0 / 16px 16px',
                      borderRadius: 8,
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  className="vc-btn vc-btn-ghost"
                  onClick={() => updateSlide({
                    logoImageId: null,
                    logoImage: null,
                    logoHidden: false,
                    ...clearSlideLogoLayout(),
                  })}
                  style={{ width: '100%', minHeight: 40 }}
                >
                  Voltar à logo da marca neste card
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
