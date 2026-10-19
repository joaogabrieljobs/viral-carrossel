import { describe, expect, it } from 'vitest';
import { cardElementEditorTarget } from '../../src/utils/card-editor-target.js';

describe('cardElementEditorTarget', () => {
  it('abre a caixa de texto ao clicar no título, subtítulo ou texto', () => {
    for (const key of ['title', 'subtitle', 'bodyAfterImage', 'text', 'eyebrow', 'offer']) {
      expect(cardElementEditorTarget(key)).toMatchObject({ tab: 'texto', section: 'texto-caixa' });
    }
  });

  it('abre Visual e Elementos ao clicar numa chamada', () => {
    expect(cardElementEditorTarget('ov_cta1')).toEqual({
      tab: 'visual', section: 'visual-elementos', mode: 'criador',
    });
  });

  it('abre Imagem e os ajustes ao clicar na foto', () => {
    expect(cardElementEditorTarget('photo')).toEqual({
      tab: 'imagem', section: 'imagem-ajustes', mode: 'criador',
    });
  });

  it('abre a logo na Marca', () => {
    expect(cardElementEditorTarget('logo')).toMatchObject({ tab: 'brand', section: 'marca-logo' });
  });
});
