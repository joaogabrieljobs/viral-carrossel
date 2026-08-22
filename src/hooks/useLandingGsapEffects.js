import { useLayoutEffect } from 'react';
import { gsap, ScrollTrigger, SplitText } from './gsapSetup.js';

/**
 * Efeitos GSAP da landing (OnboardingLanding.jsx) — inspirados na arquitetura
 * de scroll-driven animation da wolverineworldwide.com (GSAP + ScrollTrigger +
 * SplitText), recriados aqui com refs do React em vez de data-attributes +
 * Locomotive Scroll:
 *
 *  1. Reveal de texto — títulos entram de baixo de uma máscara (SplitText
 *     `type: 'lines'` + `mask: 'lines'`), com stagger entre linhas. Só roda
 *     depois de `document.fonts.ready` — SplitText mede a largura de cada
 *     linha pra montar a máscara, e se isso acontece com a fonte de fallback
 *     (antes da fonte real carregar), a linha "trava" numa largura errada e
 *     o texto acaba cortado quando a fonte de verdade entra.
 *  2. Parallax em camadas — cada elemento em `parallaxLayers` se desloca em
 *     velocidade própria conforme atravessa a viewport (ScrollTrigger scrub,
 *     deslocamento SEMPRE relativo à própria seção — nunca ao scroll
 *     absoluto da página, que cresce sem limite e criava buracos de layout).
 *  3. Header fixo com transição suave — some no topo do hero, aparece com
 *     tween (não troca abrupta de classe) assim que o hero sai de vista.
 *  4. Ken Burns no fundo do hero — zoom lento e contínuo (infinito, yoyo) na
 *     imagem de fundo cinematográfica, no lugar do vídeo do site de referência.
 *
 * Todos os refs recebidos são estáveis (useRef nunca muda de identidade), e
 * `isMobile` é primitivo — por isso é seguro usar como dependency array sem
 * disparar o effect de novo a cada re-render por scroll (o próprio
 * OnboardingLanding re-renderiza a cada scroll por causa do parallax legado
 * do hero, então isso importa).
 *
 * Respeita `prefers-reduced-motion`: se o usuário pediu menos movimento, os
 * elementos ficam estáticos e visíveis, sem nenhum ScrollTrigger criado.
 */
export function useLandingGsapEffects({
  splitRefs = [],
  parallaxLayers = [],
  ctaSectionRef,
  ctaImageRef,
  heroSectionRef,
  heroBgRef,
  stickyHeaderRef,
  isMobile,
} = {}) {
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;

    // A landing roda tanto standalone (scroll na window) quanto embutida no
    // shell do app (scroll dentro de um div `.vc-landing-shell`) — mesma
    // detecção usada pelo listener de scroll legado do hero, aplicada aqui
    // ao ScrollTrigger via `scroller`.
    const scroller = document.querySelector('.vc-landing-shell') || window;

    let cancelled = false;
    const splits = [];
    let ctx;

    const setup = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        // 1) Reveal de texto — cada heading vira linhas mascaradas.
        splitRefs.forEach((ref) => {
          const el = ref?.current;
          if (!el) return;
          const split = SplitText.create(el, {
            type: 'lines',
            mask: 'lines',
            linesClass: 'vc-split-line',
          });
          splits.push(split);
          gsap.set(split.lines, { yPercent: 110, opacity: 0 });
          gsap.to(split.lines, {
            yPercent: 0,
            opacity: 1,
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.08,
            scrollTrigger: {
              scroller,
              trigger: el,
              start: 'top 88%',
              once: true,
            },
          });
        });

        // 2) Parallax em camadas — hero bg, preview do produto, imagens de
        // seção etc. Cada camada desloca um total de `speed * 160px` (metade
        // pra cima, metade pra baixo) enquanto atravessa a viewport — sempre
        // um deslocamento LIMITADO e relativo à própria seção, nunca ligado
        // ao scroll absoluto da página (isso é o que causava buraco de
        // layout na versão anterior).
        parallaxLayers.forEach(({ ref, speed = 0.2 } = {}) => {
          const el = ref?.current;
          if (!el) return;
          const distance = 80 * speed;
          gsap.fromTo(
            el,
            { y: -distance },
            {
              y: distance,
              ease: 'none',
              scrollTrigger: {
                scroller,
                trigger: el,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.5,
              },
            },
          );
        });

        // 3) Parallax — imagem de fundo da seção CTA final (zoom-out + leve
        // translateY, igual ao efeito da seção final do site de referência).
        if (ctaSectionRef?.current && ctaImageRef?.current) {
          gsap.fromTo(
            ctaImageRef.current,
            { scale: 1.18, yPercent: -8 },
            {
              scale: 1,
              yPercent: 8,
              ease: 'none',
              scrollTrigger: {
                scroller,
                trigger: ctaSectionRef.current,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.6,
              },
            },
          );
        }

        // 4) Header fixo — aparece com tween suave depois que o hero sai de vista.
        if (stickyHeaderRef?.current && heroSectionRef?.current) {
          const headerEl = stickyHeaderRef.current;
          gsap.set(headerEl, { yPercent: -100, autoAlpha: 0 });
          ScrollTrigger.create({
            scroller,
            trigger: heroSectionRef.current,
            start: 'bottom top',
            onEnter: () => gsap.to(headerEl, { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: 'power2.out' }),
            onLeaveBack: () => gsap.to(headerEl, { yPercent: -100, autoAlpha: 0, duration: 0.35, ease: 'power2.in' }),
          });
        }

        // 5) Ken Burns — zoom lento e contínuo no fundo do hero (substitui o
        // vídeo do site de referência, que não temos aqui).
        if (heroBgRef?.current) {
          gsap.fromTo(
            heroBgRef.current,
            { scale: 1.04 },
            { scale: 1.12, duration: 16, ease: 'sine.inOut', repeat: -1, yoyo: true },
          );
        }

        ScrollTrigger.refresh();
      });
    };

    // Espera as fontes carregarem antes de rodar o SplitText — senão ele mede
    // a linha com a fonte de fallback e o texto real (mais largo) estoura a
    // máscara depois. `document.fonts.ready` não existe em navegadores muito
    // antigos; nesse caso cai direto pro setup (comportamento antigo).
    if (document.fonts?.ready) {
      document.fonts.ready.then(setup);
    } else {
      setup();
    }

    // Recalcula tudo se a janela for redimensionada de forma relevante — o
    // split de linhas depende da largura do container (quebra de linha muda).
    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        splits.forEach((s) => s.revert());
        splits.length = 0;
        ctx?.revert();
        setup();
      }, 200);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      splits.forEach((s) => s.revert());
      ctx?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctaSectionRef, ctaImageRef, heroSectionRef, heroBgRef, stickyHeaderRef, isMobile]);
}
