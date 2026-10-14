import React from 'react';

// Optical bounds include the mark and natural-width wordmark, with a small
// antialiasing guard. The letters must never be squeezed to fit a fixed width.
const WORDMARK_VIEWBOX = '2 5 272 55';
const WORDMARK_ASPECT = 272 / 55;

const ORBIT_BLUE = 'var(--moont-sequence, var(--moont-orbit, #5B53E8))';
const AURORA = 'var(--moont-aurora, #D7FF5A)';
const PRIMARY = 'var(--moont-mark-primary, currentColor)';

/**
 * The Sequence mark: three frames moving forward through a visual narrative.
 * Keeping the first tile in `currentColor` gives the mark a dark tile on light
 * surfaces and a moonlight tile on dark surfaces without maintaining two SVGs.
 */
function SequenceMark() {
  return (
    <g>
      <rect x="4" y="7" width="29" height="29" rx="6" fill={PRIMARY} />
      <rect x="18" y="18" width="29" height="29" rx="6" fill={ORBIT_BLUE} />
      <rect x="32" y="29" width="29" height="29" rx="6" fill={AURORA} />
    </g>
  );
}

/**
 * Deterministic vector outlines for the lowercase Moont wordmark. The glyphs
 * are based on Manrope ExtraBold (OFL) and do not depend on locally installed
 * fonts, so the signature exports identically in every browser and device.
 * Original outlines: weight 800, 64-unit em, uniform 0.032 scale, tracking -2.
 * Equal X/Y scaling preserves circular counters and consistent stem weight.
 */
function MoontWordmark() {
  return (
    <g fill="currentColor">
      <path d="M120.08 54V33.584Q120.08 30.16 118.464 28.256Q116.848 26.352 114 26.352Q112.176 26.352 110.832 27.2Q109.488 28.048 108.736 29.568Q107.984 31.088 107.984 33.072L104.336 30.64Q104.336 27.088 106.016 24.368Q107.696 21.648 110.528 20.128Q113.36 18.608 116.816 18.608Q122.736 18.608 125.76 22.112Q128.784 25.616 128.784 31.28V54ZM78.416 54V19.44H86.096V30.896H87.184V54ZM99.28 54V33.584Q99.28 30.16 97.664 28.256Q96.048 26.352 93.2 26.352Q90.48 26.352 88.832 28.224Q87.184 30.096 87.184 33.072L83.536 30.512Q83.536 27.12 85.232 24.432Q86.928 21.744 89.792 20.176Q92.656 18.608 96.208 18.608Q100.272 18.608 102.88 20.336Q105.488 22.064 106.736 24.944Q107.984 27.824 107.984 31.28V54Z" />
      <path d="M150.656 54.96Q145.44 54.96 141.504 52.624Q137.568 50.288 135.376 46.176Q133.184 42.064 133.184 36.72Q133.184 31.312 135.424 27.2Q137.664 23.088 141.6 20.784Q145.536 18.48 150.656 18.48Q155.872 18.48 159.824 20.816Q163.776 23.152 165.984 27.264Q168.192 31.376 168.192 36.72Q168.192 42.096 165.968 46.208Q163.744 50.32 159.792 52.64Q155.84 54.96 150.656 54.96ZM150.656 46.832Q154.848 46.832 156.912 44Q158.976 41.168 158.976 36.72Q158.976 32.112 156.88 29.36Q154.784 26.608 150.656 26.608Q147.808 26.608 145.984 27.888Q144.16 29.168 143.28 31.44Q142.4 33.712 142.4 36.72Q142.4 41.36 144.496 44.096Q146.592 46.832 150.656 46.832Z" />
      <path d="M188.784 54.96Q183.568 54.96 179.632 52.624Q175.696 50.288 173.504 46.176Q171.312 42.064 171.312 36.72Q171.312 31.312 173.552 27.2Q175.792 23.088 179.728 20.784Q183.664 18.48 188.784 18.48Q194 18.48 197.952 20.816Q201.904 23.152 204.112 27.264Q206.32 31.376 206.32 36.72Q206.32 42.096 204.096 46.208Q201.872 50.32 197.92 52.64Q193.968 54.96 188.784 54.96ZM188.784 46.832Q192.976 46.832 195.04 44Q197.104 41.168 197.104 36.72Q197.104 32.112 195.008 29.36Q192.912 26.608 188.784 26.608Q185.936 26.608 184.112 27.888Q182.288 29.168 181.408 31.44Q180.528 33.712 180.528 36.72Q180.528 41.36 182.624 44.096Q184.72 46.832 188.784 46.832Z" />
      <path d="M234.912 54V37.68Q234.912 36.496 234.784 34.656Q234.656 32.816 233.984 30.96Q233.312 29.104 231.792 27.856Q230.272 26.608 227.488 26.608Q226.368 26.608 225.088 26.96Q223.808 27.312 222.688 28.32Q221.568 29.328 220.848 31.28Q220.128 33.232 220.128 36.464L215.136 34.096Q215.136 30 216.8 26.416Q218.464 22.832 221.808 20.624Q225.152 18.416 230.24 18.416Q234.304 18.416 236.864 19.792Q239.424 21.168 240.848 23.28Q242.272 25.392 242.88 27.68Q243.488 29.968 243.616 31.856Q243.744 33.744 243.744 34.608V54ZM211.296 54V19.44H219.04V30.896H220.128V54Z" />
      <path d="M270.8 54Q267.216 54.672 263.776 54.592Q260.336 54.512 257.632 53.376Q254.928 52.24 253.52 49.712Q252.24 47.344 252.176 44.896Q252.112 42.448 252.112 39.344V9.84H260.816V38.832Q260.816 40.848 260.864 42.464Q260.912 44.08 261.52 45.04Q262.672 46.864 265.2 47.024Q267.728 47.184 270.8 46.768ZM246.224 26.16V19.44H270.8V26.16Z" />
    </g>
  );
}

/**
 * Moont brand lockup.
 *
 * Public API:
 * - wordmark: full Moont signature for landing pages and roomy headers
 * - mark: compact Sequence symbol for dense navigation and favicons
 *
 * `compact` and `symbol` are aliases for `mark`. Passing alt="" makes the
 * logo decorative; otherwise the inline SVG exposes one accessible image name.
 */
export default function BrandLogo({
  variant = 'wordmark',
  height = 28,
  style,
  alt = 'Moont',
  className = undefined,
  ...props
}) {
  const isMark = variant === 'mark' || variant === 'compact' || variant === 'symbol';
  const decorative = alt === '';
  const accessibility = decorative
    ? { 'aria-hidden': true }
    : { role: 'img', 'aria-label': alt };
  const sharedStyle = {
    display: 'block',
    height,
    color: 'var(--moont-wordmark, var(--text-primary, #F3F0E7))',
    flexShrink: 0,
    overflow: 'visible',
  };

  if (isMark) {
    return (
      <svg
        {...props}
        {...accessibility}
        className={className}
        viewBox="0 0 64 64"
        width={height}
        height={height}
        focusable="false"
        style={{ ...sharedStyle, width: height, ...style }}
      >
        <SequenceMark />
      </svg>
    );
  }

  return (
    <svg
      {...props}
      {...accessibility}
      className={className}
      viewBox={WORDMARK_VIEWBOX}
      width={height * WORDMARK_ASPECT}
      height={height}
      focusable="false"
      preserveAspectRatio="xMinYMid meet"
      shapeRendering="geometricPrecision"
      style={{
        ...sharedStyle,
        width: 'auto',
        maxWidth: 'min(100%, 320px)',
        ...style,
      }}
    >
      <SequenceMark />
      <MoontWordmark />
    </svg>
  );
}
