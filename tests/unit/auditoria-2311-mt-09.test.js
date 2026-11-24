// Auditoria 23/11 — MT-09: isenção "Essencial + sem limite de imagens".
// O servidor libera pela quota (api/lib/plans.js, imageLimitForEntitlement);
// o editor bloqueava pelo nome do plano.
import { describe, expect, it } from 'vitest';
import { imageGenerationAccess } from '../../src/utils/image-generation-readiness.js';
import { imageLimitForEntitlement } from '../../api/lib/plans.js';

describe('MT-09 — o editor decide pela quota que o servidor mandou', () => {
  it('Essencial com isenção sem limite pode gerar imagem', () => {
    const limit = imageLimitForEntitlement({ tier: 'essential', unlimitedImages: true });
    expect(limit).toBe(1_000_000);
    expect(imageGenerationAccess({
      access: { active: true, tier: 'essential', imageQuota: { unlimited: true, limit, remaining: 999_990 } },
    })).toMatchObject({ canGenerate: true, reason: null });
  });

  it('Essencial sem isenção continua sem imagens, com ou sem quota informada', () => {
    expect(imageGenerationAccess({
      access: { active: true, tier: 'essential', imageQuota: { limit: 0, remaining: 0 } },
    }).reason).toBe('plan_without_images');
    expect(imageGenerationAccess({ access: { active: true, tier: 'essential' } }).reason).toBe('plan_without_images');
  });

  it('saldo indisponível no Essencial isento não vira liberação', () => {
    expect(imageGenerationAccess({
      access: { active: true, tier: 'essential', imageQuota: { status: 'unavailable', available: false, limit: 1_000_000, remaining: null } },
    }).reason).toBe('quota_unavailable');
  });
});
