import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles, ArrowRight,
  Wand2, Download, Palette, TrendingUp, Layout, Instagram,
  BookOpen, Layers, Image, FileText, Check, X,
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
    title: 'Refine e publique',
    body: 'Ajuste frases e imagens com a sua cara, depois exporte em PNG ou PDF nas dimensões certas — sem remontar o projeto em outro lugar.',
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

const CONTRAST_WITHOUT = [
  'Entrega frases que poderiam servir para qualquer tema.',
  'Repete fórmulas sem desenvolver um ponto de vista.',
  'Trata cada slide como uma peça isolada.',
  'Deixa design, legenda e exportação para você resolver depois.',
];

const CONTRAST_WITH = [
  'Parte de uma tese clara e conduz o leitor até a conclusão.',
  'Define a função de cada card dentro do argumento.',
  'Mantém texto e identidade visual na mesma direção.',
  'Entrega o post completo, com espaço para você refinar o que importa.',
];

const GENERATION_LAYERS = [
  {
    n: '01',
    icon: BookOpen,
    title: 'Encontra a ideia central',
    body: 'Separa o que é assunto do que realmente merece virar tese — e cria um gancho que abre essa conversa.',
  },
  {
    n: '02',
    icon: Layers,
    title: 'Constrói o arco',
    body: 'Dá uma função a cada card para que a leitura avance, em vez de repetir a mesma ideia com palavras diferentes.',
  },
  {
    n: '03',
    icon: Image,
    title: 'Traduz em visual',
    body: 'Aplica layout, tipografia, paleta e imagens sem apagar a personalidade da sua marca.',
  },
  {
    n: '04',
    icon: FileText,
    title: 'Completa o post',
    body: 'Gera a legenda como continuação do raciocínio, não como um texto genérico colado no final.',
  },
  {
    n: '05',
    icon: Download,
    title: 'Entrega para publicar',
    body: 'Exporte em PNG ou PDF, nas proporções certas para o feed, sem reconstruir tudo em outro editor.',
  },
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

/** Faixa horizontal de previews 4:5 (carrosséis reais) */
function CarouselSlideStrip({ isMobile, style = {} }) {
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
              width={720}
              height={900}
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

  // Refs pros efeitos GSAP (reveal de texto, parallax de imagem e header
  // fixo) — ver src/hooks/useLandingGsapEffects.js pra a lógica em si.
  const heroTitleRef = useRef(null);
  const notEditorTitleRef = useRef(null);
  const ctaSectionRef = useRef(null);
  const ctaImageRef = useRef(null);
  const stickyHeaderRef = useRef(null);
  const heroBgRef = useRef(null);
  const problemImageRef = useRef(null);
  const modosImageRef = useRef(null);
  const stepsGridRef = useRef(null);

  useLandingGsapEffects({
    splitRefs: [heroTitleRef, notEditorTitleRef],
    parallaxLayers: [
      { ref: heroBgRef, speed: 0.65 },
      { ref: problemImageRef, speed: 0.32 },
      { ref: modosImageRef, speed: 0.28 },
      { ref: stepsGridRef, speed: 0.18 },
    ],
    ctaSectionRef,
    ctaImageRef,
    heroSectionRef: heroRef,
    heroBgRef,
    stickyHeaderRef,
    isMobile,
  });

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
        @keyframes vcLandingScrollCue {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50% { transform: translateY(5px); opacity: 1; }
        }
        .vc-landing-scroll-cue {
          animation: vcLandingScrollCue 1.8s ease-in-out infinite;
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
          .vc-landing-carousel-track,
          .vc-landing-scroll-cue {
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

      {/* Header fixo — some no topo do hero, entra com transição suave (GSAP)
          assim que o usuário rola além do hero. Estado inicial (oculto) já
          vem no style pra não piscar antes do JS montar. */}
      <div
        ref={stickyHeaderRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          opacity: 0,
          transform: 'translateY(-100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '10px 16px' : '10px clamp(24px, 5vw, 48px)',
          background: 'var(--bg-glass-strong)',
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
          borderBottom: '1px solid var(--glass-border-strong)',
        }}
      >
        <BrandLogo height={26} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onLogin && (
            <button
              type="button"
              onClick={onLogin}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Entrar
            </button>
          )}
          <button
            type="button"
            className="vc-landing-cta"
            onClick={() => {
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
              height: 36,
              padding: '0 18px',
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
            Conhecer o studio
          </button>
        </div>
      </div>

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

      {/* ── HERO — full-bleed cinematográfico ── */}
      <header
        ref={heroRef}
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: isMobile ? '92svh' : '100svh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Fundo — foto real em alta resolução (1920px, otimizada a partir do
            original 2752×1536 enviado pelo usuário), sem precisar de blur pra
            disfarçar baixa resolução como na versão anterior. Overlay escuro
            só o suficiente pra garantir contraste do texto por cima. Ken
            Burns (GSAP, no ref) dá o movimento contínuo que o vídeo do site
            de referência tinha. */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          <img
            ref={heroBgRef}
            src={IMG.heroPhoto}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              // A foto é bem larga (paisagem) e ele fica no lado direito.
              // Num crop retrato (mobile), "center" corta bem no meio e some
              // com ele quase todo — desloca a âncora horizontal pra ~72%
              // pra manter o rosto dele dentro do enquadramento.
              objectPosition: isMobile ? '72% 12%' : '68% 28%',
              filter: 'saturate(104%)',
              transform: 'scale(1.04)',
            }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: isMobile
              ? `
                linear-gradient(180deg, rgba(14,12,20,0.35) 0%, rgba(14,12,20,0.2) 32%, rgba(14,12,20,0.88) 72%, rgba(14,12,20,0.96) 100%)
              `
              : `
                linear-gradient(90deg, rgba(14,12,20,0.92) 0%, rgba(14,12,20,0.72) 38%, rgba(14,12,20,0.25) 68%, rgba(14,12,20,0.4) 100%),
                linear-gradient(180deg, rgba(14,12,20,0.35) 0%, transparent 40%, rgba(14,12,20,0.55) 100%)
              `,
          }} />
        </div>

        <nav style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile
            ? 'calc(16px + env(safe-area-inset-top, 0)) 16px 0'
            : 'calc(20px + env(safe-area-inset-top, 0)) clamp(24px, 5vw, 48px) 0',
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
        }}>
          <BrandLogo height={isMobile ? 28 : 34} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onLogin && (
              <button
                type="button"
                onClick={onLogin}
                style={{
                  height: 40,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Entrar
              </button>
            )}
            <button
              type="button"
              className="vc-landing-cta"
              onClick={() => {
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
                height: 40,
                padding: '0 20px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--glass-border-strong)',
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(18px) saturate(180%)',
                WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Conhecer o studio
            </button>
          </div>
        </nav>

        <div style={{
          position: 'relative',
          zIndex: 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMobile ? 'center' : 'flex-start',
          justifyContent: isMobile ? 'flex-end' : 'center',
          textAlign: isMobile ? 'center' : 'left',
          gap: isMobile ? 14 : 18,
          width: isMobile ? 'min(100%, 92vw)' : 'min(1280px, 92vw)',
          margin: '0 auto',
          padding: isMobile
            ? '24px 20px calc(28px + env(safe-area-inset-bottom, 0px))'
            : '48px clamp(24px, 5vw, 48px) 72px',
        }}>
          <p className="section-label" style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            fontWeight: 600,
          }}>
            Viral. · Studio editorial com IA
          </p>
          <h1 ref={heroTitleRef} style={{
            margin: 0,
            maxWidth: isMobile ? '16ch' : '22ch',
            fontSize: isMobile ? 'clamp(1.65rem, 6.8vw, 1.95rem)' : 'clamp(2.35rem, 3.4vw, 3.2rem)',
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.12,
            fontFamily: 'var(--font-display)',
          }}>
            Crie carrosséis que{' '}
            <span style={{ color: 'var(--accent)' }}>prendem até o fim,</span>
            {' '}viralizam e constroem autoridade.
          </h1>
          <p style={{
            margin: 0,
            fontSize: isMobile ? 14 : 17,
            lineHeight: 1.5,
            letterSpacing: '-0.011em',
            color: 'var(--text-secondary)',
            maxWidth: isMobile ? '34ch' : '38ch',
          }}>
            Conheça nosso studio que une design, copy e tendências —
            gerados por agentes ultra avançados.
          </p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            justifyContent: isMobile ? 'center' : 'flex-start',
            marginTop: 4,
          }}>
            <button
              type="button"
              className="vc-landing-cta"
              onClick={onEnter}
              style={{
                height: isMobile ? 46 : 50,
                padding: isMobile ? '0 20px' : '0 24px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: isMobile ? 14 : 15,
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
              Criar meu primeiro carrossel
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
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
                height: isMobile ? 46 : 50,
                padding: isMobile ? '0 18px' : '0 22px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--glass-border-strong)',
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(18px) saturate(180%)',
                WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                color: 'var(--text-primary)',
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Ver como funciona
            </button>
          </div>
          <p style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.45,
            color: 'var(--text-muted)',
            maxWidth: '40ch',
          }}>
            Design, copy e tendências no mesmo fluxo — do tema ao arquivo pronto.
          </p>
        </div>
      </header>

      {/* ── SHOWCASE criador + mobile (logo após o hero) ── */}
      <RevealSection
        variant="scale"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '32px 16px 28px' : '48px clamp(24px, 5vw, 48px) 40px',
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
        }}>Da ideia ao feed</p>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: isMobile ? 24 : 32,
          fontWeight: 600,
          letterSpacing: '-0.022em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.12,
        }}>
          Um tema. Uma linha de raciocínio.
          <br />
          Um carrossel inteiro.
        </h2>
        <p style={{
          margin: '0 0 28px',
          fontSize: 17,
          lineHeight: 1.47,
          color: 'var(--text-secondary)',
          maxWidth: '48ch',
        }}>
          Veja a mesma ideia ganhar gancho, ritmo, identidade visual e um fechamento que faz sentido.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr',
          gap: 16,
          alignItems: 'stretch',
        }}>
          <div style={{
            position: 'relative',
            height: isMobile ? 320 : 440,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--hairline)',
          }}>
            <LandingImage
              src={IMG.showcaseWindowPhone}
              alt="Criadora revisando o carrossel publicado no Instagram"
              rounded={0}
              style={{
                border: 'none',
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 20%',
              }}
            />
          </div>
          <div style={{
            position: 'relative',
            height: isMobile ? 320 : 440,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--hairline)',
          }}>
            <LandingImage
              src={IMG.showcasePhoneNike}
              alt="Exemplo de carrossel publicado no feed do Instagram"
              rounded={0}
              style={{
                border: 'none',
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        </div>
      </RevealSection>

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
            }}>O trabalho que ninguém vê</p>
            <blockquote style={{
              margin: '0 0 16px',
              padding: 0,
              border: 'none',
              fontSize: isMobile ? 20 : 26,
              fontWeight: 600,
              letterSpacing: '-0.022em',
              lineHeight: 1.25,
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
            }}>
              O difícil não é fazer slides.
              <br />
              <span style={{ color: 'var(--accent)' }}>É saber o que cada slide precisa dizer.</span>
            </blockquote>
            <p style={{
              margin: '0 0 24px',
              fontSize: 15,
              lineHeight: 1.47,
              color: 'var(--text-secondary)',
            }}>
              Uma boa ideia costuma se perder entre o documento em branco, o prompt genérico
              e horas ajustando detalhes. Quando tudo fica pronto, os slides até parecem bonitos —
              mas não levam o leitor a lugar nenhum.
            </p>
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
          </div>
          <LandingImage
            ref={problemImageRef}
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
          margin: '0 0 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          fontWeight: 600,
        }}>Um studio, não só um editor</p>
        <h2 ref={notEditorTitleRef} style={{
          margin: '0 0 14px',
          fontSize: isMobile ? 24 : 38,
          fontWeight: 600,
          letterSpacing: '-0.028em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.18,
          maxWidth: isMobile ? '22em' : '18ch',
        }}>
          O Viral. não começa pela caixa&nbsp;de&nbsp;texto.
          <br />
          Começa pelo que você quer fazer alguém perceber.
        </h2>
        <p style={{
          margin: '0 0 28px',
          fontSize: isMobile ? 15 : 17,
          lineHeight: 1.55,
          color: 'var(--text-secondary)',
          maxWidth: isMobile ? '100%' : '48ch',
        }}>
          Você traz o tema, uma referência ou um material bruto. O studio organiza a tese,
          constrói o arco e transforma essa direção em um carrossel pronto para ser refinado.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: isMobile ? 10 : 12,
        }}>
          {GENERATION_LAYERS.map(({ n, icon: Icon, title, body }) => (
            <div
              key={title}
              className="vc-landing-gen-layer"
              style={{
                padding: isMobile ? '18px 16px' : '20px 18px',
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
                marginBottom: 12,
              }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--accent-surface)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icon size={17} strokeWidth={2} />
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
                margin: '0 0 6px',
                fontSize: isMobile ? 16 : 17,
                fontWeight: 600,
                letterSpacing: '-0.018em',
              }}>{title}</h3>
              <p style={{
                margin: 0,
                fontSize: isMobile ? 14 : 14,
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
              }}>{body}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* ── OUTCOMES ── */}
      <RevealSection
        variant="rise"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '20px 16px 24px' : '28px clamp(24px, 5vw, 48px) 32px',
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
        }}>O que sai do studio</p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
          gap: 12,
          marginTop: 20,
        }}>
          {OUTCOMES.map(({ title, body }) => (
            <div
              key={title}
              style={{
                padding: '20px 18px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--hairline)',
                background: 'var(--bg-secondary)',
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'var(--accent-surface)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}>
                <Check size={16} strokeWidth={2.5} />
              </div>
              <h3 style={{
                margin: '0 0 8px',
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.016em',
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

      {/* ── CONTRASTE ── */}
      <RevealSection
        variant="rise"
        id="contraste"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '8px 16px 28px' : '12px clamp(24px, 5vw, 48px) 36px',
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
        }}>Existe uma diferença</p>
        <h2 style={{
          margin: '0 0 28px',
          fontSize: isMobile ? 26 : 36,
          fontWeight: 600,
          letterSpacing: '-0.024em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.12,
          maxWidth: '20ch',
        }}>
          Gerar texto é fácil.
          <br />
          Construir uma leitura é outra coisa.
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16,
        }}>
          <div style={{
            padding: isMobile ? 22 : 28,
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--hairline)',
            background: 'var(--bg-secondary)',
          }}>
            <p style={{
              margin: '0 0 20px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>Um prompt solto</p>
            <ul style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}>
              {CONTRAST_WITHOUT.map((line) => (
                <li key={line} style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  fontSize: 15,
                  lineHeight: 1.45,
                  color: 'var(--text-secondary)',
                }}>
                  <X size={16} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 3 }} aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div style={{
            padding: isMobile ? 22 : 28,
            borderRadius: 'var(--radius-xl)',
            border: '1px solid rgba(255, 45, 141, 0.35)',
            background: 'linear-gradient(160deg, rgba(255,45,141,0.1) 0%, rgba(14,12,20,0.4) 100%)',
          }}>
            <p style={{
              margin: '0 0 20px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              fontWeight: 600,
            }}>No Viral.</p>
            <ul style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}>
              {CONTRAST_WITH.map((line) => (
                <li key={line} style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  fontSize: 15,
                  lineHeight: 1.45,
                  color: 'var(--text-primary)',
                }}>
                  <Check size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 3 }} aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="vc-landing-cta"
              onClick={onEnter}
              style={{
                marginTop: 24,
                height: 46,
                padding: '0 22px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 14,
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
              Criar meu primeiro carrossel
              <ArrowRight size={14} />
            </button>
          </div>
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
        }}>Você decide até onde quer ir</p>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: isMobile ? 28 : 40,
          fontWeight: 600,
          letterSpacing: '-0.028em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.1,
        }}>
          Comece rápido.
          <br />
          <span style={{ color: 'var(--accent)' }}>Assuma o controle quando quiser.</span>
        </h2>
        <p style={{
          margin: '0 0 28px',
          fontSize: 17,
          lineHeight: 1.47,
          color: 'var(--text-secondary)',
          maxWidth: '54ch',
        }}>
          Há dias em que você só quer publicar uma boa ideia. Em outros, quer ajustar cada pausa,
          cada imagem e cada palavra. O Viral. acompanha os dois ritmos sem obrigar você a virar designer.
        </p>

        <LandingImage
          ref={modosImageRef}
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
        }}>Do primeiro insight ao último card</p>
        <h2 style={{
          margin: '0 0 28px',
          fontSize: isMobile ? 28 : 36,
          fontWeight: 600,
          letterSpacing: '-0.024em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.12,
        }}>
          Do primeiro insight ao último card
        </h2>
        <div ref={stepsGridRef} style={{
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
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
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
            Quero transformar uma ideia em carrossel
            <ArrowRight size={16} />
          </button>
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
          }}>Tudo no mesmo fluxo</p>
          <h2 style={{
            margin: '0 0 12px',
            fontSize: isMobile ? 24 : 32,
            fontWeight: 600,
            letterSpacing: '-0.022em',
            fontFamily: 'var(--font-display)',
          }}>Menos troca de abas.
          Mais atenção na ideia.</h2>
          <p style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.47,
            color: 'var(--text-secondary)',
            maxWidth: '48ch',
          }}>
            Pesquisa, escrita, direção visual, refinamento e exportação reunidos em um único projeto.
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

      {/* ── PLANOS ── */}
      <RevealSection
        variant="rise"
        id="planos"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '20px 16px 40px' : '28px clamp(24px, 5vw, 48px) 64px',
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
        }}>Um plano. O studio inteiro.</p>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: isMobile ? 26 : 36,
          fontWeight: 600,
          letterSpacing: '-0.024em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.12,
        }}>
          Você paga pelo studio.
          <br />
          A sua produção continua nas suas mãos.
        </h2>
        <p style={{
          margin: '0 0 32px',
          fontSize: 17,
          lineHeight: 1.47,
          color: 'var(--text-secondary)',
          maxWidth: '52ch',
        }}>
          Conecte a sua própria chave de IA e escolha o provedor que prefere.
          Assim, você acompanha o consumo diretamente e não fica preso a pacotes de posts ou créditos escondidos.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.15fr 0.85fr',
          gap: 16,
          alignItems: 'stretch',
        }}>
          <div style={{
            padding: isMobile ? 24 : 32,
            borderRadius: 'var(--radius-xl)',
            border: '1px solid rgba(255, 45, 141, 0.4)',
            background: 'linear-gradient(160deg, rgba(255,45,141,0.12) 0%, rgba(14,12,20,0.5) 55%)',
            boxShadow: 'var(--shadow-pink)',
          }}>
            <div style={{
              display: 'inline-flex',
              padding: '4px 10px',
              borderRadius: 999,
              background: 'var(--accent-surface)',
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: 16,
            }}>
              Plano individual
            </div>
            <h3 style={{
              margin: '0 0 8px',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}>Viral. Studio</h3>
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 8,
            }}>
              <span style={{
                fontSize: isMobile ? 40 : 48,
                fontWeight: 600,
                letterSpacing: '-0.03em',
              }}>R$ 97</span>
              <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>/mês</span>
            </div>
            <p style={{
              margin: '0 0 24px',
              fontSize: 14,
              color: 'var(--text-secondary)',
            }}>
              ou <strong style={{ color: 'var(--text-primary)' }}>R$ 790/ano</strong>
              {' '}— equivalente a cerca de R$ 66/mês
            </p>
            <ul style={{
              margin: '0 0 28px',
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              {PLAN_FEATURES.map((line) => (
                <li key={line} style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  fontSize: 14,
                  lineHeight: 1.4,
                  color: 'var(--text-secondary)',
                }}>
                  <Check size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                  {line}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="vc-landing-cta"
              onClick={onEnter}
              style={{
                width: '100%',
                height: 52,
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontFamily: 'var(--font-ui)',
                boxShadow: 'var(--shadow-pink)',
              }}
            >
              <Sparkles size={18} />
              Entrar no Viral. Studio
              <ArrowRight size={16} />
            </button>
            {onLogin && (
              <button
                type="button"
                onClick={onLogin}
                style={{
                  marginTop: 12,
                  width: '100%',
                  height: 44,
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--glass-border-strong)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                Já assina? Entrar
              </button>
            )}
            <p style={{
              margin: '14px 0 0',
              fontSize: 12,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.03em',
            }}>
              Use sua própria chave de IA · Cancele quando quiser
            </p>
          </div>

          <div style={{
            padding: isMobile ? 22 : 28,
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--hairline)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 16,
          }}>
            <p style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>Por que conectar sua chave?</p>
            <p style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
            }}>
              Em vez de esconder o consumo em pacotes de créditos, o Viral. deixa você
              escolher o provedor, acompanhar os gastos e trocar de modelo quando quiser.
            </p>
            <p style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.45,
              color: 'var(--text-muted)',
            }}>
              Você paga pelo studio. A geração fica na sua conta de IA — com transparência e controle.
            </p>
          </div>
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
        }}>Dúvidas</p>
        <h2 style={{
          margin: '0 0 32px',
          fontSize: isMobile ? 24 : 30,
          fontWeight: 600,
          letterSpacing: '-0.022em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.15,
        }}>
          Antes de assinar
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
        <div ref={ctaSectionRef} style={{
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
            ref={ctaImageRef}
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
          }}>Sua próxima ideia já pode virar post</p>
          <h2 style={{
            margin: '0 0 12px',
            fontSize: isMobile ? 26 : 36,
            fontWeight: 600,
            letterSpacing: '-0.028em',
            fontFamily: 'var(--font-display)',
            lineHeight: 1.12,
          }}>
            Pare de acumular rascunhos.
            <br />
            Publique o que você já tem para dizer.
          </h2>
          <p style={{
            margin: '0 auto 32px',
            maxWidth: '44ch',
            fontSize: 17,
            color: 'var(--text-secondary)',
            lineHeight: 1.47,
          }}>
            Entre no studio, escolha uma direção e transforme seu tema em um carrossel completo.
            O Viral. organiza o caminho. Você decide a versão final.
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
            Studio completo · R$ 97/mês · Sua chave de IA · Sem limite imposto pelo produto
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
          <div style={{ marginBottom: 10 }}>
            <BrandLogo height={isMobile ? 26 : 30} />
          </div>
          <p style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.47,
            color: 'var(--text-muted)',
            maxWidth: '36ch',
          }}>
            Da ideia ao post — com argumento, identidade e direção.
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
            Criar meu primeiro carrossel
          </button>
          <p style={{
            margin: 0,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            © {new Date().getFullYear()} Viral. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
