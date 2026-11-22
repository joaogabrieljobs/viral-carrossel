// Catálogo final dos prompts de carrossel (revisão de 22/11). O fixture guarda
// o "Texto final" de cada bloco com os valores de exemplo da exportação
// (6 cards, densidade Balanceado, família Revista). O código monta o mesmo
// texto com os mesmos parâmetros; o que é dinâmico continua dinâmico.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as g from '../../src/utils/generation-prompts.js';
import { buildNarrativeModeSequence, narrativeFunctionIds } from '../../src/utils/narrative-sequence.js';
import { buildEditorialStrategyBlock, buildContentObjectiveReminder } from '../../src/utils/editorial-strategy.js';
import { buildSocialSequencePrompt, NARRATIVE_VISUAL_MATRIX } from '../../src/utils/social-sequence.js';
import { NARRATIVE_CHOICES } from '../../src/utils/create-project-flow.js';
import { LUNA_STYLE_RULES } from '../../src/config/model-style.js';
import { buildVisualBiblePromptRules } from '../../src/utils/visual-bible.js';

const catalogo = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/prompts-carrossel-catalogo-2211.json', import.meta.url)), 'utf8'));
const MODOS = Object.keys(catalogo.metodo);
const COM_ARCO = MODOS.filter(id => id !== 'none');
const TOM = '[tom]';
const PEDIDO = '[pedido]';
const NEUTRO = { fidelity: 50, creativity: 50, irreverence: 50, objectivity: 50 };

describe('catálogo 22/11 — método do modo (bloco 1)', () => {
  it.each(MODOS)('%s usa o método revisado', (id) => {
    expect(g.resolveGenMode(id).method).toBe(catalogo.metodo[id]);
  });

  it('nenhum método pede mais cena, dor ou gancho que o material não dá', () => {
    const todos = COM_ARCO.map(id => g.resolveGenMode(id).method).join('\n');
    for (const antigo of ['IN MEDIAS RES', 'BERRANTE CONTROLADO', 'IDENTIFICAÇÃO brutal', 'SELO/CATEGORIA', 'PERGUNTA que tira sono']) expect(todos).not.toContain(antigo);
    expect(g.resolveGenMode('storytelling').method).toContain('o material não sustenta este modo');
    expect(g.resolveGenMode('pain').method).toContain('sem inventar dor para vender');
  });
});

describe('catálogo 22/11 — roteiro card a card (bloco 2)', () => {
  it.each(COM_ARCO)('%s: 6 cards batem com o catálogo', (id) => {
    expect(buildNarrativeModeSequence(id, 'livre', 6)).toBe(catalogo.roteiro[id]);
    expect(narrativeFunctionIds(id, 6)).toEqual(catalogo.funcoes6[id]);
  });

  it('"Seguir meu pedido" continua sem roteiro', () => {
    expect(buildNarrativeModeSequence('none', 'livre', 6)).toBe('');
    expect(narrativeFunctionIds('none', 6)).toEqual([]);
  });

  it('o cabeçalho usa o nome da tela e a quantidade pedida', () => {
    expect(buildNarrativeModeSequence('jornalistico', 'livre', 8).split('\n')[0]).toBe('ROTEIRO DO MODO «Informar com clareza» — 8 CARDS:');
    expect(buildNarrativeModeSequence('sensacionalista', 'livre', 4).split('\n')[0]).toBe('ROTEIRO DO MODO «Criar alto impacto» — 4 CARDS:');
  });

  it.each([3, 4, 5, 7, 8, 10, 12, 24])('com %i cards há um valor de funcao e uma posição no roteiro para cada card', (count) => {
    for (const id of COM_ARCO) {
      const ids = narrativeFunctionIds(id, count);
      expect(ids, id).toHaveLength(count);
      const bloco = buildNarrativeModeSequence(id, 'livre', count);
      expect(bloco, id).toContain(`valores de funcao desta solicitação: ${ids.join(' | ')}.`);
      // A última posição numerada do roteiro é a do último card.
      const numeros = [...bloco.split('Como aplicar:')[0].matchAll(/(?:^|[\s–])(\d+)\. [A-ZÁÂÃÉÊÍÓÔÕÚÇ]/gmu)].map(m => Number(m[1]));
      expect(Math.max(...numeros), `${id} ${count}`).toBe(count);
    }
  });

  it('4 cards: abertura, começo do arco, última função do argumento e fecho', () => {
    expect(narrativeFunctionIds('editorial', 4)).toEqual(['TESE', 'LEITURA COMUM', 'CONSEQUÊNCIA', 'CONCLUSÃO']);
    expect(narrativeFunctionIds('pain', 4)).toEqual(['IDENTIFICAÇÃO', 'VALIDAÇÃO', 'RAIZ', 'CONVITE']);
    expect(narrativeFunctionIds('storytelling', 4)).toEqual(['CENA', 'CONTEXTO', 'CONSEQUÊNCIA', 'DESFECHO']);
    expect(narrativeFunctionIds('how_to', 4)).toEqual(['PROMESSA', 'PASSO 1', 'PASSO 2', 'SÍNTESE']);
    const editorial = buildNarrativeModeSequence('editorial', 'livre', 4);
    expect(editorial).toContain('2. CONTEXTO — a situação documentada que torna a tese relevante; leitura comum só se fornecida.');
    expect(editorial).toContain('3. IMPLICAÇÃO — consequência ou critério de decisão no alcance do material.');
    expect(editorial).toContain('4. CONCLUSÃO — conclusão da tese e CTA pedido, sem recapitular os fatos.');
  });

  it('8 e 10 cards: entram a função extra do modo e a repetição do desenvolvimento, ambas condicionadas ao material', () => {
    expect(narrativeFunctionIds('editorial', 8)).toEqual(['TESE', 'LEITURA COMUM', 'CONTRASTE', 'MECANISMO', 'EVIDÊNCIA', 'EVIDÊNCIA', 'CONSEQUÊNCIA', 'CONCLUSÃO']);
    expect(narrativeFunctionIds('pain', 8)).toEqual(['IDENTIFICAÇÃO', 'VALIDAÇÃO', 'RAIZ', 'O QUE NÃO RESOLVE', 'SAÍDA', 'COMO FUNCIONA', 'COMO FUNCIONA', 'CONVITE']);
    expect(narrativeFunctionIds('storytelling', 10)).toEqual(['CENA', 'CONTEXTO', 'DESENVOLVIMENTO', 'VIRADA', 'DESENVOLVIMENTO', 'DESENVOLVIMENTO', 'DESENVOLVIMENTO', 'CONSEQUÊNCIA', 'SIGNIFICADO', 'DESFECHO']);
    expect(narrativeFunctionIds('how_to', 10)).toEqual(['PROMESSA', ...Array.from({ length: 8 }, (_, i) => `PASSO ${i + 1}`), 'SÍNTESE']);
    const dor = buildNarrativeModeSequence('pain', 'livre', 8);
    // O catálogo só admite tentativa anterior quando o material a informa.
    expect(dor).not.toContain('talvez já tenha tentado');
    expect(dor).toMatch(/4\. [^\n]*que o material diz não resolver/);
    const fundo = buildNarrativeModeSequence('deep', 'livre', 10);
    expect(fundo).not.toMatch(/PADRÃO —|AUTÓPSIA —/);
  });

  it('passo a passo: a faixa de execução e a contagem acompanham a quantidade', () => {
    const seis = buildNarrativeModeSequence('how_to', 'livre', 6);
    expect(seis).toContain('2–5. EXECUÇÃO — ');
    expect(seis).toContain('Quatro posições não significam quatro passos obrigatórios');
    const dez = buildNarrativeModeSequence('how_to', 'livre', 10);
    expect(dez).toContain('2–9. EXECUÇÃO — ');
    expect(dez).toContain('Oito posições não significam oito passos obrigatórios');
    expect(dez).toContain('10. CONCLUSÃO — ');
    const quatro = buildNarrativeModeSequence('how_to', 'livre', 4);
    expect(quatro).toContain('2–3. EXECUÇÃO — ');
    expect(quatro).toContain('Duas posições não significam dois passos obrigatórios');
    const tres = buildNarrativeModeSequence('how_to', 'livre', 3);
    expect(tres).toContain('2. EXECUÇÃO — ');
    expect(tres).not.toMatch(/posições não significam/);
  });

  it('história: os dois ramos recebem a mesma quantidade de posições', () => {
    const oito = buildNarrativeModeSequence('storytelling', 'livre', 8);
    const [historia, processo] = ['HISTÓRIA FORNECIDA: ', 'PROCESSO FORNECIDO, SEM HISTÓRIA: '].map(rotulo => oito.split('\n').find(linha => linha.startsWith(rotulo)));
    expect(historia).toContain('8. DESFECHO — ');
    expect(processo).toContain('8. FECHO — ');
    expect(historia).not.toContain('9. ');
    expect(oito).toContain('Escolha apenas um ramo sustentado pelo material');
  });
});

describe('catálogo 22/11 — objetivo e estratégia (bloco 3)', () => {
  it('com modo escolhido e objetivo automático bate com o catálogo', () => {
    for (const id of COM_ARCO) expect(buildEditorialStrategyBlock('auto', 'livre', null, { narrativeMode: id })).toBe(catalogo.estrategia);
  });

  it('a frase do objetivo continua sendo a que o código escolhe', () => {
    expect(buildContentObjectiveReminder('saves').split('\n')[0]).toBe('OBJETIVO DO CONTEÚDO: Gerar salvamentos. Criar uma referência útil para consultar depois.');
    expect(buildContentObjectiveReminder('saves')).toContain('Ação final: Salvamento com ocasião concreta de uso.');
    expect(buildContentObjectiveReminder('auto')).not.toContain('Escolha uma única ação final');
    expect(buildContentObjectiveReminder('saves')).toContain('Preserve a promessa sustentada pelo material já feita');
  });

  it('objetivo explícito mantém a biblioteca editorial e a frase de como usá-la dentro do modo', () => {
    const bloco = buildEditorialStrategyBlock('saves', 'livre', null, { narrativeMode: 'editorial' });
    expect(bloco).toContain('BIBLIOTECA EDITORIAL');
    expect(bloco).toContain('use a estrutura como funções adaptáveis dentro dele, sem trocar o modo');
    expect(bloco).not.toContain('O arco vem do ROTEIRO DO MODO');
  });
});

describe('catálogo 22/11 — layout e fidelidade (bloco 4)', () => {
  it.each(MODOS)('%s: híbrido Balanceado com 6 cards bate com o catálogo', (id) => {
    expect(g.buildGenerationSlideLayoutRules(id, 'livre', '1_2', 6)).toBe(catalogo.layout);
  });

  it('os tetos continuam vindo da densidade', () => {
    const denso = g.buildGenerationSlideLayoutRules('editorial', 'livre', '1_1', 9);
    expect(denso).toContain('Slide 1 e Slide 2: subtítulo até 80 caracteres');
    expect(denso).toContain('Do terceiro card em diante, quando houver: "title" OBRIGATÓRIO');
    expect(denso).toContain('"subtitle" acima da fotografia: até 160 caracteres');
    expect(denso).not.toMatch(/Slide 3 a Slide \d+/);
  });
});

describe('catálogo 22/11 — linguagem e tom (bloco 5)', () => {
  it.each(MODOS)('%s: regras de texto e a linha final batem com o catálogo', (id) => {
    expect(`${g.buildGenerationLanguageLayer('livre', TOM, id)}\n${g.buildGenerationLanguageGuard('livre', id)}`).toBe(catalogo.linguagem[id]);
  });

  it('apresentação e pacote Cultura mantêm a linha final de antes', () => {
    const padrao = 'Não invente garantia, prazo, preço, item incluso ou promessa comercial que não esteja no material. Se for hipótese, escreva isso.';
    expect(g.buildGenerationLanguageGuard('apresentacao', 'pain')).toBe(padrao);
    expect(g.buildGenerationLanguageGuard('tendencia_cultura', 'jornalistico')).toBe(padrao);
    expect(g.buildGenerationLanguageGuard('livre', 'editorial')).toBe(padrao);
  });
});

describe('catálogo 22/11 — legenda (blocos 6 e 7)', () => {
  it.each(MODOS)('%s: estrutura da legenda bate com o catálogo', (id) => {
    expect(g.buildCaptionOutlineInstructions(id, 'livre')).toBe(catalogo.legendaEstrutura[id]);
  });

  it.each(MODOS)('%s: voz da legenda bate com o catálogo', (id) => {
    expect(g.buildCaptionVoiceRules('livre', id)).toBe(catalogo.legendaVoz[id]);
  });

  it('a legenda não repete mais o bloco inteiro de fidelidade nem sugere CTA por modo', () => {
    for (const id of MODOS) {
      const bloco = g.buildCaptionOutlineInstructions(id, 'livre');
      expect(bloco, id).not.toContain('FIDELIDADE AO MATERIAL');
      expect(bloco, id).not.toContain('ESTRUTURA DA LEGENDA');
      expect(bloco, id).not.toContain('As sugestões de CTA acima');
    }
  });

  it('apresentação continua com notas, sem regra de Instagram', () => {
    expect(g.buildCaptionOutlineInstructions('editorial', 'apresentacao')).toMatch(/^NOTAS DA APRESENTAÇÃO/);
    expect(g.buildCaptionOutlineInstructions('editorial', 'apresentacao')).not.toContain('hashtags específicas');
  });
});

describe('catálogo 22/11 — sequência visual (bloco 8)', () => {
  it.each(MODOS)('%s: família Revista em Balanceado bate com o catálogo', (id) => {
    expect(buildSocialSequencePrompt({ family: 'revista', narrative: id, densityId: '1_2' })).toBe(catalogo.sequenciaVisual[id]);
  });

  it('título e capa acompanham a densidade', () => {
    const essencial = buildSocialSequencePrompt({ family: 'revista', narrative: 'editorial', densityId: '1_5' });
    expect(essencial).toContain('título de até 8 palavras e 48 caracteres');
    expect(essencial).toContain(`é de ${g.scaledCeiling(80, '1_5')} caracteres quando o layout híbrido`);
    expect(buildSocialSequencePrompt({ family: null, narrative: 'editorial', densityId: '1_2' })).toBe('');
    // Sem densidade informada vale o contrato mais largo, como no CONTRATO DE TEXTO.
    expect(buildSocialSequencePrompt({ family: 'revista', narrative: 'editorial' })).toContain('título de até 12 palavras e 80 caracteres');
  });

  it('o ritmo de cada modo não pede etapa sem apoio no material', () => {
    expect(NARRATIVE_VISUAL_MATRIX.storytelling.rhythm).toContain('sem personagem ou virada fabricados');
    expect(NARRATIVE_VISUAL_MATRIX.pain.rhythm).toContain('não exija lista nem causa não comprovada');
  });
});

describe('catálogo 22/11 — contrato JSON e imagens (C04, C05)', () => {
  it('contrato do carrossel bate com o catálogo', () => {
    expect(g.buildGenerationJsonContract('livre', '1_2', 6)).toBe(catalogo.json);
    expect(g.buildGenerationJsonContract('livre', '1_2', 9)).toContain('exatamente 9 itens em slides');
  });

  it('a apresentação não recebe a regra de lista do card', () => {
    expect(g.buildGenerationJsonContract('apresentacao', '1_2', 8)).toContain('Não use outros recursos de Markdown. Copie domínios');
  });

  it('regras de imageQuery do carrossel batem com o catálogo de imagem, com a ficha visual uma única vez', () => {
    const ficha = buildVisualBiblePromptRules();
    const padrao = g.buildGenerationImageLayer('livre', PEDIDO, '', '', false);
    expect(padrao).toBe(catalogo.imagem['carousel.default'].replace('<<FICHA>>', ficha));
    expect(padrao.split(ficha)).toHaveLength(2);
    expect(g.buildGenerationImageLayer('livre', PEDIDO, '', '', true)).toBe(catalogo.imagem['carousel.style'].replace('<<FICHA>>', ficha));
    expect(g.buildGenerationImageLayer('tendencia_cultura', PEDIDO, '', '', false)).toBe(catalogo.imagem['carousel.culture']);
    expect(g.buildGenerationImageLayer('apresentacao', PEDIDO, '', '', false, 'pitch')).toBe(catalogo.imagem['deck.pitch']);
  });

  const valor = { high: 80, midHigh: 65, midLow: 35, low: 20 };
  it.each(Object.keys(catalogo.eixosPT))('eixo %s vira a instrução do catálogo', (chave) => {
    const [eixo, faixa] = chave.split('.');
    expect(g.buildImgParamsBlockPT({ ...NEUTRO, [eixo]: valor[faixa] }).trim()).toBe(catalogo.eixosPT[chave]);
  });

  it('eixos no meio não emitem nada; eixos combinados saem sob um único cabeçalho', () => {
    expect(g.buildImgParamsBlockPT(NEUTRO)).toBe('');
    const combinado = g.buildImgParamsBlockPT({ ...NEUTRO, fidelity: 80, creativity: 20 });
    expect(combinado.match(/DIREÇÃO DE IMAGEM/g)).toHaveLength(1);
    expect(combinado).toContain('• Fidelidade alta: mostre o sujeito ou produto pedido de maneira reconhecível.');
    expect(combinado).toContain('• CRIATIVIDADE BAIXA: composições convencionais e diretas.');
    // Instrução condicional ("quando o conteúdo permitir") não combina com "siga estritamente".
    expect(combinado).not.toContain('siga estritamente');
  });

  const en = { I04: ['fidelity', 80], I05: ['fidelity', 20], I06: ['creativity', 80], I07: ['creativity', 20], I08: ['irreverence', 80], I09: ['irreverence', 20], I10: ['objectivity', 80], I11: ['objectivity', 20] };
  it.each(Object.keys(en))('bloco %s do gerador de imagem bate com o catálogo', (chave) => {
    const [eixo, v] = en[chave];
    const texto = g.buildImgParamsTagsEN({ ...NEUTRO, [eixo]: v });
    expect(texto.startsWith('\n')).toBe(true);
    expect(texto.trim()).toBe(catalogo.eixosEN[chave]);
  });

  it('eixos em inglês combinados mantêm um só prefixo e todas as frases', () => {
    expect(g.buildImgParamsTagsEN(NEUTRO)).toBe('');
    const texto = g.buildImgParamsTagsEN({ fidelity: 80, creativity: 80, irreverence: 20, objectivity: 20 });
    expect(texto.match(/Additional art direction/g)).toHaveLength(1);
    expect(texto).toContain('literal direct subject representation, theme clearly shown; serious sober contemplative formal timeless tone, no humor.');
    expect(texto).toContain(catalogo.eixosEN.I06);
    expect(texto).toContain(catalogo.eixosEN.I11);
  });
});

describe('catálogo 22/11 — GPT-6 Luna e tela de criação', () => {
  it('regras de redação do Luna batem com o catálogo', () => {
    expect(LUNA_STYLE_RULES.trim()).toBe(catalogo.luna);
    // Entra colado ao prompt de sistema: precisa começar em linha nova.
    expect(LUNA_STYLE_RULES.startsWith('\n')).toBe(true);
  });

  it('nome, descrição e exemplo de cada modo na tela batem com o catálogo', () => {
    for (const escolha of NARRATIVE_CHOICES) {
      expect({ label: escolha.label, desc: escolha.desc, example: escolha.example }, escolha.id).toEqual(catalogo.telas[escolha.id]);
    }
  });
});
