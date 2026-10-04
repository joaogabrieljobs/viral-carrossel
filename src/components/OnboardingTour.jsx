import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';

function sameRect(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

function sameBubble(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && a.maxW === b.maxW;
}

export function getOnboardingSteps(isMobile, empty) {
  let panelSel = '';
  if (!isMobile) panelSel = '[data-vc-tour="sidebar-tabs"]';
  else if (!empty) panelSel = '[data-vc-tour="mobile-bar"]';
  const panelBody = !isMobile
    ? 'Na sidebar: peça o carrossel, revise o texto e baixe os PNGs. Nos modos Controle profissional e Studio aparecem mais abas de ajuste fino.'
    : empty
      ? 'Depois do primeiro carrossel, a barra de baixo dá acesso à edição.'
      : 'Toque nos ícones da barra de baixo para abrir cada painel.';

  return [
    {
      id: 'welcome',
      title: 'Bem-vindo ao Viral Carrossel',
      body:
        'Três passos: pedir o carrossel à IA, rever os cards e baixar. Pode pular agora e rever depois na ajuda.',
      selector: null,
    },
    {
      id: 'generate',
      title: 'Gerar com IA',
      body:
        'No Criar rápido, escreva o pedido na sidebar e toque em Gerar carrossel. No header, Gerar abre o assistente completo.',
      selector: '[data-vc-tour="generate"]',
    },
    {
      id: 'library',
      title: 'Seus projetos',
      body: panelBody
        + ' Em Projetos você abre, organiza a fila e exporta — tudo fica neste navegador.',
      selector: panelSel || '[data-vc-tour="library"]',
    },
  ];
}

export default function OnboardingTour({ open, onDismiss, isMobile, empty, setTab, setDrawerOpen, onEnterEditor, onPrepareRefsTourStep }) {
  const steps = useMemo(() => getOnboardingSteps(isMobile, empty), [isMobile, empty]);
  const [idx, setIdx] = useState(0);
  const [hole, setHole] = useState(null);
  const [bubble, setBubble] = useState({ left: 24, top: 80, maxW: 360 });

  /**
   * As callbacks chegam como arrow functions inline do monólito, logo mudam de
   * identidade a cada render. Com elas nas deps do layout effect, cada `setHole`
   * /`setBubble` (objetos novos) provocava novo render → nova identidade → o
   * effect corria outra vez → loop infinito e React #185 ("Maximum update depth
   * exceeded"), que derrubava a app inteira para o error boundary.
   * Guardamos as callbacks em refs (não entram nas deps) e só escrevemos estado
   * quando a medida muda de facto.
   */
  const cbRef = useRef({ onEnterEditor, onPrepareRefsTourStep, setTab, setDrawerOpen });
  useEffect(() => {
    cbRef.current = { onEnterEditor, onPrepareRefsTourStep, setTab, setDrawerOpen };
  }, [onEnterEditor, onPrepareRefsTourStep, setTab, setDrawerOpen]);

  const setHoleIfChanged = useCallback((next) => {
    setHole((prev) => (sameRect(prev, next) ? prev : next));
  }, []);
  const setBubbleIfChanged = useCallback((next) => {
    setBubble((prev) => (sameBubble(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    if (open) setIdx(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const stepIds = steps[idx]?.id;
    const cb = cbRef.current;
    if (stepIds === 'refs') {
      if (typeof cb.onEnterEditor === 'function') cb.onEnterEditor();
      if (typeof cb.onPrepareRefsTourStep === 'function') cb.onPrepareRefsTourStep();
    } else if (stepIds === 'thumbs' || stepIds === 'panel') {
      if (typeof cb.onEnterEditor === 'function') cb.onEnterEditor();
      if (stepIds === 'panel' && isMobile && !empty) cb.setDrawerOpen?.(true);
    }
    const measure = () => {
      const s = steps[idx];
      const centrado = (fator) => {
        const maxW = Math.min(380, window.innerWidth - 32);
        setHoleIfChanged(null);
        setBubbleIfChanged({
          left: (window.innerWidth - maxW) / 2,
          top: Math.max(24, window.innerHeight * fator),
          maxW,
        });
      };
      if (!s?.selector) return centrado(0.2);
      const el = document.querySelector(s.selector);
      // Elemento ausente, invisível (display:none, sem caixa) ou tapado por um
      // modal: sem isto o realce virava um retângulo rosa sobre espaço vazio.
      const r = el?.getBoundingClientRect();
      const visivel = !!r && r.width > 8 && r.height > 8
        && r.bottom > 0 && r.right > 0
        && r.top < window.innerHeight && r.left < window.innerWidth;
      if (!visivel) return centrado(0.22);
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setHoleIfChanged({ top: r.top, left: r.left, width: r.width, height: r.height });
      const maxW = Math.min(340, window.innerWidth - 32);
      let left = Math.max(16, Math.min(window.innerWidth - maxW - 16, r.left + r.width / 2 - maxW / 2));
      let top = r.bottom + 14;
      const estCard = 210;
      if (top + estCard > window.innerHeight - 16) top = Math.max(16, r.top - estCard - 12);
      setBubbleIfChanged({ left, top, maxW });
    };

    const delay =
      steps[idx]?.id === 'refs' ? (isMobile ? 380 : 220)
        : (steps[idx]?.id === 'thumbs' || steps[idx]?.id === 'panel') ? (isMobile ? 200 : 120)
          : 0;
    const onWin = () => measure();
    let t = null;
    if (delay) t = window.setTimeout(measure, delay);
    else measure();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
    // Sem as callbacks inline nas deps — vivem em `cbRef` (ver comentário acima).
  }, [open, idx, steps, isMobile, empty, setHoleIfChanged, setBubbleIfChanged]);

  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onDismiss]);

  if (!open) return null;

  const step = steps[idx];
  const last = idx >= steps.length - 1;

  const advance = () => {
    if (last) onDismiss();
    else setIdx((i) => i + 1);
  };

  const back = () => setIdx((i) => Math.max(0, i - 1));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vc-tour-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        pointerEvents: 'auto',
      }}
    >
      {/* Escurece o fundo; “buraco” no spotlight quando há alvo */}
      {hole ? (
        <div
          data-vc-tour-hole=""
          style={{
            position: 'fixed',
            left: hole.left - 5,
            top: hole.top - 5,
            width: hole.width + 10,
            height: hole.height + 10,
            borderRadius: 11,
            border: '2px solid var(--accent-focus)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.48)',
            pointerEvents: 'none',
            zIndex: 121,
          }}
        />
      ) : (
        <div
          onClick={onDismiss}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 121,
          }}
        />
      )}

      {/* Card */}
      <div
        data-vc-tour-card=""
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: bubble.left,
          top: bubble.top,
          width: bubble.maxW,
          zIndex: 122,
          background: 'var(--bg-base)',
          border: '1px solid var(--hairline)',
          borderRadius: 18,
          padding: '18px 18px 14px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize:10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: 8 }}>
          {idx + 1} / {steps.length}
        </div>
        <div id="vc-tour-title" style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.022em', marginBottom: 8, fontFamily: 'var(--font-display)' }}>
          {step.title}
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.47, color: 'var(--text-secondary)', margin: 0, letterSpacing: '-0.011em' }}>
          {step.body}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className={idx === 0 ? 'vc-btn vc-btn-primary' : 'vc-btn vc-btn-ghost'}
            style={{
              height: 36,
              padding: '0 14px',
              fontSize: 13,
              ...(idx === 0
                ? {}
                : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }),
            }}
            onClick={onDismiss}
          >
            Pular
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              style={{ height: 36, padding: '0 14px', fontSize: 13, opacity: idx === 0 ? 0.35 : 1 }}
              disabled={idx === 0}
              onClick={back}
            >
              Voltar
            </button>
            <button
              type="button"
              className={idx === 0 ? 'vc-btn vc-btn-ghost' : 'vc-btn vc-btn-primary'}
              style={{
                height: 36,
                padding: '0 18px',
                fontSize: 13,
                ...(idx === 0
                  ? { border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }
                  : {}),
              }}
              onClick={advance}
            >
              {last ? 'Concluir' : 'Avançar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
