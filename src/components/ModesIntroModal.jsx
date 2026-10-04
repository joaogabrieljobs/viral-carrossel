import React, { useEffect, useRef } from 'react';
import { Sparkles, SlidersHorizontal, Settings, Check, ChevronRight } from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import { APP_MODE_UI, DEPTH_LAYERS_HINT } from '../utils/ui-depth-labels.js';

export default function ModesIntroModal({ open, onSelect, onClose, currentMode = 'criador' }) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    const focusTimer = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusTimer);
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  const onDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const controls = [...dialogRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) {
      event.preventDefault();
      dialogRef.current.focus();
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;
  const MODES = [
    {
      id: 'criador',
      icon: Sparkles,
      label: APP_MODE_UI.criador.label,
      tagline: APP_MODE_UI.criador.tagline,
      desc: APP_MODE_UI.criador.desc,
      features: ['Contexto curto da marca', 'Geração com IA', 'Logo nos novos cards', 'Exportar PNG'],
      recommended: true,
    },
    {
      id: 'diretor',
      icon: SlidersHorizontal,
      label: APP_MODE_UI.diretor.label,
      tagline: APP_MODE_UI.diretor.tagline,
      desc: APP_MODE_UI.diretor.desc,
      features: ['Tudo do caminho rápido', '+ Tipografia (Texto)', '+ Refinamento e remix', '+ Modos narrativos'],
    },
    {
      id: 'studio',
      icon: Settings,
      label: APP_MODE_UI.studio.label,
      tagline: APP_MODE_UI.studio.tagline,
      desc: APP_MODE_UI.studio.desc,
      features: ['Tudo do controle profissional', '+ Composição (Layout)', '+ Tracking/Leading', '+ Zonas canvas'],
    },
  ];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modes-intro-title"
        tabIndex={-1}
        style={{
          maxWidth: 720,
          padding: 0,
          maxHeight: 'min(92dvh, 920px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '28px 24px 16px',
        }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <BrandLogo height={40} style={{ maxWidth: 'min(100%, 280px)', marginInline: 'auto' }} />
          </div>
          <h2
            id="modes-intro-title"
            style={{
              fontSize: 22, fontWeight: 600, color: 'var(--text-primary)',
              letterSpacing: '-0.022em', lineHeight: 1.2, margin: '0 0 8px',
              fontFamily: 'var(--font-display)',
            }}
          >
            Bem-vindo
          </h2>
          <p style={{
            fontSize: 15, color: 'var(--text-secondary)',
            letterSpacing: '-0.011em', lineHeight: 1.5, margin: 0,
            maxWidth: 480, marginInline: 'auto',
          }}>
            Escolha a profundidade de criação. Pode mudar a qualquer momento no chip do topo.{' '}
            {DEPTH_LAYERS_HINT}
          </p>
        </div>

        {/* 3 mode cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
          {MODES.map((m) => {
            const I = m.icon;
            const isCurrent = m.id === currentMode;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                aria-pressed={isCurrent}

                style={{
                  textAlign: 'left',
                  padding: '18px 20px',
                  borderRadius: 16,
                  border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--control-border)'}`,
                  background: isCurrent
                    ? 'linear-gradient(135deg, rgba(255,45,141,0.10) 0%, rgba(255,45,141,0.03) 100%)'
                    : 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  boxShadow: isCurrent
                    ? '0 0 24px rgba(255, 45, 141, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                    : '0 4px 12px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                  transition: 'all 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
                  fontFamily: 'var(--font-ui)',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  if (!isCurrent) e.currentTarget.style.borderColor = 'var(--control-border)';
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: isCurrent ? 'rgba(255, 45, 141, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                  color: isCurrent ? 'var(--accent)' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                  <I size={20} strokeWidth={2.25}/>
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 17, fontWeight: 600, color: 'var(--text-primary)',
                      letterSpacing: '-0.016em',
                    }}>{m.label}</span>
                    {m.recommended && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        background: 'rgba(255, 45, 141, 0.18)', color: 'var(--accent)',
                        padding: '2px 8px', borderRadius: 9999,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}>Recomendado</span>
                    )}
                    {isCurrent && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        background: 'rgba(255, 255, 255, 0.10)', color: 'var(--text-secondary)',
                        padding: '2px 8px', borderRadius: 9999,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}>Atual</span>
                    )}
                  </div>
                  <p style={{
                    fontSize: 11, fontWeight: 500, color: 'var(--accent)',
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    margin: '0 0 8px', lineHeight: 1.3,
                  }}>{m.tagline}</p>
                  <p style={{
                    fontSize: 13, color: 'var(--text-secondary)',
                    letterSpacing: '-0.011em', lineHeight: 1.5,
                    margin: '0 0 10px',
                  }}>{m.desc}</p>
                  <ul style={{
                    listStyle: 'none', padding: 0, margin: 0,
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 12px',
                  }}>
                    {m.features.map((f) => (
                      <li key={f} style={{
                        fontSize: 11, color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <Check size={10} strokeWidth={2.5} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Arrow */}
                <ChevronRight size={18} strokeWidth={2} style={{
                  color: isCurrent ? 'var(--accent)' : 'var(--text-muted)',
                  flexShrink: 0, marginTop: 12,
                }}/>
              </button>
            );
          })}
        </div>
        </div>

        {/* Footer sticky — Fechar sempre à mão no mobile */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
          padding: '12px 24px calc(14px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid var(--hairline)',
          background: 'var(--bg-sidebar)',
        }}>
          <span style={{
            fontSize: 11, color: 'var(--text-muted)',
            letterSpacing: '-0.005em', lineHeight: 1.4,
          }}>
            Pode mudar quando quiser no chip de modo
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              className="vc-btn vc-btn-ghost"
              style={{
                minHeight: 40, padding: '0 14px',
                borderRadius: 9999, border: '1px solid var(--control-border)',
                background: 'transparent', color: 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)',
                cursor: 'pointer', letterSpacing: '-0.011em',
              }}
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => onSelect('criador')}
              style={{
                minHeight: 40, padding: '0 18px',
                borderRadius: 9999, border: 'none',
                background: 'var(--accent)', color: 'var(--text-on-accent)',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)',
                cursor: 'pointer', letterSpacing: '-0.011em',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              Começar no Criar rápido <ChevronRight size={14} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
