import { describe, expect, it } from 'vitest';
import { getImageCropFormat } from '../../src/components/ImageCropModal.jsx';

describe('recorte de imagem acompanha o formato do projeto', () => {
  it('usa 16:9 e nomenclatura de slide em apresentações', () => {
    const spec = getImageCropFormat('apresentacao');
    expect(spec.aspectRatio).toBeCloseTo(16 / 9, 8);
    expect(spec.label).toContain('16:9');
    expect(spec.label).toContain('1920×1080');
    expect(spec.subject).toBe('slide');
  });

  it.each([
    ['carrossel', 4 / 5, '4:5'],
    ['quadrado', 1, '1:1'],
    ['stories', 9 / 16, '9:16'],
  ])('usa a proporção correta para %s', (fmt, ratio, label) => {
    const spec = getImageCropFormat(fmt);
    expect(spec.aspectRatio).toBeCloseTo(ratio, 8);
    expect(spec.label).toContain(label);
  });

  it('volta ao feed 4:5 quando recebe formato desconhecido', () => {
    expect(getImageCropFormat('inexistente')).toMatchObject({
      key: 'carrossel',
      aspectRatio: 4 / 5,
    });
  });
});
