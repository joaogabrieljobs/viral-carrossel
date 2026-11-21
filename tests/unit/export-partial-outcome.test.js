import { describe, expect, it } from 'vitest';
import { packagedFilesOutcome } from '../../src/hooks/useExport.js';

// MOO-08 (auditoria 20/11): o ZIP "só fotos" e os vídeos do ZIP engoliam a
// falha de um arquivo e anunciavam "N fotos baixadas" com menos arquivos.
describe('MOO-08 — export parcial não é anunciado como completo', () => {
  it('todas empacotadas: sucesso com a contagem real', () => {
    expect(packagedFilesOutcome({ total: 4, failed: 0, label: 'fotos' })).toEqual({ level: 'success', message: '4 fotos baixadas no ZIP' });
  });

  it('parte falhou: aviso diz quantas ficaram de fora', () => {
    expect(packagedFilesOutcome({ total: 4, failed: 1, label: 'fotos' })).toEqual({
      level: 'warning', message: '3 de 4 fotos baixadas no ZIP. 1 não pôde ser lida e ficou de fora.',
    });
  });

  it('nenhuma empacotada: erro, sem ZIP vazio', () => {
    expect(() => packagedFilesOutcome({ total: 2, failed: 2, label: 'fotos' })).toThrow(/Nenhuma das 2 fotos pôde ser lida/);
  });
});
