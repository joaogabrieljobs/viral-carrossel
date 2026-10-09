import React from 'react';
import { ArrowRight, Layout, Layers } from 'lucide-react';
import { MOONT_NARRATIVES } from '../../config/moont-brand.js';

function CommunicationPreview() {
  return (
    <div aria-hidden style={{ position: 'relative', height: 184, minWidth: 0 }}>
      {[2, 1, 0].map((index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            width: 112,
            aspectRatio: '4 / 5',
            right: 18 + (index * 34),
            top: 18 - (index * 4),
            borderRadius: 15,
            border: '1px solid rgba(255,255,255,0.2)',
            background: index === 0
              ? 'linear-gradient(155deg, #5b53e8 0%, #27234f 72%)'
              : index === 1
                ? 'linear-gradient(155deg, #d7ff5a 0%, #727f2b 72%)'
                : 'linear-gradient(155deg, #f3f0e7 0%, #aaa6bd 72%)',
            boxShadow: '0 18px 38px rgba(0,0,0,0.3)',
            transform: `rotate(${(index - 1) * 5}deg)`,
          }}
        >
          <span style={{ position: 'absolute', top: 13, left: 13, width: 32, height: 4, borderRadius: 99, background: index === 1 ? '#171620' : 'rgba(255,255,255,0.78)' }} />
          <span style={{ position: 'absolute', left: 13, right: 13, bottom: 27, height: 7, borderRadius: 99, background: index === 1 ? '#171620' : 'rgba(255,255,255,0.88)' }} />
          <span style={{ position: 'absolute', left: 13, width: 58, bottom: 15, height: 5, borderRadius: 99, background: index === 1 ? 'rgba(23,22,32,0.55)' : 'rgba(255,255,255,0.5)' }} />
        </div>
      ))}
    </div>
  );
}

function PresentationPreview() {
  return (
    <div aria-hidden style={{ display: 'grid', placeItems: 'center', height: 184, minWidth: 0 }}>
      <div style={{
        width: 'min(100%, 286px)', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden',
        borderRadius: 16, border: '1px solid rgba(255,255,255,0.2)',
        background: 'linear-gradient(135deg, #171620 0%, #232058 100%)',
        boxShadow: '0 20px 44px rgba(0,0,0,0.34)',
      }}>
        <span style={{ position: 'absolute', inset: '12% 48% 12% 7%', borderRadius: 12, background: 'linear-gradient(155deg, #5b53e8, #9a94ff)' }} />
        <span style={{ position: 'absolute', top: '24%', left: '58%', right: '9%', height: 8, borderRadius: 99, background: '#f3f0e7' }} />
        <span style={{ position: 'absolute', top: '39%', left: '58%', right: '15%', height: 6, borderRadius: 99, background: 'rgba(243,240,231,0.6)' }} />
        <span style={{ position: 'absolute', top: '51%', left: '58%', right: '22%', height: 6, borderRadius: 99, background: 'rgba(243,240,231,0.36)' }} />
        <span style={{ position: 'absolute', left: '58%', bottom: '18%', width: 40, height: 10, borderRadius: 99, background: '#d7ff5a' }} />
      </div>
    </div>
  );
}

const CARDS = [
  { ...MOONT_NARRATIVES.carrossel, icon: Layers, Preview: CommunicationPreview, tone: 'communication' },
  { ...MOONT_NARRATIVES.apresentacao, icon: Layout, Preview: PresentationPreview, tone: 'presentation' },
];

export default function ProductNarrativesShowcase({ isMobile = false, onEnter }) {
  return (
    <section
      id="produtos"
      aria-labelledby="moont-narratives-title"
      style={{
        position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto',
        padding: isMobile ? '42px 16px 30px' : '72px clamp(24px, 5vw, 48px) 48px',
      }}
    >
      <p className="vc-eyebrow" style={{ margin: '0 0 10px', color: 'var(--accent)' }}>Dois caminhos. Um mesmo studio.</p>
      <h2 id="moont-narratives-title" style={{
        margin: 0, maxWidth: '18ch', fontFamily: 'var(--font-display)',
        fontSize: isMobile ? 30 : 48, lineHeight: 1.02, letterSpacing: '-0.036em',
      }}>
        Cada formato pede uma narrativa própria.
      </h2>
      <p style={{ margin: '16px 0 30px', color: 'var(--text-secondary)', fontSize: 17, lineHeight: 1.55, maxWidth: '60ch' }}>
        A Moont usa o mesmo contexto da sua marca, mas muda a estrutura conforme o objetivo: circular uma ideia ou conduzir uma apresentação.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {CARDS.map(({ id, name, eyebrow, title, description, format, output, icon: Icon, Preview, tone }) => (
          <article
            key={id}
            data-moont-narrative={tone}
            style={{
              minWidth: 0, overflow: 'hidden', borderRadius: 26,
              border: '1px solid var(--glass-border-strong)',
              background: tone === 'communication'
                ? 'linear-gradient(145deg, rgba(91,83,232,0.22), rgba(255,255,255,0.035) 60%)'
                : 'linear-gradient(145deg, rgba(215,255,90,0.12), rgba(255,255,255,0.035) 60%)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.24)',
            }}
          >
            <Preview />
            <div style={{ padding: isMobile ? 20 : 24, paddingTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                <span style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 11, background: tone === 'communication' ? 'var(--accent-surface-strong)' : 'var(--aurora-surface)', color: tone === 'communication' ? 'var(--accent)' : 'var(--aurora)' }}>
                  <Icon size={16} aria-hidden />
                </span>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>{name}</div>
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{eyebrow}</div>
                </div>
              </div>
              <h3 style={{ margin: 0, fontSize: isMobile ? 22 : 25, lineHeight: 1.15, letterSpacing: '-0.025em' }}>{title}</h3>
              <p style={{ margin: '10px 0 16px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>{description}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{format} · {output}</span>
                <button
                  type="button"
                  onClick={onEnter}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 14px', borderRadius: 999, border: '1px solid var(--glass-border-strong)', background: 'var(--bg-glass-strong)', color: 'var(--text-primary)', fontWeight: 650, cursor: 'pointer' }}
                >
                  Começar <ArrowRight size={14} aria-hidden />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
