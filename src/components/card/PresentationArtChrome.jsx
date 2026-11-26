import React from 'react';
import { chromeElements, chromeTokensForSlide } from '../../utils/presentation-chrome.js';
import { ContentLabelLanguageContext } from '../../utils/content-label-language.js';
import { deckArtLayer } from '../../utils/deck-art.js';

/**
 * Linguagem gráfica da família (fios, numerais, grade, blocos de cor, marcas
 * de corte, fita). Dispositivos de alinhamento e ritmo, não conteúdo gerado:
 * os únicos textos são numeração e tokens que já existem no slide.
 * Compartilhado entre preview e exportação.
 */
export default function PresentationArtChrome({ slide, frame, accent, ink, index = 0, total = 1, paletteOverrides = {} }) {
  const lang = React.useContext(ContentLabelLanguageContext);
  if (slide.presentationArtDirectionVersion === 2 && slide.presentationChrome?.chrome) {
    const { family, format, ground, chrome, fonts } = slide.presentationChrome;
    const elements = chromeElements({ family, format, ground, chrome, fonts }, {
      frame, tokens: chromeTokensForSlide(slide, { index, total }), overrides: paletteOverrides, lang,
    });
    // Arte de fundo do deck (modo livre, parte 4): a imagem cobre a página e a
    // proteção na cor base fica do lado do texto. Sem imagem, a cor base.
    const art = deckArtLayer(slide);
    return <div aria-hidden="true" data-vc-presentation-art={family}>
      {art && <div data-vc-deck-art="1" style={{
        position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0,
        backgroundImage: `url(${art.image})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
      }} />}
      {art && <div data-vc-deck-art-scrim="1" style={{
        position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, background: art.gradient,
      }} />}
      {elements.map((item) => <div key={item.key} data-vc-art-device={item.key} style={{
        position: 'absolute', pointerEvents: 'none', boxSizing: 'border-box', zIndex: item.z, ...item.style,
      }}>{item.text}</div>)}
    </div>;
  }
  if (slide.presentationArtDirectionVersion !== 1) return null;
  // Projetos salvos na versão 1 continuam com os fios discretos de antes.
  const family = slide.presentationDesignFamily;
  const base = { position: 'absolute', pointerEvents: 'none', zIndex: 1, boxSizing: 'border-box' };
  const line = (style, color = ink) => <div style={{ ...base, background: color, ...style }} />;
  return <div aria-hidden="true" data-vc-presentation-art={family}>
    {family === 'editorial' && line({ left: '6%', top: '10%', width: '88%', height: frame.w / 1920 })}
    {family === 'swiss' && line({ left: '2.5%', top: '13%', width: '0.6%', height: '75%' }, accent)}
    {family === 'technical' && <div style={{ ...base, left: '3%', top: '8%', width: '94%', height: '85%', border: `${frame.w / 1920}px solid rgba(127,127,127,0.3)` }} />}
    {family === 'data' && line({ left: '6%', top: '10%', width: '12%', height: frame.w * 0.002 }, accent)}
    {family === 'premium' && line({ left: '8%', top: '94%', width: '12%', height: frame.w / 1920 }, accent)}
    {family === 'modular' && slide.canvas?.zones?.subtitle && <div style={{ ...base,
      left: `${slide.canvas.zones.subtitle.x - 1}%`, top: `${slide.canvas.zones.subtitle.y - 1}%`,
      width: `${slide.canvas.zones.subtitle.w + 2}%`, height: `${slide.canvas.zones.subtitle.h + 2}%`,
      borderRadius: frame.w * 0.012, background: 'rgba(127,127,127,0.045)',
    }} />}
  </div>;
}
