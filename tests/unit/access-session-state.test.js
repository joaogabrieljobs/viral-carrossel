import { describe, expect, it } from 'vitest';
import { accessStateFromSession } from '../../src/hooks/useAccess.js';

describe('estado de verificação da conta', () => {
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
