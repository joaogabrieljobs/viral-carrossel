import React from 'react';

const WORDMARK_ASPECT = 240 / 64;

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
        <g fill="none" strokeWidth="5" strokeLinecap="round">
          <ellipse
            cx="21"
            cy="32"
            rx="17"
            ry="13.5"
            stroke={ORBIT_BLUE}
            transform="rotate(-12 21 32)"
          />
          <ellipse
            cx="43"
            cy="32"
            rx="17"
            ry="13.5"
            stroke={AURORA}
            transform="rotate(12 43 32)"
          />
        </g>
      </svg>
    );
  }

  return (
    <svg
      {...accessibility}
      viewBox="0 0 240 64"
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
      <g fill="none" strokeWidth="4.5" strokeLinecap="round">
        <ellipse
          cx="21"
          cy="32"
          rx="17"
          ry="13.5"
          stroke={ORBIT_BLUE}
          transform="rotate(-12 21 32)"
        />
        <ellipse
          cx="43"
          cy="32"
          rx="17"
          ry="13.5"
          stroke={AURORA}
          transform="rotate(12 43 32)"
        />
      </g>

      <text
        x="74"
        y="48.5"
        fill="currentColor"
        fontFamily="var(--font-display, -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif)"
        fontSize="48"
        fontWeight="720"
        letterSpacing="-2.6"
      >
        moont
      </text>
    </svg>
  );
}
