// O fornecedor do texto incluso não aparece na UI: tudo o que o utilizador lê é "Viral AI".
import { describe, it, expect } from 'vitest';
import { TEXT_PROVIDERS, IMAGE_PROVIDERS, normalizeAISettings } from '../../src/config/ai-providers.js';

describe('Viral AI no lugar do fornecedor', () => {
  it('provedor de texto incluso chama-se Viral AI e nenhum modelo expõe o fornecedor', () => {
    const p = TEXT_PROVIDERS.zai;
    expect(p.name).toBe('Viral AI');
    expect(p.platform).toBe(true);
    for (const m of p.models) expect(m.name).not.toMatch(/glm|z\.ai/i);
    expect(JSON.stringify(p)).not.toMatch(/z\.ai/i);
  });

  it('provedor de imagem do mesmo fornecedor fica escondido e quem o tinha volta ao OpenAI', () => {
    expect(IMAGE_PROVIDERS.zai.hidden).toBe(true);
    expect(normalizeAISettings({ imageProvider: 'zai' }).imageProvider).toBe('openai');
  });

  it('modelo Flash antigo migra para o padrão (Flash saiu da lista)', () => {
    const s = normalizeAISettings({ textProvider: 'zai', textModels: { zai: 'glm-4.7-flash' } });
    expect(TEXT_PROVIDERS.zai.models.map((m) => m.id)).toContain(s.textModels.zai);
  });
});
