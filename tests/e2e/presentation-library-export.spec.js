import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import JSZip from 'jszip';
import { test, expect } from '@playwright/test';
import { mockApi, SESSAO_ATIVA } from './helpers/api-mock.js';
import { enterEditorFromHome } from './helpers/project-entry.js';
import { DEFAULT_BRAND, mkSlide } from '../../src/utils/doc-schema.js';
import { familySpec } from '../../src/utils/presentation-families.js';
import { applyPresentationVisualPreset, getPresentationCompositionOverrides } from '../../src/styles/presentation-presets.jsx';

// Exportação real (PDF, ZIP e PNG) da biblioteca 2.0 com serviços simulados.
// Conteúdo fictício da galeria e uma foto local comum; não valida geração por IA.
const contents = JSON.parse(readFileSync(new URL('../../docs/presentation/template-gallery-content.json', import.meta.url)));
const photo = `data:image/jpeg;base64,${readFileSync(new URL('../../public/landing/hero-creator-photo.jpg', import.meta.url)).toString('base64')}`;
test.use({ viewport: { width: 1600, height: 1100 } });

const read = async (download) => {
  const chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
};
const save = (path, buffer) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, buffer); };
// Deslocamento vertical do texto entre preview e arquivo (px na escala 1920).
// Perfis de linhas com tinta na metade esquerda, alinhados por correlação.
async function verticalShift(page, preview, exported) {
  return page.evaluate(async ({ a, b }) => {
    const profile = async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 1920, 1080);
      const { data } = ctx.getImageData(0, 0, 900, 1080);
      const bg = [data[(20 * 900 + 880) * 4], data[(20 * 900 + 880) * 4 + 1], data[(20 * 900 + 880) * 4 + 2]];
      return Array.from({ length: 1080 }, (_, y) => {
        let n = 0;
        for (let x = 60; x < 900; x++) {
          const i = (y * 900 + x) * 4;
          if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 90) n++;
        }
        return n;
      });
    };
    const [pa, pb] = await Promise.all([profile(a), profile(b)]);
    let best = 0, score = -Infinity;
    for (let d = -40; d <= 40; d++) {
      let sum = 0;
      for (let y = 40; y < 1040; y++) sum += pa[y] * (pb[y + d] || 0);
      if (sum > score) { score = sum; best = d; }
    }
    return best;
  }, { a: `data:image/png;base64,${preview.toString('base64')}`, b: `data:image/png;base64,${exported.toString('base64')}` });
}
const pngSize = (buffer) => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });

for (const key of ['editorial', 'cinematic', 'technical']) test(`biblioteca 2 exporta ${key}: PDF, ZIP e PNG 16:9 e Stories`, async ({ page }, info) => {
  test.setTimeout(180_000);
  const preset = familySpec(key).runtimeId;
  const items = contents.decks[key].slides;
  const slides = items.map((s, index) => {
    const slide = { ...mkSlide(index + 1, DEFAULT_BRAND), id: `${key}-${index}`,
      title: s.title, subtitle: s.subtitle || '', bodyAfterImage: s.body || '', eyebrow: s.eyebrow || '', photoCaption: s.caption || '',
      presentationBlocks: s.blocks || [], elementsUnlocked: true, useCultureLayout: false,
      bgImage: s.photo == null ? '' : photo, imageQuery: s.photo == null ? '' : 'controlled illustrative photo',
      presentationPlan: { visualRole: s.kind, purpose: s.kind === 'data' ? 'comparison' : 'explain' } };
    return { ...slide, ...getPresentationCompositionOverrides(preset, { slide, index, count: items.length }) };
  });
  const project = { id: `export-${key}`, name: `Exportação ${key}`, doc: {
    fmt: 'apresentacao', productKind: 'apresentacao', creativePreset: 'apresentacao', visualPreset: preset,
    brand: applyPresentationVisualPreset({ ...DEFAULT_BRAND, showHandle: false, logo: null }, preset), slides } };
  await mockApi(page, { session: SESSAO_ATIVA });
  await page.addInitScript(project => {
    if (localStorage.getItem('vc_library')) return;
    localStorage.setItem('vc_library', JSON.stringify([project]));
    localStorage.setItem('vc_active_doc_id', JSON.stringify(project.id));
    localStorage.setItem('vc_app_mode', JSON.stringify('studio'));
  }, project);
  await page.goto('/?app=1');
  await expect(page.locator('[data-vc-tour="account-home"]')).toBeVisible({ timeout: 30_000 });
  await enterEditorFromHome(page);
  const cards = page.locator('main [data-vc-card-surface]');
  await expect(cards).toHaveCount(6);
  for (let i = 0; i < 6; i++) await expect.poll(() => cards.nth(i).getAttribute('data-vc-framing-pending')).not.toBe('true');
  await page.evaluate(() => document.fonts.ready);
  const previews = {};
  for (const i of [0, 4]) previews[i] = await cards.nth(i).screenshot({ path: info.outputPath(`${key}-preview-${i + 1}.png`) });

  const options = page.getByRole('button', { name: 'Opções de download', exact: true });
  await options.click();
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menu').getByRole('menuitem', { name: 'Apresentação em PDF', exact: true }).click(),
  ]);
  const pdfBytes = await read(pdf);
  await pdf.saveAs(info.outputPath(`${key}.pdf`));
  const pdfText = pdfBytes.toString('latin1');
  expect(pdfText.startsWith('%PDF-')).toBe(true);
  expect(pdfText.match(/\/Type \/Page\b/g)).toHaveLength(6);
  const [, w, h] = pdfText.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  expect(Number(w) / Number(h)).toBeCloseTo(16 / 9, 3);

  await expect(options).toBeEnabled();
  await options.click();
  const [zipDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Todos os .* slides/ }).click(),
  ]);
  const zip = await JSZip.loadAsync(await read(zipDownload));
  const pngs = Object.keys(zip.files).filter(name => name.endsWith('.png')).sort();
  expect(pngs).toHaveLength(6);
  for (const [index, name] of pngs.entries()) {
    const buffer = await zip.file(name).async('nodebuffer');
    const { width, height } = pngSize(buffer);
    expect(width / height, name).toBeCloseTo(16 / 9, 2);
    expect(width, name).toBeGreaterThanOrEqual(1920);
    save(info.outputPath(`${key}-zip-${index + 1}.png`), buffer);
    // O arquivo precisa repetir a composição do preview (sem texto deslocado).
    if (previews[index]) expect(Math.abs(await verticalShift(page, previews[index], buffer)), `${key}: texto deslocado no PNG ${index + 1}`).toBeLessThanOrEqual(4);
  }

  await expect(options).toBeEnabled();
  await page.getByRole('button', { name: 'Stories', exact: true }).first().click();
  await expect.poll(() => cards.first().evaluate(n => { const r = n.getBoundingClientRect(); return Math.round(r.width / r.height * 1000) / 1000; })).toBeCloseTo(9 / 16, 2);
  await cards.first().screenshot({ path: info.outputPath(`${key}-stories-preview-1.png`) });
  const [story] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /baixar card 1/i }).click(),
  ]);
  const storyBytes = await read(story);
  save(info.outputPath(`${key}-stories-1.png`), storyBytes);
  const size = pngSize(storyBytes);
  expect(size.width / size.height).toBeCloseTo(9 / 16, 2);
});
