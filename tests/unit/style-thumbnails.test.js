// Miniaturas do seletor vêm do renderer real (scripts/build-style-thumbnails.mjs).
// Todo estilo visível no seletor precisa de uma; padrão personalizado não usa.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { STYLE_THUMBNAILS } from '../../src/styles/style-thumbnails.generated.js';
import { VISUAL_PRESETS, renderPresetPreview } from '../../src/styles/visual-presets.jsx';
import { PRESENTATION_VISUAL_PRESETS, renderPresentationPresetPreview } from '../../src/styles/presentation-presets.jsx';
import { SOCIAL_FAMILY_KEYS } from '../../src/utils/social-families.js';
import { SOCIAL_FAMILY_COVER_PHOTO } from '../../scripts/style-thumbnail-photos.mjs';

const root = path.resolve(__dirname, '../..');
const visible = [...VISUAL_PRESETS, ...PRESENTATION_VISUAL_PRESETS].filter((p) => !p.hidden && !p.isCustom);

describe('miniaturas dos estilos', () => {
  it('todo estilo visível tem miniatura e o arquivo existe em public/style-thumbs', () => {
    for (const p of visible) {
      const url = STYLE_THUMBNAILS[p.id];
      expect(url, `${p.id} sem miniatura`).toBeTruthy();
      expect(url).toMatch(new RegExp(`^/style-thumbs/${p.id}\\.jpg\\?v=[0-9a-f]{10}$`));
      expect(fs.existsSync(path.join(root, 'public', url.split('?')[0])), `${url} ausente`).toBe(true);
    }
  });

  it('não há miniatura sobrando de estilo que saiu do catálogo', () => {
    const ids = new Set(visible.map((p) => p.id));
    expect(Object.keys(STYLE_THUMBNAILS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('o seletor usa a imagem para estilos do catálogo e o desenho para o personalizado', () => {
    const social = renderPresetPreview(VISUAL_PRESETS.find((p) => p.id === 'sports_editorial'));
    expect(social.type).toBe('img');
    expect(social.props.src).toBe(STYLE_THUMBNAILS.sports_editorial);
    const deck = renderPresentationPresetPreview(PRESENTATION_VISUAL_PRESETS[0]);
    expect(deck.type).toBe('img');
    const custom = renderPresetPreview({ ...VISUAL_PRESETS.find((p) => p.id === 'sports_editorial'), isCustom: true });
    expect(custom.type).not.toBe('img');
  });

  it('cada família editorial tem a própria foto de exemplo, sem repetir', () => {
    expect(Object.keys(SOCIAL_FAMILY_COVER_PHOTO).sort()).toEqual([...SOCIAL_FAMILY_KEYS].sort());
    const photos = Object.values(SOCIAL_FAMILY_COVER_PHOTO);
    expect(new Set(photos).size).toBe(photos.length);
    for (const name of photos) expect(name).toMatch(/^[a-z]+-\d+$/);
  });

  it('o gerador usa a foto da família na capa', () => {
    const script = fs.readFileSync(path.join(root, 'scripts/build-style-thumbnails.mjs'), 'utf8');
    expect(script).toContain("from './style-thumbnail-photos.mjs'");
    expect(script).toContain('SOCIAL_FAMILY_COVER_PHOTO');
  });
});
