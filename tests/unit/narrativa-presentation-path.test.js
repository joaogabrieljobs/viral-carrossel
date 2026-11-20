// Reteste 19/11: projeto Pitch mostrava "Modo narrativo: Explicar com
// autoridade" (modo de carrossel) na aba Narrativa.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NarrativaStudioPanels } from '../../src/components/panels/NarrativaStudioPanels.jsx';

const render = (props) => renderToStaticMarkup(React.createElement(NarrativaStudioPanels, { panel: 'prompt', setPanel: () => {}, narrativeMode: 'editorial', ...props }));

describe('aba Narrativa por produto', () => {
  it('apresentação mostra o tipo de apresentação, não os modos de carrossel', () => {
    const html = render({ isPresentation: true, presentationPath: 'pitch' });
    expect(html).toContain('Tipo de apresentação');
    expect(html).toMatch(/<option value="pitch" selected="">Pitch<\/option>/);
    expect(html).not.toContain('Explicar com autoridade');
    expect(html).not.toContain('Modo narrativo');
  });
  it('carrossel continua com o modo narrativo', () => {
    const html = render({});
    expect(html).toContain('Modo narrativo');
    expect(html).not.toContain('Tipo de apresentação');
  });
});
