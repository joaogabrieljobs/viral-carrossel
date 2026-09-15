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
