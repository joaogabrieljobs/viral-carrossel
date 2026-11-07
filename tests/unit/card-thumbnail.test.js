import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CardThumbnail, { cardThumbnailModel } from '../../src/components/card/CardThumbnail.jsx';
import { AccountHomeShell } from '../../src/components/AccountHomeShell.jsx';
import LibraryModal from '../../src/components/LibraryModal.jsx';
import { brandForFormatDisplay, slideForFormatDisplay } from '../../src/utils/format-view.js';

describe('CardThumbnail', () => {
  it('mostra o texto do card 1 também em fundos claros da Biblioteca', () => {
    const html = renderToStaticMarkup(React.createElement(CardThumbnail, {
      slide:{ id:'s1', title:'Título visível' },
      brand:{ bg:'#ffffff', titleColor:'#171717' },
      index:0,
      count:4,
      width:56,
      height:70,
    }));

    expect(html).toContain('data-vc-card-thumbnail="true"');
    expect(html).toContain('data-vc-thumbnail-title="true"');
    expect(html).toContain('Título visível');
    expect(html).toContain('background:#ffffff');
    expect(html).toContain('color:#171717');
    expect(html).toContain('04');
  });

  it('é usado pelas duas bibliotecas de projetos, inclusive sem foto', () => {
    const entry = {
      id:'project-1', name:'Projeto claro', status:'draft',
      doc:{
        fmt:'quadrado',
        brand:{ bg:'#ffffff', titleColor:'#161616' },
        slides:[{ id:'s1', title:'Capa do projeto' }],
        formatViews:{ quadrado:{ slides:{ s1:{ visualBrand:{ bg:'#a52a2a', titleColor:'#ffffff' } } } } },
      },
    };
    const home = renderToStaticMarkup(React.createElement(AccountHomeShell, {
      library:[entry], initialProjectView:'library', openDoc() {}, onStartCreation() {},
    }));
    const modal = renderToStaticMarkup(React.createElement(LibraryModal, {
      open:true, library:[entry], onClose() {}, onOpen() {},
    }));

    expect(home).toContain('data-vc-card-thumbnail="true"');
    expect(home).toContain('Capa do projeto');
    expect(home).toContain('background:#a52a2a');
    expect(modal).toContain('data-vc-card-thumbnail="true"');
    expect(modal).toContain('Capa do projeto');
    expect(modal).toContain('background:#a52a2a');
  });

  it('mantém o título acima da foto e legível quando a imagem falha', () => {
    const html = renderToStaticMarkup(React.createElement(CardThumbnail, {
      slide:{ id:'s1', title:'Produto', bgImage:'blob:foto', titleColor:'#111111' },
      brand:{ bg:'#ffffff' },
      index:0,
    }));

    expect(html.indexOf('data-vc-thumbnail-photo="true"'))
      .toBeLessThan(html.indexOf('data-vc-thumbnail-title="true"'));
    expect(html).toContain('z-index:2');
    expect(html).toContain('color:#fff');
    expect(html).toContain('Produto');
  });

  it('deriva a mesma vista por formato do canvas e volta ao visual anterior no undo', () => {
    const baseBrand = { bg:'#ffffff', titleColor:'#111111' };
    const slides = [
      { id:'s1', title:'PRODUTO' },
      { id:'s2', title:'PESSOA' },
    ];
    const before = {
      quadrado:{
        brand:{ bg:'#f7f7f5' },
        slides:{
          s1:{ visualBrand:{ bg:'#a52a2a', titleColor:'#ffffff' } },
          s2:{ visualBrand:{ bg:'#075985', titleColor:'#ffffff' } },
        },
      },
    };
    const imported = {
      quadrado:{
        brand:{ bg:'#f7f7f5' },
        slides:{ s1:{ visualBrand:{ bg:'#ffffff', titleColor:'#111111' } } },
      },
    };
    const modelsFor = (formatViews) => {
      const displayBrand = brandForFormatDisplay(baseBrand, 'quadrado', formatViews);
      return slides.map((slide, index) => cardThumbnailModel(
        slideForFormatDisplay(slide, 'quadrado', formatViews),
        displayBrand,
        index,
      ));
    };

    expect(modelsFor(imported).map((model) => model.background)).toEqual(['#ffffff', '#f7f7f5']);
    // Cmd+Z devolve o snapshot anterior; não existe cache visual na miniatura.
    expect(modelsFor(before).map((model) => model.background)).toEqual(['#a52a2a', '#075985']);
    expect(modelsFor(before).map((model) => model.titleColor)).toEqual(['#ffffff', '#ffffff']);
  });
});
