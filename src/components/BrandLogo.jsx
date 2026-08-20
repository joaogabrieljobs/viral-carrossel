import React from 'react';

const WORDMARK = '/landing/logo-viral-carrossel-studio.png?v=2';
const MARK = '/favicon.png';
const WORDMARK_ASPECT = 953 / 172;

/**
 * Marca Viral Carrossel Studio.
 * - wordmark: logo completa (landing, headers com espaço)
 * - mark: ícone V+avião (chrome compacto / favicon)
 */
export default function BrandLogo({
  variant = 'wordmark',
  height = 28,
  style,
  alt = 'viral carrossel STUDIO',
}) {
  if (variant === 'mark') {
    return (
      <img
        src={MARK}
        alt={alt}
        width={height}
        height={height}
        decoding="async"
        style={{
          display: 'block',
          width: height,
          height,
          borderRadius: Math.max(6, Math.round(height * 0.22)),
          objectFit: 'cover',
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <img
      src={WORDMARK}
      alt={alt}
      width={Math.round(height * WORDMARK_ASPECT)}
      height={height}
      decoding="async"
      style={{
        display: 'block',
        height,
        width: 'auto',
        maxWidth: 'min(100%, 320px)',
        objectFit: 'contain',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
