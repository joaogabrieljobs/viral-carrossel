// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useEffect, useRef } from 'react';
import { Download, FileText, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { FORMATS } from '../../utils/formats.js';

// ─── EXPORT MORE FORMATS — único dropdown "Baixar" com todas as saídas ────────
// Antes era um botão secundário ("Mais formatos") abaixo do CTA fixo "Baixar
// card N". Agora absorve a opção do card individual como PRIMEIRA do menu e
// vira o único ponto de download da app — economiza 50px no footer mobile.
function ExportMoreFormats({
  slides, exporting, exportProgress,
  activeIdx, onExportSlide,
  onExportAll, onExportPDF, onExportPhotosOnly,
  hideSlideOption = false,
}) {
  const [open, setOpen] = React.useState(false);
  const refMenu = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (!refMenu.current) return;
      if (!refMenu.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const photoCount = slides.filter(s => !!s.bgImage).length;
  const aiCount = slides.filter(s => s.bgImageSource === 'ai').length;
  const menuItemStyle = {
    display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
    border:'none', background:'transparent', cursor:'pointer', borderRadius:6,
    fontSize:12, fontFamily:'var(--font-ui)', color:'var(--text-primary)',
    transition:'background 0.12s', textAlign:'left', width:'100%',
  };
  return (
    <div ref={refMenu} style={{ position:'relative', flex:'0 0 auto' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={exporting}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Opções de download"
        style={{
          minHeight:36, padding:'0 16px', borderRadius:9999, border:'none',
          background:'var(--text-primary)', color:'#fff',
          fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)',
          letterSpacing:'-0.011em', cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
          opacity: exporting ? 0.5 : 1,
          transition:'opacity 0.15s var(--ease-smooth), transform 0.1s var(--ease-smooth)',
          whiteSpace:'nowrap',
        }}
      >
        <Download size={13}/>
        {exporting && exportProgress
          ? `${exportProgress.current}/${exportProgress.total}…`
          : 'Exportar'}
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}/>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position:'absolute', bottom:'100%', left:0, marginBottom:6, minWidth:260,
            background:'var(--bg-base)', border:'1px solid var(--hairline)',
            borderRadius:10, boxShadow:'0 8px 28px rgba(0,0,0,0.12)',
            padding:6, display:'flex', flexDirection:'column', gap:2, zIndex:50,
          }}
        >
          {/* Card individual — primeira opção, era o CTA fixo antes */}
          {!hideSlideOption && onExportSlide && (
            <button
              role="menuitem"
              type="button"
              onClick={() => { setOpen(false); onExportSlide(activeIdx); }}
              disabled={exporting}
              style={menuItemStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-pearl)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Download size={13} style={{ color:'var(--accent)' }}/>
              <span style={{ flex:1, fontWeight:600 }}>Card {activeIdx + 1}</span>
              <span style={{ color:'var(--text-muted)', fontSize:10, fontFamily:'var(--font-mono)' }}>PNG</span>
            </button>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={() => { setOpen(false); onExportAll(); }}
            disabled={exporting}
            style={menuItemStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-pearl)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Download size={13} style={{ color:'var(--text-muted)' }}/>
            <span style={{ flex:1 }}>Carrossel completo</span>
            <span style={{ color:'var(--text-muted)', fontSize:10, fontFamily:'var(--font-mono)' }}>
              ZIP · {slides.length} cards
            </span>
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => { setOpen(false); onExportPDF(); }}
            disabled={exporting}
            style={menuItemStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-pearl)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <FileText size={13} style={{ color:'var(--text-muted)' }}/>
            <span style={{ flex:1 }}>Carrossel em PDF</span>
          </button>
          {photoCount > 0 && (
            <button
              role="menuitem"
              type="button"
              onClick={() => { setOpen(false); onExportPhotosOnly(); }}
              disabled={exporting}
              style={menuItemStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-pearl)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              title="Salva as imagens raw (sem texto) — útil pra reusar fotos geradas por IA"
            >
              <ImageIcon size={13} style={{ color:'var(--text-muted)' }}/>
              <span style={{ flex:1 }}>Apenas fotos limpas</span>
              <span style={{ color:'var(--text-muted)', fontSize:10, fontFamily:'var(--font-mono)' }}>
                {photoCount}{aiCount > 0 ? ` · ${aiCount} IA` : ''}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export {
  ExportMoreFormats,
};
