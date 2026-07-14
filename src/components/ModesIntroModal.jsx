import React from 'react';
import { Sparkles, SlidersHorizontal, Settings, Check, ChevronRight } from 'lucide-react';

export default function ModesIntroModal({ open, onSelect, onClose, currentMode = 'criador' }) {
  if (!open) return null;
  const MODES = [
    {
      id: 'criador',
      icon: Sparkles,
      label: 'Criador',
      tagline: 'Pra começar agora',
      desc: 'Pra quem quer criar carrosséis sem se preocupar com detalhes técnicos. Tema + estilo + gerar.',
      features: ['Padrões visuais prontos', 'Geração com IA', 'Imagem automática', 'Identidade da marca'],
      recommended: true,
    },
    {
      id: 'diretor',
      icon: SlidersHorizontal,
      label: 'Diretor',
      tagline: 'Controle intermediário',
      desc: 'Pra quem quer afinar tom, narrativa, tipografia. Mais controle sem complexidade técnica.',
      features: ['Tudo do Criador', '+ Tipografia (Texto)', '+ Refinamento de tom', '+ Variações IA'],
    },
    {
      id: 'studio',
      icon: Settings,
      label: 'Studio',
      tagline: 'Avançado — tudo aberto',
      desc: 'Pra designers e usuários experientes. Composição livre, grids, tracking, overlays, zonas.',
      features: ['Tudo do Diretor', '+ Composição (Layout)', '+ Tracking/Leading', '+ Zonas canvas'],
    },
  ];
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modes-intro-title">
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 720, padding: 32 }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(255,45,141,0.18) 0%, rgba(143,125,255,0.10) 100%)',
            border: '1px solid var(--glass-border-strong)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 0 32px rgba(255, 45, 141, 0.24)',
          }}>
            <Sparkles size={28} strokeWidth={2} style={{ color: 'var(--accent)' }}/>
          </div>
          <h2
            id="modes-intro-title"
            style={{
              fontSize: 28, fontWeight: 700, color: 'var(--text-primary)',
              letterSpacing: '-0.022em', lineHeight: 1.15, margin: '0 0 8px',
              fontFamily: 'var(--font-display)',
            }}
          >
            Bem-vindo ao <span style={{ color: 'var(--accent)' }}>Narrative OS</span>
          </h2>
          <p style={{
            fontSize: 15, color: 'var(--text-secondary)',
            letterSpacing: '-0.011em', lineHeight: 1.5, margin: 0,
            maxWidth: 480, marginInline: 'auto',
          }}>
            Escolha como quer trabalhar. Pode mudar a qualquer momento no chip
            <strong style={{ color: 'var(--accent)', fontWeight: 600 }}> Modo </strong>
            no topo.
          </p>
        </div>

        {/* 3 mode cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {MODES.map((m) => {
            const I = m.icon;
            const isCurrent = m.id === currentMode;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                style={{
                  textAlign: 'left',
                  padding: '18px 20px',
                  borderRadius: 16,
                  border: `1px solid ${isCurrent ? 'rgba(255, 45, 141, 0.42)' : 'var(--glass-border)'}`,
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
                    e.currentTarget.style.borderColor = 'var(--glass-border-strong)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  if (!isCurrent) e.currentTarget.style.borderColor = 'var(--glass-border)';
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

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{
            fontSize: 11, color: 'var(--text-muted)',
            letterSpacing: '-0.005em', lineHeight: 1.4,
          }}>
            Pode mudar quando quiser no chip de modo
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: 36, padding: '0 18px',
              borderRadius: 9999, border: '1px solid var(--glass-border-strong)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
              cursor: 'pointer', letterSpacing: '-0.011em',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
