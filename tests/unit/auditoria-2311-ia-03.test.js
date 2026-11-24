import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveMaterialPromptParts } from '../../src/utils/generation-prompts.js';
import { materialNoticeSourceText, narrativeModeMaterialNotice } from '../../src/utils/presentation.js';

// Auditoria 23/11 (IA-03): na apresentação o material chega em
// `presentationSources`; o aviso lia só o tema e pedia material que já estava
// no Conteúdo base.
const CASE = 'Antes da mudança a padaria vendia 80 pães por dia. Depois de reorganizar a vitrine, a venda aumentou 40%.';
const LESSON = 'Como fazer a massa: passo 1, misture a farinha e a água. Erro comum: sovar pouco.';
const OFFER = 'Pão de fermentação natural, 18 reais. Encomendas pelo WhatsApp até quinta.';

async function noticeFor(path, topic, content) {
  const parts = await resolveMaterialPromptParts({ content }, null, { presentationPath: path, topic });
  return narrativeModeMaterialNotice(path, materialNoticeSourceText(topic, parts));
}

describe('auditoria 23/11 IA-03: aviso de material lê o Conteúdo base', () => {
  it('Estudo de caso com antes e depois no Conteúdo base não pede material', async () => {
    expect(await noticeFor('estudo_de_caso', 'Estudo de caso da Padaria Aurora', CASE)).toBe('');
  });

  it('Aula com passo e erro no Conteúdo base não pede material', async () => {
    expect(await noticeFor('aula_workshop', 'Aula da Padaria Aurora', LESSON)).toBe('');
  });

  it('Estudo de caso só com oferta continua avisando', async () => {
    expect(await noticeFor('estudo_de_caso', 'Estudo de caso da Padaria Aurora', OFFER)).toMatch(/acrescente o contexto/);
  });

  it('no carrossel o aviso continua lendo a base factual', async () => {
    const parts = await resolveMaterialPromptParts({ content: 'A loja abriu em 2019, quando a fundadora decidiu vender pela internet.' }, null, {});
    expect(narrativeModeMaterialNotice('storytelling', materialNoticeSourceText('Nossa loja', parts))).toBe('');
    expect(narrativeModeMaterialNotice('storytelling', materialNoticeSourceText('Nossa loja', {}))).toMatch(/acrescente dois momentos/);
  });

  it('a geração monta o aviso com o material da apresentação', () => {
    const source = readFileSync(new URL('../../ViralCarrossel.jsx', import.meta.url), 'utf8');
    expect(source).toMatch(/narrativeModeMaterialNotice\([^\n]*materialNoticeSourceText\(topic, \{[^\n]*presentationSources/);
  });

  it('Aula só com oferta continua avisando', async () => {
    expect(await noticeFor('aula_workshop', 'Aula da Padaria Aurora', OFFER)).toMatch(/acrescente o conceito/);
  });
});
