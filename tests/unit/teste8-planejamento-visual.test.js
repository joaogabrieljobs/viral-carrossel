import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildFreeArtDirectionBlock, buildPresentationPlanPrompt, buildVisualDirectionBlock,
} from '../../src/utils/presentation-plan.js';

const referenceColors = [
  { hex: '#213744', weight: 0.6 }, { hex: '#F0A040', weight: 0.3 }, { hex: '#658E99', weight: 0.1 },
];
const freeOptions = { freeDesign: true, count: 10, kitReferenceWithoutText: true, referenceColors };
const digest = value => createHash('sha256').update(value).digest('hex');

describe('Teste 8 — intenção visual no planejamento Livre', () => {
  it('a paleta extraída não faz o texto afirmar que examinou o meio, a textura ou os sujeitos da referência', () => {
    const prompt = buildVisualDirectionBlock(freeOptions);
    expect(prompt).toMatch(/referência que você não vê/i);
    expect(prompt).toMatch(/paleta[^\n]*não revela[^\n]*(meio|fotografia)[^\n]*acabamento/i);
    expect(prompt).toMatch(/instruções escritas explícitas[^\n]*prevalecem/i);
    expect(prompt).toMatch(/acabamento[^\n]*não descrito[^\n]*referência/i);
  });

  it.each([
    { kitReferenceWithoutText: true },
    { referenceColors, kitColors: ['#213744'] },
  ])('avisa que a referência não foi vista com e sem descrição de cor: %j', options => {
    expect(buildVisualDirectionBlock({ freeDesign: true, ...options })).toMatch(/referência que você não vê/i);
  });

  it('cenas de experiência representam pessoas e comportamento sem transformar toda apresentação em retratos', () => {
    const prompt = buildPresentationPlanPrompt({ ...freeOptions, brief: 'Encontro de música, moda e prazer de estar entre amigos.' });
    expect(prompt).toMatch(/briefing[^\n]*experiência[^\n]*pessoas[^\n]*comportamento[^\n]*(gestos|interações)/i);
    expect(prompt).toMatch(/dados, arquitetura ou produto[^\n]*não acrescente pessoas/i);
    expect(prompt).toMatch(/"no people"[^\n]*só[^\n]*(explícit|necessidad)/i);
  });

  it('a capa parte de um sujeito concreto, e abstração permanece escolha explícita de intenção', () => {
    const prompt = buildPresentationPlanPrompt(freeOptions);
    expect(prompt).toMatch(/capa[^\n]*sujeito concreto[^\n]*(briefing|conceito)/i);
    expect(prompt).toMatch(/abstração[^\n]*(solicitada|intenção explícita)/i);
    expect(prompt).not.toContain('Fotografia só quando esclarecer a ideia.');
  });

  it('preserva escala e cobertura das cenas importantes antes de procurar variedade', () => {
    const prompt = buildFreeArtDirectionBlock();
    expect(prompt).toMatch(/cobertura[^\n]*intenção/i);
    expect(prompt).toMatch(/não[^\n]*(retire|elimine)[^\n]*reduza[^\n]*variedade/i);
    expect(prompt).toMatch(/protagonista[^\n]*half[^\n]*full[^\n]*small[^\n]*apoio/i);
    expect(prompt).toMatch(/sem quota[^\n]*sem foto/i);
    expect(prompt).not.toContain('Use pelo menos 3 fundos e 3 tamanhos de foto no deck.');
  });

  it('não inventa ausência de pessoas ou de textura como restrição e mantém tipografia editável', () => {
    const prompt = buildPresentationPlanPrompt(freeOptions);
    expect(prompt).toMatch(/não invente[^\n]*"no grain"[^\n]*"no people"/i);
    expect(prompt).toMatch(/grafismos[^\n]*secundários[^\n]*sujeito/i);
    expect(prompt).toMatch(/intervenções tipográficas[^\n]*camadas editáveis/i);
  });

  it('preserva ordens explícitas opostas para um projeto arquitetônico sem impor estética de evento', () => {
    const userInstructions = 'Arquitetura vazia, sem pessoas. Acabamento liso, sem grão. Grafismos: none.';
    const prompt = buildPresentationPlanPrompt({ ...freeOptions, brief: 'Apresentar os espaços de um museu.', userInstructions });
    expect(prompt).toContain(userInstructions);
    expect(prompt).toMatch(/instruções escritas explícitas[^\n]*prevalecem/i);
    expect(prompt).not.toMatch(/Afro-Brazilian|#171344|palmeiras|máscaras|Apoteose/);
  });

  it('mantém contrato e orçamento compactos sem repetir a definição dos campos de cena', () => {
    const prompt = buildPresentationPlanPrompt(freeOptions);
    // Baseline 7cc1106: 24.561 caracteres nas mesmas opções. O ajuste de
    // intenção substitui instruções; não duplica o contrato inteiro.
    expect(prompt.length).toBeLessThanOrEqual(25_361);
    expect(prompt.match(/^- subject:/gm)).toHaveLength(1);
    expect(prompt.match(/DIREÇÃO VISUAL DO DECK \(/g)).toHaveLength(1);
    expect(prompt).toContain('8192 tokens');
    expect(prompt).toContain('"schemaVersion":3');
  });
});

describe('Teste 8 — prompts fixos preservados byte a byte no HEAD 7cc1106', () => {
  it.each([
    [{}, 'e8e2ecee637b79bc9eea654ff8d28de1f59aed03f9ad92c2589ae72c966a8aec'],
    [{ freeDesign: false }, 'e8e2ecee637b79bc9eea654ff8d28de1f59aed03f9ad92c2589ae72c966a8aec'],
    [{ brief: 'Relatório de produto', count: 10, presentationPath: 'relatorio_executivo', sources: [{ id: 'material', text: 'A receita permanece uma hipótese.' }], userInstructions: 'Preserve as condições.', kitColors: ['#213744'], kitReferenceWithoutText: true, referenceColors }, 'dd40519c314fb22b034d9e43950b7364445b46dbc081cf3f25124274ff7281d5'],
    [{ compactRepair: true, kitReferenceWithoutText: true }, '5757b9776fd0bb51bf33d79ad32a0c723b19ac07b408131974e184c3fa16a3d5'],
  ])('preserva o roteiro sem opt-in: %j', (input, expected) => {
    expect(digest(buildPresentationPlanPrompt(input))).toBe(expected);
  });
});
