import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectSaveStatus } from '../../src/components/ProjectSaveStatus.jsx';

afterEach(() => vi.unstubAllGlobals());
const render = props => {
  vi.stubGlobal('navigator', { onLine:true });
  return renderToStaticMarkup(React.createElement(ProjectSaveStatus, props));
};

describe('estado de salvamento visível', () => {
  it('salvar no aparelho não anuncia confirmação da conta', () => {
    const html = render({ localSavedAt:Date.now(), onRetry:() => {} });
    expect(html).toContain('Salvo no aparelho · pendente na conta');
    expect(html).not.toContain('Salvo na conta às');
    expect(html).toContain('Tentar salvar na conta');
  });
  it('erro atual prevalece sobre uma confirmação anterior', () => {
    expect(render({ cloudSavedAt:Date.now(), error:true })).toContain('Sincronização pendente');
    expect(render({ cloudSavedAt:Date.now(), error:true })).not.toContain('Salvo na conta às');
  });
  it('confirmação válida mostra horário e envio em curso mostra progresso', () => {
    expect(render({ cloudSavedAt:Date.now() })).toContain('Salvo na conta às');
    expect(render({ cloudSavedAt:Date.now(), busy:true })).toContain('Salvando na conta');
  });
  it('sem rede distingue alterações pendentes de trabalho já confirmado', () => {
    vi.stubGlobal('navigator', { onLine:false });
    expect(renderToStaticMarkup(React.createElement(ProjectSaveStatus, { localSavedAt:Date.now() }))).toContain('Sem conexão');
    expect(renderToStaticMarkup(React.createElement(ProjectSaveStatus, { cloudSavedAt:Date.now() }))).toContain('Salvo na conta às');
  });
});
