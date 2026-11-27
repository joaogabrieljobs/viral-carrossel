import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAMILY_KEYS, familyFont, familySpec } from '../../src/utils/presentation-families.js';
import { familyCarouselAdaptation, presentationForSocialFormat } from '../../src/utils/presentation-format.js';
import { slideForFormatDisplay } from '../../src/utils/format-view.js';
import { freeTextLines } from '../../src/utils/free-design.js';
import { FORMATS } from '../../src/utils/formats.js';

// Apoteose 9 (27/11, iPhone): na troca 16:9 → 9:16 o apoio dos slides 6 e 7
// virava uma linha de ~6 px. Piso de leitura dos formatos sociais: 28 px a 1080.
const READING_FLOOR = 28;
const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/apoteose-teste8.json', import.meta.url)));
const livre = fixture.doc.slides;
const apoteose9 = [
  { title: 'Para quem é a Apoteose', eyebrow: 'O PÚBLICO',
    subtitle: 'Pessoas socialmente ativas, **formadoras de opinião**, conectadas a tendências de moda, cultura e entretenimento. O acesso exclusivo por convite privilegia a **curadoria de público** e fortalece o caráter social da festa.' },
  { title: 'O **esquenta** de Carnaval de São Paulo', eyebrow: 'O POSICIONAMENTO',
    subtitle: 'A Apoteose pretende se consolidar como o **esquenta** mais badalado da cidade, uma festa com **identidade própria** que gera desejo e expectativa antes mesmo de acontecer.' },
];

/** Altura (px) que o apoio + corpo pedem na zona, no menor tamanho permitido. */
function readingNeed(adapted, fmt) {
  const { w, h } = FORMATS[fmt];
  const zone = adapted.canvas.zones.subtitle;
  const width = zone.w / 100 * w * 0.96 - 24;
  const font = familyFont(adapted.presentationDesignFamily, 'text').family;
  const leading = familySpec(adapted.presentationDesignFamily).type.bodyLeading;
  const subPx = w * 0.028 * adapted.subSize / 100;
  const bodyPx = w * 0.018 * adapted.bodyAfterSize / 100;
  const body = String(adapted.bodyAfterImage || '').trim();
  const scale = Math.min(1, READING_FLOOR / Math.min(subPx, body ? bodyPx : Infinity));
  const lines = (text, px) => freeTextLines(text, width, px * scale, font, 'text');
  // Margem do corpo no renderer: 1,8% da altura; respiro da zona: 0,6% + 0,6%.
  const need = lines(adapted.subtitle, subPx) * subPx * scale * leading
    + (body ? h * 0.018 + lines(body, bodyPx) * bodyPx * scale * leading : 0);
  return { need, available: zone.h / 100 * h - h * 0.012, subPx, bodyPx };
}

const overlaps = (a, b) => a && b && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5
  && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;

const cases = [];
for (const fmt of ['stories', 'carrossel', 'quadrado']) {
  for (const family of FAMILY_KEYS) {
    for (const kind of ['cover', 'content', 'data', 'demo', 'closing']) {
      for (const photo of [true, false]) {
        // Os dois textos das capturas e os três apoios mais longos do deck real.
        const samples = [...apoteose9, ...[...livre].sort((a, b) => (b.subtitle + b.bodyAfterImage).length - (a.subtitle + a.bodyAfterImage).length)
          .slice(0, 3).map(s => ({ title: s.title, subtitle: s.subtitle, bodyAfterImage: s.bodyAfterImage }))];
        for (const [index, text] of samples.entries()) {
          cases.push({ fmt, family, kind, photo, index, text });
        }
      }
    }
  }
}

const adaptedCache = new Map();
function adaptedFor(item) {
  if (!adaptedCache.has(item)) adaptedCache.set(item, adapt(item));
  return adaptedCache.get(item);
}

function adapt({ fmt, family, kind, photo, index, text }) {
  const base = livre[index % livre.length];
  const slide = { ...base, ...text, presentationDesignFamily: family, presentationComposition: kind, presentationBlocks: [],
    presentationFreeDesign: { ...base.presentationFreeDesign, family }, bgImageId: null, presentationArtImageId: null,
    bgImage: photo ? 'data:image/png;base64,PHOTO' : null, presentationSuppressPhoto: !photo };
  return { slide, adapted: familyCarouselAdaptation(slide, fmt) };
}

describe('Apresentação Livre em Feed, Quadrado e Stories: piso de leitura', { timeout: 60_000 }, () => {
  it('a zona de apoio comporta o texto inteiro sem descer de 28 px a 1080', () => {
    const failures = [];
    for (const item of cases) {
      const { adapted } = adaptedFor(item);
      const { need, available, subPx, bodyPx } = readingNeed(adapted, item.fmt);
      if (!adapted.presentationReadingFloor || need > available + 1 || subPx < READING_FLOOR - 0.01
        || (String(adapted.bodyAfterImage || '').trim() && bodyPx < READING_FLOOR - 0.01)) {
        failures.push(`${item.fmt} ${item.family} ${item.kind} foto=${item.photo} #${item.index}: precisa ${Math.round(need)} px, zona ${Math.round(available)} px, apoio ${subPx.toFixed(1)} px, corpo ${bodyPx.toFixed(1)} px, piso=${adapted.presentationReadingFloor}`);
      }
    }
    expect(failures.slice(0, 12), `${failures.length} de ${cases.length} composições`).toEqual([]);
  });

  it('a reorganização não põe texto sobre a foto recortada nem fora da área segura', () => {
    for (const item of cases) {
      const { adapted } = adaptedFor(item);
      const { photo, title, subtitle } = adapted.canvas.zones;
      const bleed = photo && photo.x === 0 && photo.y === 0 && photo.w === 100 && photo.h === 100;
      const hasPhoto = !adapted.presentationSuppressPhoto && photo && photo.w > 1;
      if (hasPhoto && !bleed) {
        expect(overlaps(photo, subtitle), `${item.fmt} ${item.family} ${item.kind} #${item.index} foto × apoio`).toBeFalsy();
        expect(overlaps(photo, title), `${item.fmt} ${item.family} ${item.kind} #${item.index} foto × título`).toBeFalsy();
      }
      expect(overlaps(title, subtitle), `${item.fmt} ${item.family} ${item.kind} #${item.index} título × apoio`).toBeFalsy();
      // Stories: texto entre 14% e 82% (faixas da interface do app).
      expect(subtitle.y + subtitle.h).toBeLessThanOrEqual(item.fmt === 'stories' ? 82.01 : 97);
    }
  });

  it('é só composição de leitura: o slide 16:9 não muda e voltar ao 16:9 devolve o original', () => {
    const doc = structuredClone(fixture.doc);
    const before = JSON.stringify(doc);
    for (const fmt of ['stories', 'carrossel', 'quadrado']) {
      for (const slide of doc.slides) slideForFormatDisplay(slide, fmt, doc.formatViews, doc.creativePreset);
    }
    expect(JSON.stringify(doc)).toBe(before);
    for (const slide of doc.slides) {
      expect(slideForFormatDisplay(slide, 'apresentacao', doc.formatViews, doc.creativePreset))
        .toEqual(slideForFormatDisplay(structuredClone(slide), 'apresentacao', doc.formatViews, doc.creativePreset));
      expect(presentationForSocialFormat(slide, 'stories').presentationReadingFloor).toBe(true);
    }
  });
});

describe('Renderer: apoio da apresentação adaptada não desce do piso', { timeout: 60_000 }, () => {
  it('o piso do apoio vale para a apresentação Livre/família vista em formato social', async () => {
    const renderer = await import('../../src/components/card/SlideCardInner.jsx');
    const adapted = familyCarouselAdaptation({ ...livre[6], presentationBlocks: [] }, 'stories');
    expect(adapted.presentationReadingFloor).toBe(true);
    // Apoio de 30 px e corpo de 28 px: o menor fica em 28 (escala mínima 1).
    expect(renderer.presentationReadingScaleFloor(adapted, { w: 1080 }, [30, 28], 0.62)).toBeCloseTo(1, 5);
    expect(renderer.presentationReadingScaleFloor(adapted, { w: 1080 }, [56], 0.62)).toBeCloseTo(0.5, 5);
    // Sem a marca (16:9 original, ou zona que não comporta o texto) vale o piso antigo.
    expect(renderer.presentationReadingScaleFloor({ ...adapted, presentationReadingFloor: false }, { w: 1080 }, [56], 0.62)).toBe(0.62);
    expect(renderer.presentationReadingScaleFloor(livre[6], { w: 1920 }, [56], 0.62)).toBe(0.62);
  });
});
