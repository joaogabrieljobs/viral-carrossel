import React, { useState } from 'react';
import { Palette, X, Trash2 } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock.js';
import { hydrateBrandTextColors, effectiveTitleFontFamily } from '../utils/brand-helpers.js';

export default function BrandsModal({ open, onClose, brands, activeBrandId, currentBrand, onApply, onSave, onDelete }) {
  useScrollLock(open);
  const [newName, setNewName] = useState('');
  const [confirmDeleteBrandId, setConfirmDeleteBrandId] = useState(null);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth:520 }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Palette size={14} color="var(--text-secondary)"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.022em' }}>Perfis de marca</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{brands.length} {brands.length === 1 ? 'perfil' : 'perfis'} salvos</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>

        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          {/* Salvar marca atual como novo perfil */}
          <div style={{
            background:'rgba(255,77,46,0.06)', border:'1px dashed rgba(255,77,46,0.3)',
            borderRadius:10, padding:12, display:'flex', flexDirection:'column', gap:8,
          }}>
            <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)', lineHeight:1.45 }}>
              Salvar a marca <b>atual</b> ({currentBrand?.handle || '@perfil'}) como perfil reutilizável:
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { onSave(newName.trim()); setNewName(''); } }}
                placeholder="Ex: Marca Cliente X"
                className="vc-input"
                style={{ flex:1 }}
              />
              <button
                onClick={() => { if (newName.trim()) { onSave(newName.trim()); setNewName(''); } }}
                disabled={!newName.trim()}
                style={{
                  padding:'0 14px', height:38, borderRadius:8, border:'none', cursor:'pointer',
                  background:'var(--accent)', color:'#fff', fontSize:12, fontWeight:700,
                  fontFamily:'var(--font-ui)', opacity: newName.trim() ? 1 : 0.4,
                }}
              >
                Salvar
              </button>
            </div>
          </div>

          {/* Lista de perfis */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {brands.map(b => {
              const on = b.id === activeBrandId;
              return (
                <div
                  key={b.id}
                  style={{
                    background: on ? 'rgba(255,77,46,0.06)' : 'var(--bg-card)',
                    border:`1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius:10, padding:'10px 12px',
                    display:'flex', alignItems:'center', gap:10,
                  }}
                >
                  {/* Swatches */}
                  <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                    {(() => {
                      const sw = hydrateBrandTextColors(b);
                      return [b.bg, b.titleColor, sw.subtitleColor, sw.textColor, b.accent];
                    })().map((c,i)=>(
                      <div key={i} style={{ width:18, height:18, borderRadius:4, background:c, border:'1px solid rgba(255,255,255,0.08)' }}/>
                    ))}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily: effectiveTitleFontFamily(b), letterSpacing:'-0.011em' }}>
                      {b.name || 'Sem nome'}
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em' }}>
                      {b.handle}{b.bio ? ` · ${b.bio.slice(0, 50)}${b.bio.length > 50 ? '…' : ''}` : ''}
                    </div>
                  </div>
                  {!on && (
                    <button
                      onClick={() => onApply(b.id)}
                      style={{
                        fontSize:11, padding:'5px 12px', borderRadius:6, cursor:'pointer',
                        background:'var(--bg-elevated)', border:'1px solid var(--border)',
                        color:'var(--text-secondary)', fontWeight:600, fontFamily:'var(--font-ui)',
                      }}
                    >Aplicar</button>
                  )}
                  {on && (
                    <span style={{
                      fontSize:10, padding:'4px 9px', borderRadius:99,
                      background:'rgba(34,197,94,0.10)', color:'#86efac',
                      border:'1px solid rgba(34,197,94,0.3)', fontWeight:700,
                      fontFamily:'var(--font-mono)', letterSpacing:'0.06em',
                    }}>ATIVO</span>
                  )}
                  {brands.length > 1 && b.id !== 'default' && (
                    confirmDeleteBrandId === b.id ? (
                      <>
                        <button
                          onClick={() => { onDelete(b.id); setConfirmDeleteBrandId(null); }}
                          title="Confirmar exclusão"
                          style={{ height:28, padding:'0 8px', borderRadius:5, border:'1px solid rgba(248,113,113,0.5)', background:'rgba(248,113,113,0.15)', color:'#f87171', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'var(--font-ui)' }}
                        >OK</button>
                        <button
                          onClick={() => setConfirmDeleteBrandId(null)}
                          title="Cancelar"
                          style={{ width:28, height:28, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                        ><X size={11}/></button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteBrandId(b.id)}
                        title="Apagar perfil"
                        style={{ width:28, height:28, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                      >
                        <Trash2 size={11}/>
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-ui)', lineHeight:1.5 }}>
            Aplicar um perfil sobrescreve a marca do carrossel atual com cores, fontes, logo, bio e tom desse perfil. Use em agências/freelance pra alternar entre clientes em segundos.
          </div>
        </div>
      </div>
    </div>
  );
}
