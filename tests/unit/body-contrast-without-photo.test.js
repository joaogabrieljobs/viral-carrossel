// Apoteose8: o rascunho guarda a frase final da capa, mas a foto ainda não foi
// gerada. O renderer deve mostrar o corpo sobre o fundo real dessa etapa.
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SlideCardInner } from '../../src/components/card/SlideCardInner.jsx';
import { wcagContrast } from '../../src/utils/wcag.js';

const { doc } = JSON.parse(readFileSync(new URL('../fixtures/apoteose-teste8.json', import.meta.url), 'utf8'));
const brand = { ...doc.brand, logo: null, showHandle: false };
const cover = {
  ...doc.slides[0],
  bgImage: null,
  bgImageId: null,
  bgImageAssetId: null,
  bgImageFailed: false,
};

function renderedBody(slide, { identity = brand, forExport = false } = {}) {
  const html = renderToStaticMarkup(React.createElement(SlideCardInner, {
    slide, brand: identity, fmt: 'apresentacao', num: 1, total: 3, forExport,
  }));
  const tag = html.match(/<p\b(?=[^>]*\bdata-vc-support-text="true")([^>]*)>([\s\S]*?)<\/p>/);
  expect(tag, 'o corpo salvo precisa existir no HTML, sem ser movido às notas').toBeTruthy();
  expect(tag[2]).toContain(slide.bodyAfterImage);
  const style = tag[1].match(/\bstyle="([^"]*)"/)?.[1];
  const color = style?.match(/(?:^|;)color:([^;]+)/)?.[1];
  expect(color, 'cor efetiva do texto complementar').toMatch(/^#[0-9a-f]{6}$/i);
  return color.toLowerCase();
}

describe('corpo da capa composta para foto, enquanto a mídia não existe', () => {
  it.each([
    ['editor', false],
    ['exportação', true],
  ])('%s: a frase do rascunho lê no fundo branco', (_label, forExport) => {
    expect(cover.presentationFreeDesign).toMatchObject({ family: 'cinematic', ground: 'photo', photo: 'full' });
    expect(cover.customBg).toBe('#FFFFFF');
    const before = JSON.stringify(cover);
    const ink = renderedBody(cover, { forExport });
    expect(wcagContrast(ink, cover.customBg), `${ink} sobre ${cover.customBg}`).toBeGreaterThanOrEqual(4.5);
    expect(JSON.stringify(cover), 'renderização não reescreve o documento salvo').toBe(before);
  });

  it('foto marcada como falha também conserva a frase legível', () => {
    const slide = { ...cover, bgImageFailed: true };
    expect(wcagContrast(renderedBody(slide), slide.customBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('preserva uma tinta do corpo que já lê sobre a superfície sem foto', () => {
    const slide = { ...cover, textColor: '#2A2158' };
    expect(renderedBody(slide)).toBe('#2a2158');
  });

  it('conserva a tinta clara quando existe foto cheia com proteção escura', () => {
    // SSR não carrega o ativo: esta string só exerce a decisão da tinta para
    // uma foto existente; não há rede nem geração de imagem neste teste.
    const slide = { ...cover, bgImage: 'data:image/png;base64,iVBORw0KGgo=' };
    expect(renderedBody(slide)).toBe('#f5f5f7');
  });

  it('não impõe o novo guard às composições legadas fora da biblioteca v2', () => {
    const slide = { ...cover, presentationArtDirectionVersion: 1, presentationFreeDesign: null };
    // O caminho legado já aceita este cinza a 3:1. O conserto do rascunho
    // composto para foto não pode redesenhar a escolha desses documentos.
    expect(renderedBody(slide, { identity: { ...brand, textColor: '#777777' } })).toBe('#777777');
  });
});
