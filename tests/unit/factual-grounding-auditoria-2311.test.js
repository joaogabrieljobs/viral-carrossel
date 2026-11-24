import { describe, expect, it } from 'vitest';
import { auditDraftFactuality } from '../../src/utils/factual-grounding.js';

// Auditoria 23/11: a guarda de fatos funciona por listas fechadas. Palavra
// comum derrubava a geração para "Rascunho preservado" (IA-04); "garantir" só
// era visto em três formas (IA-05); número inventado com unidade fora da lista
// passava como revisado (V4-X1); "mais de 2000 clientes em 2024" virava prova
// de "há 24 anos" (resto do MOO-12).
const SITES = 'A WebExpresso faz sites para taquerias e restaurantes de bairro. Black Friday: site de uma página por R$ 499, segunda língua grátis. Atendimento por e-mail. Vagas: 10 sites.';
const PADARIA = 'A Padaria Aurora abriu em 2019 e vende pão de fermentação natural de terça a domingo.';
const audit = (text, factualSource, extra = {}) => auditDraftFactuality(
  { slides: [{ title: 'Card', subtitle: text, bodyAfterImage: '' }] },
  { count: 1, presetId: 'livre', factualSource, currentYear: 2026, ...extra },
);
const categories = (text, source, extra) => audit(text, source, extra).map(item => item.category);

describe('IA-04 — palavra comum não é alegação', () => {
  it.each([
    'Seu site é a vitrine do seu negócio.',
    'A direct line to your customers.',
    'Um cardápio com mais sabor.',
    'Tenha o contato sempre à mão.',
    'Leia os comentários dos clientes antes de publicar.',
    'O aroma do café convida a entrar.',
  ])('não marca: %s', (frase) => {
    expect(audit(frase, SITES)).toEqual([]);
  });

  it.each([
    ['Sem reserva, depende do que sobra na vitrine.', 'disponibilidade ou escassez sem fonte'],
    ['Chame no direct.', 'canal ou serviço não informado'],
    ['Manda um direct pra gente.', 'canal ou serviço não informado'],
    ['Conta pra gente nos comentários.', 'canal ou serviço não informado'],
    ['Envie uma mensagem no WhatsApp.', 'canal ou serviço não informado'],
    ['Crosta firme e miolo aerado.', 'atributo sensorial sem fonte'],
    ['Sabor e aroma que ninguém esquece.', 'atributo sensorial sem fonte'],
    ['Pão feito à mão.', 'rotina ou feitura sem fonte'],
  ])('continua marcando: %s', (frase, category) => {
    expect(categories(frase, SITES)).toContain(category);
  });

  it('canal citado no material vale em qualquer redação', () => {
    const source = `${SITES} Atendimento pelo direct do Instagram e respostas nos comentários.`;
    expect(audit('Chame no direct.', source)).toEqual([]);
    expect(audit('Conta pra gente nos comentários.', source)).toEqual([]);
  });
});

describe('IA-05 — garantia em qualquer forma', () => {
  it.each([
    'A encomenda garante seu pão.',
    'Garanta o seu até sexta.',
    'Peça hoje para garantir a fornada.',
    'Resultados garantidos para sua loja.',
    'Entrega garantida no sábado.',
    'Satisfação garantida ou seu dinheiro de volta.',
    'We guarantee results.',
    'Guaranteed delivery.',
  ])('marca: %s', (frase) => {
    expect(categories(frase, PADARIA)).toContain('garantia');
  });

  it('negação e garantia que está no material não são marcadas', () => {
    expect(audit('Não garantimos entrega no domingo.', PADARIA)).toEqual([]);
    expect(audit('Com garantia de 30 dias.', `${PADARIA} Todo pedido tem garantia de 30 dias.`)).toEqual([]);
  });
});

describe('V4-X1 — número que o material não traz', () => {
  it.each([
    'Vendemos 41.200 pães.',
    'Mais de 300 sites entregues.',
    'Já são 1.200 famílias atendidas.',
    '12 lojas em 4 cidades.',
    'Nota 4,9 no Google.',
    'Mais de 10 mil seguidores.',
    'Fundada em 1998.',
    'Ligue 11 99999-0000.',
    'Atendimento 24h.',
  ])('marca: %s', (frase) => {
    expect(categories(frase, PADARIA)).toContain('dado sem fonte');
  });

  it.each([
    ['Desde 2019 no bairro.', PADARIA],
    ['Em 2025 foram 41.200 pães.', `${PADARIA} Em 2025 vendeu 41.200 pães.`],
    ['Foram 41200 pães.', `${PADARIA} Em 2025 vendeu 41.200 pães.`],
    ['Só 10 sites nesta leva.', SITES],
    ['Dez mil seguidores? São 10 mil.', `${PADARIA} Tem 10.000 seguidores.`],
    ['Black Friday 2026.', SITES],
    ['Promoção até 25/11.', `${SITES} A promoção vai até 25 de novembro.`],
    ['Aberto das 7h às 13:00.', `${PADARIA} Funciona das 7h às 13h.`],
    ['Site por R$ 499.', SITES],
    ['Passo 3: publique.', PADARIA],
    ['Siga @padaria2019 e marque #aurora24.', PADARIA],
  ])('não marca o que vem do material: %s', (frase, source) => {
    expect(audit(frase, source)).toEqual([]);
  });

  it('arredondamento com "mil" do número do material não é dado novo; outro número continua sendo', () => {
    const source = `${PADARIA} Em 2025 vendeu 41.200 pães.`;
    expect(audit('Mais de 41 mil pães em 2025.', source)).toEqual([]);
    expect(audit('Quase 41 mil pães vendidos em 2025.', source)).toEqual([]);
    expect(categories('Mais de 60 mil pães em 2025.', source)).toContain('dado sem fonte');
    expect(categories('Foram 41 pães.', source)).toContain('dado sem fonte');
  });

  it('número da própria enumeração (até a quantidade de cards) não é dado', () => {
    const slides = Array.from({ length: 12 }, (_, index) => ({ title: `Erro ${index + 1}`, subtitle: index === 0 ? '12 erros para rever hoje.' : 'Revise com calma.', bodyAfterImage: '' }));
    expect(auditDraftFactuality({ slides }, { count: 12, presetId: 'livre', factualSource: PADARIA, currentYear: 2026 })).toEqual([]);
  });

  it('número dado nas instruções da pessoa também é fonte', () => {
    expect(audit('São 35 fornadas por semana.', PADARIA, { userInstructions: 'Diga que são 35 fornadas por semana.' })).toEqual([]);
  });

  it('não marca duas vezes o que a regra de preço ou de quantidade já avaliou', () => {
    const issues = audit('Por R$ 899, pronto em 15 dias.', SITES);
    // Preço e prazo continuam marcados pelas regras próprias; a regra geral
    // não acrescenta "899" nem "15" como achados soltos.
    expect(issues.map(item => item.category)).toEqual(expect.arrayContaining(['preço', 'dado sem fonte']));
    expect(issues.map(item => item.claim)).not.toContain('899');
    expect(issues.map(item => item.claim)).not.toContain('15');
  });
});

describe('MOO-12 (resto) — quantidade não vira ano', () => {
  it('"mais de 2000 clientes em 2024" não sustenta "há 24 anos"', () => {
    expect(categories('Há 24 anos no mercado.', 'Atendeu mais de 2000 clientes em 2024.')).toContain('dado sem fonte');
    expect(categories('Há 14 anos no mercado.', 'Mais de 2010 clientes em 2024.')).toContain('dado sem fonte');
  });
  it('duas datas de verdade continuam sustentando a diferença', () => {
    expect(audit('Há seis anos no bairro.', 'Fundada em 2019. Em 2025 abriu a segunda loja.')).toEqual([]);
  });
});

// Reteste real de 23/11 (14 gerações em produção): dois falsos positivos
// antigos derrubaram Pitch e Caso da WebExpresso para "Rascunho preservado".
// "O pagamento acompanha a entrega" e "acompanha o avanço do projeto" foram
// lidos como item incluso; "um segundo idioma" foi lido como um segundo de tempo.
describe('reteste 23/11 — "acompanha" que segue não é item incluso', () => {
  it.each([
    'O pagamento acompanha a entrega.',
    'Cada parcela acompanha o avanço do projeto.',
    'O site acompanha seu negócio.',
    'O pagamento acompanha cada etapa.',
  ])('não marca: %s', (frase) => {
    expect(audit(frase, SITES)).toEqual([]);
  });

  it.each([
    'O pacote acompanha manual impresso e brinde.',
    'Acompanha suporte por telefone.',
    'O plano acompanha um domínio próprio.',
    'Acompanha 2 revisões de layout.',
  ])('continua marcando item que o material não traz: %s', (frase) => {
    expect(categories(frase, SITES)).toContain('item incluso');
  });
});

describe('reteste 23/11 — "um segundo idioma" é ordinal, não tempo', () => {
  it.each([
    'Escolha um segundo idioma para o site.',
    'Na Black Friday, um segundo idioma entra no site.',
    'Vale abrir um segundo site para a filial?',
  ])('não marca: %s', (frase) => {
    expect(audit(frase, SITES)).toEqual([]);
  });

  it.each([
    'O site carrega em um segundo.',
    'Leva um segundo para pedir.',
    'O pedido sai em um segundo e meio.',
    'A página abre em dois segundos.',
    'Um segundo de atraso derruba a venda.',
  ])('continua marcando tempo que o material não traz: %s', (frase) => {
    expect(categories(frase, SITES)).toContain('dado sem fonte');
  });

  it('"um segundo idioma" no material não vira prova de "em um segundo"', () => {
    expect(categories('O site abre em um segundo.', `${SITES} Você pode pedir um segundo idioma.`)).toContain('dado sem fonte');
  });
});
