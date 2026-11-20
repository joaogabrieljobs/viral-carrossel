// MF-01 (reteste 19/11): sombra preta no texto de card sem foto, também no PNG.
import { describe, expect, it } from 'vitest';
import { textShadowFor } from '../../src/components/card/SlideCardInner.jsx';

describe('sombra do texto', () => {
  it('não aparece sem foto atrás, mesmo com a composição pedindo sombra', () => {
    expect(textShadowFor({ textShadow: true }, false)).toBe('none');
    expect(textShadowFor({}, false)).toBe('none');
  });
  it('aparece com foto atrás do texto ou com placa escura', () => {
    expect(textShadowFor({ textShadow: true }, true)).not.toBe('none');
    expect(textShadowFor({ textShadow: true, textBg: true }, false)).not.toBe('none');
  });
  it('respeita quem desligou a sombra', () => {
    expect(textShadowFor({ textShadow: false }, true)).toBe('none');
  });
});
