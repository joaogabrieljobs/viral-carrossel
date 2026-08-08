// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Sparkles, Wand2, Loader2, X, ChevronDown, Check, Settings, SlidersHorizontal } from 'lucide-react';
import { SectionLabel as S } from './SectionLabel.jsx';
import { FORMATS } from '../../utils/formats.js';

/** Proporção de exportação — uma linha no desktop; grelha largura total no mobile (evita barra apertada). */
function EditorFormatSelector({ fmt, setFmt, layout }) {
  // Mobile: segmented pill compacto (38px) em vez de grid 3-cards 80px+.
  // Liberta espaço vertical pro user ver os cards no preview enquanto
  // o drawer está aberto (drawer já é 55dvh).
  const grid = false;
  const wrapStyle = layout === 'mobile'
    ? {
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-card)',
        borderRadius: 9999,
        padding: 3,
        gap: 2,
        border: '1px solid var(--border)',
        width: '100%',
        flexShrink: 0,
      }
    : {
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-card)',
        borderRadius: 8,
        padding: 3,
        gap: 2,
        border: '1px solid var(--border)',
        flexShrink: 0,
      };

  return (
    <div style={wrapStyle} role="group" aria-label="Formato do card (exportação)">
      {Object.entries(FORMATS).map(([k, v]) => {
        const isActive = fmt === k;
        const ratio = v.h / v.w;
        const miniW = 14;
        const miniH = Math.max(10, Math.min(20, miniW * ratio));
        const compactLabel = v.label.split(/\s+/)[0];
        return (
          <button
            key={k}
            type="button"
            onClick={() => setFmt(k)}
            title={`${v.label} · ${v.w}×${v.h}`}
            style={
              grid
                ? {
                    minHeight: 44,
                    padding: '6px 4px',
                    borderRadius: 11,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'var(--font-ui)',
                    letterSpacing: '-0.011em',
                    cursor: 'pointer',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--hairline)'}`,
                    background: isActive ? 'var(--accent-surface-strong)' : 'var(--bg-base)',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    transition: 'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
                  }
                : {
                    // No mobile (wrapper width 100%) preciso flex:1 pra
                    // 3 botões dividirem largura igualmente; no desktop
                    // fica padding natural (auto-width pill clássico).
                    flex: layout === 'mobile' ? '1 1 0' : 'initial',
                    minHeight: layout === 'mobile' ? 32 : undefined,
                    padding: layout === 'mobile' ? '6px 10px' : '5px 14px',
                    borderRadius: 9999,
                    fontSize: layout === 'mobile' ? 12 : 13,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'var(--font-ui)',
                    letterSpacing: '-0.011em',
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'background-color 0.15s var(--ease-smooth), color 0.15s var(--ease-smooth)',
                    background: isActive ? 'var(--bg-base)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }
            }
          >
            {grid && (
              <span
                style={{
                  display: 'inline-block',
                  width: miniW,
                  height: miniH,
                  border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--text-muted)'}`,
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
            )}
            {layout === 'mobile' ? compactLabel : (grid ? compactLabel : v.label)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * ModeSwitcher — chip dropdown pra trocar entre Criador / Diretor / Studio.
 * Controla progressive disclosure global do Narrative OS (FASE 2).
 *
 * - Criador (90% users): só tema, estilo, intensidade, gerar. Tabs reduzidas.
 * - Diretor (intermediate): + narrativa, branding, composição, IA, estética.
 * - Studio (advanced): tudo + grids, tracking, overlays, canvas, ajustes finos.
 */
const APP_MODES = [
  { id: 'criador',  label: 'Criador',  icon: Sparkles,    desc: 'Simples — tema, estilo e gerar' },
  { id: 'diretor',  label: 'Diretor',  icon: SlidersHorizontal, desc: 'Controle intermediário' },
  { id: 'studio',   label: 'Studio',   icon: Settings,    desc: 'Avançado — todos os controles' },
];

function ModeSwitcher({ value, onChange, compact = false }) {
  const [open, setOpen] = React.useState(false);
  // Posição calculada em px (não CSS `absolute` relativo ao wrapper) porque o
  // <header> pai usa `overflow:hidden` (pro collapse mobile) e clipava o menu,
  // deixando os itens visíveis-mas-inclicáveis / invisíveis. `position:fixed`
  // ancorado via getBoundingClientRect escapa desse clipping.
  const [menuPos, setMenuPos] = React.useState(null);
  const refMenu = React.useRef(null);
  const current = APP_MODES.find((m) => m.id === value) || APP_MODES[0];
  React.useLayoutEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const r = refMenu.current?.getBoundingClientRect();
      if (!r) return;
      const menuW = 220;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 9999;
      const left = Math.min(r.left, Math.max(8, vw - menuW - 8));
      setMenuPos({ top: r.bottom + 8, left });
    };
    updatePos();
    const onClickOutside = (e) => {
      if (!refMenu.current || !refMenu.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);
  const Ic = current.icon;
  return (
    <div ref={refMenu} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Modo atual: ${current.label}. Clique para mudar.`}
        title={`Modo: ${current.label} — ${current.desc}`}
        style={{
          minHeight: 34, padding: compact ? '0 10px' : '0 12px',
          borderRadius: 9999,
          border: '1px solid var(--glass-border-strong)',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
          color: 'var(--text-primary)',
          fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
          letterSpacing: '-0.011em',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        <Ic size={13} strokeWidth={2.25} style={{ color: 'var(--accent)' }}/>
        {!compact && <span>{current.label}</span>}
        <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}/>
      </button>
      {open && menuPos && (
        <div
          role="menu"
          style={{
            position: 'fixed', top: menuPos.top, left: menuPos.left,
            minWidth: 220,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%), var(--bg-secondary)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid var(--glass-border-strong)',
            borderRadius: 14,
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.42), 0 0 40px rgba(255, 45, 141, 0.10)',
            padding: 4, zIndex: 100,
            animation: 'fadeUp 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {APP_MODES.map((m) => {
            const I = m.icon;
            const active = m.id === value;
            return (
              <button
                key={m.id}
                role="menuitem"
                type="button"
                onClick={() => { onChange(m.id); setOpen(false); }}
                aria-current={active}
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 10, border: 'none',
                  background: active ? 'rgba(255, 45, 141, 0.10)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-ui)',
                  transition: 'background 0.15s var(--ease-smooth)',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: active ? 'rgba(255, 45, 141, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <I size={14} strokeWidth={2.25}/>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'block', fontSize: 13, fontWeight: 600,
                    color: active ? 'var(--accent)' : 'var(--text-primary)',
                    letterSpacing: '-0.011em', lineHeight: 1.2,
                  }}>{m.label}</span>
                  <span style={{
                    display: 'block', fontSize: 11, color: 'var(--text-muted)',
                    marginTop: 2, lineHeight: 1.3,
                  }}>{m.desc}</span>
                </span>
                {active && <Check size={13} strokeWidth={2.5} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 4 }}/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MOBILE DRAWER ────────────────────────────────────────────────────────────
// Bottom-sheet com 3 snaps de altura (small/medium/large) — user arrasta
// pra cima pra expandir ou pra baixo pra encolher/fechar. Cada drag termina
// no snap mais próximo (não fica em altura arbitrária — UX consistente).
const DRAWER_SNAPS = [
  { id: 'small',  dvh: 35, label: 'Pequeno' },
  { id: 'medium', dvh: 55, label: 'Médio' },   // default
  { id: 'large',  dvh: 85, label: 'Grande' },
];
const DRAWER_DEFAULT_SNAP = 1;

function MobileDrawer({ open, onClose, children }) {
  const panelRef  = useRef(null);
  const startRef  = useRef({ y:0, t:0, snap: DRAWER_DEFAULT_SNAP });
  const dragging  = useRef(false);
  // Snap atual — reset pra default ao reabrir o drawer.
  const [snapIdx, setSnapIdx] = useState(DRAWER_DEFAULT_SNAP);
  useEffect(() => { if (open) setSnapIdx(DRAWER_DEFAULT_SNAP); }, [open]);

  const currentDvh = DRAWER_SNAPS[snapIdx].dvh;

  // Aplica offset de drag direto no DOM (sem re-render por frame)
  const applyDrag = useCallback((dy) => {
    if (!panelRef.current) return;
    // Durante drag ativo: sem transição. Ao soltar/abrir: transição smooth.
    panelRef.current.style.transition = dragging.current ? 'none' : 'transform 0.28s var(--ease-smooth), height 0.28s var(--ease-smooth)';
    panelRef.current.style.transform  = open ? `translateY(${dy}px)` : 'translateY(110%)';
  }, [open]);

  // Bloqueia scroll do body quando aberto, evita "double-scroll" no iOS
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    applyDrag(0);
    return () => { document.body.style.overflow = prev; };
  }, [open, applyDrag]);

  const onTouchStart = (e) => {
    // Só reage a arrasto iniciado no handle (não no scroll do conteúdo)
    if (!e.target.closest('[data-drawer-handle]')) return;
    dragging.current = true;
    startRef.current = { y: e.touches[0].clientY, t: Date.now(), snap: snapIdx };
    applyDrag(0);
  };
  const onTouchMove = (e) => {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - startRef.current.y;
    // Permite drag em AMBAS as direções: dy>0 encolhe (move pra baixo),
    // dy<0 expande visualmente o painel pra cima (clamping em -20px pra
    // sinalizar limite sem permitir voo).
    const clamped = Math.max(-20, dy);
    applyDrag(clamped);
  };
  const onTouchEnd = (e) => {
    if (!dragging.current) return;
    const dy = e.changedTouches[0].clientY - startRef.current.y;
    const dt = Math.max(1, Date.now() - startRef.current.t);
    const velocity = dy / dt; // px/ms (positivo = pra baixo)
    dragging.current = false;
    applyDrag(0);

    // Threshold: 60px ou velocidade alta. Drag pra baixo = próximo snap menor
    // (ou fecha se já no menor). Drag pra cima = próximo snap maior.
    const threshold = 60;
    const fastDown = dy > threshold || velocity > 0.4;
    const fastUp = dy < -threshold || velocity < -0.4;
    const startSnap = startRef.current.snap;

    if (fastDown) {
      const next = startSnap - 1;
      if (next < 0) onClose();
      else setSnapIdx(next);
    } else if (fastUp) {
      const next = Math.min(DRAWER_SNAPS.length - 1, startSnap + 1);
      setSnapIdx(next);
    }
    // Drag pequeno = volta pro snap original (applyDrag(0) já cuida).
  };

  return (
    <>
      {/* Backdrop dim leve sem blur — cards visíveis acima */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.18)',
            zIndex:30, animation:'fadeIn 0.18s',
          }}
        />
      )}
      {/* Painel resizable — altura controlada por snapIdx, drag escolhe entre
          os 3 snaps (pequeno/médio/grande) ou fecha no limite inferior. */}
      <div
        ref={panelRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position:'fixed', bottom:0, left:0, right:0, zIndex:40,
          background:'var(--bg-sidebar)',
          borderTop:'1px solid var(--border)',
          borderRadius:'18px 18px 0 0',
          display:'flex', flexDirection:'column',
          height:`${currentDvh}dvh`, maxHeight:`${currentDvh}dvh`,
          boxShadow:'0 -8px 40px rgba(0,0,0,0.35)',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 0.28s var(--ease-smooth), height 0.28s var(--ease-smooth)',
          paddingBottom:'env(safe-area-inset-bottom, 0)',
        }}
      >
        {/* Handle tactível com 3 dots indicando snap atual. Drag pra cima
            expande, pra baixo encolhe ou fecha. */}
        <div
          data-drawer-handle
          style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            padding:'10px 16px 6px', flexShrink:0,
            cursor:'grab', userSelect:'none', touchAction:'none',
            position:'relative', gap:4,
          }}
          title={`Tamanho ${DRAWER_SNAPS[snapIdx].label} · arraste pra cima/baixo`}
        >
          {/* Pill principal — visualmente óbvia */}
          <div style={{
            width:56, height:5, background:'var(--text-muted)', borderRadius:99,
            opacity:0.55,
          }}/>
          {/* 3 dots indicando snap atual (pequeno/médio/grande) */}
          <div style={{ display:'flex', gap:4, marginTop:2 }} aria-hidden>
            {DRAWER_SNAPS.map((s, i) => (
              <div key={s.id} style={{
                width: i === snapIdx ? 14 : 4, height:4, borderRadius:99,
                background: i === snapIdx ? 'var(--accent)' : 'var(--border)',
                transition:'width 0.2s var(--ease-smooth), background 0.2s',
              }}/>
            ))}
          </div>
          <button
            onClick={onClose}
            style={{
              position:'absolute', right:10, top:8,
              background:'none', border:'none', color:'var(--text-muted)',
              cursor:'pointer', padding:8, borderRadius:6,
              minWidth:36, minHeight:36,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}
            aria-label="Fechar editor"
          ><X size={16}/></button>
        </div>
        {children}
      </div>
    </>
  );
}

/**
 * RefineBtn — CTA pra refinar texto via IA. Quando colapsado, oferece o
 * gatilho; quando aberto, expõe presets + input livre.
 *
 * `variant` controla apenas a aparência do estado colapsado:
 *   - 'compact'    (default): ghost height 36, pro uso dentro dos cards
 *                  onde já tem "Marcar Destaque" + "Gerar variações" juntos.
 *   - 'prominent': drop-zone com círculo accent + label + subtítulo, pro
 *                  uso na sidebar Refinar onde é o CTA principal da seção.
 */
function RefineBtn({ onRefine, busy, variant = 'compact', label = 'Refinar com IA', subtitle = 'IA reescreve mantendo a voz do carrossel' }) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState('');
  const presets = ['Mais direto','Mais curto','Adicione número','Tom técnico','Tom casual','Mais polêmico','Storytelling'];

  if (!open) {
    if (variant === 'prominent') {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          style={{
            width:'100%', minHeight:60, padding:'10px 14px', borderRadius:11,
            cursor:'pointer', border:'1px solid var(--hairline)',
            background:'var(--bg-card)', fontFamily:'var(--font-ui)',
            display:'flex', alignItems:'center', gap:12, textAlign:'left',
            transition:'background-color 0.15s var(--ease-smooth), border-color 0.15s var(--ease-smooth)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='var(--accent-surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='var(--hairline)'; e.currentTarget.style.background='var(--bg-card)'; }}
        >
          <span style={{
            width:32, height:32, borderRadius:'50%', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'var(--accent-surface)', color:'var(--accent)',
          }} aria-hidden>
            <Wand2 size={14} strokeWidth={2.25}/>
          </span>
          <span style={{ display:'flex', flexDirection:'column', gap:2, flex:1, minWidth:0 }}>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.011em', lineHeight:1.3 }}>
              {label}
            </span>
            <span style={{ fontSize:10, color:'var(--text-muted)', letterSpacing:'-0.005em', lineHeight:1.35 }}>
              {subtitle}
            </span>
          </span>
        </button>
      );
    }
    return (
      <button onClick={()=>setOpen(true)} className="vc-btn vc-btn-ghost" style={{ width:'100%', height:36 }}>
        <Wand2 size={12}/>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div style={{
      background:'var(--bg-pearl)', border:'1px solid var(--accent)',
      borderRadius:11, padding:12, display:'flex', flexDirection:'column', gap:8,
      animation:'fadeUp 0.15s var(--ease-smooth)',
    }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
        {presets.map(p=>(
          <button key={p} onClick={()=>{onRefine(p);setOpen(false);}} disabled={busy}
            style={{
              fontSize:10, padding:'4px 10px', borderRadius:99,
              background:'var(--bg-elevated)', border:'1px solid var(--border)',
              color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-ui)',
              transition:'all 0.12s',
            }}
            onMouseEnter={e=>{e.currentTarget.style.color='var(--text-primary)';e.currentTarget.style.borderColor='var(--accent)';}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--text-secondary)';e.currentTarget.style.borderColor='var(--border)';}}
          >{p}</button>
        ))}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <input
          value={txt} onChange={e=>setTxt(e.target.value)}
          placeholder="Instrução personalizada…"
          className="vc-input" style={{ flex:1, fontSize:12 }}
          onKeyDown={e=>{if(e.key==='Enter'&&txt.trim()){onRefine(txt);setTxt('');setOpen(false);}}}
        />
        <button
          onClick={()=>{if(txt.trim()){onRefine(txt);setTxt('');setOpen(false);}}}
          disabled={busy||!txt.trim()}
          className="vc-btn vc-btn-primary"
          style={{ padding:'0 12px', height:36, opacity: (busy||!txt.trim()) ? 0.4 : 1 }}
        >
          {busy ? <Loader2 size={11} style={{animation:'spin 0.8s linear infinite'}}/> : <Wand2 size={11}/>}
        </button>
        <button onClick={()=>{setOpen(false);setTxt('');}} aria-label="Cancelar refino" className="vc-btn vc-btn-ghost" style={{ height:36, padding:'0 10px' }}>
          <X size={12}/>
        </button>
      </div>
    </div>
  );
}

export {
  EditorFormatSelector,
  APP_MODES,
  ModeSwitcher,
  DRAWER_SNAPS,
  DRAWER_DEFAULT_SNAP,
  MobileDrawer,
  RefineBtn,
};
