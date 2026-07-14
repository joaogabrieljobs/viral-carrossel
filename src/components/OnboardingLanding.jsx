import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles, Flame, ArrowRight, ChevronDown,
  Wand2, Download, Palette, TrendingUp, Layout, Instagram,
  BookOpen, Layers, Image, FileText,
} from 'lucide-react';

/** Assets em public/landing/ (origem: IMAGENS CARROCEIS P LAND + IMAGENS VIRACAL CARRECEL) */
const IMG = {
  heroStage: '/landing/hero-stage.png',
  heroSlides: [
    '/landing/creator-reaction.png',
    '/landing/hero-slide-2.png',
    '/landing/hero-slide-3.png',
  ],
  problem: '/landing/section-problem.png',
  steps: ['/landing/step-01.png', '/landing/creator-filming.png', '/landing/step-03.png'],
  cta: '/landing/analytics-screen.png',
  mobile: '/landing/phone-feed.png',
  showcase: '/landing/showcase-creator.png',
  modosPlatform: '/landing/modos-platform.png',
  carouselSamples: [
    '/landing/carousel-01.png',
    '/landing/carousel-02.png',
    '/landing/carousel-03.png',
    '/landing/carousel-04.png',
    '/landing/carousel-05.png',
    '/landing/carousel-06.png',
    '/landing/carousel-07.png',
  ],
};

const STEPS = [
  {
    n: '01',
    title: 'Escolha o arco',
    body: 'Tendência quente, erro que todo mundo comete, decodificação de marca ou mudança de comportamento. Você define o tema — a IA monta a narrativa em slides.',
    image: IMG.steps[0],
  },
  {
    n: '02',
    title: 'Gere e refine',
    body: 'Gancho na capa, corpo argumentativo e legenda pronta num fluxo. Ajuste tom, troque imagens, teste variações de tese até a versão que para o scroll.',
    image: IMG.steps[1],
  },
  {
    n: '03',
    title: 'Publique no feed',
    body: 'Exporte PNG slide a slide ou PDF multipágina em 4:5, quadrado ou stories — dimensões reais do Instagram, sem redimensionar no Canva.',
    image: IMG.steps[2],
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
    tag: 'Comece aqui',
    desc: 'Tema + gerar. Carrossel, legenda e export em minutos — sem painel técnico, sem tutorial.',
  },
  {
    id: 'diretor',
    label: 'Diretor',
    tag: null,
    desc: 'Refina gancho, tom e tipografia slide a slide. Controle editorial sem virar designer.',
  },
  {
    id: 'studio',
    label: 'Studio',
    tag: 'Pro',
    desc: 'Grids, tracking e composição livre. Quando você quer cada pixel no lugar.',
  },
];

const PAIN_POINTS = [
  'Ideia na cabeça, slide em branco no Figma.',
  'Legenda genérica que não segura até o último card.',
  'Horas ajustando fonte e cor em vez de publicar.',
];

const GENERATION_LAYERS = [
  {
    n: '01',
    icon: BookOpen,
    title: 'Gera narrativa',
    body: 'Gancho, tese e arco editorial — do primeiro slide ao CTA, com o tom da sua marca.',
  },
  {
    n: '02',
    icon: Layers,
    title: 'Gera estrutura',
    body: 'Quantidade de cards, ritmo entre slides e função de cada frame no argumento.',
  },
  {
    n: '03',
    icon: Image,
    title: 'Gera visual',
    body: 'Layout, tipografia, paleta e imagens sugeridas ou geradas — identidade já aplicada.',
  },
  {
    n: '04',
    icon: FileText,
    title: 'Gera legenda',
    body: 'Texto do post pronto pra colar: contexto, desenvolvimento e fechamento que segura o swipe.',
  },
  {
    n: '05',
    icon: Download,
    title: 'Gera exportação',
    body: 'PNG slide a slide ou PDF multipágina em 4:5, quadrado ou stories — dimensões reais do feed.',
  },
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

/** Cartão flutuante do hero — preview real de slide */
function HeroSlideCard({ style, imageSrc, label }) {
  return (
    <div
      className="vc-landing-slide-card"
      style={{
        position: 'absolute',
        width: 'clamp(120px, 22vw, 168px)',
        aspectRatio: '4 / 5',
        borderRadius: 16,
        border: '1px solid var(--glass-border-strong)',
        boxShadow: 'var(--shadow-lg), var(--shadow-pink)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <img
        src={imageSrc}
        alt=""
        loading="lazy"
        decoding="async"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to top, rgba(14,12,20,0.75) 0%, transparent 55%)',
        pointerEvents: 'none',
      }} />
      {label && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          right: 10,
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.85)',
          fontWeight: 600,
        }}>{label}</div>
      )}
    </div>
  );
}

/** Faixa horizontal de previews 4:5 (carrosséis reais) */
function CarouselSlideStrip({ isMobile, style }) {
  return (
    <div
      style={{
        overflow: 'hidden',
        maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
        ...style,
      }}
    >
      <div
        className="vc-landing-carousel-track"
        style={{
          display: 'flex',
          gap: isMobile ? 10 : 14,
          width: 'max-content',
          padding: isMobile ? '0 16px' : '0 clamp(24px, 5vw, 48px)',
        }}
      >
        {[...IMG.carouselSamples, ...IMG.carouselSamples].map((src, i) => (
          <div
            key={`${src}-${i}`}
            style={{
              flexShrink: 0,
              width: isMobile ? 152 : 200,
              aspectRatio: '4 / 5',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--glass-border-strong)',
              boxShadow: 'var(--shadow-lg), var(--shadow-pink)',
              overflow: 'hidden',
              background: 'var(--bg-secondary)',
            }}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingImage({ src, alt = '', style, rounded = 'var(--radius-lg)' }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        borderRadius: rounded,
        border: '1px solid var(--hairline)',
        ...style,
      }}
    />
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
        @keyframes vcLandingCarouselMarquee {
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
        .vc-landing-carousel-track {
          animation: vcLandingCarouselMarquee 36s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .vc-landing-slide-card,
          .vc-landing-glow,
          .vc-landing-marquee-track,
          .vc-landing-carousel-track {
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
        .vc-landing-gen-layer:hover {
          border-color: rgba(255, 45, 141, 0.35);
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

          {/* Stage — composição principal + slides flutuantes */}
          <div style={{
            order: isMobile ? 1 : 0,
            position: 'relative',
            height: isMobile ? 'auto' : 480,
            minHeight: isMobile ? 0 : 400,
            transform: `translateY(${parallax}px)`,
          }}>
            <div
              className="vc-landing-glow"
              aria-hidden
              style={{
                position: 'absolute',
                width: '80%',
                height: '80%',
                top: '10%',
                left: '10%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,45,141,0.22) 0%, transparent 70%)',
                filter: 'blur(48px)',
                zIndex: 0,
              }}
            />
            <LandingImage
              src={IMG.heroStage}
              alt="Preview do editor Viral Carrossel com export para Instagram"
              style={{
                position: 'relative',
                zIndex: 1,
                boxShadow: 'var(--shadow-xl), var(--shadow-pink)',
              }}
              rounded="var(--radius-xl)"
            />
            {!isMobile && (
              <>
                <HeroSlideCard
                  imageSrc={IMG.heroSlides[0]}
                  label="Slide 01"
                  style={{ top: '6%', left: '-4%', '--rot': '-8deg', zIndex: 3 }}
                />
                <HeroSlideCard
                  imageSrc={IMG.heroSlides[1]}
                  label="Slide 05"
                  style={{ top: '18%', right: '-2%', '--rot': '6deg', zIndex: 4 }}
                />
                <HeroSlideCard
                  imageSrc={IMG.heroSlides[2]}
                  label="Slide 09"
                  style={{ bottom: '4%', left: '12%', '--rot': '-3deg', zIndex: 2 }}
                />
              </>
            )}
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
          padding: isMobile ? '0 16px 16px' : '0 clamp(24px, 5vw, 48px) 20px',
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1.05fr',
          gap: isMobile ? 24 : 40,
          alignItems: 'center',
          padding: isMobile ? '28px 20px' : '36px 40px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--hairline)',
          background: 'var(--bg-secondary)',
        }}>
          <div>
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
          <LandingImage
            src={IMG.problem}
            alt="Interface de dados e criação com IA"
          />
        </div>
      </RevealSection>

      <RevealSection
        variant="rise"
        eager
        style={{
          position: 'relative',
          zIndex: 1,
          padding: isMobile ? '12px 0 20px' : '16px 0 24px',
          overflow: 'hidden',
        }}
      >
        <CarouselSlideStrip isMobile={isMobile} />
      </RevealSection>

      {/* ── NÃO É EDITOR ── */}
      <RevealSection
        variant="rise"
        id="nao-editor"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '20px 16px 24px' : '32px clamp(24px, 5vw, 48px) 28px',
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
        }}>Posicionamento</p>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: isMobile ? 28 : 40,
          fontWeight: 600,
          letterSpacing: '-0.028em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.1,
          maxWidth: '16ch',
        }}>
          Não é um editor de carrossel.
        </h2>
        <p style={{
          margin: '0 0 32px',
          fontSize: 17,
          lineHeight: 1.47,
          color: 'var(--text-secondary)',
          maxWidth: '52ch',
        }}>
          Editor só arrasta caixa. O Viral. parte do tema e entrega o post inteiro —
          cada camada gerada num fluxo, não montada slide a slide no Canva.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {GENERATION_LAYERS.map(({ n, icon: Icon, title, body }) => (
            <div
              key={title}
              className="vc-landing-gen-layer"
              style={{
                padding: '20px 18px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--hairline)',
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(12px)',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'var(--accent-surface)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icon size={18} strokeWidth={2} />
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}>{n}</span>
              </div>
              <h3 style={{
                margin: '0 0 8px',
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.018em',
              }}>{title}</h3>
              <p style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.45,
                color: 'var(--text-secondary)',
              }}>{body}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* ── MODOS ── */}
      <RevealSection
        variant="rise"
        id="modos"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '8px 16px 20px' : '16px clamp(24px, 5vw, 48px) 24px',
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
        }}>Modos de trabalho</p>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: isMobile ? 28 : 40,
          fontWeight: 600,
          letterSpacing: '-0.028em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.1,
        }}>
          Publique hoje.
          <br />
          <span style={{ color: 'var(--accent)' }}>Aprofunde quando quiser.</span>
        </h2>
        <p style={{
          margin: '0 0 28px',
          fontSize: 17,
          lineHeight: 1.47,
          color: 'var(--text-secondary)',
          maxWidth: '54ch',
        }}>
          Você não precisa ser designer nem copywriter. No modo Criador, um tema vira
          post completo — narrativa, slides, legenda e arquivo pronto pro feed.
        </p>

        <LandingImage
          src={IMG.modosPlatform}
          alt="Plataforma Viral Carrossel — editor com geração de narrativa, slides e imagens por IA"
          rounded="var(--radius-xl)"
          style={{
            marginBottom: isMobile ? 24 : 32,
            border: '1px solid var(--glass-border-strong)',
            boxShadow: 'var(--shadow-xl), var(--shadow-pink)',
          }}
        />

        <div style={{
          padding: isMobile ? 20 : 28,
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--glass-border)',
          background: 'linear-gradient(135deg, rgba(255,45,141,0.06) 0%, rgba(143,125,255,0.04) 100%)',
        }}>
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
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            marginTop: 24,
          }}>
            <button
              type="button"
              className="vc-landing-cta"
              onClick={onEnter}
              style={{
                height: 48,
                padding: '0 24px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-ui)',
                boxShadow: 'var(--shadow-pink)',
              }}
            >
              <Sparkles size={16} />
              Começar no modo Criador
              <ArrowRight size={14} />
            </button>
            <p style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--text-muted)',
              lineHeight: 1.47,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.02em',
            }}>
              Troque de modo a qualquer momento — sem perder o projeto.
            </p>
          </div>
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
          padding: isMobile ? '20px 16px 16px' : '28px clamp(24px, 5vw, 48px) 20px',
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
          margin: '0 0 28px',
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
          {STEPS.map(({ n, title, body, image }) => (
            <div
              key={n}
              style={{
                padding: 0,
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--hairline)',
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(12px)',
                overflow: 'hidden',
              }}
            >
              <LandingImage src={image} alt="" rounded={0} style={{ border: 'none', borderRadius: 0 }} />
              <div style={{ padding: 24 }}>
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
          padding: isMobile ? '20px 0 32px' : '28px 0 40px',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: isMobile ? '0 16px 12px' : '0 clamp(24px, 5vw, 48px) 16px',
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

      {/* ── SHOWCASE criador + mobile ── */}
      <RevealSection
        variant="scale"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '0 16px 40px' : '0 clamp(24px, 5vw, 48px) 48px',
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
        }}>Na prática</p>
        <h2 style={{
          margin: '0 0 28px',
          fontSize: isMobile ? 24 : 32,
          fontWeight: 600,
          letterSpacing: '-0.022em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.12,
        }}>
          Do café ao post publicado
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16,
        }}>
          <LandingImage
            src={IMG.showcase}
            alt="Criadora de conteúdo usando o Viral Carrossel"
          />
          <LandingImage
            src={IMG.mobile}
            alt="Editor de carrossel no celular"
          />
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
          position: 'relative',
          maxWidth: 720,
          margin: '0 auto',
          padding: isMobile ? '40px 24px' : '56px 48px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(255, 45, 141, 0.28)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-pink)',
        }}>
          <img
            src={IMG.cta}
            alt=""
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.32,
            }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(165deg, rgba(14,12,20,0.88) 0%, rgba(14,12,20,0.72) 100%)',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
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
