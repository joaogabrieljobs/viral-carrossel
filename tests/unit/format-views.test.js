import { describe, expect, it } from 'vitest';
import { FORMATS } from '../../src/utils/formats.js';
import { logoBoxPx } from '../../src/utils/slide-logo.js';
import { surfaceForReadableText, switchDocFormat } from '../../src/utils/format-views.js';

const doc = {
  fmt: 'carrossel',
  creativePreset: 'livre',
  productKind: 'carrossel',
  brand: {
    bg: '#f4efe8',
    titleColor: '#f7f4ef',
    logoSize: 260,
    name: 'Janine',
  },
  slides: [{
    id: 's1',
    title: 'Colágeno no centro do planejamento facial',
    subtitle: 'BIOESTIMULADOR FACIAL',
    titleSize: 100,
    layout: 'tl',
    bgImage: 'data:image/png,foto',
    overlays: [{ id: 'cta', type: 'cta', x: 22, y: 78, text: 'Agende sua avaliação' }],
  }],
};

describe('cada proporção guarda o próprio ajuste', () => {
  it('escolhe fundo escuro quando o texto da marca é claro', () => {
    expect(surfaceForReadableText('#f7f7f5', '#f7f4ef')).toBe('#161616');
    expect(surfaceForReadableText('#f7f7f5', '#1a1a1a')).toBe('#f7f7f5');
  });

  it('a apresentação não reescreve o carrossel', () => {
    const presentation = switchDocFormat(doc, 'apresentacao');
    expect(presentation.fmt).toBe('apresentacao');
    expect(presentation.brand.bg).toBe('#161616');
    expect(presentation.brand.titleColor).toBe('#f7f4ef');
    expect(presentation.brand.name).toBe('Janine');
    expect(presentation.slides[0].title).toBe(doc.slides[0].title);
    expect(presentation.slides[0].bgImage).toBe('data:image/png,foto');
    expect(presentation.slides[0].canvas?.zones?.title).toBeTruthy();

    presentation.slides[0].titleSize = 64;
    presentation.slides[0].title = 'Título editado na apresentação';

    const back = switchDocFormat(presentation, 'carrossel');
    expect(back.fmt).toBe('carrossel');
    expect(back.brand.bg).toBe('#f4efe8');
    expect(back.creativePreset).toBe('livre');
    expect(back.slides[0].titleSize).toBe(100);
    expect(back.slides[0].layout).toBe('tl');
    expect(back.slides[0].title).toBe('Título editado na apresentação');
    expect(back.slides[0].canvas).toBeUndefined();

    const again = switchDocFormat(back, 'apresentacao');
    expect(again.brand.bg).toBe('#161616');
    expect(again.slides[0].titleSize).toBe(64);
    expect(again.slides[0].title).toBe('Título editado na apresentação');
  });

  it('o quadrado não altera o tamanho salvo no feed', () => {
    const square = switchDocFormat(doc, 'quadrado');
    expect(square.slides[0].titleSize).toBeLessThan(100);
    const feed = switchDocFormat(square, 'carrossel');
    expect(feed.slides[0].titleSize).toBe(100);
    expect(feed.brand.bg).toBe('#f4efe8');
  });
});

describe('logo na apresentação', () => {
  it('fica pequena no 16:9 e no tamanho do feed no 4:5', () => {
    expect(logoBoxPx(FORMATS.apresentacao, 260)).toBeLessThan(110);
    expect(logoBoxPx(FORMATS.carrossel, 260)).toBe(260);
  });
});
