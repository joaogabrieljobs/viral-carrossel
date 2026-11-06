import { describe, expect, it, vi } from 'vitest';
import { validateVideoFile } from '../../src/utils/video-store.js';
import { INVALID_BACKUP_MESSAGE, reportInvalidBackup } from '../../src/hooks/useLibrary.js';

const file = (name, type, size = 100) => ({ name, type, size });

describe('validação de mídia importada', () => {
  it('recusa imagem mesmo quando a automação ignora accept="video/*"', () => {
    expect(validateVideoFile(file('rosto-teste.jpg', 'image/jpeg'))).toMatchObject({
      valid:false,
      message:expect.stringContaining('não é um vídeo'),
    });
    expect(validateVideoFile(file('rosto-teste.mp4', 'image/jpeg')).valid).toBe(false);
  });

  it('aceita somente MP4, MOV e WebM, inclusive quando o browser omite o MIME', () => {
    expect(validateVideoFile(file('filme.mp4', 'video/mp4'))).toMatchObject({ valid:true, mime:'video/mp4' });
    expect(validateVideoFile(file('filme.mov', 'video/quicktime'))).toMatchObject({ valid:true, mime:'video/quicktime' });
    expect(validateVideoFile(file('filme.webm', ''))).toMatchObject({ valid:true, mime:'video/webm' });
    expect(validateVideoFile(file('filme.avi', 'video/x-msvideo')).valid).toBe(false);
    expect(validateVideoFile(file('vazio.mp4', 'video/mp4', 0)).valid).toBe(false);
  });

  it('mostra backup inválido como erro temporário, sem acionar quota persistente', () => {
    const toast = vi.fn();
    reportInvalidBackup(toast);
    expect(toast).toHaveBeenCalledWith(INVALID_BACKUP_MESSAGE, 'error', 6500);
  });
});
