import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeBrandTone, parseBrandToneTraitsInput } from '../../src/utils/brand-tone.js';

describe('edição do tom de voz e da descrição da marca (auditoria 23/11, GB-01)', () => {
  it('traços digitados com vírgula viram itens separados; vírgula final ainda não cria item', () => {
    expect(parseBrandToneTraitsInput('direto, claro')).toEqual(['direto', 'claro']);
    expect(parseBrandToneTraitsInput('direto,')).toEqual(['direto']);
    expect(parseBrandToneTraitsInput('  direto ;claro\nsem jargão ')).toEqual(['direto', 'claro', 'sem jargão']);
    expect(parseBrandToneTraitsInput('a,b,c,d,e,f,g,h,i,j')).toHaveLength(8);
  });

  it('o tom guardado continua normalizado (o campo é que não pode usar esse valor ao digitar)', () => {
    const saved = normalizeBrandTone({ summary: 'Direto e ', do: 'Frases curtas \n', method: 'x' });
    expect(saved.summary).toBe('Direto e');
    expect(saved.do).toBe('Frases curtas');
  });

  // Não há ambiente de DOM no Vitest deste projeto: a digitação tecla a tecla
  // é provada no Playwright (quick-adjustments.spec.js). Aqui fica a trava de
  // que nenhum dos dois formulários volta a ligar o campo ao valor aparado.
  it('os campos não usam mais o valor aparado como value', () => {
    const quick = readFileSync(new URL('../../src/components/panels/CriarRapidoHome.jsx', import.meta.url), 'utf8');
    expect(quick).toContain('value={bioDraft}');
    expect(quick).not.toMatch(/const bioDraft = [^\n]*\.trim\(\)/);
    const tone = readFileSync(new URL('../../src/components/panels/BrandTonePanel.jsx', import.meta.url), 'utf8');
    expect(tone).not.toMatch(/value=\{tone\.(summary|do|dont|ctaStyle)/);
    expect(tone).not.toContain("value={(tone.traits || []).join(', ')}");
    for (const field of ['summary', 'traits', 'do', 'dont', 'ctaStyle']) {
      expect(tone).toContain(`value={fields.${field}}`);
    }
  });
});
