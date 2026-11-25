import { describe, expect, it } from 'vitest';
import * as audit from '../../src/utils/image-audit.js';

// Spec 1.1, entrega 5: a resposta do modelo é validada em código. Slide que não
// foi auditado, regra que não está no roteiro ou achado sem evidência visível
// são descartados. Sem evidência, não marca nada.
const rules = [
  { id: 'r1', level: 'avoid', target: 'image', instruction: 'Sem fantasia de carnaval, máscara ou plumas' },
  { id: 'r2', level: 'required', target: 'image', instruction: 'Pessoas em ambiente urbano' },
  { id: 'r3', level: 'avoid', target: 'copy', instruction: 'Sem clichês no texto' },
];
const audited = [
  { slideId: 's2', slideIndex: 1, title: 'O brasileiro não espera' },
  { slideId: 's3', slideIndex: 2, title: 'Apoteose é ápice' },
  { slideId: 's5', slideIndex: 4, title: 'Curadoria sem fronteiras' },
];
const validate = (findings) => audit.validateImageAuditResponse?.(JSON.stringify({ findings }), { slides: audited, rules });
const visible = 'Mulher com máscara dourada e plumas azuis no rosto';

describe('spec 1.1 entrega 5 — contrato da auditoria de imagem', () => {
  it('só as rules de imagem do roteiro entram na auditoria', () => {
    expect(audit.imageAuditRules?.({ rules }).map(rule => rule.id)).toEqual(['r1', 'r2']);
    expect(audit.imageAuditRules?.({ rules: [{ id: '', target: 'image', level: 'avoid', instruction: 'x' }] })).toEqual([]);
    expect(audit.imageAuditRules?.({})).toEqual([]);
    expect(audit.imageAuditRules?.(null)).toEqual([]);
  });

  it('achado dentro do contrato vira slide, regra e evidência', () => {
    expect(validate([{ slide: 3, ruleId: 'r1', evidence: visible }])).toEqual([{
      slideId: 's3', slideIndex: 2, ruleId: 'r1', level: 'avoid', rule: rules[0].instruction, evidence: visible,
    }]);
  });

  it('descarta slide fora do mosaico, índice quebrado e regra que não está no roteiro', () => {
    expect(validate([
      { slide: 1, ruleId: 'r1', evidence: visible },
      { slide: 99, ruleId: 'r1', evidence: visible },
      { slide: '3', ruleId: 'r1', evidence: visible },
      { slide: 2.5, ruleId: 'r1', evidence: visible },
      { slide: 3, ruleId: 'r9', evidence: visible },
      { slide: 3, ruleId: 'r3', evidence: visible },
    ])).toEqual([]);
  });

  it('achado sem evidência visível é descartado e não marca o slide', () => {
    expect(validate([
      { slide: 2, ruleId: 'r1' },
      { slide: 2, ruleId: 'r1', evidence: '' },
      { slide: 2, ruleId: 'r1', evidence: '   ' },
      { slide: 2, ruleId: 'r1', evidence: 'n/a' },
      { slide: 2, ruleId: 'r1', evidence: 'Sem evidência' },
      { slide: 2, ruleId: 'r1', evidence: 'curta' },
      { slide: 2, ruleId: 'r1', evidence: 'Talvez haja uma máscara ao fundo' },
      { slide: 2, ruleId: 'r1', evidence: 'The image might show feathers' },
      { slide: 2, ruleId: 'r1', evidence: { text: visible } },
    ])).toEqual([]);
  });

  it('resposta fora do formato não vira achado', () => {
    const opts = { slides: audited, rules };
    for (const raw of ['', 'não é json', '[]', '{"findings":"r1"}', '{}', null, undefined, 42]) {
      expect(audit.validateImageAuditResponse?.(raw, opts)).toEqual([]);
    }
    expect(audit.validateImageAuditResponse?.('```json\n{"findings":[{"slide":5,"ruleId":"r2","evidence":"Praia deserta sem nenhuma pessoa"}]}\n```', opts))
      .toHaveLength(1);
  });

  it(`mostra no máximo ${2} achados e um por slide`, () => {
    expect(audit.IMAGE_AUDIT_MAX_FINDINGS).toBe(2);
    const findings = validate([
      { slide: 2, ruleId: 'r1', evidence: visible },
      { slide: 2, ruleId: 'r2', evidence: 'Fundo de estúdio liso, sem cidade' },
      { slide: 3, ruleId: 'r1', evidence: visible },
      { slide: 5, ruleId: 'r1', evidence: visible },
    ]);
    expect(findings.map(item => [item.slideId, item.ruleId])).toEqual([['s2', 'r1'], ['s3', 'r1']]);
  });

  it('evidência longa é encurtada, nunca descartada por isso', () => {
    const [finding] = validate([{ slide: 2, ruleId: 'r1', evidence: `${visible}. ${'Detalhe visível. '.repeat(40)}` }]);
    expect(finding.evidence.length).toBeLessThanOrEqual(280);
    expect(finding.evidence.startsWith(visible)).toBe(true);
  });
});
