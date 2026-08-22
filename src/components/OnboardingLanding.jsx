import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles, ArrowRight,
  Wand2, Download, Palette, TrendingUp, Layout, Instagram,
  BookOpen, Layers, Image, FileText, Check,
} from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import { useLandingGsapEffects } from '../hooks/useLandingGsapEffects.js';

/** Assets em public/landing/ — samples otimizados WebP (slides editoriais) */
const IMG = {
  logo: '/landing/logo-viral-carrossel-studio.png',
  problem: '/landing/section-problem.png',
  steps: ['/landing/step-01-imersao.webp', '/landing/step-02-refine.webp', '/landing/step-03-publicar.webp'],
  cta: '/landing/analytics-screen.png',
  mobile: '/landing/phone-feed.png',
  showcase: '/landing/showcase-creator.png',
  heroPhoto: '/landing/hero-creator-photo.jpg',
  showcaseWindowPhone: '/landing/showcase-window-phone.jpg',
  showcasePhoneNike: '/landing/showcase-phone-rosa.webp',
  modosPlatform: '/landing/modos-platform.png',
  carouselSamples: [
    '/landing/sample-01.webp',
    '/landing/sample-02.webp',
    '/landing/sample-03.webp',
    '/landing/sample-04.webp',
    '/landing/sample-05.webp',
    '/landing/sample-06.webp',
    '/landing/sample-07.webp',
    '/landing/sample-08.webp',
    '/landing/sample-09.webp',
    '/landing/sample-10.webp',
    '/landing/sample-11.webp',
    '/landing/sample-12.webp',
    '/landing/sample-13.webp',
    '/landing/sample-14.webp',
    '/landing/sample-15.webp',
    '/landing/sample-16.webp',
  ],
};

const COVER_META = [
  { name: 'Erro comum', segment: 'Marketing' },
  { name: 'Tendência', segment: 'Criadores' },
  { name: 'Marca', segment: 'Mentoria' },
  { name: 'Virada', segment: 'Consultoria' },
  { name: 'Prova social', segment: 'E-commerce' },
  { name: 'Bastidores', segment: 'Criadores' },
  { name: 'Framework', segment: 'Tecnologia' },
  { name: 'Antes e depois', segment: 'Marketing' },
];

const SAMPLE_COVERS = IMG.carouselSamples.map((src, i) => ({
  src,
  ...COVER_META[i % COVER_META.length],
}));

const STEPS = [
  {
    n: '01',
    title: 'Traga uma ideia',
    body: 'Digite um tema, cole um texto ou use uma referência. Você pode começar com algo pronto ou apenas com aquela ideia que ainda está meio solta.',
    image: IMG.steps[0],
  },
  {
    n: '02',
    title: 'Escolha a direção',
    body: 'Defina o tipo de narrativa e a identidade visual. O Viral. organiza o argumento e cria o carrossel inteiro.',
    image: IMG.steps[1],
  },
  {
    n: '03',
    title: 'Deixe com a sua cara',
    body: 'Reescreva uma frase, troque uma imagem ou aprofunde um card. Você mantém a decisão final.',
    image: IMG.steps[2],
  },
  {
    n: '04',
    title: 'Exporte e publique',
    body: 'Baixe em PNG ou PDF nas dimensões certas para Instagram, sem remontar o projeto em outro lugar.',
    image: IMG.steps[2],
  },
];

const CAPABILITIES = [
  { icon: Layout, label: '16 sistemas editoriais', hint: 'Marketing · Criadores · Mentoria · Consultoria · Tecnologia · E-commerce e mais' },
  { icon: BookOpen, label: 'Narrativas completas', hint: 'Gancho · contexto · tensão · virada · aplicação · CTA' },
  { icon: Palette, label: 'Identidade de marca', hint: 'Paleta · tipografia · assinatura · fontes próprias' },
  { icon: TrendingUp, label: 'Pesquisa de nicho', hint: 'Tendências e referências da web para alimentar a pauta' },
  { icon: Wand2, label: 'Variações de gancho', hint: 'Compare diferentes teses antes de escolher a capa' },
  { icon: Image, label: 'Imagens no fluxo', hint: 'Pesquise, envie ou gere imagens sem sair do projeto' },
  { icon: Download, label: 'Exportação pronta', hint: 'PNG individual ou PDF completo nas proporções do feed' },
  { icon: Instagram, label: 'Feito para continuar no celular', hint: 'Crie, revise e exporte sem depender do computador' },
];

const MODES = [
  {
    id: 'criador',
    label: 'Criador',
    tag: 'Comece aqui',
    desc: 'Escreva o tema e receba uma primeira versão completa: narrativa, slides, legenda e visual.',
  },
  {
    id: 'diretor',
    label: 'Diretor',
    tag: 'Refine a ideia',
    desc: 'Ajuste gancho, tom, ordem, imagens e tipografia até o carrossel soar como você.',
  },
  {
    id: 'studio',
    label: 'Studio',
    tag: 'Controle visual',
    desc: 'Trabalhe grids, tracking, composição e detalhes de cada página quando cada pixel importa.',
  },
];

const PAIN_POINTS = [
  'Você sabe o tema, mas trava na primeira frase.',
  'Cada card parece bom sozinho, mas o conjunto não conta uma história.',
  'O texto nasce em uma ferramenta, o visual em outra e a legenda fica para depois.',
  'Você gasta mais energia montando o post do que desenvolvendo a ideia.',
];

const OUTCOMES = [
  {
    title: 'Uma história que avança',
    body: 'Cada card abre espaço para o próximo. O leitor entende onde está e por que vale continuar.',
  },
  {
    title: 'Ganchos que você pode escolher',
    body: 'Teste diferentes entradas para a mesma ideia e encontre a que soa mais forte — e mais sua.',
  },
  {
    title: 'Sua marca em cada página',
    body: 'Cores, fontes, ritmo e assinatura visual aplicados desde o começo, não como retoque final.',
  },
  {
    title: 'Um post realmente terminado',
    body: 'Slides, legenda e arquivos de publicação no mesmo projeto. Menos pontas soltas antes de postar.',
  },
];

const GENERATION_LAYERS = [
  { n: '01', icon: BookOpen, title: 'Ideia', body: 'O que precisa ser dito.' },
  { n: '02', icon: Layers, title: 'Arco', body: 'Como a leitura avança.' },
  { n: '03', icon: Image, title: 'Visual', body: 'Como a ideia ganha forma.' },
  { n: '04', icon: FileText, title: 'Legenda', body: 'Como a conversa continua.' },
  { n: '05', icon: Download, title: 'Publicação', body: 'Como o projeto chega ao feed.' },
];

const CONTRAST_ROWS = [
  { left: '5 frases isoladas', right: 'uma tese' },
  { left: 'cards repetitivos', right: 'um arco' },
  { left: 'visual genérico', right: 'uma identidade' },
  { left: 'rascunho', right: 'arquivo publicável' },
];

const FAQ = [
  {
    q: 'Quanto custa o Viral.?',
    a: 'O plano individual custa R$ 97 por mês ou R$ 790 por ano. Os dois liberam o studio completo. A geração de texto e imagem usa a chave de IA conectada por você.',
  },
  {
    q: 'Por que preciso conectar uma chave de IA?',
    a: 'Porque preferimos dar transparência e controle a você. Em vez de esconder o consumo dentro de pacotes de créditos, o Viral. deixa você escolher o provedor, acompanhar os gastos e trocar de modelo quando quiser.',
  },
  {
    q: 'Isso significa que existe um custo além da assinatura?',
    a: 'Sim. O acesso ao studio é a assinatura. As gerações são cobradas pelo provedor de IA escolhido, diretamente na sua conta. O valor varia conforme o modelo e a quantidade de conteúdo gerado.',
  },
  {
    q: 'Existe limite de carrosséis?',
    a: 'O Viral. não impõe um teto mensal de projetos. O limite prático depende apenas do saldo ou orçamento configurado na sua chave de IA.',
  },
  {
    q: 'Preciso ser designer ou copywriter?',
    a: 'Não. O modo Criador entrega uma primeira versão completa. Se quiser mais controle, você pode avançar para os modos Diretor e Studio sem precisar dominar uma ferramenta profissional de design.',
  },
  {
    q: 'ChatGPT ou Claude não fazem isso sozinhos?',
    a: 'Eles ajudam a gerar texto. O Viral. transforma esse texto em um projeto editorial: organiza o arco, distribui a ideia entre os cards, aplica sua identidade visual, prepara a legenda e exporta tudo nas dimensões corretas.',
  },
  {
    q: 'Ainda vou precisar do Canva?',
    a: 'Não para o fluxo principal. Você pode criar, editar e exportar dentro do Viral. Se quiser um tratamento muito específico fora do produto, o arquivo exportado continua sendo seu.',
  },
  {
    q: 'Posso usar minha própria identidade visual?',
    a: 'Sim. Você pode configurar cores, tipografia, assinatura e outros elementos da marca para manter consistência entre os projetos.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Sim. O fluxo de criação, revisão, preview e exportação foi pensado para funcionar também no celular.',
  },
  {
    q: 'Como cancelo?',
    a: 'O cancelamento é feito pelo portal do cliente, sem fidelidade. Seu acesso permanece ativo até o fim do período já pago.',
  },
];

const PLAN_FEATURES = [
  'Acesso aos modos Criador, Diretor e Studio',
  'Narrativa, slides, visual, legenda e exportação',
  '16 sistemas editoriais para diferentes nichos',
  'Perfis de marca, fontes e paletas próprias',
  'Compatível com diferentes provedores de IA',
  'Sem limite de carrosséis imposto pelo studio',
  'Cancelamento pelo portal do cliente',
];

/** Carrossel interativo de capas 4:5 — drag + snap ao centro */
function CoverCarousel({ isMobile, samples, onUseStyle }) {
  const n = samples?.length || 0;
  const cardW = isMobile ? 168 : 220;
  const gap = isMobile ? 14 : 20;
  const step = cardW + gap;

  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const dragRef = useRef({ active: false, startX: 0, baseOffset: 0, moved: false });
  const indexRef = useRef(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  const clampIndex = (i) => Math.max(0, Math.min(n - 1, i));

  const settleTo = (i, fromOffset) => {
    const next = clampIndex(i);
    const target = -next * step;
    setIndex(next);
    if (reducedMotion) {
      setOffset(target);
      setDragging(false);
      return;
    }
    setDragging(false);
    // Force style flush then animate via CSS transition
    setOffset(fromOffset ?? offsetRef.current);
    requestAnimationFrame(() => setOffset(target));
  };

  const onPointerDown = (e) => {
    if (n < 2) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      baseOffset: offsetRef.current,
      moved: false,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 3) d.moved = true;
    const min = -(n - 1) * step;
    const next = Math.max(min - step * 0.35, Math.min(step * 0.35, d.baseOffset + dx));
    setOffset(next);
  };

  const endDrag = () => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    const nearest = Math.round(-offsetRef.current / step);
    settleTo(nearest, offsetRef.current);
  };

  const active = samples?.[index] || samples?.[0];
  const trackTransition = dragging || reducedMotion
    ? 'none'
    : 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';

  return (
    <div style={{ width: '100%' }}>
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Estilos de capa"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          overflow: 'hidden',
          touchAction: 'pan-y',
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
          padding: isMobile ? '8px 0 4px' : '12px 0 8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap,
            width: 'max-content',
            transform: `translateX(calc(50% - ${cardW / 2}px + ${offset}px))`,
            transition: trackTransition,
            willChange: 'transform',
          }}
        >
          {(samples || []).map((item, i) => {
            const dist = Math.abs(i - index);
            const isCenter = i === index;
            const scale = isCenter ? 1 : dist === 1 ? 0.86 : 0.8;
            return (
              <div
                key={`${item.src}-${i}`}
                onClick={() => {
                  if (dragRef.current.moved) return;
                  settleTo(i);
                }}
                style={{
                  flexShrink: 0,
                  width: cardW,
                  aspectRatio: '4 / 5',
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: isCenter
                    ? '0 8px 28px rgba(0,0,0,0.35)'
                    : '0 4px 16px rgba(0,0,0,0.22)',
                  overflow: 'hidden',
                  background: 'var(--bg-secondary)',
                  transform: `scale(${scale})`,
                  transition: reducedMotion
                    ? 'none'
                    : 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                  opacity: isCenter ? 1 : 0.72,
                }}
              >
                <img
                  src={item.src}
                  alt=""
                  width={720}
                  height={900}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {active && (
        <div style={{
          textAlign: 'center',
          padding: isMobile ? '16px 16px 0' : '20px clamp(24px, 5vw, 48px) 0',
        }}>
          <p style={{
            margin: '0 0 4px',
            fontSize: isMobile ? 18 : 20,
            fontWeight: 600,
            letterSpacing: '-0.018em',
            color: 'var(--text-primary)',
          }}>
            {active.name}
          </p>
          <p style={{
            margin: '0 0 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>
            {active.segment}
          </p>
          <button
            type="button"
            className="vc-landing-cta"
            onClick={() => onUseStyle?.()}
            style={{
              height: 44,
              padding: '0 22px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'var(--bg-glass)',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            Usar este estilo
          </button>
        </div>
      )}
    </div>
  );
}

const LandingImage = React.forwardRef(function LandingImage({ src, alt = '', style, rounded = 'var(--radius-lg)' }, ref) {
  return (
    <img
      ref={ref}
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
});

// rootMargin positivo em baixo = a seção já é considerada "visível" um bom
// tanto ANTES de entrar de fato na viewport (o observer enxerga além do que a
// tela mostra). threshold baixo = já dispara com uma fatia mínima da seção
// nessa área expandida. Isso garante que o reveal termina de rodar bem antes
// do usuário rolar até ali — como clip-path/opacity não colapsam a altura da
// seção, qualquer atraso aqui aparece como vão vazio enquanto rola.
// Duas rodadas ajustando o IntersectionObserver (threshold/rootMargin) não
// resolveram o vão vazio reportado — mesmo com o dev server confirmadamente
// servindo a versão atual. Ao invés de continuar caçando a causa exata do
// observer não disparar a tempo (clip-path/opacity não colapsam a altura da
// seção enquanto ela espera o "entrou na tela", então qualquer atraso vira
// buraco visível), a reveal virou "dispara pouco depois do mount" em vez de
// "dispara quando rola até a seção". Isso garante que a transição já
// terminou muito antes do usuário conseguir rolar até ali (mount acontece no
// carregamento inicial da página inteira, não seção por seção), eliminando a
// classe inteira do bug — não é só uma seção que já teria dado tempo de
// aparecer, é fisicamente impossível o usuário rolar mais rápido que isso.
function useReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setVisible(true);
      return undefined;
    }
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return visible;
}

function RevealSection({ children, variant = 'rise', style, className = '', eager = false, id }) {
  const ref = useRef(null);
  // `eager` não muda mais o comportamento (todo RevealSection revela no
  // mount, não no scroll — ver comentário em useReveal) mas o prop continua
  // aceito pra não quebrar os call sites existentes.
  const visible = useReveal();
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

export default function OnboardingLanding({ onEnter, onLogin, isMobile }) {
  const heroRef = useRef(null);
  const [activeMode, setActiveMode] = useState('criador');
  const [navOpen, setNavOpen] = useState(false);

  const heroTitleRef = useRef(null);
  const notEditorTitleRef = useRef(null);
  const ctaSectionRef = useRef(null);
  const ctaImageRef = useRef(null);
  const stickyHeaderRef = useRef(null);
  const heroBgRef = useRef(null);
  const problemImageRef = useRef(null);
  const modosImageRef = useRef(null);
  const stepsGridRef = useRef(null);

  const scrollToId = (id) => {
    setNavOpen(false);
    const shell = document.querySelector('.vc-landing-shell');
    const target = document.getElementById(id);
    if (!target) return;
    if (shell) {
      const shellRect = shell.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      shell.scrollTop += targetRect.top - shellRect.top - 88;
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useLandingGsapEffects({
    splitRefs: [heroTitleRef, notEditorTitleRef],
    parallaxLayers: [
      { ref: heroBgRef, speed: 0.35 },
      { ref: problemImageRef, speed: 0.22 },
      { ref: modosImageRef, speed: 0.18 },
      { ref: stepsGridRef, speed: 0.12 },
    ],
    ctaSectionRef,
    ctaImageRef,
    heroSectionRef: heroRef,
    heroBgRef,
    stickyHeaderRef,
    isMobile,
  });

  const activeModeData = MODES.find((m) => m.id === activeMode) || MODES[0];

  const eyebrowStyle = {
    margin: '0 0 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 600,
  };

  const sectionTitleStyle = {
    margin: '0 0 12px',
    fontSize: isMobile ? 'clamp(1.75rem, 7vw, 2.25rem)' : 'clamp(2.25rem, 4vw, 3.1rem)',
    fontWeight: 600,
    letterSpacing: '-0.028em',
    fontFamily: 'var(--font-display)',
    lineHeight: 1.04,
    color: 'var(--text-primary)',
  };

  return (
    <div
      className="vc-onboarding-landing"
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'var(--ld-bg)',
        color: 'var(--ld-text)',
        fontFamily: 'var(--font-ui)',
        overflowX: 'hidden',
        '--ld-bg': '#0B0A10',
        '--ld-bg-2': '#121119',
        '--ld-elevated': 'rgba(255,255,255,0.055)',
        '--ld-text': '#F5F3F4',
        '--ld-text-2': '#AAA6AD',
        '--ld-muted': '#76727C',
        '--ld-accent': '#FF2D8D',
        '--ld-accent-press': '#E8257D',
        '--ld-border': 'rgba(255,255,255,0.10)',
        '--bg-primary': '#0B0A10',
        '--bg-secondary': '#121119',
        '--bg-tertiary': '#16141e',
        '--bg-glass': 'rgba(255,255,255,0.055)',
        '--bg-glass-strong': 'rgba(255,255,255,0.08)',
        '--text-primary': '#F5F3F4',
        '--text-secondary': '#AAA6AD',
        '--text-muted': '#76727C',
        '--accent': '#FF2D8D',
        '--accent-hover': '#E8257D',
        '--accent-surface': 'rgba(255,45,141,0.12)',
        '--hairline': 'rgba(255,255,255,0.10)',
        '--glass-border': 'rgba(255,255,255,0.10)',
        '--glass-border-strong': 'rgba(255,255,255,0.14)',
        '--shadow-pink': '0 8px 24px rgba(255, 45, 141, 0.18)',
        '--gradient-bg': '#0B0A10',
      }}
    >
      <style>{`
        .vc-landing-marquee-track {
          animation: vcLandingMarquee 32s linear infinite;
        }
        @keyframes vcLandingMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vc-landing-marquee-track { animation: none !important; }
        }
        .vc-landing-cta:active { transform: scale(0.98); }
        .vc-landing-cta {
          transition: transform 0.15s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .vc-landing-cta.primary:hover {
          background: var(--accent-hover) !important;
          box-shadow: 0 8px 24px rgba(255, 45, 141, 0.22);
        }
        .vc-landing-cap-chip:hover,
        .vc-landing-gen-layer:hover {
          border-color: rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.08);
          transform: translateY(-2px);
        }
        .vc-landing-gen-layer {
          transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
        }
        .vc-landing-nav-link {
          background: none; border: none; cursor: pointer;
          color: var(--text-secondary); font-size: 13px; font-weight: 540;
          font-family: var(--font-ui); padding: 8px 10px; border-radius: 999px;
        }
        .vc-landing-nav-link:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
        .vc-landing-mode-seg {
          position: relative; display: inline-flex; padding: 4px; width: min(100%, 420px);
          border-radius: 999px; border: 1px solid var(--hairline);
          background: rgba(255,255,255,0.04);
        }
        .vc-landing-mode-seg button {
          position: relative; z-index: 1; border: none; background: transparent;
          color: var(--text-secondary); font-size: 14px; font-weight: 600;
          font-family: var(--font-ui); padding: 10px 18px; border-radius: 999px;
          cursor: pointer; transition: color 0.25s ease;
        }
        .vc-landing-mode-seg button[aria-selected="true"] { color: var(--text-primary); }
        .vc-landing-mode-pill {
          position: absolute; top: 4px; bottom: 4px; border-radius: 999px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,45,141,0.45);
          transition: left 0.35s cubic-bezier(0.22, 1, 0.36, 1), width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
        }
      `}</style>

      {/* Nav flutuante */}
      <div
        ref={stickyHeaderRef}
        data-always-visible="true"
        style={{
          position: 'fixed',
          top: isMobile ? 10 : 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          width: isMobile ? 'calc(100% - 20px)' : 'min(920px, calc(100% - 32px))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: isMobile ? '8px 10px' : '8px 12px 8px 16px',
          borderRadius: 999,
          background: 'rgba(11,10,16,0.72)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        }}
      >
        <BrandLogo height={22} />
        {!isMobile && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button type="button" className="vc-landing-nav-link" onClick={() => scrollToId('produto')}>Produto</button>
            <button type="button" className="vc-landing-nav-link" onClick={() => scrollToId('templates')}>Templates</button>
            <button type="button" className="vc-landing-nav-link" onClick={() => scrollToId('como-funciona')}>Como funciona</button>
            <button type="button" className="vc-landing-nav-link" onClick={() => scrollToId('planos')}>Preço</button>
          </nav>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isMobile && (
            <button
              type="button"
              className="vc-landing-nav-link"
              onClick={() => setNavOpen((v) => !v)}
              aria-expanded={navOpen}
              aria-label="Menu"
            >
              Menu
            </button>
          )}
          {onLogin && (
            <button
              type="button"
              onClick={onLogin}
              style={{
                height: 36, padding: '0 14px', borderRadius: 999, border: 'none',
                background: 'transparent', color: 'var(--text-primary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              }}
            >
              Entrar
            </button>
          )}
          <button
            type="button"
            className="vc-landing-cta primary"
            onClick={onEnter}
            style={{
              height: 36, padding: '0 16px', borderRadius: 999, border: 'none',
              background: 'var(--accent)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}
          >
            Começar
          </button>
        </div>
      </div>
      {isMobile && navOpen && (
        <div style={{
          position: 'fixed', top: 64, left: 10, right: 10, zIndex: 29,
          padding: 12, borderRadius: 16, background: 'rgba(11,10,16,0.92)',
          border: '1px solid var(--hairline)', backdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {[
            ['produto', 'Produto'],
            ['templates', 'Templates'],
            ['como-funciona', 'Como funciona'],
            ['planos', 'Preço'],
          ].map(([id, label]) => (
            <button key={id} type="button" className="vc-landing-nav-link" onClick={() => scrollToId(id)} style={{ textAlign: 'left' }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* HERO split */}
      <header
        ref={heroRef}
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: isMobile ? 'auto' : '100svh',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1.05fr',
          gap: 0,
          paddingTop: isMobile ? 72 : 88,
          background: 'var(--ld-bg)',
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: isMobile ? '32px 20px 28px' : '48px clamp(28px, 5vw, 64px) 64px',
          maxWidth: 560,
        }}>
          <p style={{ ...eyebrowStyle, marginBottom: 16 }}>Viral. Carrossel Studio</p>
          <h1
            ref={heroTitleRef}
            style={{
              margin: '0 0 20px',
              fontSize: isMobile ? 'clamp(2.2rem, 9vw, 2.8rem)' : 'clamp(2.75rem, 5vw, 4.25rem)',
              fontWeight: 600,
              letterSpacing: '-0.035em',
              lineHeight: 1.0,
              fontFamily: 'var(--font-display)',
            }}
          >
            Sua ideia merece
            <br />
            mais que slides bonitos.
          </h1>
          <p style={{
            margin: '0 0 28px',
            fontSize: isMobile ? 16 : 18,
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            maxWidth: '36ch',
          }}>
            Transforme um tema em uma narrativa pronta para prender, convencer e publicar.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="vc-landing-cta primary"
              onClick={onEnter}
              style={{
                height: 52, padding: '0 26px', borderRadius: 999, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 600,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10,
                fontFamily: 'var(--font-ui)', boxShadow: 'var(--shadow-pink)',
              }}
            >
              Começar um carrossel
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => scrollToId('produto')}
              style={{
                height: 52, padding: '0 22px', borderRadius: 999,
                border: '1px solid var(--hairline)', background: 'transparent',
                color: 'var(--text-primary)', fontSize: 15, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-ui)',
              }}
            >
              Ver o produto
            </button>
          </div>
        </div>

        <div style={{
          position: 'relative',
          minHeight: isMobile ? 320 : 'auto',
          overflow: 'hidden',
          background: 'var(--ld-bg-2)',
        }}>
          <img
            ref={heroBgRef}
            src={IMG.heroPhoto}
            alt=""
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: isMobile ? '72% 18%' : '62% 28%',
              opacity: 0.55,
            }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: isMobile
              ? 'linear-gradient(180deg, #0B0A10 0%, transparent 28%, rgba(11,10,16,0.55) 100%)'
              : 'linear-gradient(90deg, #0B0A10 0%, rgba(11,10,16,0.35) 28%, transparent 55%)',
          }} />
          <div style={{
            position: 'relative', zIndex: 1, height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: isMobile ? '24px 16px 40px' : '48px 40px',
          }}>
            <img
              src={IMG.modosPlatform}
              alt="Interface do Viral. Carrossel Studio"
              style={{
                width: '100%', maxWidth: isMobile ? 420 : 560,
                borderRadius: 16, border: '1px solid var(--hairline)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
                display: 'block',
              }}
            />
          </div>
        </div>
      </header>

      {/* ── PRODUTO ── */}
      <RevealSection
        variant="rise"
        id="produto"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '40px 16px 28px' : '64px clamp(24px, 5vw, 48px) 40px',
        }}
      >
        <p style={eyebrowStyle}>Demonstração</p>
        <h2 style={sectionTitleStyle}>O studio em ação.</h2>
        <p style={{
          margin: '0 0 28px', fontSize: 18, lineHeight: 1.55,
          color: 'var(--text-secondary)', maxWidth: '48ch',
        }}>
          Do tema ao arquivo: narrativa, slides, marca e exportação no mesmo projeto —
          com a interface real do Viral.
        </p>
        <LandingImage
          ref={modosImageRef}
          src={IMG.modosPlatform}
          alt="Editor do Viral. Carrossel Studio"
          rounded={16}
          style={{
            border: '1px solid var(--hairline)',
            boxShadow: '0 20px 56px rgba(0,0,0,0.4)',
          }}
        />
      </RevealSection>

      {/* ── TEMPLATES / GALERIA ── */}
      <RevealSection
        variant="scale"
        id="templates"
        style={{
          position: 'relative',
          zIndex: 1,
          padding: isMobile ? '28px 0 40px' : '36px 0 56px',
          background: 'var(--ld-bg-2)',
        }}
      >
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: isMobile ? '0 16px 8px' : '0 clamp(24px, 5vw, 48px) 12px',
        }}>
          <p style={eyebrowStyle}>Resultados</p>
          <h2 style={{ ...sectionTitleStyle, marginBottom: 8 }}>Capas que já saíram do studio.</h2>
          <p style={{
            margin: '0 0 8px', fontSize: 17, lineHeight: 1.5,
            color: 'var(--text-secondary)', maxWidth: '42ch',
          }}>
            Arraste para explorar. Escolha um estilo e comece a partir dele.
          </p>
        </div>
        <CoverCarousel isMobile={isMobile} samples={SAMPLE_COVERS} onUseStyle={onEnter} />
      </RevealSection>

      {/* ── PROBLEMA ── */}
      <RevealSection
        variant="rise"
        style={{
          position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto',
          padding: isMobile ? '40px 16px 32px' : '64px clamp(24px, 5vw, 48px) 40px',
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? 28 : 48,
          alignItems: 'center',
        }}>
          <div>
            <p style={eyebrowStyle}>O trabalho que ninguém vê</p>
            <h2 style={sectionTitleStyle}>
              O difícil não é fazer slides.
              <br />
              É saber o que cada slide precisa dizer.
            </h2>
            <p style={{
              margin: '0 0 24px', fontSize: 17, lineHeight: 1.55,
              color: 'var(--text-secondary)',
            }}>
              Uma boa ideia costuma se perder entre o documento em branco, o prompt genérico
              e horas ajustando detalhes. Quando tudo fica pronto, os slides até parecem bonitos —
              mas não levam o leitor a lugar nenhum.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {PAIN_POINTS.map((line) => (
                <li key={line} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  fontSize: 16, lineHeight: 1.5, color: 'var(--text-secondary)',
                }}>
                  <span style={{
                    flexShrink: 0, width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent)', marginTop: 9,
                  }} aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <LandingImage
            ref={problemImageRef}
            src={IMG.problem}
            alt="Fluxo de criação com IA"
            rounded={16}
            style={{ border: '1px solid var(--hairline)' }}
          />
        </div>
      </RevealSection>

      {/* ── COMO O VIRAL RESOLVE ── */}
      <RevealSection
        variant="rise"
        id="nao-editor"
        style={{
          position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto',
          padding: isMobile ? '24px 16px 48px' : '32px clamp(24px, 5vw, 48px) 64px',
        }}
      >
        <p style={eyebrowStyle}>Um studio, não só um editor</p>
        <h2 ref={notEditorTitleRef} style={sectionTitleStyle}>
          O Viral. começa pelo que você quer fazer alguém perceber.
        </h2>
        <p style={{
          margin: '0 0 32px', fontSize: 17, lineHeight: 1.55,
          color: 'var(--text-secondary)', maxWidth: '52ch',
        }}>
          Você traz o tema. O studio organiza a tese, constrói o arco e transforma
          essa direção em um carrossel pronto para refinar.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {GENERATION_LAYERS.map(({ n, title, body }, i) => (
            <div
              key={title}
              className="vc-landing-gen-layer"
              style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr',
                gap: 16,
                padding: '20px 0',
                borderTop: i === 0 ? '1px solid var(--hairline)' : undefined,
                borderBottom: '1px solid var(--hairline)',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
                letterSpacing: '0.06em', color: 'var(--accent)', paddingTop: 2,
              }}>{n}</span>
              <div>
                <h3 style={{
                  margin: '0 0 4px', fontSize: 18, fontWeight: 600,
                  letterSpacing: '-0.012em',
                }}>{title}</h3>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* ── MODOS SEGMENTED ── */}
      <RevealSection
        variant="rise"
        id="modos"
        style={{
          position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto',
          padding: isMobile ? '24px 16px 48px' : '40px clamp(24px, 5vw, 48px) 64px',
          background: 'transparent',
        }}
      >
        <p style={eyebrowStyle}>Você decide até onde quer ir</p>
        <h2 style={sectionTitleStyle}>
          Comece simples.
          <br />
          Revele mais controle somente quando precisar.
        </h2>
        <div style={{ margin: '28px 0 24px' }}>
          <div
            className="vc-landing-mode-seg"
            role="tablist"
            aria-label="Modos de trabalho"
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            <span
              className="vc-landing-mode-pill"
              style={{
                left: `calc(4px + ${MODES.findIndex((m) => m.id === activeMode)} * ((100% - 8px) / ${MODES.length}))`,
                width: `calc((100% - 8px) / ${MODES.length})`,
              }}
            />
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={activeMode === m.id}
                onClick={() => setActiveMode(m.id)}
                style={{ flex: 1, minWidth: isMobile ? 0 : 110 }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '0.9fr 1.1fr',
          gap: 24,
          alignItems: 'center',
          padding: isMobile ? 20 : 28,
          borderRadius: 24,
          background: 'var(--ld-elevated)',
          border: '1px solid var(--hairline)',
        }}>
          <div>
            {activeModeData.tag && (
              <p style={{
                ...eyebrowStyle, color: 'var(--accent)', marginBottom: 10,
              }}>{activeModeData.tag}</p>
            )}
            <h3 style={{
              margin: '0 0 10px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
            }}>{activeModeData.label}</h3>
            <p style={{
              margin: '0 0 20px', fontSize: 16, lineHeight: 1.55, color: 'var(--text-secondary)',
            }}>{activeModeData.desc}</p>
            <button
              type="button"
              className="vc-landing-cta primary"
              onClick={onEnter}
              style={{
                height: 44, padding: '0 20px', borderRadius: 999, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-ui)',
              }}
            >
              Entrar no modo {activeModeData.label}
            </button>
          </div>
          <LandingImage
            src={IMG.modosPlatform}
            alt={`Modo ${activeModeData.label}`}
            rounded={16}
            style={{ border: '1px solid var(--hairline)' }}
          />
        </div>
      </RevealSection>

      {/* ── COMO FUNCIONA ── */}
      <RevealSection
        variant="rise"
        id="como-funciona"
        style={{
          position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto',
          padding: isMobile ? '24px 16px 40px' : '32px clamp(24px, 5vw, 48px) 56px',
        }}
      >
        <p style={eyebrowStyle}>Do primeiro insight ao último card</p>
        <h2 style={sectionTitleStyle}>Quatro passos. Uma linha de raciocínio.</h2>
        <div
          ref={stepsGridRef}
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: 16,
            marginTop: 28,
          }}
        >
          {STEPS.map(({ n, title, body, image }) => (
            <div key={n} style={{
              padding: 0, borderRadius: 16, border: '1px solid var(--hairline)',
              background: 'var(--ld-elevated)', overflow: 'hidden',
            }}>
              <LandingImage src={image} alt="" rounded={0} style={{ border: 'none', borderRadius: 0 }} />
              <div style={{ padding: isMobile ? 20 : 28 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)',
                  letterSpacing: '0.06em', marginBottom: 12, fontWeight: 600,
                }}>{n}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, letterSpacing: '-0.012em' }}>{title}</h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            className="vc-landing-cta primary"
            onClick={onEnter}
            style={{
              height: 52, padding: '0 28px', borderRadius: 999, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10,
              fontFamily: 'var(--font-ui)', boxShadow: 'var(--shadow-pink)',
            }}
          >
            Quero transformar uma ideia em carrossel
            <ArrowRight size={16} />
          </button>
        </div>
      </RevealSection>

      {/* ── CONTRASTE ── */}
      <RevealSection
        variant="rise"
        id="contraste"
        style={{
          position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto',
          padding: isMobile ? '24px 16px 48px' : '32px 24px 64px',
        }}
      >
        <p style={eyebrowStyle}>Existe uma diferença</p>
        <h2 style={sectionTitleStyle}>
          Gerar texto é fácil.
          <br />
          Construir uma leitura é outra coisa.
        </h2>
        <div style={{
          marginTop: 28, borderRadius: 16, border: '1px solid var(--hairline)',
          overflow: 'hidden', background: 'var(--ld-elevated)',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 28px 1fr', gap: 8,
            padding: '14px 18px', borderBottom: '1px solid var(--hairline)',
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
            textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)',
          }}>
            <span>Prompt solto</span>
            <span />
            <span style={{ color: 'var(--accent)' }}>Viral.</span>
          </div>
          {CONTRAST_ROWS.map(({ left, right }) => (
            <div key={left} style={{
              display: 'grid', gridTemplateColumns: '1fr 28px 1fr', gap: 8,
              padding: '16px 18px', borderBottom: '1px solid var(--hairline)',
              fontSize: 15, lineHeight: 1.4,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>{left}</span>
              <span style={{ color: 'var(--text-muted)', textAlign: 'center' }}>→</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{right}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <button
            type="button"
            className="vc-landing-cta primary"
            onClick={onEnter}
            style={{
              height: 48, padding: '0 24px', borderRadius: 999, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}
          >
            Criar meu primeiro carrossel
          </button>
        </div>
      </RevealSection>

      {/* ── OUTCOMES ── */}
      <RevealSection
        variant="rise"
        style={{
          position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto',
          padding: isMobile ? '16px 16px 40px' : '24px clamp(24px, 5vw, 48px) 56px',
        }}
      >
        <p style={eyebrowStyle}>O que sai do studio</p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 12, marginTop: 20,
        }}>
          {OUTCOMES.slice(0, 3).map(({ title, body }) => (
            <div key={title} style={{
              padding: '24px 22px', borderRadius: 16,
              background: 'var(--ld-elevated)', border: '1px solid var(--hairline)',
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, letterSpacing: '-0.012em' }}>{title}</h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{body}</p>
            </div>
          ))}
        </div>
        {OUTCOMES[3] && (
          <div style={{
            marginTop: 12, padding: '24px 22px', borderRadius: 16,
            background: 'var(--ld-elevated)', border: '1px solid var(--hairline)',
            maxWidth: isMobile ? '100%' : '66%',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>{OUTCOMES[3].title}</h3>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{OUTCOMES[3].body}</p>
          </div>
        )}
      </RevealSection>

      {/* ── CAPACIDADES ── */}
      <RevealSection
        variant="scale"
        style={{
          position: 'relative', zIndex: 1, padding: isMobile ? '24px 0 40px' : '32px 0 56px',
          overflow: 'hidden', background: 'var(--ld-bg-2)',
        }}
      >
        <div style={{
          padding: isMobile ? '0 16px 16px' : '0 clamp(24px, 5vw, 48px) 20px',
          maxWidth: 1200, margin: '0 auto',
        }}>
          <p style={eyebrowStyle}>Tudo no mesmo fluxo</p>
          <h2 style={sectionTitleStyle}>Menos troca de abas. Mais atenção na ideia.</h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: 'var(--text-secondary)', maxWidth: '48ch' }}>
            Pesquisa, escrita, direção visual, refinamento e exportação reunidos em um único projeto.
          </p>
        </div>
        <div style={{ overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
          <div className="vc-landing-marquee-track" style={{ display: 'flex', gap: 12, width: 'max-content', padding: '8px 0' }}>
            {[...CAPABILITIES, ...CAPABILITIES].map(({ icon: Icon, label, hint }, i) => (
              <div key={`${label}-${i}`} className="vc-landing-cap-chip" style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 20px', borderRadius: 12, border: '1px solid var(--hairline)',
                background: 'rgba(255,255,255,0.04)', minWidth: 240,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ── PLANOS ── */}
      <RevealSection
        variant="rise"
        id="planos"
        style={{
          position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto',
          padding: isMobile ? '40px 16px 48px' : '56px 24px 64px',
        }}
      >
        <p style={eyebrowStyle}>Um plano. O studio inteiro.</p>
        <h2 style={sectionTitleStyle}>
          Você paga pelo studio.
          <br />
          A produção continua nas suas mãos.
        </h2>
        <p style={{
          margin: '0 0 28px', fontSize: 17, lineHeight: 1.55,
          color: 'var(--text-secondary)',
        }}>
          Conecte a sua própria chave de IA e escolha o provedor que prefere.
          Sem pacotes de posts nem créditos escondidos.
        </p>
        <div style={{
          padding: isMobile ? 24 : 32, borderRadius: 24,
          border: '1px solid var(--hairline)', background: 'var(--ld-elevated)',
        }}>
          <p style={{ ...eyebrowStyle, color: 'var(--accent)' }}>Plano individual</p>
          <h3 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600 }}>Viral. Studio</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: isMobile ? 40 : 48, fontWeight: 600, letterSpacing: '-0.03em' }}>R$ 97</span>
            <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>/mês</span>
          </div>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary)' }}>
            ou <strong style={{ color: 'var(--text-primary)' }}>R$ 790/ano</strong> — cerca de R$ 66/mês
          </p>
          <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PLAN_FEATURES.map((line) => (
              <li key={line} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                <Check size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                {line}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="vc-landing-cta primary"
            onClick={onEnter}
            style={{
              width: '100%', height: 52, borderRadius: 999, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-ui)', boxShadow: 'var(--shadow-pink)',
            }}
          >
            Entrar no Viral. Studio
          </button>
          <p style={{
            margin: '14px 0 0', fontSize: 12, textAlign: 'center', color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
          }}>
            Use sua própria chave de IA · Cancele quando quiser
          </p>
        </div>
      </RevealSection>

      {/* ── FAQ ── */}
      <RevealSection
        variant="rise"
        style={{
          position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto',
          padding: isMobile ? '0 16px 56px' : '0 24px 72px',
        }}
      >
        <p style={eyebrowStyle}>Dúvidas</p>
        <h2 style={{ ...sectionTitleStyle, marginBottom: 28 }}>Antes de assinar</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {FAQ.map(({ q, a }) => (
            <details key={q} style={{
              borderBottom: '1px solid var(--hairline)', padding: '18px 0',
            }}>
              <summary style={{
                cursor: 'pointer', fontSize: 16, fontWeight: 600, letterSpacing: '-0.014em',
                listStyle: 'none', display: 'flex', justifyContent: 'space-between', gap: 16,
              }}>
                {q}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>+</span>
              </summary>
              <p style={{
                margin: '12px 0 0', fontSize: 15, lineHeight: 1.55, color: 'var(--text-secondary)',
              }}>{a}</p>
            </details>
          ))}
        </div>
      </RevealSection>

      {/* ── CTA FINAL ── */}
      <RevealSection
        variant="rise"
        style={{
          position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto',
          padding: isMobile ? '0 16px 56px' : '0 clamp(24px, 5vw, 48px) 80px',
        }}
      >
        <div
          ref={ctaSectionRef}
          style={{
            position: 'relative', overflow: 'hidden', borderRadius: 24,
            border: '1px solid var(--hairline)', padding: isMobile ? '40px 24px' : '64px 48px',
            textAlign: 'center', background: 'var(--ld-bg-2)',
          }}
        >
          <img
            ref={ctaImageRef}
            src={IMG.cta}
            alt=""
            aria-hidden
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: 0.18, pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ ...eyebrowStyle, color: 'var(--accent)' }}>Sua próxima ideia já pode virar post</p>
            <h2 style={sectionTitleStyle}>
              Pare de acumular rascunhos.
              <br />
              Publique o que você já tem para dizer.
            </h2>
            <p style={{
              margin: '0 auto 28px', maxWidth: '44ch', fontSize: 17,
              color: 'var(--text-secondary)', lineHeight: 1.55,
            }}>
              Entre no studio, escolha uma direção e transforme seu tema em um carrossel completo.
              O Viral. organiza o caminho. Você decide a versão final.
            </p>
            <button
              type="button"
              className="vc-landing-cta primary"
              onClick={onEnter}
              style={{
                height: 56, padding: '0 32px', borderRadius: 999, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 17, fontWeight: 600,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10,
                fontFamily: 'var(--font-ui)', boxShadow: 'var(--shadow-pink)',
              }}
            >
              <Sparkles size={18} />
              Criar meu primeiro carrossel
            </button>
            <p style={{
              margin: '18px 0 0', fontSize: 12, color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            }}>
              Studio completo · R$ 97/mês · Sua chave de IA · Sem limite imposto pelo produto
            </p>
          </div>
        </div>
      </RevealSection>

      {/* ── FOOTER ── */}
      <footer style={{
        position: 'relative', zIndex: 1, borderTop: '1px solid var(--hairline)',
        padding: isMobile
          ? '32px 16px calc(40px + env(safe-area-inset-bottom))'
          : '40px clamp(24px, 5vw, 48px) calc(48px + env(safe-area-inset-bottom))',
        maxWidth: 1200, margin: '0 auto', width: '100%',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between', gap: 24,
      }}>
        <div>
          <div style={{ marginBottom: 10 }}>
            <BrandLogo height={isMobile ? 26 : 30} />
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.47, color: 'var(--text-muted)', maxWidth: '36ch' }}>
            Da ideia ao post — com argumento, identidade e direção.
          </p>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: isMobile ? 'flex-start' : 'flex-end', gap: 12,
        }}>
          <button
            type="button"
            className="vc-landing-cta"
            onClick={onEnter}
            style={{
              height: 44, padding: '0 24px', borderRadius: 999,
              border: '1px solid var(--hairline)', background: 'transparent',
              color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}
          >
            Criar meu primeiro carrossel
          </button>
          <p style={{
            margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)',
          }}>
            © {new Date().getFullYear()} Viral. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
