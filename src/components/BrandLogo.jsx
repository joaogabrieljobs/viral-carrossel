import React from 'react';

const WORDMARK_ASPECT = 216 / 64;

const ORBIT_BLUE = 'var(--moont-orbit, #5B53E8)';
const AURORA = 'var(--moont-aurora, #D7FF5A)';

/**
 * Moont brand lockup.
 *
 * Public API remains compatible with the former image logo:
 * - wordmark: full Moont signature for landing pages and roomy headers
 * - mark: compact double-orbit symbol for dense navigation and favicons
 *
 * `compact` and `symbol` are accepted aliases for `mark`. Passing alt=""
 * makes the logo decorative; otherwise the inline SVG exposes one image name.
 */
export default function BrandLogo({
  variant = 'wordmark',
  height = 28,
  style,
  alt = 'Moont',
}) {
  const isMark = variant === 'mark' || variant === 'compact' || variant === 'symbol';
  const decorative = alt === '';
  const accessibility = decorative
    ? { 'aria-hidden': true }
    : { role: 'img', 'aria-label': alt };

  if (isMark) {
    return (
      <svg
        {...accessibility}
        viewBox="0 0 64 64"
        width={height}
        height={height}
        focusable="false"
        style={{
          display: 'block',
          width: height,
          height,
          flexShrink: 0,
          overflow: 'visible',
          ...style,
        }}
      >
        <g fill="none" strokeWidth="5.5" strokeLinecap="round">
          <rect
            x="5.5"
            y="14.5"
            width="31"
            height="35"
            rx="15.5"
            stroke={ORBIT_BLUE}
            transform="rotate(-8 21 32)"
          />
          <rect
            x="27.5"
            y="14.5"
            width="31"
            height="35"
            rx="15.5"
            stroke={AURORA}
            transform="rotate(8 43 32)"
          />
        </g>
        <circle cx="8.9" cy="23.6" r="3.25" fill={ORBIT_BLUE} />
        <circle cx="55.1" cy="40.4" r="3.25" fill={AURORA} />
      </svg>
    );
  }

  return (
    <svg
      {...accessibility}
      viewBox="0 0 216 64"
      width={Math.round(height * WORDMARK_ASPECT)}
      height={height}
      focusable="false"
      preserveAspectRatio="xMinYMid meet"
      style={{
        display: 'block',
        height,
        width: 'auto',
        maxWidth: 'min(100%, 320px)',
        color: 'var(--moont-wordmark, var(--text-primary, #F3F0E7))',
        flexShrink: 0,
        overflow: 'visible',
        ...style,
      }}
    >
      <text
        x="1"
        y="49"
        fill="currentColor"
        fontFamily="var(--font-display, -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif)"
        fontSize="51"
        fontWeight="760"
        letterSpacing="-2.2"
      >
        m
      </text>

      <g fill="none" stroke="currentColor" strokeWidth="8.5" strokeLinecap="round" opacity="0.92">
        <rect
          x="58"
          y="12.5"
          width="38"
          height="42"
          rx="19"
          transform="rotate(-7 77 33.5)"
        />
        <rect
          x="93"
          y="12.5"
          width="38"
          height="42"
          rx="19"
          transform="rotate(7 112 33.5)"
        />
      </g>

      <g fill="none" strokeWidth="4.5" strokeLinecap="round">
        <rect
          x="58"
          y="12.5"
          width="38"
          height="42"
          rx="19"
          stroke={ORBIT_BLUE}
          transform="rotate(-7 77 33.5)"
        />
        <rect
          x="93"
          y="12.5"
          width="38"
          height="42"
          rx="19"
          stroke={AURORA}
          transform="rotate(7 112 33.5)"
        />
      </g>
      <circle cx="61.9" cy="23" r="3.25" fill={ORBIT_BLUE} />
      <circle cx="127.1" cy="44" r="3.25" fill={AURORA} />

      <text
        x="138"
        y="49"
        fill="currentColor"
        fontFamily="var(--font-display, -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif)"
        fontSize="51"
        fontWeight="760"
        letterSpacing="-2.2"
      >
        nt
      </text>
    </svg>
  );
}
