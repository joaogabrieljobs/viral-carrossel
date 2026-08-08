import { describe, it, expect } from 'vitest';
import { canvasZonesFontScalePatch } from '../../src/utils/canvas-zones.js';

/** Slide no canvas clássico: foto em faixa superior, título e subtítulo abaixo. */
function slideClassico(titleSize, zones) {
  return {
    title: 'O público não é mais o mesmo.',
    subtitle: 'E quase nenhuma marca atualizou a leitura.',
    titleSize,
    subSize: 100,
    bodyAfterSize: 100,
    canvas: {
      enabled: true,
      variant: 'classic',
      zones: zones ?? {
        photo: { x: 0, y: 0, w: 100, h: 58 },
        title: { x: 6, y: 62, w: 88, h: 14 },
        subtitle: { x: 6, y: 77, w: 88, h: 20 },
      },
    },
  };
}

/** Aplica uma sequência de tamanhos de título encadeando o patch, como o slider faz. */
function varrer(tamanhos) {
  let atual = slideClassico(100);
  const passos = [];
  for (const ts of tamanhos) {
    const prev = atual;
    const merged = { ...prev, titleSize: ts };
    const patch = canvasZonesFontScalePatch(prev, merged);
    atual = patch ? { ...merged, ...patch } : merged;
    passos.push({ ts, zones: atual.canvas.zones });
  }
  return passos;
}

describe('canvasZonesFontScalePatch — canvas clássico', () => {
  it('não consome a zona da foto ao aumentar o título', () => {
    // O título fica ABAIXO da foto e title.y é fixo neste patch: encolher a foto
    // não abre espaço nenhum no rodapé, só apaga a imagem.
    for (const passo of varrer([110, 130, 150, 170, 180])) {
      expect(passo.zones.photo.h, `titleSize ${passo.ts}`).toBeCloseTo(58, 5);
      expect(passo.zones.photo.y, `titleSize ${passo.ts}`).toBeCloseTo(0, 5);
    }
  });

  it('devolve a altura do título ao voltar o slider (sem catraca)', () => {
    const passos = varrer([180, 150, 120, 100]);
    const fim = passos[passos.length - 1].zones;
    expect(fim.title.h).toBeCloseTo(14, 3);
    expect(fim.title.y).toBeCloseTo(62, 5);
    expect(fim.photo.h).toBeCloseTo(58, 5);
  });

  it('mantém as molduras de texto dentro do card com título no máximo', () => {
    const passos = varrer([180]);
    const z = passos[0].zones;
    expect(z.title.y + z.title.h).toBeLessThanOrEqual(98.001);
    expect(z.subtitle.y + z.subtitle.h).toBeLessThanOrEqual(98.001);
  });

  it('trava a altura do título quando não cabe mais, em vez de transbordar', () => {
    // Título já ocupando quase tudo: crescer mais não pode empurrar nada para fora.
    const prev = slideClassico(100, {
      photo: { x: 0, y: 0, w: 100, h: 40 },
      title: { x: 6, y: 50, w: 88, h: 40 },
      subtitle: { x: 6, y: 91, w: 88, h: 7 },
    });
    const merged = { ...prev, titleSize: 180 };
    const z = canvasZonesFontScalePatch(prev, merged).canvas.zones;
    expect(z.title.y + z.title.h).toBeLessThanOrEqual(98.001);
    expect(z.subtitle.y + z.subtitle.h).toBeLessThanOrEqual(98.001);
    expect(z.photo.h).toBeCloseTo(40, 5);
  });

  it('ignora variação de tamanho abaixo do limiar', () => {
    const prev = slideClassico(100);
    expect(canvasZonesFontScalePatch(prev, { ...prev, titleSize: 100.2 })).toBeNull();
  });
});
