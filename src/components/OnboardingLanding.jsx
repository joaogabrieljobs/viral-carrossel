import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles, Flame, ArrowRight, ChevronDown,
  Wand2, Download, Palette, TrendingUp, Layout, Instagram,
} from 'lucide-react';

const STEPS = [
  {
    n: '01',
    title: 'Escolha o arco',
    body: 'Tendência quente, erro que todo mundo comete, decodificação de marca ou mudança de comportamento. Você define o tema — a IA monta a narrativa em slides.',
  },
  {
    n: '02',
    title: 'Gere e refine',
    body: 'Gancho na capa, corpo argumentativo e legenda pronta num fluxo. Ajuste tom, troque imagens, teste variações de tese até a versão que para o scroll.',
  },
  {
    n: '03',
    title: 'Publique no feed',
    body: 'Exporte PNG slide a slide ou PDF multipágina em 4:5, quadrado ou stories — dimensões reais do Instagram, sem redimensionar no Canva.',
  },
];

const CAPABILITIES = [
  { icon: Layout, label: 'Templates virais', hint: 'Erro comum · Tendência · Marca · Comportamento' },
  { icon: Palette, label: 'Identidade de marca', hint: '8 paletas · 8 fontes de título · @handle' },
  { icon: TrendingUp, label: 'Pesquisa de nicho', hint: 'Tendências reais da web, ao vivo' },
  { icon: Wand2, label: 'Variações de gancho', hint: '5 teses contraintuitivas por tema' },
  { icon: Download, label: 'Export HD', hint: 'PNG individual ou PDF completo' },
  { icon: Instagram, label: 'Feito pro celular', hint: 'Editor, preview e export no mobile' },
];

const MODES = [
  {
    id: 'criador',
    label: 'Criador',
    tag: 'Recomendado',
    desc: 'Tema + estilo + gerar. Sem painel técnico — ideal pra postar hoje.',
  },
  {
    id: 'diretor',
    label: 'Diretor',
    tag: null,
    desc: 'Tipografia, tom e refinamento slide a slide. Controle sem virar designer.',
  },
  {
    id: 'studio',
    label: 'Studio',
    tag: 'Avançado',
    desc: 'Grids, tracking, zonas e composição livre. Tudo aberto.',
  },
];

const PAIN_POINTS = [
  'Ideia na cabeça, slide em branco no Figma.',
  'Legenda genérica que não segura até o último card.',
  'Horas ajustando fonte e cor em vez de publicar.',
];

const FAQ = [
  {
    q: 'Preciso pagar ou criar conta?',
    a: 'Não. O Viral. roda no seu navegador, sem cadastro. Seus projetos ficam salvos localmente neste dispositivo.',
  },
  {
    q: 'Preciso de chave de API?',
    a: 'Para gerar texto e imagens com IA, sim — Anthropic e/ou OpenAI. Você configura uma vez no ícone de engrenagem. Em dev local, o servidor pode ler .env.local.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Sim. Editor, preview, geração e export foram pensados mobile-first — drawer inferior, navegação por slides e barra de progresso durante a geração.',
  },
];

/** Cartão flutuante do hero — mock de slide de carrossel */
function HeroSlideCard({ style, title, subtitle, accent }) {
  return (
    <div
      className="vc-landing-slide-card"
      style={{
        position: 'absolute',
        width: 'clamp(140px, 28vw, 200px)',
        aspectRatio: '4 / 5',
        borderRadius: 16,
        border: '1px solid var(--glass-border-strong)',
        background: 'linear-gradient(165deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        boxShadow: 'var(--shadow-lg), var(--shadow-pink)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 14,
        ...style,
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        background: accent || 'radial-gradient(circle at 30% 20%, rgba(255,45,141,0.35) 0%, transparent 55%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'relative',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginBottom: 6,
      }}>Slide</div>
      <div style={{
        position: 'relative',
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-display)',
      }}>{title}</div>
      {subtitle && (
        <div style={{
          position: 'relative',
          marginTop: 4,
          fontSize: 11,
          color: 'var(--text-secondary)',
          lineHeight: 1.35,
        }}>{subtitle}</div>
      )}
    </div>
  );
}

function useReveal(ref, { threshold = 0.15, rootMargin = '0px 0px -8% 0px' } = {}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setVisible(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold, rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold, rootMargin]);
  return visible;
}

function RevealSection({ children, variant = 'rise', style, className = '', eager = false, id }) {
  const ref = useRef(null);
  const visible = useReveal(ref, eager ? { threshold: 0.05, rootMargin: '0px 0px 0px 0px' } : undefined);
  const variants = {
    rise: {
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(32px)',
      pointerEvents: visible ? 'auto' : 'none',
      transition: 'opacity 0.7s var(--ease-smooth), transform 0.7s var(--ease-smooth)',
    },
    clip: {
      opacity: visible ? 1 : 0,
      clipPath: visible ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
      pointerEvents: visible ? 'auto' : 'none',
      transition: 'opacity 0.6s var(--ease-smooth), clip-path 0.85s var(--ease-smooth)',
    },
    scale: {
      opacity: visible ? 1 : 0,
      transform: visible ? 'scale(1)' : 'scale(0.94)',
      pointerEvents: visible ? 'auto' : 'none',
      transition: 'opacity 0.55s var(--ease-smooth), transform 0.65s var(--ease-smooth)',
    },
  };
  return (
    <section
      ref={ref}
      id={id}
      className={className}
      style={{ ...variants[variant] || variants.rise, ...style }}
    >
      {children}
    </section>
  );
}

export default function OnboardingLanding({ onEnter, isMobile }) {
  const heroRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const shell = document.querySelector('.vc-landing-shell');
    const onScroll = () => setScrollY(shell ? shell.scrollTop : window.scrollY);
    const target = shell || window;
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, []);

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parallax = reducedMotion ? 0 : scrollY * 0.08;

  return (
    <div
      className="vc-onboarding-landing"
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-ui)',
        overflowX: 'hidden',
      }}
    >
      <style>{`
        @keyframes vcLandingFloat {
          0%, 100% { transform: translateY(0) rotate(var(--rot, 0deg)); }
          50% { transform: translateY(-10px) rotate(var(--rot, 0deg)); }
        }
        @keyframes vcLandingPulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.06); }
        }
        @keyframes vcLandingMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .vc-landing-slide-card {
          animation: vcLandingFloat 5.5s ease-in-out infinite;
        }
        .vc-landing-slide-card:nth-child(2) { animation-delay: -1.2s; }
        .vc-landing-slide-card:nth-child(3) { animation-delay: -2.4s; }
        .vc-landing-glow {
          animation: vcLandingPulse 8s ease-in-out infinite;
        }
        .vc-landing-marquee-track {
          animation: vcLandingMarquee 28s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .vc-landing-slide-card,
          .vc-landing-glow,
          .vc-landing-marquee-track {
            animation: none !important;
          }
        }
        .vc-landing-cta:active { transform: scale(0.95); }
        .vc-landing-cta {
          transition: transform var(--motion-fast) var(--ease-smooth),
                      background var(--motion-base) var(--ease-smooth),
                      box-shadow var(--motion-base) var(--ease-smooth);
        }
        .vc-landing-cta:hover {
          background: var(--accent-hover) !important;
          box-shadow: 0 8px 32px rgba(255, 45, 141, 0.35);
        }
        .vc-landing-cap-chip:hover {
          border-color: var(--glass-border-strong);
          background: var(--bg-glass-strong);
        }
      `}</style>

      {/* Ambient layers */}
      <div aria-hidden style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        background: `
          radial-gradient(ellipse 80% 60% at 85% 15%, rgba(255, 45, 141, 0.14) 0%, transparent 55%),
          radial-gradient(ellipse 70% 50% at 10% 85%, rgba(143, 125, 255, 0.10) 0%, transparent 50%),
          var(--gradient-bg)
        `,
      }} />

      {/* ── HERO ── */}
      <header
        ref={heroRef}
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: isMobile ? 'auto' : 'min(100vh, 920px)',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'calc(20px + env(safe-area-inset-top, 0))',
        }}
      >
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 16px 24px' : '0 clamp(24px, 5vw, 48px) 32px',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--logo-mark-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Flame size={18} color="var(--logo-mark-fg)" />
            </div>
            <span style={{
              fontSize: 18, fontWeight: 600, letterSpacing: '-0.022em',
              fontFamily: 'var(--font-display)',
            }}>
              Viral<span style={{ color: 'var(--accent)' }}>.</span>
            </span>
          </div>
          <button
            type="button"
            className="vc-landing-cta"
            onClick={onEnter}
            style={{
              height: 40,
              padding: '0 20px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--glass-border-strong)',
              background: 'var(--bg-glass)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Entrar no app
          </button>
        </nav>

        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? 32 : 48,
          alignItems: 'center',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
          padding: isMobile ? '0 16px 48px' : '0 clamp(24px, 5vw, 48px) 64px',
        }}>
          {/* Copy */}
          <div style={{ order: isMobile ? 2 : 0 }}>
            <p className="section-label" style={{
              margin: '0 0 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              fontWeight: 600,
            }}>
              Narrative OS · Carrossel Studio
            </p>
            <h1 style={{
              margin: '0 0 20px',
              fontSize: isMobile ? 'clamp(2rem, 8vw, 2.75rem)' : 'clamp(2.5rem, 4.5vw, 3.75rem)',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              fontFamily: 'var(--font-display)',
            }}>
              Carrossel que prende
              <br />
              <span style={{ color: 'var(--accent)' }}>do gancho ao CTA.</span>
            </h1>
            <p style={{
              margin: '0 0 16px',
              fontSize: isMobile ? 17 : 18,
              lineHeight: 1.47,
              letterSpacing: '-0.011em',
              color: 'var(--text-secondary)',
              maxWidth: '44ch',
            }}>
              Você traz o tema. A IA escreve a narrativa, monta os slides, sugere imagens
              e entrega a legenda — com a identidade visual da sua marca já aplicada.
            </p>
            <p style={{
              margin: '0 0 32px',
              fontSize: 15,
              lineHeight: 1.47,
              letterSpacing: '-0.011em',
              color: 'var(--text-muted)',
              maxWidth: '44ch',
            }}>
              Sem Canva genérico. Sem prompt solto no ChatGPT. Um fluxo editorial
              pensado pra Instagram — direto no browser.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                className="vc-landing-cta"
                onClick={onEnter}
                style={{
                  height: 52,
                  padding: '0 28px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  fontFamily: 'var(--font-ui)',
                  boxShadow: 'var(--shadow-pink)',
                }}
              >
                <Sparkles size={18} />
                Entrar no studio
                <ArrowRight size={16} />
              </button>
              <a
                href="#como-funciona"
                onClick={(e) => {
                  e.preventDefault();
                  const shell = document.querySelector('.vc-landing-shell');
                  const target = document.getElementById('como-funciona');
                  if (shell && target) {
                    const shellRect = shell.getBoundingClientRect();
                    const targetRect = target.getBoundingClientRect();
                    shell.scrollTop += targetRect.top - shellRect.top - 24;
                  } else {
                    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Como funciona
                <ChevronDown size={14} />
              </a>
            </div>
          </div>

          {/* Stage — floating carousel cards */}
          <div style={{
            order: isMobile ? 1 : 0,
            position: 'relative',
            height: isMobile ? 280 : 420,
            minHeight: isMobile ? 280 : 360,
            transform: `translateY(${parallax}px)`,
          }}>
            <div
              className="vc-landing-glow"
              aria-hidden
              style={{
                position: 'absolute',
                width: '70%',
                height: '70%',
                top: '15%',
                left: '15%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,45,141,0.25) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />
            <HeroSlideCard
              title="O erro que mata 90% dos carrosséis"
              subtitle="Capa · Erro comum"
              style={{
                top: '8%',
                left: '5%',
                '--rot': '-6deg',
                zIndex: 1,
              }}
            />
            <HeroSlideCard
              title="A tendência já virou — e ninguém percebeu"
              accent="radial-gradient(circle at 70% 30%, rgba(143,125,255,0.4) 0%, transparent 55%)"
              style={{
                top: '22%',
                right: '8%',
                '--rot': '4deg',
                zIndex: 3,
              }}
            />
            <HeroSlideCard
              title="Por que marcas grandes postam menos"
              subtitle="Decodificação · Slide 7"
              style={{
                bottom: '5%',
                left: '22%',
                '--rot': '-2deg',
                zIndex: 2,
              }}
            />
          </div>
        </div>
      </header>

      {/* ── PROBLEMA EDITORIAL ── */}
      <RevealSection
        variant="rise"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '0 16px 48px' : '0 clamp(24px, 5vw, 48px) 64px',
        }}
      >
        <div style={{
          padding: isMobile ? '28px 20px' : '36px 40px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--hairline)',
          background: 'var(--bg-secondary)',
        }}>
          <p style={{
            margin: '0 0 20px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>O problema</p>
          <blockquote style={{
            margin: '0 0 24px',
            padding: 0,
            border: 'none',
            fontSize: isMobile ? 20 : 26,
            fontWeight: 600,
            letterSpacing: '-0.022em',
            lineHeight: 1.25,
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
          }}>
            Carrossel bom não é slide bonito.
            <br />
            <span style={{ color: 'var(--accent)' }}>É arco narrativo que segura até o fim.</span>
          </blockquote>
          <ul style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            {PAIN_POINTS.map((line) => (
              <li
                key={line}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  fontSize: 15,
                  lineHeight: 1.47,
                  color: 'var(--text-secondary)',
                }}
              >
                <span style={{
                  flexShrink: 0,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  marginTop: 8,
                }} aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <p style={{
            margin: '24px 0 0',
            fontSize: 15,
            lineHeight: 1.47,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}>
            O Viral. existe pra fechar essa lacuna — do insight ao post publicável.
          </p>
        </div>
      </RevealSection>

      {/* ── COMO FUNCIONA ── */}
      <RevealSection
        variant="clip"
        id="como-funciona"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '64px 16px' : '96px clamp(24px, 5vw, 48px)',
        }}
      >
        <p style={{
          margin: '0 0 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          fontWeight: 600,
        }}>Fluxo</p>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: isMobile ? 28 : 36,
          fontWeight: 600,
          letterSpacing: '-0.024em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.12,
        }}>
          Do tema ao arquivo final.
        </h2>
        <p style={{
          margin: '0 0 48px',
          fontSize: 17,
          lineHeight: 1.47,
          color: 'var(--text-secondary)',
          maxWidth: '52ch',
        }}>
          Três etapas. Você não precisa ser copywriter nem designer —
          só saber o que quer dizer.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 16,
        }}>
          {STEPS.map(({ n, title, body }) => (
            <div
              key={n}
              style={{
                padding: 24,
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--hairline)',
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--accent)',
                letterSpacing: '0.06em',
                marginBottom: 16,
                fontWeight: 600,
              }}>{n}</div>
              <h3 style={{
                margin: '0 0 10px',
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '-0.02em',
              }}>{title}</h3>
              <p style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.47,
                color: 'var(--text-secondary)',
              }}>{body}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* ── MONTAGE — capabilities marquee ── */}
      <RevealSection
        variant="scale"
        style={{
          position: 'relative',
          zIndex: 1,
          padding: isMobile ? '32px 0 64px' : '48px 0 80px',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: isMobile ? '0 16px 24px' : '0 clamp(24px, 5vw, 48px) 32px',
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          <p style={{
            margin: '0 0 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>Capacidades</p>
          <h2 style={{
            margin: '0 0 12px',
            fontSize: isMobile ? 24 : 32,
            fontWeight: 600,
            letterSpacing: '-0.022em',
            fontFamily: 'var(--font-display)',
          }}>Tudo que um criador precisa</h2>
          <p style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.47,
            color: 'var(--text-secondary)',
            maxWidth: '48ch',
          }}>
            Pesquisa, escrita, visual e export num só lugar — sem trocar de aba a cada slide.
          </p>
        </div>
        <div style={{ overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
          <div
            className="vc-landing-marquee-track"
            style={{
              display: 'flex',
              gap: 12,
              width: 'max-content',
              padding: '8px 0',
            }}
          >
            {[...CAPABILITIES, ...CAPABILITIES].map(({ icon: Icon, label, hint }, i) => (
              <div
                key={`${label}-${i}`}
                className="vc-landing-cap-chip"
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--hairline)',
                  background: 'var(--bg-tertiary)',
                  minWidth: 220,
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--accent-surface)',
                  color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.014em' }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ── MODOS ── */}
      <RevealSection
        variant="rise"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '0 16px 64px' : '0 clamp(24px, 5vw, 48px) 80px',
        }}
      >
        <div style={{
          padding: 32,
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--glass-border)',
          background: 'linear-gradient(135deg, rgba(255,45,141,0.08) 0%, rgba(143,125,255,0.05) 100%)',
        }}>
          <p style={{
            margin: '0 0 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>Modos de trabalho</p>
          <h2 style={{
            margin: '0 0 12px',
            fontSize: isMobile ? 22 : 28,
            fontWeight: 600,
            letterSpacing: '-0.022em',
            fontFamily: 'var(--font-display)',
          }}>Simples ou profundo — você escolhe</h2>
          <p style={{
            margin: '0 0 24px',
            fontSize: 15,
            lineHeight: 1.47,
            color: 'var(--text-secondary)',
            maxWidth: '52ch',
          }}>
            Três níveis de controle. Comece no Criador e suba quando quiser
            afinar tipografia, layout ou composição avançada.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: 12,
          }}>
            {MODES.map(({ id, label, tag, desc }) => (
              <div
                key={id}
                style={{
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${id === 'criador' ? 'rgba(255,45,141,0.4)' : 'var(--hairline)'}`,
                  background: id === 'criador' ? 'var(--accent-surface)' : 'var(--bg-glass)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
                  {tag && (
                    <span style={{
                      fontSize: 9,
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--accent)',
                      fontWeight: 700,
                    }}>{tag}</span>
                  )}
                </div>
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: 'var(--text-secondary)',
                }}>{desc}</p>
              </div>
            ))}
          </div>
          <p style={{
            margin: '16px 0 0',
            fontSize: 13,
            color: 'var(--text-muted)',
            lineHeight: 1.47,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.02em',
          }}>
            Troque de modo a qualquer momento no chip Modo, no topo do editor.
          </p>
        </div>
      </RevealSection>

      {/* ── FAQ ── */}
      <RevealSection
        variant="rise"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 720,
          margin: '0 auto',
          padding: isMobile ? '0 16px 64px' : '0 24px 80px',
        }}
      >
        <p style={{
          margin: '0 0 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          fontWeight: 600,
        }}>Antes de entrar</p>
        <h2 style={{
          margin: '0 0 32px',
          fontSize: isMobile ? 24 : 30,
          fontWeight: 600,
          letterSpacing: '-0.022em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.15,
        }}>
          Perguntas que todo mundo faz
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FAQ.map(({ q, a }) => (
            <div
              key={q}
              style={{
                padding: '20px 22px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--hairline)',
                background: 'var(--bg-glass)',
              }}
            >
              <h3 style={{
                margin: '0 0 8px',
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.016em',
                color: 'var(--text-primary)',
              }}>{q}</h3>
              <p style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.47,
                color: 'var(--text-secondary)',
              }}>{a}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* ── CTA FINAL ── */}
      <RevealSection
        variant="rise"
        eager
        style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          padding: isMobile ? '48px 16px 64px' : '80px 24px 96px',
        }}
      >
        <div style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: isMobile ? '40px 24px' : '56px 48px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(255, 45, 141, 0.28)',
          background: 'linear-gradient(165deg, rgba(255,45,141,0.12) 0%, rgba(143,125,255,0.06) 50%, rgba(255,255,255,0.02) 100%)',
          boxShadow: 'var(--shadow-pink)',
        }}>
          <p style={{
            margin: '0 0 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            fontWeight: 600,
          }}>Próximo passo</p>
          <h2 style={{
            margin: '0 0 12px',
            fontSize: isMobile ? 26 : 36,
            fontWeight: 600,
            letterSpacing: '-0.028em',
            fontFamily: 'var(--font-display)',
            lineHeight: 1.12,
          }}>
            O feed não espera.
            <br />
            Seu carrossel pode sair hoje.
          </h2>
          <p style={{
            margin: '0 auto 32px',
            maxWidth: '44ch',
            fontSize: 17,
            color: 'var(--text-secondary)',
            lineHeight: 1.47,
          }}>
            Entre no studio, escolha um template ou digite um tema,
            e deixe a IA montar gancho, slides e legenda — você só refina o que importa.
          </p>
          <button
            type="button"
            className="vc-landing-cta"
            onClick={onEnter}
            style={{
              height: 56,
              padding: '0 36px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 17,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'var(--font-ui)',
              boxShadow: 'var(--shadow-pink)',
            }}
          >
            <Sparkles size={20} />
            Criar meu primeiro carrossel
          </button>
          <p style={{
            margin: '20px 0 0',
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
          }}>
            Grátis · Sem cadastro · Dados locais no navegador
          </p>
        </div>
      </RevealSection>

      {/* ── FOOTER ── */}
      <footer style={{
        position: 'relative',
        zIndex: 1,
        borderTop: '1px solid var(--hairline)',
        padding: isMobile
          ? '32px 16px calc(40px + env(safe-area-inset-bottom))'
          : '40px clamp(24px, 5vw, 48px) calc(48px + env(safe-area-inset-bottom))',
        maxWidth: 1200,
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: 24,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--logo-mark-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Flame size={14} color="var(--logo-mark-fg)" />
            </div>
            <span style={{
              fontSize: 16, fontWeight: 600, letterSpacing: '-0.022em',
              fontFamily: 'var(--font-display)',
            }}>
              Viral<span style={{ color: 'var(--accent)' }}>.</span>
            </span>
          </div>
          <p style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.47,
            color: 'var(--text-muted)',
            maxWidth: '36ch',
          }}>
            Carrossel Studio com IA — do insight editorial ao post publicável.
          </p>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMobile ? 'flex-start' : 'flex-end',
          gap: 12,
        }}>
          <button
            type="button"
            className="vc-landing-cta"
            onClick={onEnter}
            style={{
              height: 44,
              padding: '0 24px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--glass-border-strong)',
              background: 'var(--bg-glass)',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Entrar no studio
          </button>
          <p style={{
            margin: 0,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            © {new Date().getFullYear()} · Narrative OS
          </p>
        </div>
      </footer>
    </div>
  );
}
