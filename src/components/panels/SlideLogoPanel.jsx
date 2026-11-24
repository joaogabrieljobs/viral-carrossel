import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import {
  storeSlideLogo,
  resolveLogoAssetSource,
  resolveLogoControls,
  clearSlideLogoLayout,
  resolveLogoDataUrl,
  stampLogoVisibleOnSlides,
  LOGO_SIZE_MIN,
  LOGO_SIZE_MAX,
  LOGO_SIZE_DEFAULT,
  LOGO_SIZE_IMPORT,
  logoImportControls,
  brandLogoReplacementPatch,
  clearLogoOffsetOnSlide,
  clearLogoOffsetOnSlides,
} from '../../utils/slide-logo.js';
import { applyFormatEditToAll, applyLogoToCards, followLogoDefaultOnAllCards } from '../../utils/format-view.js';
import { origemParaBlob } from '../../utils/image-store.js';
import { Slider } from '../ui/primitives.jsx';

// UX-08: a seta é só o desenho do botão; `name` é o que o leitor de tela anuncia.
const POS = [
  { id: 'tl', label: '↖', name: 'Superior esquerda' },
  { id: 'tr', label: '↗', name: 'Superior direita' },
  { id: 'c', label: '●', name: 'Centro' },
  { id: 'bl', label: '↙', name: 'Inferior esquerda' },
  { id: 'br', label: '↘', name: 'Inferior direita' },
];

/**
 * Único painel de logo: padrão da marca + overrides do card ativo.
 * - Ajustes “padrão” escrevem na marca e soltam o mesmo ajuste em todos os cards
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
  onSaveBrandLogo = null,
  setSlides,
  editDoc = null,
  cardIndex = 0,
  selectedSlideIds = null,
  cardOnly = false,
}) {
  const brandFile = useRef(null);
  const cardFile = useRef(null);
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const ctrl = resolveLogoControls(brand, slide);
  const hidden = !!slide.logoHidden;
  const hasCustom = !!((slide.logoImageId || slide.logoImage) && !hidden);
  const cardN = cardIndex + 1;
  const hasProjectLogo = !!(styleKit?.logo?.imageId || styleKit?.logo?.dataUrl);
  const hasLogoSource = !!(brand?.logo || brand?.logoImageId || hasProjectLogo || slide?.logoImageId || slide?.logoImage);
  const logoOnGenerate = styleKit?.logoOnGenerate !== false;

  const setBrandLogo = (partial) => {
    if (!setBrand) return;
    // Reteste 22/11: tamanho escolhido no controle sobrevive a duplicar/reabrir.
    setBrand((current) => ({ ...current, ...partial, ...(partial.logoSize != null ? { logoSizeChosen: true } : {}) }));
    // Nenhum card trava o padrão antigo. Depois de "Aplicar em todos" só o
    // card aberto mudava, porque cada card guardava o ajuste copiado.
    if (editDoc) editDoc((d) => followLogoDefaultOnAllCards(d, partial));
    else updateSlide(clearSlideLogoLayout());
  };

  const setCardLayout = (partial) => {
    updateSlide({ ...partial, ...(partial.logoSize != null ? { logoSizeChosen: true } : {}), logoHidden: false });
  };

  /** Aplica a logo em cards sem promover a logo específica do projeto ao perfil global. */
  const insertLogoOnAllCards = async (onlySelected = false) => {
    if (!editDoc) {
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
      const asset = resolveLogoAssetSource(brand, styleKit, slide);
      if (!asset) {
        toast?.('Carregue uma logo da marca ou do projeto primeiro.', 'error');
        return;
      }
      // O card selecionado é a fonte de verdade: se ele usa um PNG próprio,
      // “Aplicar em todos” replica esse arquivo e o seu ajuste visual.
      let { logoImageId, logoImage } = asset;
      // PNG embutido já é portátil. Object URLs antigas ainda precisam de uma
      // gravação confirmada (ou do fallback portátil) antes de serem replicadas.
      if (!logoImageId && !String(logoImage).startsWith('data:image/png;base64,')) {
        const stored = await storeSlideLogo(await origemParaBlob(logoImage));
        logoImageId = stored.logoImageId;
        logoImage = stored.logoImage;
      }
      if (!alive.current) return;
      // Mesmo quando a origem é a marca, substituir as cópias antigas dos
      // destinos. Apenas desocultar deixava overrides vazios bloqueando-a.
      // O ajuste vai pela proporção aberta, como o feito card a card.
      editDoc((d) => applyLogoToCards(d, {
        ids,
        logoImageId,
        logoImage,
        sourceSlide: slide,
        brand,
      }));
      if (!onlySelected) setStyleKit?.((prev) => ({ ...prev, logoOnGenerate: true }));
      toast?.(
        ids
          ? `Logo aplicada em ${ids.length} card${ids.length === 1 ? '' : 's'} selecionado${ids.length === 1 ? '' : 's'}. Use Desfazer para voltar.`
          : 'Logo e ajuste do card atual aplicados em todos. Use Desfazer para voltar.',
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
    if (!editDoc) return;
    const ids = onlySelected && selectedSlideIds?.length ? selectedSlideIds : null;
    if (onlySelected && !ids?.length) {
      toast?.('Selecione cards na lista para remover a logo só neles.', 'info');
      return;
    }
    editDoc((d) => applyFormatEditToAll(d, { logoHidden: true }, ids));
    toast?.(
      ids
        ? `Logo ocultada em ${ids.length} card${ids.length === 1 ? '' : 's'}. Use Desfazer para voltar.`
        : 'Logo removida de todos os cards. A marca continua com a logo. Use Desfazer para voltar.',
      'success',
      5500,
    );
  };

  const onBrandUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !setBrand) return;
    setBusy(true);
    try {
      const stored = await storeSlideLogo(file);
      if (!alive.current) { URL.revokeObjectURL(stored.logoImage); return; }
      const patch = brandLogoReplacementPatch(stored, brand);
      if (onSaveBrandLogo) onSaveBrandLogo(patch);
      else setBrand((current) => ({ ...current, ...patch }));
      setSlides?.((list) => clearLogoOffsetOnSlides(stampLogoVisibleOnSlides(list)));
      updateSlide({ ...clearSlideLogoLayout(), logoHidden: false });
      toast?.(
        stored.logoLowRes
          ? `Logo aplicada, mas o PNG é pequeno (<600px). Use um arquivo maior para ficar nítida.`
          : `Logo da marca aplicada · tamanho ${LOGO_SIZE_IMPORT}px (ajuste o tamanho até ${LOGO_SIZE_MAX}).`,
        stored.logoLowRes ? 'info' : 'success',
        stored.logoLowRes ? 7000 : 4000,
      );
    } catch (error) {
      if (alive.current) toast?.(error.message || 'Não foi possível salvar a logo.', 'error');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const onCardUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const patch = await storeSlideLogo(file);
      if (!alive.current) { URL.revokeObjectURL(patch.logoImage); return; }
      const next = clearLogoOffsetOnSlide({
        ...slide,
        ...patch,
        ...logoImportControls(brand),
        logoPosition: slide.logoPosition || brand?.logoPosition || 'tr',
      });
      updateSlide({
        logoImageId: next.logoImageId,
        logoImage: next.logoImage,
        logoHidden: false,
        logoPosition: next.logoPosition,
        logoSize: next.logoSize,
        logoOpacity: next.logoOpacity,
        elementOffsets: next.elementOffsets,
      });
      toast?.(
        patch.logoLowRes
          ? `Logo no card ${cardN}, mas o PNG é pequeno (<600px). Prefira um arquivo maior.`
          : `Logo só no card ${cardN} · tamanho ${LOGO_SIZE_IMPORT}px.`,
        patch.logoLowRes ? 'info' : 'success',
        5500,
      );
    } catch (error) {
      if (alive.current) toast?.(error.message, 'error');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const applyProjectOrBrandToCard = async () => {
    if (hasProjectLogo) {
      updateSlide({
        logoImageId: styleKit.logo.imageId || null,
        logoImage: styleKit.logo.dataUrl || null,
        logoHidden: false,
        logoPosition: slide.logoPosition || brand?.logoPosition || 'tr',
        logoSize: slide.logoSize ?? brand?.logoSize ?? LOGO_SIZE_DEFAULT,
        logoOpacity: slide.logoOpacity ?? brand?.logoOpacity ?? 90,
      });
      toast?.(`Logo do projeto só no card ${cardN}.`, 'success');
      return;
    }
    if (!brand?.logo && !brand?.logoImageId) return;
    setBusy(true);
    try {
      const source = await resolveLogoDataUrl(brand, {});
      if (!source) throw new Error('A logo da marca não está disponível. Reimporte o PNG.');
      const patch = await storeSlideLogo(await origemParaBlob(source));
      if (!alive.current) { URL.revokeObjectURL(patch.logoImage); return; }
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
      {!cardOnly ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                onClick={() => {
                  const patch = { logo: null, logoImageId: null, logoAssetId: null, logoForeign: false };
                  if (onSaveBrandLogo) onSaveBrandLogo(patch);
                  else setBrand((current) => ({ ...current, ...patch }));
                }}
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
          aria-hidden="true"
          tabIndex={-1}
          style={{ display: 'none' }}
          onChange={onBrandUpload}
        />

        {brand?.logo && setBrand ? (
          <>
            <div>
              <label className="vc-label-sm">Posição padrão</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {POS.map((p) => {
                  const on = (brand.logoPosition || 'tr') === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`vc-seg-item${on ? ' active' : ''}`}
                      aria-pressed={on}
                      aria-label={p.name}
                      title={p.name}
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

        {hasLogoSource && editDoc ? (
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
      </div> : null}

      {/* ── Este card ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        paddingTop: 12, borderTop: '1px solid var(--glass-border)',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
          letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-secondary)',
        }}>
          Só no card {cardN}
        </div>

        {(brand?.logo || brand?.logoImageId || hasProjectLogo || hasCustom) ? (
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
            Carregue a logo da marca acima ou importe um PNG só para este card.
          </p>
        )}

        {!hidden && (brand?.logo || brand?.logoImageId || hasCustom) ? (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="vc-label-sm">Posição neste card</span>
              <select
                className="vc-input"
                aria-label="Posição da logo neste card"
                value={ctrl.logoPosition}
                onChange={(event) => setCardLayout({ logoPosition: event.target.value })}
                style={{ minHeight: 40 }}
              >
                <option value="tl">Superior esquerda ↖</option>
                <option value="tr">Superior direita ↗</option>
                <option value="c">Centro ●</option>
                <option value="bl">Inferior esquerda ↙</option>
                <option value="br">Inferior direita ↘</option>
              </select>
            </label>
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
            {editDoc ? <button type="button" className="vc-btn vc-btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 12 }}
              onClick={() => {
                editDoc((d) => applyFormatEditToAll(d, { logoSize: ctrl.logoSize, logoSizeChosen: true, logoOpacity: ctrl.logoOpacity }));
                toast?.('Tamanho e opacidade da logo aplicados em todos os cards. Use Desfazer para voltar.', 'success');
              }}>
              Usar tamanho e opacidade em todos os cards
            </button> : null}
          </>
        ) : null}

        {!hidden ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(hasProjectLogo || brand?.logo || brand?.logoImageId) && !hasCustom ? (
              <button
                type="button"
                className="vc-btn vc-btn-ghost"
                aria-label="Aplicar logo do projeto neste card"
                disabled={busy}
                onClick={applyProjectOrBrandToCard}
                style={{ width: '100%', minHeight: 40 }}
              >
                {hasProjectLogo ? 'Usar logo do projeto só neste card' : 'Duplicar logo da marca só neste card'}
              </button>
            ) : null}
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              aria-label="Importar logo PNG neste card"
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
              aria-hidden="true"
              tabIndex={-1}
              style={{ display: 'none' }}
              onChange={onCardUpload}
            />
            {hasCustom ? (
              <>
                {slide.logoImage ? (
                  <img
                    src={slide.logoImage}
                    alt="Logo deste card"
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
