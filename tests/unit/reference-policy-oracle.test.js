import { describe, expect, it } from 'vitest';
import { referencePolicyFacts } from '../e2e/helpers/reference-policy-facts.js';

// Redações observadas no HTTP; não importamos o montador nem suas constantes.
const legacy = 'Use moodboard images only for the look (medium, palette, light, contrast, texture), never for people, objects, framing or composition.';
const analyzed = 'Moodboards supply visual language, not the identity of the depicted person or an exact scene to copy. Explicit written direction overrides their medium and look; otherwise preserve medium, detail and photo/graphics hierarchy. The current scene and COMPOSITION govern the new image.';
const prompt = policy => `REFERENCE ROLES: ${policy} 1: moodboard. 2: identity.`;

describe('oracle independente da política de referência no HTTP', () => {
  it.each([['legada', legacy], ['analisada', analyzed]])('aceita uma política %s completa, com os papéis na ordem', (_name, policy) => {
    expect(referencePolicyFacts(prompt(policy), 2)).toEqual({
      policyCount: 1, lookOnlyExcludesContent: true,
      roles: [{ number: 1, role: 'style' }, { number: 2, role: 'identity' }],
      expectedRoles: [{ number: 1, role: 'style' }, { number: 2, role: 'identity' }],
    });
  });

  it.each([
    ['veto à identidade', 'not the identity of the depicted person or an exact scene to copy', 'not an exact scene to copy'],
    ['veto à cópia da cena', 'not the identity of the depicted person or an exact scene to copy', 'not the identity of the depicted person'],
    ['prioridade da direção escrita', 'Explicit written direction overrides their medium and look; ', ''],
    ['preservação do meio e hierarquia', 'otherwise preserve medium, detail and photo/graphics hierarchy.', ''],
    ['prioridade da cena atual', 'The current scene and COMPOSITION govern the new image.', 'COMPOSITION governs the new image.'],
    ['prioridade da composição', 'The current scene and COMPOSITION govern the new image.', 'The current scene governs the new image.'],
  ])('rejeita uma análise sem %s', (_name, before, after) => {
    const facts = referencePolicyFacts(prompt(analyzed.replace(before, after)), 2);
    expect(facts.policyCount).toBe(1);
    expect(facts.lookOnlyExcludesContent).toBe(false);
  });

  it('não considera os papéis dos anexos como uma política', () => {
    const facts = referencePolicyFacts('REFERENCE ROLES: 1: moodboard. 2: identity.', 2);
    expect(facts.policyCount).toBe(0);
    expect(facts.lookOnlyExcludesContent).toBe(false);
  });

  it('rejeita política legada sem exclusão de conteúdo', () => {
    const facts = referencePolicyFacts(prompt(legacy.replace(', never for people, objects, framing or composition', '')), 2);
    expect(facts.policyCount).toBe(1);
    expect(facts.lookOnlyExcludesContent).toBe(false);
  });

  it.each([
    ['legadas no mesmo parágrafo', `${legacy} ${legacy}`],
    ['analisadas no mesmo parágrafo', `${analyzed} ${analyzed}`],
    ['legadas em parágrafos distintos', `${legacy}\n\n${legacy}`],
    ['analisadas em parágrafos distintos', `${analyzed}\n\n${analyzed}`],
    ['uma de cada versão no mesmo parágrafo', `${legacy} ${analyzed}`],
  ])('conta duas políticas %s', (_name, policy) => {
    expect(referencePolicyFacts(prompt(policy), 2).policyCount).toBe(2);
  });

  it('mantém papéis duplicados para a asserção externa detectá-los', () => {
    const facts = referencePolicyFacts(`${prompt(analyzed)} 1: moodboard.`, 2);
    expect(facts.roles).toEqual([
      { number: 1, role: 'style' }, { number: 2, role: 'identity' }, { number: 1, role: 'style' },
    ]);
    expect(facts.roles).not.toEqual(facts.expectedRoles);
  });
});
