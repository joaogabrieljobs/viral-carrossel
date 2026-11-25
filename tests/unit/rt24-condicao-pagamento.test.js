import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { auditDraftFactuality, auditUnsupportedCommercialClaims } from '../../src/utils/factual-grounding.js';

// Reteste real de 24/11 (RT24 texto 4), e6085f3: Proposta e Relatório abriram
// como rascunho porque a guarda marcou "no upfront cost" e "no upfront payment"
// como condição de pagamento sem apoio. O briefing diz "you see the new site
// before any payment": é o mesmo fato com outras palavras.
const { brief, projects } = JSON.parse(readFileSync(new URL('../fixtures/rt24-projetos.json', import.meta.url), 'utf8'));
const blockText = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(blockText).join('\n')
  : value && typeof value === 'object' ? Object.values(value).map(blockText).join('\n') : '';
// Mesma dobra que a geração planejada faz: apoio, notas e blocos entram na conferência.
const payment = project => auditDraftFactuality({ slides: project.slides.map(slide => ({ ...slide,
  bodyAfterImage: [slide.bodyAfterImage, slide.speakerNotes, blockText(slide.presentationBlocks)].filter(Boolean).join('\n') })) },
{ count: project.slides.length, presetId: 'apresentacao', factualSource: brief, currentYear: 2026 }).filter(issue => issue.category === 'condição de pagamento');
const audit = (title, factualSource) => auditDraftFactuality({ slides: [{ title, subtitle: 'Built for San Diego local businesses.', bodyAfterImage: '' }] },
  { count: 1, presetId: 'apresentacao', factualSource, currentYear: 2026 }).filter(issue => issue.category === 'condição de pagamento');

describe('RT24 texto 4: "no upfront cost" é paráfrase de "before any payment"', () => {
  it.each(['A2 Proposta', 'A3 Relatorio'])('%s real não tem condição de pagamento marcada', name => {
    expect(payment(projects.find(project => project.name === name))).toEqual([]);
  });

  it.each(['Send Your Link to Start with No Upfront Cost', 'No upfront payment to see your new site', 'No upfront fees'])('passa com o briefing real: %s', title => {
    expect(audit(title, brief)).toEqual([]);
    expect(auditUnsupportedCommercialClaims([{ title, subtitle: '', bodyAfterImage: '' }], brief).filter(issue => issue.category === 'condição de pagamento')).toEqual([]);
  });

  it('passa com o material em português que diz o mesmo', () => {
    expect(audit('No upfront cost', 'Você vê o site novo antes de qualquer pagamento.')).toEqual([]);
  });

  it.each(['New site first, pay later', 'Zero down to start', 'Financing available', 'Pay over time', 'Site parcelado sem entrada'])('condição que o material não traz continua marcada: %s', title => {
    expect(audit(title, brief).length).toBeGreaterThan(0);
  });

  it('sem "before any payment" no material, "no upfront cost" continua marcado', () => {
    const semAntes = 'Black Frog builds websites for local businesses in San Diego. The site is $797, and this week a new logo is included.';
    expect(audit('No upfront cost to start', semAntes)).toHaveLength(1);
  });
});
