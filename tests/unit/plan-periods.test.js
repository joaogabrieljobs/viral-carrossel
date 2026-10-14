import { describe, expect, it } from 'vitest';
import { periodBoundsFromSubscription } from '../../api/lib/plans.js';

const start = 1791846000;
const end = 1794524400;
const period = { current_period_start: start, current_period_end: end };

describe('período de cobrança das imagens', () => {
  it('lê os campos do item nas versões atuais do Stripe', () => {
    expect(periodBoundsFromSubscription({ items: { data: [period] } })).toEqual({
      periodStartSec: start, periodEndSec: end,
      periodStart: new Date(start * 1000).toISOString(),
      periodEnd: new Date(end * 1000).toISOString(),
    });
  });

  it('mantém compatibilidade com assinaturas legadas e prefere o item do plano', () => {
    expect(periodBoundsFromSubscription(period).periodStartSec).toBe(start);
    expect(periodBoundsFromSubscription({ ...period, items: { data: [
      { current_period_start: start + 60, current_period_end: end + 60 },
      { current_period_start: start + 120, current_period_end: end + 120 },
    ] } }).periodStartSec).toBe(start + 60);
  });

  it('não inventa ciclo para datas incompletas, invertidas ou inválidas', () => {
    for (const value of [undefined, {}, { current_period_start: start },
      { current_period_start: end, current_period_end: start },
      { current_period_start: 1, current_period_end: Infinity },
      { current_period_start: 1, current_period_end: 9_000_000_000_000 },
      { items: { data: [{}, period] } },
    ]) {
      expect(periodBoundsFromSubscription(value)).toEqual({
        periodStartSec: null, periodEndSec: null, periodStart: null, periodEnd: null,
      });
    }
  });

  it('roda a chave apenas quando o Stripe informa o próximo período', () => {
    const before = periodBoundsFromSubscription({ items: { data: [period] } });
    const repeated = periodBoundsFromSubscription({ items: { data: [period] } });
    const renewed = periodBoundsFromSubscription({ items: { data: [
      { current_period_start: end, current_period_end: end + 2_592_000 },
    ] } });
    expect(repeated).toEqual(before);
    expect(renewed.periodStartSec).toBe(before.periodEndSec);
  });
});
