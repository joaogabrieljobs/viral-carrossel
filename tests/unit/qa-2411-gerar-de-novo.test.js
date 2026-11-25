import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importedPhotosWarning, regenerationDefaults, resolveGenerationLanguage } from '../../src/utils/regeneration-defaults.js';
import { resolveRequestedContentLanguage } from '../../src/utils/generation-prompts.js';

// QA 24/11 (editor 5): "Gerar de novo" num projeto que já tem cards abria o
// assistente em branco (tema vazio, 6 cards, idioma padrão), não avisava que as
// fotos enviadas saem e mostrava um "0" solto na revisão.
const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const modal = source('src/components/panels/GenerateModal.jsx');
const app = source('ViralCarrossel.jsx');

function sectionBetween(text, start, end) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  expect(from, `marcador ausente: ${start}`).toBeGreaterThanOrEqual(0);
  expect(to, `marcador ausente: ${end}`).toBeGreaterThan(from);
  return text.slice(from, to);
}

const cards = [
  { id: 'a', title: 'Why your launch stalls', subtitle: 'The plan was fine and the timing was not.', bgImage: 'blob:1', bgImageId: 'img-1', bgImageSource: 'imported' },
  { id: 'b', title: 'What the team does with this', subtitle: 'Pick one channel and stay with it for a month.', bgImageId: 'img-2', bgImageSource: 'ai' },
  { id: 'c', title: 'How to start this week', subtitle: 'Write the offer and send it to ten people from your list.', bgImageAssetId: 'asset-3', bgImageSource: 'imported' },
  { id: 'd', title: 'From idea to the first sale', subtitle: 'Small steps that you can repeat.' },
  { id: 'e', title: 'Save this for your next launch', subtitle: '' },
  { id: 'f', title: 'Follow for more', subtitle: '' },
  { id: 'g', title: 'The end', subtitle: '' },
];

describe('QA 24/11 editor 5 — gerar de novo num projeto existente', () => {
  it('pré-preenche tema e quantidade com o que o projeto tem hoje', () => {
    const defaults = regenerationDefaults({ slides: cards, editorialContext: { topic: '  Launch plan for freelancers  ' } });
    expect(defaults).toMatchObject({ existing: true, topic: 'Launch plan for freelancers', count: 7, importedPhotos: 2 });
    expect(defaults.contentSample).toContain('Why your launch stalls');
  });

  it('projeto novo (só o card de exemplo) continua abrindo em branco', () => {
    const blank = regenerationDefaults({ slides: [{ id: 'x', title: 'Seu título aqui', subtitle: '' }], editorialContext: { topic: 'antigo' } });
    expect(blank).toMatchObject({ existing: false, topic: '', count: null, importedPhotos: 0, contentSample: '' });
  });

  it('sem idioma reconhecível no pedido, vale o idioma do conteúdo atual', () => {
    const { contentSample } = regenerationDefaults({ slides: cards, editorialContext: { topic: 'Launch plan' } });
    const semProjeto = resolveGenerationLanguage({ topic: 'Launch plan' });
    expect(semProjeto.language).toMatchObject({ code: 'pt-BR', source: 'default' });
    const comProjeto = resolveGenerationLanguage({ topic: 'Launch plan', currentContent: contentSample });
    expect(comProjeto.language).toMatchObject({ code: 'en', label: 'inglês', source: 'current' });
    // O pedido que segue para a IA resolve o mesmo idioma no detector que já existe.
    expect(resolveRequestedContentLanguage(comProjeto.input).code).toBe('en');
  });

  it('pedido ou instrução com idioma claro vence o conteúdo atual', () => {
    const currentContent = cards.map((card) => `${card.title}\n${card.subtitle}`).join('\n');
    const instrucao = resolveGenerationLanguage({ instructions: 'Escreva o conteúdo em português brasileiro', topic: 'Launch plan', currentContent });
    expect(instrucao.language).toMatchObject({ code: 'pt-BR', source: 'instructions' });
    const pedido = resolveGenerationLanguage({ topic: 'Como o time usa a lista para vender com uma oferta que o cliente entende e que a equipe sustenta por um mês', currentContent });
    expect(pedido.language).toMatchObject({ code: 'pt-BR', source: 'brief' });
    expect(pedido.input.topic).toContain('Como o time');
  });

  it('avisa quantas fotos enviadas saem, no singular e no plural', () => {
    expect(importedPhotosWarning(0)).toBe('');
    expect(importedPhotosWarning(1)).toBe('A foto que você enviou sai junto com os cards atuais.');
    expect(importedPhotosWarning(3, 'slides')).toBe('As 3 fotos que você enviou saem junto com os slides atuais.');
    expect(importedPhotosWarning(2)).not.toMatch(/—|importad/i);
  });

  it('o editor entrega os dados do projeto atual ao assistente', () => {
    const mount = sectionBetween(app, '<GenerateModal', 'hookLibrary={hookLibrary}');
    expect(mount).toContain('defaultTopic={prefilledTopic || regenerationSetup.topic}');
    expect(mount).toContain('currentProject={regenerationSetup}');
    // A confirmação que já existe antes de substituir os cards leva o aviso das fotos.
    const dialog = sectionBetween(app, 'title="Substituir os cards?"', 'confirmLabel="Substituir"');
    expect(dialog).toContain('importedPhotosWarning(');
  });

  it('a geração usa o mesmo idioma que a revisão mostra', () => {
    const generate = sectionBetween(app, 'const handleGenerate = async', 'const contextoModoPerso');
    expect(generate).toMatch(/resolveGenerationLanguage\(\{[\s\S]{0,260}currentContent:/);
    expect(generate).toContain('buildContentLanguageRule(languageInput)');
  });

  it('o assistente abre com a quantidade atual e mostra o aviso das fotos na revisão', () => {
    expect(modal).toContain('currentProject = null');
    expect(modal).toMatch(/setCount\(currentCount \?\? /);
    expect(modal).toContain("'igual ao conteúdo atual'");
    expect(modal).toContain('importedPhotosWarning(currentProject?.importedPhotos');
    const review = sectionBetween(modal, 'ETAPA 4 — REVISÃO', 'RODAPÉ FIXO');
    expect(review).toContain('{photosWarning} Desfazer recupera esta versão.');
  });

  it('a revisão não usa quantidade como condição de JSX (era o "0" solto)', () => {
    const review = sectionBetween(modal, 'ETAPA 4 — REVISÃO', 'RODAPÉ FIXO');
    expect(review).not.toMatch(/\.length\)\s*(?:\|\||&&|\))/);
  });
});
