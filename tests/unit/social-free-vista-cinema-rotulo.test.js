// Defeito visto na captura da vista Feed de um projeto Stories: com Cinema
// só no card 6, "CENA 06" ficava colado ao título. A composição usava a marca
// do estilo (sem selo), mas o card desenha o selo APOTEOSE da marca do
// projeto; o renderer subia o texto acima do selo e o rótulo ficava parado.
import { describe, expect, it } from 'vitest';
import { apoteoseBrand, apoteoseLivre, fixture, pct } from '../helpers/apoteose-livre.js';
import { FORMATS } from '../../src/utils/formats.js';
import { applyVisualPresetToCard } from '../../src/utils/visual-scope.js';
import { brandForFormatDisplay, slideForFormatDisplay } from '../../src/utils/format-view.js';
import { footerChromeReservePx, textZonesAboveFooter } from '../../src/utils/card-chrome.js';
import { sanitizeCustomVisualPresetBrand } from '../../src/utils/custom-visual-presets.js';
import { VISUAL_PRESETS } from '../../src/styles/visual-presets.jsx';

describe('Vista Feed de projeto Stories com Cinema em um card: rótulo da cena separado do título (card 6)', () => {
  it('o rótulo termina antes do título no lugar em que o renderer o desenha, com o selo da marca', () => {
    const doc = { fmt: 'carrossel', productKind: 'carrossel', creativePreset: 'livre', visualPreset: 'social_free',
      brand: { ...apoteoseBrand }, slides: apoteoseLivre('stories'), formatViews: {}, quickNarrativeMode: fixture.narrative };
    const cinema = VISUAL_PRESETS.find(item => item.id === 'social_cinema');
    const next = applyVisualPresetToCard(doc, 5, cinema, VISUAL_PRESETS);
    const slide = slideForFormatDisplay(next.slides[5], 'carrossel', next.formatViews, next.creativePreset);
    expect(slide.visualPresetId).toBe('social_cinema');
    const shownBrand = { ...brandForFormatDisplay(next.brand, 'carrossel', next.formatViews, next.creativePreset), ...sanitizeCustomVisualPresetBrand(slide.visualBrand) };
    const f = FORMATS.carrossel;
    const reserve = footerChromeReservePx(shownBrand, f);
    expect(reserve, 'o selo APOTEOSE continua desenhado neste card').toBeGreaterThan(0);
    const { title } = textZonesAboveFooter({ title: slide.canvas.zones.title, subtitle: slide.canvas.zones.subtitle }, 100 - reserve / f.h * 100);
    const label = slide.socialArt.chrome.find(d => d.t === 'text' && /CENA/.test(d.text));
    expect(label).toBeDefined();
    const labelBottom = label.y + pct(label.size * 1.3, 'carrossel');
    expect(labelBottom + pct(8, 'carrossel'), `rótulo em ${label.y}% × título desenhado em ${title.y.toFixed(2)}%`).toBeLessThanOrEqual(title.y + 0.01);
  });
});
