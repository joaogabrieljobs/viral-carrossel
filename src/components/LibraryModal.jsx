import React, { useState } from 'react';
import { BookOpen, X, Plus, Download, Upload, Copy, Trash2 } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock.js';
import { resolveSlideBrandBg } from '../utils/brand-helpers.js';
import { STATUS_DEFS, STATUS_BY_ID, fmtDate, isDefault } from '../utils/library-helpers.js';

export default function LibraryModal({ open, onClose, library, activeDocId, onOpen, onNew, onDuplicate, onDelete, onRename, onSetStatus, onExportDoc, onExportAll, onImportTrigger }) {
  useScrollLock(open);
  const [filter, setFilter] = useState('all'); // all | draft | ready | published
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  if (!open) return null;

  const items = library
    .filter(e => filter === 'all' || e.status === filter)
    .filter(e => !search.trim() || e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const counts = {
    all:       library.length,
    draft:     library.filter(e => e.status === 'draft').length,
    ready:     library.filter(e => e.status === 'ready').length,
    published: library.filter(e => e.status === 'published').length,
  };

  const startEdit = (entry) => { setEditingId(entry.id); setEditingName(entry.name); };
  const commitEdit = () => {
    if (editingId && editingName.trim()) onRename(editingId, editingName.trim());
    setEditingId(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel-wide" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--bg-sidebar)', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <BookOpen size={14} color="var(--text-secondary)"/>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.022em' }}>Biblioteca</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{counts.all} projetos salvos</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="vc-icon-btn">
            <X size={16}/>
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ padding:'14px 20px 0', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={() => onNew()}
              style={{
                height:40, flex:1, borderRadius:9, border:'none', cursor:'pointer',
                background:'linear-gradient(135deg, var(--accent), #e03220)',
                color:'#fff', fontSize:13, fontWeight:700, fontFamily:'var(--font-ui)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow:'0 4px 14px rgba(255,77,46,0.25)',
              }}
            >
              <Plus size={14}/>Novo carrossel
            </button>
            <button
              onClick={onExportAll}
              title="Exportar toda a biblioteca como JSON"
              style={{
                height:40, padding:'0 14px', borderRadius:9, cursor:'pointer',
                background:'var(--bg-card)', border:'1px solid var(--border)',
                color:'var(--text-secondary)', fontSize:12, fontWeight:600,
                fontFamily:'var(--font-ui)', display:'flex', alignItems:'center', gap:6,
              }}
            >
              <Download size={13}/>Exportar
            </button>
            <button
              onClick={onImportTrigger}
              title="Importar projetos de um arquivo JSON"
              style={{
                height:40, padding:'0 14px', borderRadius:9, cursor:'pointer',
                background:'var(--bg-card)', border:'1px solid var(--border)',
                color:'var(--text-secondary)', fontSize:12, fontWeight:600,
                fontFamily:'var(--font-ui)', display:'flex', alignItems:'center', gap:6,
              }}
            >
              <Upload size={13}/>Importar
            </button>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar pelo nome..."
              className="vc-input"
              style={{ flex:1 }}
            />
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {[
              { id:'all',       label:'Todos' },
              { id:'draft',     label:'Rascunhos' },
              { id:'ready',     label:'Prontos' },
              { id:'published', label:'Publicados' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  fontSize:11, padding:'5px 11px', borderRadius:99, cursor:'pointer',
                  fontFamily:'var(--font-ui)', fontWeight:600, transition:'all 0.12s',
                  background: filter === f.id ? 'var(--accent)' : 'var(--bg-card)',
                  border: `1px solid ${filter === f.id ? 'var(--accent)' : 'var(--border)'}`,
                  color: filter === f.id ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {f.label} <span style={{ opacity:0.6, marginLeft:3 }}>({counts[f.id]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div style={{ padding:'14px 20px 20px', display:'flex', flexDirection:'column', gap:8 }}>
          {items.length === 0 && (() => {
            // Empty state diferenciado: biblioteca 100% vazia (primeira visita) vs filtro
            const totalLibrary = library.filter(e => !isDefault(e.doc?.slides || [])).length;
            const isFirstVisit = totalLibrary === 0 && !search.trim() && filter === 'all';
            if (isFirstVisit) {
              return (
                <div style={{
                  padding:'48px 24px', textAlign:'center', display:'flex', flexDirection:'column',
                  alignItems:'center', gap:14, color:'var(--text-secondary)', fontFamily:'var(--font-ui)',
                }}>
                  <div style={{
                    width:60, height:60, borderRadius:16, background:'var(--success-surface)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <BookOpen size={24} style={{ color:'var(--accent)' }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:600, color:'var(--text-primary)', fontFamily:'var(--font-display)', letterSpacing:'-0.018em', marginBottom:4 }}>
                      Sua biblioteca está vazia
                    </div>
                    <div style={{ fontSize:13, lineHeight:1.55, maxWidth:320, color:'var(--text-muted)', letterSpacing:'-0.011em' }}>
                      Crie seu primeiro carrossel — depois ele aparece aqui com auto-save, nome editável e ações de duplicar/exportar.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { onClose(); onNew?.(); }}
                    style={{
                      marginTop:6, padding:'10px 18px', borderRadius:9999, cursor:'pointer',
                      background:'var(--accent)', color:'#fff', border:'none',
                      fontSize:13, fontWeight:600, fontFamily:'var(--font-ui)',
                      letterSpacing:'-0.011em', display:'inline-flex', alignItems:'center', gap:8,
                    }}
                  >
                    <Plus size={14}/>
                    Criar primeiro carrossel
                  </button>
                </div>
              );
            }
            return (
              <div style={{
                padding:'40px 20px', textAlign:'center', color:'var(--text-muted)',
                fontSize:13, fontFamily:'var(--font-ui)',
              }}>
                {search.trim() ? 'Nenhum carrossel com esse nome.' : 'Nenhum carrossel neste filtro.'}
              </div>
            );
          })()}
          {items.map(entry => {
            const isActive = entry.id === activeDocId;
            const status = STATUS_BY_ID[entry.status] || STATUS_BY_ID.draft;
            const slides = entry.doc?.slides || [];
            const firstSlide = slides[0];
            const bg = resolveSlideBrandBg(entry.doc?.brand || {}, 0, firstSlide || {}) || '#0a0a0a';
            const editing = editingId === entry.id;
            return (
              <div
                key={entry.id}
                style={{
                  background: isActive ? 'rgba(255,77,46,0.06)' : 'var(--bg-card)',
                  border:`1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius:11, padding:12,
                  display:'flex', alignItems:'center', gap:12,
                  transition:'all 0.12s',
                }}
              >
                {/* Mini-thumbnail */}
                <button
                  onClick={() => onOpen(entry.id)}
                  style={{
                    width:56, height:70, borderRadius:6, flexShrink:0, cursor:'pointer',
                    background: bg,
                    backgroundImage: firstSlide?.bgImage ? `url(${firstSlide.bgImage})` : 'none',
                    backgroundSize:'cover', backgroundPosition:'center',
                    border:'1px solid rgba(255,255,255,0.06)',
                    position:'relative', overflow:'hidden',
                  }}
                  aria-label={`Abrir ${entry.name}`}
                >
                  {firstSlide?.bgImage && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)' }}/>}
                  <span style={{
                    position:'absolute', bottom:3, left:5, fontSize:7, fontWeight:700,
                    color:'rgba(255,255,255,0.7)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
                  }}>
                    {String(slides.length).padStart(2,'0')}
                  </span>
                </button>

                {/* Conteúdo */}
                <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:4 }}>
                  {editing ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="vc-input"
                      style={{ padding:'6px 8px', fontSize:13, fontWeight:600 }}
                    />
                  ) : (
                    <button
                      onClick={() => onOpen(entry.id)}
                      onDoubleClick={() => startEdit(entry)}
                      style={{
                        background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left',
                        fontSize:13.5, fontWeight:600, color:'var(--text-primary)',
                        fontFamily:'var(--font-ui)', letterSpacing:'-0.011em',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}
                      title={entry.name + ' (clique duplo para renomear)'}
                    >
                      {entry.name}
                    </button>
                  )}
                  <div style={{
                    display:'flex', alignItems:'center', gap:8, fontSize:10,
                    color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
                  }}>
                    <span style={{
                      padding:'2px 7px', borderRadius:99,
                      background: status.bg, color: status.color,
                      border: `1px solid ${status.border}`, fontWeight:700,
                    }}>{status.label}</span>
                    <span>{slides.length} cards</span>
                    <span style={{ opacity:0.6 }}>· {fmtDate(entry.updatedAt)}</span>
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {/* Toggle de status */}
                  <select
                    value={entry.status}
                    onChange={e => onSetStatus(entry.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      fontSize:10, padding:'4px 6px', borderRadius:6,
                      background:'var(--bg-elevated)', color:'var(--text-secondary)',
                      border:'1px solid var(--border)', fontFamily:'var(--font-mono)',
                      cursor:'pointer', appearance:'auto', maxWidth:110,
                    }}
                  >
                    {STATUS_DEFS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <div style={{ display:'flex', gap:4 }}>
                    <button
                      onClick={() => startEdit(entry)}
                      title="Renomear"
                      style={{ width:26, height:26, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                    </button>
                    <button
                      onClick={() => onDuplicate(entry.id)}
                      title="Duplicar"
                      style={{ width:26, height:26, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                    >
                      <Copy size={10}/>
                    </button>
                    <button
                      onClick={() => onExportDoc(entry.id)}
                      title="Exportar como JSON"
                      style={{ width:26, height:26, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                    >
                      <Download size={10}/>
                    </button>
                    {confirmDeleteId === entry.id ? (
                      <>
                        <button
                          onClick={() => { onDelete(entry.id); setConfirmDeleteId(null); }}
                          title="Confirmar exclusão"
                          style={{ height:26, padding:'0 8px', borderRadius:5, border:'1px solid rgba(248,113,113,0.5)', background:'rgba(248,113,113,0.15)', color:'#f87171', cursor:'pointer', fontSize:10, fontWeight:700, fontFamily:'var(--font-ui)' }}
                        >OK</button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          title="Cancelar"
                          style={{ width:26, height:26, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                        ><X size={10}/></button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(entry.id)}
                        title="Apagar"
                        style={{ width:26, height:26, borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                      >
                        <Trash2 size={10}/>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
