// Paletas de cor, fontes de título e templates prontos — dados estáticos
// compartilhados entre o editor principal e o TemplatesModal.

/** `subtitle`: cards do meio (linha curta sob o título) · `text`: corpo / blocos maiores · `accent`: Destaques. */
export const PALETTES = [
  { name:'Carbon',   bg:'#0a0a0a', title:'#ffffff', subtitle:'#e8e8e8', text:'#cfcfcf', accent:'#ff5736' },
  { name:'Midnight', bg:'#0c1220', title:'#ffffff', subtitle:'#dbeafe', text:'#b8c5d6', accent:'#6366f1' },
  { name:'Ivory',    bg:'#f5f1ea', title:'#0a0a0a', subtitle:'#3f3f46', text:'#52525b', accent:'#dc2626' },
  { name:'Forest',   bg:'#0d1f17', title:'#a3e635', subtitle:'#bef264', text:'#86efac', accent:'#a3e635' },
  { name:'Coral',    bg:'#1c0f0f', title:'#ff6b4a', subtitle:'#e8dcd8', text:'#e8b4b4', accent:'#ff5736' },
  { name:'Royal',    bg:'#1e1b4b', title:'#fde047', subtitle:'#eef0ff', text:'#c7d2fe', accent:'#fcd34d' },
  { name:'Mono',     bg:'#171717', title:'#fafafa', subtitle:'#e5e5e5', text:'#c8c8c8', accent:'#ffffff' },
  { name:'Cream',    bg:'#fef9e7', title:'#1a1a1a', subtitle:'#57534e', text:'#78716c', accent:'#b45309' },
  /* Neutro institucional — alinhado ao DEFAULT_BRAND e ao token --accent; índice fixo no final pra não quebrar templates (palette: 0–7). */
  { name:'Pearl',    bg:'#fafafc', title:'#000000', subtitle:'#363636', text:'#363636', accent:'#000000' },
];

// Fontes para títulos — agrupadas por categoria pra UI navegável.
// `cat`: 'sans' | 'display' | 'serif' | 'editorial' | 'mono'
export const TITLE_FONTS = [
  // Sans modern (default e variantes próximas)
  { name:'Outfit',         val:'"Outfit", sans-serif',                cat:'sans' },
  { name:'Inter Tight',    val:'"Inter Tight", sans-serif',           cat:'sans' },
  { name:'Inter',          val:'"Inter", sans-serif',                 cat:'sans' },
  { name:'Space Grotesk',  val:'"Space Grotesk", sans-serif',         cat:'sans' },
  { name:'DM Sans',        val:'"DM Sans", sans-serif',               cat:'sans' },
  { name:'Manrope',        val:'"Manrope", sans-serif',               cat:'sans' },
  { name:'Sora',           val:'"Sora", sans-serif',                  cat:'sans' },
  { name:'Plus Jakarta',   val:'"Plus Jakarta Sans", sans-serif',     cat:'sans' },
  { name:'Familjen',       val:'"Familjen Grotesk", sans-serif',      cat:'sans' },
  { name:'Bricolage',      val:'"Bricolage Grotesque", sans-serif',   cat:'sans' },
  { name:'Funnel',         val:'"Funnel Display", sans-serif',        cat:'sans' },
  // Display (impacto, headlines bombásticos)
  { name:'Bebas Neue',     val:'"Bebas Neue", sans-serif',            cat:'display' },
  { name:'Anton',          val:'"Anton", sans-serif',                 cat:'display' },
  { name:'Oswald',          val:'"Oswald", sans-serif',                cat:'display' },
  { name:'Archivo Black',  val:'"Archivo Black", sans-serif',         cat:'display' },
  { name:'Big Shoulders',  val:'"Big Shoulders Display", sans-serif', cat:'display' },
  { name:'Syne',           val:'"Syne", sans-serif',                  cat:'display' },
  { name:'Unbounded',      val:'"Unbounded", sans-serif',             cat:'display' },
  // Serif (autoridade, editorial)
  { name:'Playfair',       val:'"Playfair Display", serif',           cat:'serif' },
  { name:'Fraunces',       val:'"Fraunces", serif',                   cat:'serif' },
  { name:'Cormorant',      val:'"Cormorant Garamond", serif',         cat:'serif' },
  { name:'EB Garamond',    val:'"EB Garamond", serif',                cat:'serif' },
  { name:'Spectral',       val:'"Spectral", serif',                   cat:'serif' },
  { name:'Yeseva',         val:'"Yeseva One", serif',                 cat:'serif' },
  { name:'Italiana',       val:'"Italiana", serif',                   cat:'serif' },
  { name:'Caslon',         val:'"Libre Caslon Display", serif',       cat:'serif' },
  // Editorial / Mono
  { name:'Instrument',     val:'"Instrument Serif", serif',           cat:'editorial' },
  { name:'Major Mono',     val:'"Major Mono Display", monospace',     cat:'mono' },
];

/**
 * Templates: arco 7–9 slides com `composition` (ver slide-design-system.js).
 * titleFont/bodyFont = índices em TITLE_FONTS / BODY_FONTS (BODY no ViralCarrossel).
 */
export const TEMPLATES = [
  {
    id: 'erro_comum',
    name: 'Erro Comum',
    desc: 'Quebra de leitura óbvia em qualquer nicho',
    palette: 0, titleFont: 0, bodyFont: 1,
    pairingId: 'autoridade_b2b',
    creativePreset: 'quick_erro_comum',
    slides: [
      { title:'Você está fazendo errado.', subtitle:'O que parece técnica é, na verdade, sintoma de outra coisa.', q:'cinematic dark portrait moody', composition:'hook_fullbleed' },
      { title:'A leitura óbvia.', subtitle:'O mercado vê o problema na superfície. Resolve só o que aparece.', q:'urban street night blur cinematic', composition:'list_beat' },
      { title:'O mecanismo oculto.', subtitle:'O verdadeiro motor está duas camadas atrás.', body:'Quem enxerga a camada estrutural antecipa. Quem fica na superfície disputa preço.', q:'minimal dark office abstract', composition:'sandwich_editorial' },
      { title:'47%', subtitle:'Das decisões estratégicas ainda tratam o sintoma — não a causa.', composition:'stat_proof' },
      { title:'O custo de ignorar.', subtitle:'Cada ciclo sem o diagnóstico certo amplifica o erro.', q:'executive boardroom dark cinematic', composition:'reveal_bridge' },
      { title:'Quem entende, lidera.', subtitle:'A diferença não é esforço. É leitura estrutural.', q:'cinematic leadership portrait', composition:'quote_pull' },
      { title:'Salve para revisar.', subtitle:'Antes da sua próxima decisão estratégica.', q:'minimal abstract dark texture', composition:'cta_close' },
    ],
  },
  {
    id: 'tendencia',
    name: 'Tendência de Mercado',
    desc: 'Antecipa um movimento que ninguém viu',
    palette: 1, titleFont: 16, bodyFont: 0,
    pairingId: 'hype_escuro',
    creativePreset: 'quick_tendencia',
    slides: [
      { title:'O mercado está mudando.', subtitle:'E quase ninguém percebeu para onde.', q:'futuristic city night blue', composition:'hook_fullbleed' },
      { title:'O sinal antigo.', subtitle:'O que funcionava em 2023 já não move ponteiro.', q:'old technology vintage office', composition:'list_beat' },
      { title:'O sinal novo.', subtitle:'Categoria, percepção e narrativa migraram.', body:'Quem leu cedo posicionou. Quem esperou disputa atenção cara.', q:'modern minimal workspace blue', composition:'sandwich_editorial' },
      { title:'Quem perde primeiro.', subtitle:'Marcas presas no playbook antigo — volume sem significado.', q:'empty retail store cinematic', composition:'reveal_bridge' },
      { title:'3×', subtitle:'Mais retenção quando a narrativa acompanha o novo comportamento.', composition:'stat_proof' },
      { title:'O próximo diferencial.', subtitle:'Será de quem traduzir essa mudança em produto e canal.', q:'cinematic boardroom future', composition:'quote_pull' },
      { title:'Antes que vire óbvio.', subtitle:'Tendência é vantagem só enquanto poucos nomeiam.', q:'neon abstract blue motion', composition:'list_beat' },
      { title:'Comente: você já viu?', subtitle:'Quero entender se isso bate com seu mercado.', q:'minimal abstract blue texture', composition:'cta_close' },
    ],
  },
  {
    id: 'decodificacao',
    name: 'Decodificação de Marca',
    desc: 'Por que uma marca está vencendo',
    palette: 2, titleFont: 19, bodyFont: 9,
    pairingId: 'magazine_cream',
    creativePreset: 'quick_decodificacao',
    slides: [
      { title:'Por que essa marca vence.', subtitle:'Não é o produto. Não é o preço. Não é o canal.', q:'luxury retail store minimal', composition:'hook_fullbleed' },
      { title:'O que parece ser.', subtitle:'Marketing bonito. Identidade forte. Bom storytelling.', q:'creative studio bright minimal', composition:'list_beat' },
      { title:'O que realmente é.', subtitle:'Coerência radical entre promessa e comportamento.', body:'O sistema opera em silêncio: repertório, prova e presença alinhados.', q:'designer working desk minimal', composition:'sandwich_editorial' },
      { title:'Superfície × sistema', subtitle:'Um lado vende estética. O outro constrói memória.', q:'split composition brand moodboard', composition:'split_ab' },
      { title:'A lição replicável.', subtitle:'Marcas vencem quando deixam de explicar e passam a representar.', q:'minimal interior design cream', composition:'quote_pull' },
      { title:'1 regra', subtitle:'Toda decisão pública reforça a mesma promessa — ou dissolve.', composition:'stat_proof' },
      { title:'Como aplicar amanhã.', subtitle:'Audite canal, oferta e tom contra a promessa central.', q:'notebook planning cream desk', composition:'list_beat' },
      { title:'Salve antes da próxima decisão.', subtitle:'De marca, posicionamento ou campanha.', q:'minimal cream abstract', composition:'cta_close' },
    ],
  },
  {
    id: 'comportamento',
    name: 'Mudança de Comportamento',
    desc: 'Como o público mudou de verdade',
    palette: 3, titleFont: 26, bodyFont: 0,
    pairingId: 'editorial_cultura',
    creativePreset: 'quick_comportamento',
    slides: [
      { title:'O público não é mais o mesmo.', subtitle:'E quase nenhuma marca atualizou a leitura.', q:'people crowd diverse modern', composition:'hook_fullbleed' },
      { title:'O que ele dizia querer.', subtitle:'Conveniência, preço, rapidez. Era só a camada de cima.', q:'shopping mall busy people', composition:'list_beat' },
      { title:'O que ele realmente quer.', subtitle:'Pertencimento, repertório e signo de identidade.', body:'A compra virou declaração. O canal virou contexto social.', q:'community gathering authentic', composition:'sandwich_editorial' },
      { title:'A evidência.', subtitle:'Atenção migrou do “melhor preço” para “melhor significado”.', q:'phone screen social feed cinematic', composition:'reveal_bridge' },
      { title:'72%', subtitle:'Dos consumidores dizem preferir marcas que “parecem comigo”.', composition:'stat_proof' },
      { title:'A armadilha.', subtitle:'Teatralizar pertencimento sem mudar produto ou cultura.', q:'fake influencer studio lights', composition:'quote_pull' },
      { title:'Como traduzir isso.', subtitle:'Em produto, narrativa e canal — sem teatralizar.', q:'authentic portrait natural light', composition:'list_beat' },
      { title:'Quem entender, ganha relevância.', subtitle:'Quem ignorar perde atenção primeiro — receita depois.', q:'minimal green nature abstract', composition:'cta_close' },
    ],
  },
];
