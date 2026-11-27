import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const fixtureBytes = fs.readFileSync(new URL('../../fixtures/apoteose-teste8.json', import.meta.url));
export const teste8 = JSON.parse(fixtureBytes.toString('utf8'));
export const teste8Plan = teste8.doc.presentationPlan;
const material = teste8.doc.material.content;
const personality = material.split('**Personalidade da marca**')[1]?.split('**Posicionamento**')[0];
if (!personality) throw new Error('O material real precisa conter a personalidade da marca.');
export const teste8Pairs = personality.split('\n').map(line => line.trim()).filter(line => line.startsWith('- '))
  .map(line => {
    const pair = line.replace(/^- /, '').replace(/\.$/, '').split(/,\s*(?=sem\b)/i);
    if (pair.length !== 2) throw new Error('Par da personalidade não reconhecido: ' + line);
    return pair;
  });
if (teste8Pairs.length !== 7) throw new Error('O material real deve conservar os sete pares.');

// A versão20 foi salva depois que a página7 saiu do projeto. Os nove textos
// abaixo são os campos editoriais observados, sem canvas, IDs de mídia,
// composição, formato editado ou qualquer resultado do diretor do aplicativo.
// A página ausente combina a transcrição visível da captura 22.03.09 com os
// sete pares do material. Ela não é uma recuperação do documento apagado:
// o bloco é editorial, sem canvas, fontes ou geometria pré-compostos.
const savedByPlanIndex = new Map(teste8.doc.slides.map(slide => [slide.presentationPlan.index, slide]));
export const teste8Draft = teste8Plan.slides.map(plan => {
  const saved = savedByPlanIndex.get(plan.index);
  if (!saved) {
    if (plan.index !== 7) throw new Error('Página não documentada na reconstrução: ' + plan.index);
    return {
      title: 'Brasileira, sofisticada, exclusiva',
      subtitle: 'A personalidade da Apoteose vive nos contrastes: é brasileira sem ser caricata, sofisticada sem ser pretensiosa, exclusiva sem ser arrogante.',
      bodyAfterImage: '',
      eyebrow: 'A PERSONALIDADE',
      presentationBlocks: [{ type: 'comparison', variant: 'pairs', headers: ['Traço', 'Sem ser'], rows: teste8Pairs }],
      speakerNotes: '',
      imageQuery: '',
    };
  }
  return Object.fromEntries(['title', 'subtitle', 'bodyAfterImage', 'eyebrow', 'presentationBlocks', 'imageQuery']
    .map(key => [key, structuredClone(saved[key] ?? (key === 'presentationBlocks' ? [] : ''))])
    .concat([['speakerNotes', '']]));
});

export const teste8Provenance = {
  source: 'tests/fixtures/apoteose-teste8.json',
  sha256: createHash('sha256').update(fixtureBytes).digest('hex'),
  savedVersion: teste8.metadata.version,
  savedAt: teste8.metadata.updatedAtUtc,
  plannedSlides: 10,
  savedSlides: 9,
  observedDraftIndexes: [...savedByPlanIndex.keys()],
  reconstructedSlide: {
    index: 7,
    source: 'Captura 22.03.09 (página7/10) e doc.material.content, seção Personalidade da marca',
    title: 'Transcrição da captura: Brasileira, sofisticada, exclusiva.',
    subtitle: 'Transcrição da introdução visível na captura 22.03.09; conservada junto da tabela.',
    rows: 'Sete pares literais da seção Personalidade da marca, em bloco comparison/pairs declarado, sem geometria.',
    eyebrow: 'Rótulo editorial reconstruído.',
    unavailable: ['documento original da página apagada', 'canvas original da página apagada'],
  },
  exclusions: [
    'Nenhum documento final é injetado na biblioteca.',
    'Nenhum diretor, normalizador ou compositor do produto é importado.',
    'Canvas e offsets posteriores à geração não entram no mock.',
    'O plano real, incluindo cenas abstratas e exclusões inadequadas à intenção, permanece intacto.',
    'APIs simuladas e mídia local não validam a estética da IA real.',
  ],
};

// Mesma captura nativa já verificada no Teste7: zoom pela UI, alinhamento
// transitório do viewport externo e restauração em finally. Nenhum pixel do
// PNG é cortado/redimensionado depois e nenhuma caixa do documento é editada.
export async function captureTeste8Deck(page, directory, count = 10) {
  fs.mkdirSync(directory, { recursive: true });
  await page.setViewportSize({ width: 2560, height: 1540 });
  const cards = page.locator('main [data-vc-card-surface]');
  await expect(cards).toHaveCount(count);
  await page.getByLabel('Ir para o card', { exact: true }).selectOption('0');
  await cards.first().scrollIntoViewIfNeeded();
  const width = await cards.first().evaluate(node => node.getBoundingClientRect().width);
  const viewport = page.locator('#vc-cards-viewport');
  const bounds = await viewport.boundingBox();
  await viewport.dispatchEvent('wheel', { ctrlKey: true, deltaY: -Math.log(1920 / width) / 0.008,
    clientX: bounds.x + 200, clientY: bounds.y + 200 });
  await expect.poll(() => cards.first().evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(1920);
  await page.evaluate(() => document.fonts.ready);
  const captures = [];
  for (let index = 0; index < count; index++) {
    await page.getByLabel('Ir para o card', { exact: true }).selectOption(String(index));
    const card = cards.nth(index);
    await card.scrollIntoViewIfNeeded();
    const notices = page.getByRole('button', { name: 'Fechar notificação', exact: true });
    while (await notices.count()) await notices.first().click();
    await page.mouse.move(10, 10);
    const measure = () => card.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        scrollX: window.scrollX, scrollY: window.scrollY };
    });
    const before = await measure();
    expect(Math.abs(before.width - 1920), 'largura nativa do slide ' + (index + 1)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(before.height - 1080), 'altura nativa do slide ' + (index + 1)).toBeLessThanOrEqual(0.001);
    const dx = Math.round(before.x + before.scrollX) - (before.x + before.scrollX);
    const dy = Math.round(before.y + before.scrollY) - (before.y + before.scrollY);
    const originalTranslate = await viewport.evaluate((node, shift) => {
      const original = { value: node.style.getPropertyValue('translate'), priority: node.style.getPropertyPriority('translate') };
      node.style.setProperty('translate', shift.dx + 'px ' + shift.dy + 'px', 'important');
      return original;
    }, { dx, dy });
    try {
      await expect.poll(async () => {
        const box = await measure(), x = box.x + box.scrollX, y = box.y + box.scrollY;
        return Math.max(...[x, y, x + box.width, y + box.height].map(value => Math.abs(value - Math.round(value))));
      }).toBeLessThanOrEqual(0.001);
      const aligned = await measure(), screen = page.viewportSize();
      expect(Math.abs(aligned.width - 1920)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(aligned.height - 1080)).toBeLessThanOrEqual(0.001);
      expect(aligned.x).toBeGreaterThanOrEqual(0);
      expect(aligned.y).toBeGreaterThanOrEqual(0);
      expect(aligned.x + aligned.width).toBeLessThanOrEqual(screen.width);
      expect(aligned.y + aligned.height).toBeLessThanOrEqual(screen.height);
      const filename = 'slide-' + String(index + 1).padStart(2, '0') + '.png';
      const png = await card.screenshot({ path: path.join(directory, filename), animations: 'disabled' });
      const dimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
      expect(await measure()).toEqual(aligned);
      expect(dimensions).toEqual({ width: 1920, height: 1080 });
      captures.push({ slide: index + 1, filename, sha256: createHash('sha256').update(png).digest('hex'),
        before, aligned, normalization: { target: '#vc-cards-viewport', dx, dy, originalTranslate }, png: dimensions });
      fs.writeFileSync(path.join(directory, 'capturas.json'), JSON.stringify(captures, null, 2));
    } finally {
      await viewport.evaluate((node, original) => {
        if (original.value) node.style.setProperty('translate', original.value, original.priority);
        else node.style.removeProperty('translate');
      }, originalTranslate);
    }
  }
}
