import { describe, expect, it } from 'vitest';
import { auditDraftFactuality } from '../../src/utils/factual-grounding.js';

// Auditoria 23/11 (B3): teste real BLK FROGDAY com marca própria. O briefing
// diz "you only pay when you like it" e o título do card 1 saiu
// "new site first, pay later". A guarda de fatos não tinha regra para isso.
const brief = 'Black Frog builds websites for local businesses in San Diego. BLK FROGDAY, Nov 23 to 30: we build your new site first, and you only pay when you like it. The site is $797, and this week a new logo (or a refresh of yours) is included.';
const deck = title => ({ slides: [{ title, subtitle: 'Built for San Diego local businesses.', bodyAfterImage: '' }], caption: '' });

describe('auditoria 23/11 B3: condição de pagamento sem apoio', () => {
  it.each(['BLK FROGDAY: new site first, pay later', 'No upfront cost to start', 'Site parcelado em 3x sem entrada'])('marca "%s"', title => {
    const issues = auditDraftFactuality(deck(title), { factualSource: brief });
    expect(issues).toContainEqual(expect.objectContaining({ slideIndex: 0, field: 'title', category: 'condição de pagamento' }));
  });

  it('a condição que está no briefing passa', () => {
    const issues = auditDraftFactuality(deck('You only pay when you like it'), { factualSource: brief });
    expect(issues.filter(item => item.category === 'condição de pagamento')).toEqual([]);
  });

  it('"pay later" que está no briefing passa', () => {
    const issues = auditDraftFactuality(deck('Start now, pay later'), { factualSource: `${brief} Start now and pay later in 3 installments.` });
    expect(issues.filter(item => item.category === 'condição de pagamento' && /pay later/i.test(item.claim))).toEqual([]);
  });
});
