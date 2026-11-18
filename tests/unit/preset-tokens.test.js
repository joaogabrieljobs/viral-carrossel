import { describe, it, expect } from 'vitest';
import {
  resolvePresetText,
  resolvePresetChrome,
  resolvePresetChromeDetalhado,
  textoParaEdicao,
  exemploDe,
} from '../../src/utils/preset-tokens.js';

const ANO = String(new Date().getFullYear());
const semMarca = { name: 'Padrão', handle: '' };
const comMarca = { name: 'Ateliê Traço', handle: 'atelietraco' };

describe('tokens de preset — o card nunca imprime texto provisório', () => {
  it('no card, token sem valor resolve para vazio', () => {
    expect(resolvePresetText('{handle}', semMarca)).toBe('');
    expect(resolvePresetText('{marca}', semMarca)).toBe('');
    expect(resolvePresetText('{exemplo:SUA EDITORIA}', semMarca)).toBe('');
    expect(resolvePresetText('{exemplo:SUA EDITORIA}', comMarca)).toBe('');
    expect(resolvePresetText('{ano}', semMarca)).toBe(ANO);
  });

  it('no card, token com valor usa a marca real', () => {
    expect(resolvePresetText('{handle}', comMarca)).toBe('@atelietraco');
    expect(resolvePresetText('{marca}', comMarca)).toBe('Ateliê Traço');
    expect(resolvePresetText('{marca}', { name: 'Padrão', handle: '@nina' })).toBe('nina');
    expect(resolvePresetText('©{ano} {marca}', comMarca)).toBe(`©${ANO} Ateliê Traço`);
  });

  it('o handle provisório gravado como texto não conta como handle real', () => {
    expect(resolvePresetText('{handle}', { handle: '@seuperfil' })).toBe('');
    expect(resolvePresetText('{handle}', { handle: '@SeuPerfil' })).toBe('');
  });

  it('na miniatura do seletor, o preset mostra a sua cara', () => {
    const preview = { modo: 'preview' };
    expect(resolvePresetText('{handle}', null, preview)).toBe('@seuperfil');
    expect(resolvePresetText('{marca}', null, preview)).toBe('SUA MARCA');
    expect(resolvePresetText('{exemplo:#SUAHASHTAG}', null, preview)).toBe('#SUAHASHTAG');
    expect(resolvePresetText('Tema|{exemplo:Sua editoria}', null, preview)).toBe('Tema|Sua editoria');
    expect(resolvePresetText('{marca}', comMarca, preview)).toBe('Ateliê Traço');
  });

  it('texto sem token passa intacto, inclusive o que parece provisório', () => {
    // A pessoa pode digitar isto de propósito; origem não se deduz do valor.
    for (const texto of ['SUA EDITORIA', '#SUAHASHTAG', '@seuperfil', 'ARRASTA PRO LADO', '{desconhecido}']) {
      expect(resolvePresetText(texto, semMarca)).toBe(texto);
    }
    expect(resolvePresetText('', semMarca)).toBe('');
    expect(resolvePresetText(undefined, semMarca)).toBe(undefined);
  });
});

describe('assinatura do card — regras de visibilidade por grupo', () => {
  it('sem tokens devolve o mesmo objeto', () => {
    const marca = { ...semMarca, cultureHeaderLeft: 'SUA EDITORIA', footerPillText: '#SELOTESTE' };
    const { brand, ocultos } = resolvePresetChromeDetalhado(marca);
    expect(brand).toBe(marca);
    expect(ocultos).toEqual([]);
  });

  it('selo some quando depende de token sem valor e volta com a marca', () => {
    expect(resolvePresetChrome({ ...semMarca, footerPillText: '{handle}' }).footerPillText).toBe('');
    expect(resolvePresetChrome({ ...semMarca, footerPillText: '{exemplo:#SUAHASHTAG}' }).footerPillText).toBe('');
    expect(resolvePresetChrome({ ...comMarca, footerPillText: '{handle}' }).footerPillText).toBe('@atelietraco');
    expect(resolvePresetChromeDetalhado({ ...semMarca, footerPillText: '{handle}' }).ocultos).toEqual(['pill']);
  });

  it('coluna com token sem valor some inteira, sem deixar rótulo solto', () => {
    const r = resolvePresetChrome({ ...semMarca, cultureHeaderLeft: 'Por {marca}', cultureHeaderCenter: 'ANÁLISE', cultureHeaderYear: '' });
    expect(r.cultureHeaderLeft).toBe('');
    expect(r.cultureHeaderCenter).toBe('ANÁLISE');
  });

  it('ano sozinho não sustenta o cabeçalho', () => {
    const sports = { ...semMarca, cultureHeaderLeft: '{exemplo:DESTAQUE}', cultureHeaderCenter: '{marca}', cultureHeaderYear: '{ano}' };
    const { brand, ocultos } = resolvePresetChromeDetalhado(sports);
    expect([brand.cultureHeaderLeft, brand.cultureHeaderCenter, brand.cultureHeaderYear]).toEqual(['', '', '']);
    expect(ocultos).toEqual(['header']);
    const variante = resolvePresetChrome({ ...semMarca, cultureHeaderLeft: '{handle}', cultureHeaderYear: '©{ano}' });
    expect(variante.cultureHeaderYear).toBe('');
  });

  it('com marca, o cabeçalho mostra o que tem valor e mantém o ano', () => {
    const sports = { ...comMarca, cultureHeaderLeft: '{exemplo:DESTAQUE}', cultureHeaderCenter: '{marca}', cultureHeaderYear: '{ano}' };
    const r = resolvePresetChrome(sports);
    expect(r.cultureHeaderLeft).toBe('');
    expect(r.cultureHeaderCenter).toBe('Ateliê Traço');
    expect(r.cultureHeaderYear).toBe(ANO);
  });

  it('ano digitado pelo usuário é texto dele e sustenta o cabeçalho', () => {
    const r = resolvePresetChrome({ ...semMarca, cultureHeaderLeft: '{handle}', cultureHeaderYear: '2026' });
    expect(r.cultureHeaderYear).toBe('2026');
  });

  it('centro indefinido continua indefinido — o fallback para o handle é do renderer', () => {
    const r = resolvePresetChrome({ ...semMarca, cultureHeaderLeft: '{handle}' });
    expect('cultureHeaderCenter' in r).toBe(false);
  });

  it('barra do rodapé é atômica: perde uma coluna, some inteira', () => {
    const authority = {
      footerBarLeft: 'Tema|{exemplo:Sua editoria}',
      footerBarCenter: 'Conteúdo por|{marca}',
      footerBarRight: 'Não esqueça|de salvar',
    };
    const sem = resolvePresetChromeDetalhado({ ...semMarca, ...authority });
    expect([sem.brand.footerBarLeft, sem.brand.footerBarCenter, sem.brand.footerBarRight]).toEqual(['', '', '']);
    expect(sem.ocultos).toEqual(['footerBar']);
    // Com marca mas sem o tema preenchido, a ficha continua incompleta.
    const parcial = resolvePresetChrome({ ...comMarca, ...authority });
    expect(parcial.footerBarCenter).toBe('');
    // A pessoa digita o tema: a barra inteira aparece.
    const completa = resolvePresetChrome({ ...comMarca, ...authority, footerBarLeft: 'Tema|Retratos' });
    expect([completa.footerBarLeft, completa.footerBarCenter, completa.footerBarRight])
      .toEqual(['Tema|Retratos', 'Conteúdo por|Ateliê Traço', 'Não esqueça|de salvar']);
  });

  it('chamada funcional literal permanece com ou sem marca', () => {
    expect(resolvePresetChrome({ ...semMarca, footerPillText: 'ARRASTA PRO LADO', cultureHeaderLeft: '{handle}' }).footerPillText)
      .toBe('ARRASTA PRO LADO');
  });

  it('não altera campos que não são assinatura', () => {
    const marca = { ...semMarca, footerPillText: '{handle}', accent: '#ff0000', footerPillArrow: false };
    const r = resolvePresetChrome(marca);
    expect(r.accent).toBe('#ff0000');
    expect(r.footerPillArrow).toBe(false);
    expect(marca.footerPillText).toBe('{handle}');
  });
});

describe('campos de edição', () => {
  it('amostra some do campo e vira dica; outros tokens ficam visíveis', () => {
    expect(textoParaEdicao('{exemplo:SUA EDITORIA}')).toBe('');
    expect(textoParaEdicao('Tema|{exemplo:Sua editoria}')).toBe('Tema|');
    expect(textoParaEdicao('{marca}')).toBe('{marca}');
    expect(textoParaEdicao('Meu texto')).toBe('Meu texto');
    expect(textoParaEdicao(undefined)).toBe('');
    expect(exemploDe('Tema|{exemplo:Sua editoria}')).toBe('Sua editoria');
    expect(exemploDe('sem amostra')).toBe('');
  });
});
