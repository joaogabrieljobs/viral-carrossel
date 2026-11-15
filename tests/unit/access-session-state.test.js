import { describe, expect, it } from 'vitest';
import { accessStateFromSession, accessStateFromUsageSession } from '../../src/hooks/useAccess.js';

describe('estado de verificação da conta', () => {
  it('preserva isenção e ciclo de créditos explícitos sem inferir acesso por quota', () => {
    const exempt = accessStateFromSession({ active:true, status:'exempt', billingExempt:true, accessSource:'exempt',
      email:'pessoa@empresa.com', tier:'creator', quotaPeriodStart:'2026-11-01T00:00:00Z', quotaPeriodEnd:'2026-12-01T00:00:00Z',
      imageQuota:{ limit:50, used:2, remaining:48 },
    });
    expect(exempt).toMatchObject({ active:true, status:'active', sessionStatus:'exempt', billingExempt:true, accessSource:'exempt',
      quotaPeriodStart:'2026-11-01T00:00:00Z', quotaPeriodEnd:'2026-12-01T00:00:00Z', imageQuota:{ limit:50, used:2 },
    });
    expect(accessStateFromSession({ active:false, status:'inactive', email:'pessoa@empresa.com' }, exempt))
      .toMatchObject({ active:false, billingExempt:false, accessSource:null, quotaPeriodStart:null, quotaPeriodEnd:null });
    expect(accessStateFromSession({ active:true, status:'active', accessSource:'stripe', tier:'creator', imageQuota:{ limit:50 } }))
      .toMatchObject({ active:true, billingExempt:false, accessSource:'stripe' });
    expect(accessStateFromSession({ active:true, billingDisabled:true, tier:'creator' }).billingExempt).toBe(false);
    expect(accessStateFromSession({ active:false, billingExempt:true, accessSource:'exempt', imageQuota:{ limit:50 } }))
      .toMatchObject({ active:false, billingExempt:false });
  });

  it('não transforma erro de rede no boot em assinatura inativa', () => {
    expect(accessStateFromSession({
      active:false, status:'offline', verificationUnavailable:true,
      error:'Confira a conexão.',
    }, { status:'loading', active:false })).toMatchObject({
      status:'loading', sessionStatus:'offline', active:false,
      verificationUnavailable:true, verificationError:'Confira a conexão.',
    });
  });

  it('preserva a sessão local ativa enquanto a verificação está indisponível', () => {
    expect(accessStateFromSession({ active:false, status:'timeout' }, {
      status:'active', active:true, email:'pessoa@empresa.com', customerId:'cus_1', tier:'creator',
    })).toMatchObject({
      status:'timeout', sessionStatus:'timeout', active:true,
      email:'pessoa@empresa.com', customerId:'cus_1', tier:'creator',
      verificationUnavailable:true,
    });
  });

  it('mantém conta realmente sem sessão como inativa', () => {
    expect(accessStateFromSession({ active:false, status:'inactive' }, {
      status:'active', active:true, email:'old@example.com',
    })).toMatchObject({ status:'inactive', active:false, email:null });
  });

  it('limpa o erro quando uma nova tentativa confirma a sessão', () => {
    expect(accessStateFromSession({
      active: true,
      status: 'active',
      email: 'pessoa@empresa.com',
    }, {
      status: 'loading',
      active: false,
      sessionStatus: 'offline',
      verificationUnavailable: true,
      verificationError: 'Confira a conexão.',
    })).toMatchObject({
      status: 'active',
      sessionStatus: 'active',
      active: true,
      verificationUnavailable: false,
      verificationError: '',
    });
  });
});

describe('atualização de uso confirma o acesso da mesma conta', () => {
  const current = Object.freeze({
    status:'active', active:true, email:'pessoa@empresa.com', customerId:'cus_1',
    tier:'creator', plan:{ id:'creator' }, currentPeriodStart:'2026-11-01', currentPeriodEnd:'2026-12-01',
    imageQuota:{ tier:'creator', limit:50, used:8, remaining:42, available:true, allowed:true },
    verificationRefreshing:true,
  });
  it('aplica active=false confirmado e não mantém plano ou período antigo', () => {
    const next = accessStateFromUsageSession({ active:false, status:'inactive', email:current.email }, current);
    expect(next).toMatchObject({ active:false, status:'inactive', email:current.email,
      tier:null, plan:null, currentPeriodStart:null, currentPeriodEnd:null,
      verificationRefreshing:false, verificationUnavailable:false,
      imageQuota:{ available:false, used:null, remaining:null, allowed:false },
    });
    expect(next.imageQuota).not.toHaveProperty('tier');
    expect(current.active).toBe(true);
    expect(current.imageQuota.remaining).toBe(42);
  });
  it('falha transitória preserva acesso local, mas deixa verificação e consumo indisponíveis', () => {
    const next = accessStateFromUsageSession({ active:false, status:'offline', error:'Conexão indisponível.' }, current);
    expect(next).toMatchObject({ active:true, status:'offline', email:current.email, customerId:'cus_1', tier:'creator',
      verificationRefreshing:false, verificationUnavailable:true, verificationError:'Conexão indisponível.',
      imageQuota:{ available:false, used:null, remaining:null, allowed:false },
    });
  });
  it('confirma assinatura ativa mesmo se apenas o contador de uso estiver indisponível', () => {
    const next = accessStateFromUsageSession({ active:true, status:'active', email:current.email, customerId:'cus_1',
      tier:'creator', imageQuota:{ status:'unavailable', available:false },
    }, { ...current, status:'offline', verificationUnavailable:true, verificationError:'Falha anterior.' });
    expect(next).toMatchObject({ active:true, status:'active', verificationRefreshing:false, verificationUnavailable:false, verificationError:'',
      imageQuota:{ status:'unavailable', available:false },
    });
  });
  it.each([
    { email:'outra@empresa.com', customerId:'cus_2' },
    { email:'pessoa@empresa.com', customerId:'cus_2' },
  ])('não substitui a conta atual por outra identidade retornada', identity => {
    expect(accessStateFromUsageSession({ active:true, status:'active', tier:'max', ...identity }, current)).toMatchObject({
      active:true, email:current.email, customerId:'cus_1', tier:'creator',
      verificationRefreshing:false, verificationUnavailable:true, status:'error',
      imageQuota:{ available:false, remaining:null },
    });
  });
});
