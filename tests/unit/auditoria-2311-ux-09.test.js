// Auditoria 23/11 — UX-09: texto de interface com nota de desenvolvimento,
// inglês e português de Portugal. A lista vem do achado; cada frase proibida
// aqui estava num rótulo, dica, aviso ou nome lido pelo leitor de tela.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeRes } from '../helpers/http.js';
import { rateLimitResponse } from '../../api/lib/rate-limit.js';
import { VISUAL_PRESETS } from '../../src/styles/visual-presets.jsx';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const FORBIDDEN = {
  'src/components/SidebarContent.jsx': [
    'só a UX é melhor', 'Usa o mesmo bgX/bgY', 'Cover e tipografia', 'largura útil ~6%', 'esta grelha afeta',
    'label="Overlay escuro"', 'Glass ao redor do conteúdo', 'Tracking/leading', 'Escurecimento aplicado em todos os cards. Desfazer: Cmd+Z',
    'foto a preencher a zona (cover)', 'zonas normalizadas',
  ],
  'ViralCarrossel.jsx': [
    'Use o toggle', '>sidebar</strong>', 'QA: prévia à distância do polegar', 'aria-label="Preview qualidade tipográfica"',
    'aria-label={`Legenda do card ${activeIdx + 1}`}', 'aria-label={`Legenda do card ${i+1}`}',
  ],
  'src/components/panels/SlideLogoPanel.jsx': ['Carrega uma logo', 'Carrega a logo', 'importa um PNG', 'ajuste no slider', 'mantém-se', 'Desfazer: Cmd+Z'],
  'src/components/panels/BrandWorkspacePanel.jsx': ['Gerir'],
  'src/components/AccountHomeShell.jsx': ['eliminação'],
  'api/lib/rate-limit.js': ['Demasiados pedidos'],
  'api/lib/oauth-rate-limit.js': ['Demasiados pedidos'],
};

describe('UX-09 — texto de interface sem jargão, inglês ou português de Portugal', () => {
  for (const [file, phrases] of Object.entries(FORBIDDEN)) {
    it(`${file} não mostra mais as frases apontadas`, () => {
      const contents = source(file);
      for (const phrase of phrases) expect(contents, phrase).not.toContain(phrase);
    });
  }

  it('o servidor responde o limite de pedidos em português do Brasil', () => {
    const res = makeRes();
    rateLimitResponse(res, 12);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe('Muitos pedidos. Aguarde um momento e tente de novo.');
  });

  it('a descrição dos estilos, lida pelo leitor de tela, fala de cor e título, sem termo de design em inglês', () => {
    const jargon = /header|badge|pill|vibe|ornament|display|accent|cream|sans\b|lookbook|cinematic|\b3-col|N\/M|handle/i;
    for (const preset of VISUAL_PRESETS.filter((item) => item.presetGroup !== 'familias-editoriais')) {
      expect(preset.desc, preset.id).not.toMatch(jargon);
      expect(preset.desc, preset.id).toMatch(/^Fundo /);
    }
    expect(VISUAL_PRESETS.find((preset) => preset.id === 'bold_promo_rosa').desc)
      .toBe('Fundo rosa forte, título branco em caixa alta e preço riscado em âmbar');
  });

  it('o botão de legenda diz "Notas do slide" na apresentação', () => {
    const monolith = source('ViralCarrossel.jsx');
    expect(monolith).toContain('aria-label={isPresentationProject ? `Notas do slide ${activeIdx + 1}` : `Legenda do card ${activeIdx + 1}`}');
    expect(monolith).toContain('aria-label={isPresentationProject ? `Notas do slide ${i+1}` : `Legenda do card ${i+1}`}');
  });

  it('o controle de escurecimento tem o mesmo nome do botão ao lado', () => {
    const sidebar = source('src/components/SidebarContent.jsx');
    expect(sidebar).toContain('<Slider label="Escurecimento" value={slide.overlay}');
    expect(sidebar).toContain('Usar este escurecimento em todos');
  });
});
