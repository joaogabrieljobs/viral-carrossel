// Auditoria 2026-09-15 — H8 (prompt SJinn truncado), L2 (cascatas ⊆ config).
import { describe, it, expect } from 'vitest';
import { buildGptImageFullPrompt, OPENAI_IMAGE_MODELS, ZAI_FALLBACK_MODELS } from '../../src/utils/ai-client.js';
import { IMAGE_PROVIDERS, TEXT_PROVIDERS } from '../../src/config/ai-providers.js';

describe('H8 — prompt de imagem do plano sobrevive ao corte de 4000 chars', () => {
  it('direção de marca e regra "no text" ficam nos primeiros 4000 chars', () => {
    const extra = 'B'.repeat(2000);
    const full = buildGptImageFullPrompt('moonrise over a quiet city', null, extra, { priorityFirst: true });
    const head = full.slice(0, 4000);
    expect(head).toContain('BRAND / CLIENT DIRECTION');
    expect(head).toContain('THEME OF THIS CARD: moonrise');
    expect(head).toMatch(/no text/i);
  });
});

describe('L2 — cascatas de modelos só citam modelos conhecidos', () => {
  it('ZAI_FALLBACK_MODELS ⊆ TEXT_PROVIDERS.zai.models', () => {
    const known = new Set(TEXT_PROVIDERS.zai.models.map((m) => m.id));
    for (const id of ZAI_FALLBACK_MODELS) expect(known.has(id), id).toBe(true);
  });
  it('OPENAI_IMAGE_MODELS ⊆ IMAGE_PROVIDERS.openai.models ∪ legado explícito', () => {
    const known = new Set([...IMAGE_PROVIDERS.openai.models.map((m) => m.id), 'gpt-image-1', 'dall-e-3']);
    for (const m of OPENAI_IMAGE_MODELS) expect(known.has(m.name), m.name).toBe(true);
  });
});

describe('cena do card — ficha visual e enquadramento no prompt de imagem', () => {
  const cena = 'PROJECT SUBJECTS — whenever one of these appears...\n- raul: adult man wearing a plain olive-green shirt\n\nFRAMING: Keep the main subject complete inside the frame.';

  it('sem cena o prompt é idêntico ao de antes', () => {
    for (const opts of [{}, { priorityFirst: true }, { withReference: true }, { aspectRatio: '16:9' }]) {
      expect(buildGptImageFullPrompt('quiet city', null, '', { ...opts, scene: '' })).toBe(buildGptImageFullPrompt('quiet city', null, '', opts));
      expect(buildGptImageFullPrompt('quiet city', null, 'brand', { ...opts, scene: '   ' })).toBe(buildGptImageFullPrompt('quiet city', null, 'brand', opts));
    }
  });

  it('a cena entra logo depois do tema, em todos os ramos, sem remover nada', () => {
    for (const [extra, opts] of [['', {}], ['', { priorityFirst: true }], ['brand direction', {}], ['', { withReference: true }]]) {
      const sem = buildGptImageFullPrompt('quiet city', null, extra, opts);
      const com = buildGptImageFullPrompt('quiet city', null, extra, { ...opts, scene: cena });
      expect(com).toContain('THEME OF THIS CARD: quiet city\n\nPROJECT SUBJECTS');
      expect(com.replace(`\n\n${cena}`, '')).toBe(sem);
    }
  });

  it('a ficha não troca a linguagem visual: sem direção de marca, a direção de arte padrão continua', () => {
    const com = buildGptImageFullPrompt('quiet city', null, '', { scene: cena });
    expect(com).toContain('art director');
    expect(com).not.toContain('BRAND / CLIENT DIRECTION');
  });

  it('no teto de 4000 do plano a regra "no text" e a direção de marca sobrevivem; a cena cede', () => {
    const extra = 'B'.repeat(3000);
    const cenaLonga = `${cena}\n${'x'.repeat(2000)}`;
    const full = buildGptImageFullPrompt('moonrise over a quiet city', null, extra, { priorityFirst: true, scene: cenaLonga, maxChars: 4000 });
    expect(full.length).toBeLessThanOrEqual(4000);
    expect(full).toContain('BRAND / CLIENT DIRECTION');
    expect(full).toMatch(/HARD RULES: no text/);
    expect(full).toContain('PROJECT SUBJECTS');
  });

  it('sem direção de marca, tema, cena e regras fixas ficam nos primeiros 4000', () => {
    const full = buildGptImageFullPrompt('moonrise', null, '', { priorityFirst: true, scene: `${cena}\n${'x'.repeat(2000)}`, maxChars: 4000 });
    const head = full.slice(0, 4000);
    expect(head).toContain('PROJECT SUBJECTS');
    expect(head).toMatch(/Strictly no text/);
  });
});
