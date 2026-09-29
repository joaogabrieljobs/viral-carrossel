import React, { useEffect, useRef, useState } from 'react';
import { storeSlideLogo } from '../../utils/slide-logo.js';
import { origemParaBlob } from '../../utils/image-store.js';

export function SlideLogoPanel({ slide, updateSlide, toast, styleKit, setStyleKit, brand }) {
  const fileInput = useRef(null);
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const upload = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const patch = await storeSlideLogo(file);
      if (!alive.current) { URL.revokeObjectURL(patch.logoImage); return; }
      setStyleKit(prev => ({ ...prev, logo: { imageId: patch.logoImageId, name: file.name } }));
      updateSlide({ ...patch, logoSize: slide.logoSize ?? 60, logoOpacity: 100 });
      toast('Logo aplicada somente neste card.', 'success');
    } catch (error) { if (alive.current) toast(error.message, 'error'); }
    finally { if (alive.current) setBusy(false); }
  };
  const applySaved = async () => {
    if (styleKit?.logo?.imageId) {
      updateSlide({ logoImageId: styleKit.logo.imageId, logoImage: null, logoHidden: false, logoSize: slide.logoSize ?? 60, logoOpacity: 100 });
      toast('Logo do projeto aplicada somente neste card.', 'success');
      return;
    }
    if (!brand?.logo) return;
    setBusy(true);
    try {
      const patch = await storeSlideLogo(await origemParaBlob(brand.logo));
      if (!alive.current) { URL.revokeObjectURL(patch.logoImage); return; }
      setStyleKit(prev => ({ ...prev, logo: { imageId: patch.logoImageId, name: 'Logo da marca' } }));
      updateSlide({ ...patch, logoSize: slide.logoSize ?? 60, logoOpacity: 100 });
      toast('Logo já importada aplicada neste card.', 'success');
    } catch (error) { if (alive.current) toast(error.message, 'error'); }
    finally { if (alive.current) setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(styleKit?.logo?.imageId || brand?.logo) && <button type="button" className="vc-btn" disabled={busy} onClick={applySaved} style={{ minHeight: 44, borderRadius: 10, background: 'var(--accent)', color: '#fff', border: 0, cursor: 'pointer' }}>
        {styleKit?.logo?.imageId ? 'Aplicar logo do projeto neste card' : 'Aplicar logo já importada da marca'}
      </button>}
      <input ref={fileInput} type="file" accept="image/png" aria-label="Arquivo PNG da logo deste card" onChange={upload} style={{ display: 'none' }} />
      <button type="button" className="vc-btn" disabled={busy} onClick={() => fileInput.current?.click()} style={{ minHeight: 44, padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}>
        {busy ? 'Importando logo…' : slide.logoImageId ? 'Trocar logo PNG deste card' : 'Importar logo PNG neste card'}
      </button>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>PNG até 2 MB. Preserva a transparência e aplica só no card selecionado.</p>
      {slide.logoImageId && !slide.logoHidden && <>
        {slide.logoImage && <img src={slide.logoImage} alt="Logo deste card" style={{ width: 72, height: 72, objectFit: 'contain', alignSelf: 'center', background: 'repeating-conic-gradient(#aaa 0% 25%, #ddd 0% 50%) 0 / 16px 16px', borderRadius: 8 }} />}
        <label style={{ fontSize: 12 }}>Posição da logo neste card
          <select className="vc-input" value={slide.logoPosition || 'tr'} onChange={e => updateSlide({ logoPosition: e.target.value })}>
            <option value="tl">Superior esquerdo</option><option value="tr">Superior direito</option><option value="bl">Inferior esquerdo</option><option value="br">Inferior direito</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Tamanho da logo neste card
          <input type="range" min="20" max="200" value={slide.logoSize ?? 60} onChange={e => updateSlide({ logoSize: Number(e.target.value) })} style={{ width: '100%' }} />
        </label>
        <button type="button" className="vc-btn" onClick={() => updateSlide({ logoImageId: null, logoImage: null, logoHidden: true })}>Remover logo deste card</button>
        <button type="button" className="vc-btn" onClick={() => updateSlide({ logoImageId: null, logoImage: null, logoHidden: false })}>Usar logo da marca neste card</button>
      </>}
    </div>
  );
}
