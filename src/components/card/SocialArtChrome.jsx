import React from 'react';
import { socialChromeElements, socialChromeTokens } from '../../utils/social-chrome.js';

/**
 * Linguagem gráfica das famílias de carrossel (fios, numeração, grade,
 * blocos, molduras, letterbox). Mesmo componente no editor e na exportação.
 * Só desenha quando o card foi composto pela biblioteca v4 (`socialArt`).
 */
export default function SocialArtChrome({ slide, brand, frame, titleFont, bodyFont, index = 0, total = 1 }) {
  const art = slide?.socialArt;
  if (!art || slide.socialCompositionVersion < 4) return null;
  const elements = socialChromeElements(art, {
    frame, brand,
    tokens: socialChromeTokens(brand, { index, total }),
    fonts: { title: titleFont, body: bodyFont, label: art.labelFont || bodyFont },
  });
  if (!elements.length) return null;
  return <div aria-hidden="true" data-vc-social-art={art.family} data-vc-social-function={art.fn}>
    {elements.map((item) => <div key={item.key} data-vc-art-device={item.key} style={{
      position: 'absolute', pointerEvents: 'none', boxSizing: 'border-box', zIndex: item.z, ...item.style,
    }}>{item.text}</div>)}
  </div>;
}
