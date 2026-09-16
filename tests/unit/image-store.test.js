// A quota do localStorage apagava imagens para conseguir gravar o documento.
// Estes casos travam o contrato do novo store: o que sai do que se persiste.
import { describe, it, expect } from 'vitest';
import { semImagensDeRuntime, idsDeImagemEmUso, dataUrlParaBlob, newImageId } from '../../src/utils/image-store.js';

const lib = (slides) => [{ id: 'd1', name: 'Doc', doc: { slides } }];

describe('semImagensDeRuntime', () => {
  it('remove o bgImage quando já existe bgImageId', () => {
    const out = semImagensDeRuntime(lib([{ id: 's1', bgImageId: 'img_1', bgImage: 'blob:http://x/1' }]));
    expect(out[0].doc.slides[0]).toEqual({ id: 's1', bgImageId: 'img_1' });
  });

  it('remove object URLs mesmo sem id — não sobrevivem ao reload', () => {
    const out = semImagensDeRuntime(lib([{ id: 's1', bgImage: 'blob:http://x/2' }]));
    expect(out[0].doc.slides[0].bgImage).toBeUndefined();
  });

  it('mantém data URL ainda não migrada (é o único sítio onde a imagem existe)', () => {
    const data = 'data:image/png;base64,AAAA';
    const out = semImagensDeRuntime(lib([{ id: 's1', bgImage: data }]));
    expect(out[0].doc.slides[0].bgImage).toBe(data);
  });

  it('não mexe em slides sem imagem nem no resto do documento', () => {
    const entrada = lib([{ id: 's1', title: 'T' }]);
    expect(semImagensDeRuntime(entrada)).toEqual(entrada);
  });
});

describe('idsDeImagemEmUso', () => {
  it('junta ids de todos os projetos, sem repetir', () => {
    const l = [
      { doc: { slides: [{ bgImageId: 'a' }, { bgImageId: 'b' }] } },
      { doc: { slides: [{ bgImageId: 'b' }, { title: 'sem foto' }] } },
    ];
    expect(idsDeImagemEmUso(l).sort()).toEqual(['a', 'b']);
    expect(idsDeImagemEmUso(null)).toEqual([]);
  });
});

describe('utilitários', () => {
  it('dataUrlParaBlob devolve o mime e recusa entrada inválida', () => {
    const b = dataUrlParaBlob('data:image/jpeg;base64,/9j/4AAQ');
    expect(b.type).toBe('image/jpeg');
    expect(dataUrlParaBlob('http://exemplo/x.png')).toBeNull();
  });

  it('newImageId gera ids distintos com prefixo', () => {
    const a = newImageId(); const b = newImageId();
    expect(a).toMatch(/^img_/);
    expect(a).not.toBe(b);
  });
});
