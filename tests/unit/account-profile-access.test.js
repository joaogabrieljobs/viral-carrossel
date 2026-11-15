import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AccountProfile from '../../src/components/AccountProfile.jsx';

const render = accessStatus => renderToStaticMarkup(React.createElement(AccountProfile, {
  email:'conta@example.test', planTier:'creator', currentPeriodEnd:'2026-12-01T12:00:00Z',
  imageQuota:{ tier:'creator', status:'available', available:true, limit:50, used:1 },
  accessStatus,
}));

describe('Perfil não deduz assinatura a partir do plano ou saldo em cache', () => {
  it('isenção confirmada mostra ciclo de créditos sem prometer cobrança ou renovação', () => {
    const html = render({ active:true, status:'active', billingExempt:true, accessSource:'exempt', quotaPeriodEnd:'2026-12-01T12:00:00Z' });
    expect(html).toContain('Conta isenta de cobrança');
    expect(html).toContain('ciclo de créditos até 01/12/2026');
    expect(html).not.toContain('período atual até');
    expect(html).not.toContain('Acesso à assinatura confirmado');
    expect(html).not.toContain('Pagamento e cancelamento');
  });
  it('isenção em cache não vira confirmação durante falha de consulta ou após revogação', () => {
    for (const change of [{ status:'offline', verificationUnavailable:true }, { active:false, status:'inactive' }, { verificationRefreshing:true }]) {
      expect(render({ active:true, status:'active', billingExempt:true, accessSource:'exempt', ...change })).not.toContain('Conta isenta de cobrança');
    }
    expect(render({ active:true, status:'active', billingExempt:false, accessSource:'stripe' })).not.toContain('Conta isenta de cobrança');
    expect(render({ active:true, status:'active', billingExempt:true, accessSource:'stripe' })).not.toContain('Conta isenta de cobrança');
  });
  it('só mostra confirmação e período com acesso ativo verificado', () => {
    const html = render({ active:true, status:'active' });
    expect(html).toContain('Acesso à assinatura confirmado');
    expect(html).toContain('período atual até 01/12/2026');
    expect(html).not.toContain(' · renova ');
    expect(html).not.toContain('Plano individual ativo');
  });
  it('active=false confirmado não anuncia plano ativo nem usa o período antigo', () => {
    const html = render({ active:false, status:'inactive' });
    expect(html).toContain('Acesso à assinatura não confirmado');
    expect(html).not.toContain('Acesso à assinatura confirmado');
    expect(html).not.toContain('período atual até');
    expect(html).not.toContain('Plano individual ativo');
    expect(html).not.toMatch(/cancelad|pagamento atrasado/);
  });
  it.each(['offline', 'error', 'timeout'])('consulta %s não afirma estado comercial', status => {
    const html = render({ active:true, status, verificationUnavailable:true });
    expect(html).toContain('Não foi possível verificar o acesso à assinatura agora');
    expect(html).not.toContain('Acesso à assinatura confirmado');
    expect(html).not.toContain('Acesso à assinatura não confirmado');
    expect(html).not.toContain('período atual até');
  });
  it('não confunde quota indisponível com assinatura inativa', () => {
    const html = renderToStaticMarkup(React.createElement(AccountProfile, {
      accessStatus:{ active:true, status:'active' }, imageQuota:{ status:'unavailable', available:false },
    }));
    expect(html).toContain('Acesso à assinatura confirmado');
  });
  it('estado desconhecido ou em consulta não anuncia acesso ativo', () => {
    expect(render(undefined)).toContain('Acesso à assinatura ainda não verificado');
    const html = render({ active:true, status:'active', verificationRefreshing:true });
    expect(html).toContain('Verificando o acesso à assinatura');
    expect(html).not.toContain('Acesso à assinatura confirmado');
    expect(html).not.toContain('período atual até');
  });
});
