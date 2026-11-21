import { describe, expect, it } from 'vitest';
import { ocrQuotaDay } from '../../api/lib/ocr-quota.js';

// MOO-30 (auditoria 20/11): a cota diária de OCR virava às 21h de Brasília
// porque o dia era o dia UTC.
describe('MOO-30 — dia da cota de OCR segue o horário de Brasília', () => {
  it('21h30 e 23h30 de Brasília caem no mesmo dia', () => {
    expect(ocrQuotaDay(Date.parse('2026-11-21T21:30:00-03:00'))).toBe('2026-11-21');
    expect(ocrQuotaDay(Date.parse('2026-11-21T23:30:00-03:00'))).toBe('2026-11-21');
  });

  it('meia-noite e meia de Brasília já é o dia seguinte', () => {
    expect(ocrQuotaDay(Date.parse('2026-11-22T00:30:00-03:00'))).toBe('2026-11-22');
  });
});
