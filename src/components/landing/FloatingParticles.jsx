import { useLayoutEffect, useRef } from 'react';
import { gsap } from '../../hooks/gsapSetup.js';

/**
 * Versão leve do campo de "partículas" flutuantes do hero da
 * wolverineworldwide.com — lá é uma grade de dezenas de imagens em espaço 3D
 * (perspective + translate3d) controlada por scroll/mouse via JS. Aqui é uma
 * meia dúzia de thumbnails reais do produto, cada uma com um drift próprio
 * (sobe/desce + leve rotação, infinito e assíncrono via `delay`), sem depender
 * de scroll — decorativo, atrás do stage principal do hero.
 *
 * Some em mobile (isMobile) por decisão de espaço/performance, igual ao resto
 * dos elementos flutuantes do hero (HeroSlideCard também só aparece desktop).
 */
const SLOTS = [
  { top: '2%',  left: '4%',  size: 44, rot: -8 },
  { top: '70%', left: '-2%', size: 36, rot: 10 },
  { top: '6%',  left: '90%', size: 40, rot: 6 },
  { top: '80%', left: '86%', size: 48, rot: -6 },
  { top: '34%', left: '96%', size: 32, rot: 12 },
  { top: '88%', left: '44%', size: 30, rot: -10 },
];

export default function FloatingParticles({ images, isMobile }) {
  const containerRef = useRef(null);

  useLayoutEffect(() => {
    if (isMobile) return undefined;
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const tweens = Array.from(container.children).map((el, i) => gsap.to(el, {
      y: 14 + (i % 3) * 6,
      rotation: `+=${i % 2 === 0 ? 4 : -4}`,
      duration: 4 + (i % 4),
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: i * 0.3,
    }));

    return () => tweens.forEach((t) => t.kill());
  }, [isMobile]);

  if (isMobile || !images?.length) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: '-10% -6%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {SLOTS.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            borderRadius: 10,
            overflow: 'hidden',
            opacity: 0.5,
            transform: `rotate(${p.rot}deg)`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          <img
            src={images[i % images.length]}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ))}
    </div>
  );
}
