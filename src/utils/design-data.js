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

  /* ── Paletas editoriais (índices 9+) ──────────────────────────────────────
     Vieram da biblioteca de capas. `subtitle` e `text` são o tom do título
     misturado ao fundo (12% e 28%) — mantém a família cromática em vez de
     cinza genérico. Todas medidas: título/subtítulo/corpo ≥ 4.5:1 e accent
     ≥ 3:1 contra o fundo. Dois accents da referência reprovavam e foram
     escurecidos (comentados abaixo). */
  { name:'Ink',             bg:'#080808', title:'#ffffff', subtitle:'#e1e1e1', text:'#bababa', accent:'#ff3b16' },
  { name:'Navy Sinal',      bg:'#07111f', title:'#f5f5f2', subtitle:'#d8dad9', text:'#b2b5b7', accent:'#4545ff' },
  { name:'Bege Editorial',  bg:'#f3ebdd', title:'#101010', subtitle:'#2b2a29', text:'#504d49', accent:'#8f171b' },
  { name:'Floresta Lima',   bg:'#071a10', title:'#d8f75b', subtitle:'#bfdc52', text:'#9db946', accent:'#f4f1e8' },
  { name:'Papel Preto',     bg:'#050505', title:'#f8f7f2', subtitle:'#dbdad6', text:'#b4b3b0', accent:'#ff3028' },
  /* accent era #c67a00 (2.9:1 sobre a areia) — escurecido para #8f5200 (5.4:1) */
  { name:'Areia Âmbar',     bg:'#f7eedb', title:'#202124', subtitle:'#3a3a3a', text:'#5c5a57', accent:'#8f5200' },
  { name:'Pérola Magenta',  bg:'#faf8f4', title:'#090909', subtitle:'#262625', text:'#4c4c4b', accent:'#ff2276' },
  { name:'Roxo Ouro',       bg:'#28105d', title:'#ffd400', subtitle:'#e5bc0b', text:'#c39d1a', accent:'#fff7e5' },
  { name:'Borgonha',        bg:'#240303', title:'#f7f1e9', subtitle:'#ded4cd', text:'#bcaea9', accent:'#f0222b' },
  { name:'Colagem Ácida',   bg:'#050505', title:'#f3f2ed', subtitle:'#d6d6d1', text:'#b0b0ac', accent:'#e4eb00' },
  { name:'Espresso Ouro',   bg:'#17110b', title:'#eee3d2', subtitle:'#d4caba', text:'#b2a89a', accent:'#c9ac79' },
  { name:'Grafite Laranja', bg:'#171717', title:'#fff0dc', subtitle:'#e3d6c4', text:'#beb3a5', accent:'#f04b00' },
  { name:'Blueprint',       bg:'#f7f5f0', title:'#061a38', subtitle:'#23344e', text:'#49576c', accent:'#d6202a' },
  { name:'Tech Gelo',       bg:'#02070c', title:'#f6f8f8', subtitle:'#d9dbdc', text:'#b2b5b6', accent:'#a9d8ff' },
  { name:'Commerce Rosa',   bg:'#030303', title:'#fff5ee', subtitle:'#e1d8d2', text:'#b8b1ac', accent:'#ff006c' },
  /* accent era #36e31a (1.0:1 sobre a pedra — invisível) — escurecido para #0f5407 (5.1:1) */
  { name:'Pedra Verde',     bg:'#d6be9e', title:'#080808', subtitle:'#211e1a', text:'#423b32', accent:'#0f5407' },
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
  /*
   * Regras de qualidade (tests/unit/templates.test.js reprova quem violar):
   *
   * COPY — o slide de stat nunca traz estatística inventada com cara de
   * pesquisa ("47%", "72% dos consumidores"): usuário posta sem saber que era
   * para trocar e vira desinformação assinada pela marca dele. Números só
   * quando estruturais (2 camadas, 1 regra) ou palavra-stat ("Agora.").
   *
   * DIREÇÃO DE ARTE — cada template carrega a própria assinatura em
   * `signature` (barra editorial com tokens, contador, selo). Fontes vêm SÓ do
   * `pairingId`; os índices titleFont/bodyFont morreram porque o applyTemplate
   * os ignorava e o preview os mostrava — duas fontes diferentes no mesmo clique.
   *
   * ARCO — hook forte → tensão → mecanismo → prova → custo → virada → CTA com
   * verbo único (salvar OU comentar OU arrastar, nunca dois pedidos).
   */
  {
    id: 'erro_comum',
    name: 'Erro Comum',
    desc: 'Quebra de leitura óbvia em qualquer nicho',
    categoria: 'angulo',
    palette: 0,
    pairingId: 'autoridade_b2b',
    creativePreset: 'quick_erro_comum',
    signature: {
      cultureHeaderLeft: 'ANÁLISE',
      cultureHeaderCenter: '{marca}',
      cultureHeaderYear: '{ano}',
      showPageBadge: true,
    },
    slides: [
      { title:'Você está fazendo errado.', subtitle:'O que parece técnica é, na verdade, sintoma de outra coisa.', q:'cinematic dark portrait moody', composition:'hook_fullbleed' },
      { title:'A leitura óbvia.', subtitle:'O mercado vê o problema na superfície. Resolve só o que aparece.', q:'urban street night blur cinematic', composition:'list_beat' },
      { title:'O mecanismo oculto.', subtitle:'O verdadeiro motor está duas camadas atrás.', body:'Quem enxerga a camada estrutural antecipa. Quem fica na superfície disputa preço.', q:'minimal dark office abstract', composition:'sandwich_editorial' },
      { title:'2 camadas', subtitle:'É a distância média entre o sintoma que incomoda e a causa que resolve.', composition:'stat_proof' },
      { title:'O custo de ignorar.', subtitle:'Cada ciclo tratando o sintoma financia o problema que o gera.', q:'executive boardroom dark cinematic', composition:'reveal_bridge' },
      { title:'Quem entende, lidera.', subtitle:'A diferença não é esforço. É leitura estrutural.', q:'cinematic leadership portrait', composition:'quote_pull' },
      { title:'Salve para revisar.', subtitle:'Antes da sua próxima decisão importante.', q:'minimal abstract dark texture', composition:'cta_close' },
    ],
  },
  {
    id: 'tendencia',
    name: 'Tendência de Mercado',
    desc: 'Antecipa um movimento que ninguém viu',
    categoria: 'angulo',
    palette: 1,
    pairingId: 'hype_escuro',
    creativePreset: 'quick_tendencia',
    signature: {
      cultureHeaderLeft: '{handle}',
      cultureHeaderCenter: 'TENDÊNCIA',
      cultureHeaderYear: '{ano}',
      showPageBadge: true,
      footerPillText: 'ARRASTA PRO LADO',
      footerPillBg: 'rgba(255,255,255,0.94)',
      footerPillFg: '#0c1220',
    },
    slides: [
      { title:'O mercado está mudando.', subtitle:'E quase ninguém percebeu para onde.', q:'futuristic city night blue', composition:'hook_fullbleed' },
      { title:'O sinal antigo.', subtitle:'O que funcionava até ontem já não move ponteiro.', q:'old technology vintage office', composition:'list_beat' },
      { title:'O sinal novo.', subtitle:'Categoria, percepção e narrativa migraram.', body:'Quem leu cedo posicionou. Quem esperou disputa atenção cara.', q:'modern minimal workspace blue', composition:'sandwich_editorial' },
      { title:'Quem perde primeiro.', subtitle:'Marcas presas no playbook antigo — volume sem significado.', q:'empty retail store cinematic', composition:'reveal_bridge' },
      { title:'Agora.', subtitle:'Tendência é vantagem com data de validade: só rende antes de virar consenso.', composition:'stat_proof' },
      { title:'O próximo diferencial.', subtitle:'Será de quem traduzir essa mudança em produto e canal.', q:'cinematic boardroom future', composition:'quote_pull' },
      { title:'Antes que vire óbvio.', subtitle:'Quando todo mundo nomeia, deixa de ser vantagem e vira custo de entrada.', q:'neon abstract blue motion', composition:'list_beat' },
      { title:'Comente "eu vi".', subtitle:'Se esse movimento já chegou no seu mercado, quero saber como.', q:'minimal abstract blue texture', composition:'cta_close' },
    ],
  },
  {
    id: 'decodificacao',
    name: 'Decodificação de Marca',
    desc: 'Por que uma marca está vencendo',
    categoria: 'angulo',
    palette: 2,
    pairingId: 'magazine_cream',
    creativePreset: 'quick_decodificacao',
    signature: {
      cultureHeaderLeft: 'DECODIFICAÇÃO',
      cultureHeaderCenter: '{marca}',
      cultureHeaderYear: '©{ano}',
      showPageBadge: true,
    },
    slides: [
      { title:'Por que essa marca vence.', subtitle:'Não é o produto. Não é o preço. Não é o canal.', q:'luxury retail store minimal', composition:'hook_fullbleed' },
      { title:'O que parece ser.', subtitle:'Marketing bonito. Identidade forte. Bom storytelling.', q:'creative studio bright minimal', composition:'list_beat' },
      { title:'O que realmente é.', subtitle:'Coerência radical entre promessa e comportamento.', body:'O sistema opera em silêncio: repertório, prova e presença alinhados.', q:'designer working desk minimal', composition:'sandwich_editorial' },
      { title:'Superfície × sistema', subtitle:'Um lado vende estética. O outro constrói memória.', q:'split composition brand moodboard', composition:'split_ab' },
      { title:'A lição replicável.', subtitle:'Marcas vencem quando deixam de explicar e passam a representar.', q:'minimal interior design cream', composition:'quote_pull' },
      { title:'1 regra', subtitle:'Toda decisão pública reforça a mesma promessa — ou dissolve a marca aos poucos.', composition:'stat_proof' },
      { title:'Como aplicar amanhã.', subtitle:'Audite canal, oferta e tom contra a promessa central.', q:'notebook planning cream desk', composition:'list_beat' },
      { title:'Salve antes da próxima decisão.', subtitle:'De marca, posicionamento ou campanha.', q:'minimal cream abstract', composition:'cta_close' },
    ],
  },
  {
    id: 'comportamento',
    name: 'Mudança de Comportamento',
    desc: 'Como o público mudou de verdade',
    categoria: 'angulo',
    palette: 3,
    pairingId: 'editorial_cultura',
    creativePreset: 'quick_comportamento',
    signature: {
      cultureHeaderLeft: '{handle}',
      cultureHeaderCenter: 'COMPORTAMENTO',
      cultureHeaderYear: '{ano}',
      showPageBadge: true,
    },
    slides: [
      { title:'O público não é mais o mesmo.', subtitle:'E quase nenhuma marca atualizou a leitura.', q:'people crowd diverse modern', composition:'hook_fullbleed' },
      { title:'O que ele dizia querer.', subtitle:'Conveniência, preço, rapidez. Era só a camada de cima.', q:'shopping mall busy people', composition:'list_beat' },
      { title:'O que ele realmente quer.', subtitle:'Pertencimento, repertório e signo de identidade.', body:'A compra virou declaração. O canal virou contexto social.', q:'community gathering authentic', composition:'sandwich_editorial' },
      { title:'A evidência.', subtitle:'A atenção migrou do "melhor preço" para o "melhor significado".', q:'phone screen social feed cinematic', composition:'reveal_bridge' },
      { title:'Espelho.', subtitle:'Ninguém compra o que você faz. Compram o reflexo de quem querem ser.', composition:'stat_proof' },
      { title:'A armadilha.', subtitle:'Teatralizar pertencimento sem mudar produto ou cultura.', q:'fake influencer studio lights', composition:'quote_pull' },
      { title:'Como traduzir isso.', subtitle:'Em produto, narrativa e canal — sem encenação.', q:'authentic portrait natural light', composition:'list_beat' },
      { title:'Quem entender, ganha relevância.', subtitle:'Quem ignorar perde atenção primeiro — e receita depois.', q:'minimal green nature abstract', composition:'cta_close' },
    ],
  },

  // ══ ÂNGULOS EDITORIAIS ═════════════════════════════════════════════════════
  {
    id: 'manifesto',
    name: 'Manifesto',
    desc: 'Uma tese incômoda dita sem rodeio',
    categoria: 'angulo',
    palette: 13, pairingId: 'manifesto_brutal',
    creativePreset: 'quick_erro_comum',
    signature: {
      cultureHeaderLeft: 'MANIFESTO',
      cultureHeaderYear: '{ano}',
      subtitleVisible: true,
      subtitleCase: 'upper',
      subtitleWeight: 600,
    },
    slides: [
      { title:'Pare de criar para o algoritmo.', subtitle:'Ele não assina embaixo do que você virou.', q:'torn black paper texture macro', composition:'hook_fullbleed' },
      { title:'O que te ensinaram.', subtitle:'Poste todo dia. Siga o formato. Copie quem cresceu.', q:'phone screen scrolling blur dark', composition:'list_beat' },
      { title:'O que isso produz.', subtitle:'Um feed cheio e uma marca sem contorno.', body:'Volume é fácil de imitar. Ponto de vista, não. O algoritmo premia o primeiro e o público lembra do segundo.', q:'identical products assembly line dark', composition:'sandwich_editorial' },
      { title:'O preço escondido.', subtitle:'Cada post genérico ensina o público a te ignorar.', q:'empty theater seats cinematic dark', composition:'reveal_bridge' },
      { title:'1 pergunta', subtitle:'Se tirassem seu nome do post, alguém saberia que é seu?', composition:'stat_proof' },
      { title:'Formato é emprestado. Tese é sua.', subtitle:'Copie a estrutura à vontade. Nunca copie a opinião.', q:'single red thread black background', composition:'quote_pull' },
      { title:'O que muda amanhã.', subtitle:'Escolha uma opinião que você defenderia num debate. Poste ela.', q:'hand writing notebook dramatic light', composition:'list_beat' },
      { title:'Qual é a sua tese?', subtitle:'Responde aqui embaixo — quero ler.', q:'black paper texture minimal', composition:'cta_close' },
    ],
  },
  {
    id: 'lista_visual',
    name: 'Lista Visual',
    desc: 'Checklist que o público salva para usar depois',
    categoria: 'angulo',
    palette: 14, pairingId: 'minimal_clean',
    creativePreset: 'livre',
    signature: {
      cultureHeaderLeft: 'CHECKLIST',
      cultureHeaderCenter: '{marca}',
      showPageBadge: true,
    },
    slides: [
      { title:'5 sinais de que está no caminho certo.', subtitle:'Um checklist para revisar hoje, em cinco minutos.', q:'organized flat lay objects warm light', composition:'hook_fullbleed' },
      { title:'01 · O básico está de pé.', subtitle:'O que sustenta o resto funciona sem você empurrar.', q:'solid foundation architecture detail', composition:'list_beat' },
      { title:'02 · Você sabe o número que importa.', subtitle:'Um só. Não um painel com trinta.', body:'Quem acompanha tudo não acompanha nada. Escolha a métrica que muda a decisão da semana.', q:'single dial gauge close up', composition:'sandwich_editorial' },
      { title:'03 · Dá para explicar em uma frase.', subtitle:'Se precisa de slide, ainda não está claro.', q:'minimal desk one notebook', composition:'list_beat' },
      { title:'04 · Existe rotina, não surto.', subtitle:'O resultado vem de repetição, não de esforço heroico.', q:'calendar routine morning light', composition:'reveal_bridge' },
      { title:'05 · Você corta sem dó.', subtitle:'O que não serve sai — mesmo que tenha dado trabalho.', q:'scissors cutting paper macro', composition:'quote_pull' },
      { title:'Marcou quantos?', subtitle:'Três ou mais: está no caminho. Menos que isso: comece pelo 01.', composition:'stat_proof' },
      { title:'Salva para revisar no fim do mês.', subtitle:'É rápido e mostra o que mudou.', q:'warm minimal texture paper', composition:'cta_close' },
    ],
  },
  {
    id: 'ideia_central',
    name: 'Ideia Central',
    desc: 'Uma frase que reorganiza a cabeça de quem lê',
    categoria: 'angulo',
    palette: 15, pairingId: 'quote_serif',
    creativePreset: 'quick_comportamento',
    signature: {
      showStarOrnament: true,
      footerPillText: '{handle}',
      footerPillArrow: false,
      subtitleVisible: true,
      subtitleItalic: true,
    },
    slides: [
      { title:'Sua atenção é o lugar onde sua vida acontece.', subtitle:'E quase ninguém trata ela como decisão.', q:'single object pearl white minimal', composition:'hook_fullbleed' },
      { title:'A gente trata atenção como sobra.', subtitle:'O que resta depois das obrigações.', q:'cluttered desk soft light', composition:'list_beat' },
      { title:'Mas ela não sobra. Ela é gasta.', subtitle:'E o que você olha vira o que você é.', body:'Ninguém decide ser distraído. A distração é o resultado de mil escolhas pequenas que ninguém registrou.', q:'hourglass sand falling minimal', composition:'sandwich_editorial' },
      { title:'O que some primeiro.', subtitle:'A capacidade de ficar entediado sem procurar a tela.', q:'empty room natural light quiet', composition:'reveal_bridge' },
      { title:'0 notificações', subtitle:'É a configuração mais radical que existe — e é gratuita.', composition:'stat_proof' },
      { title:'Você não tem falta de tempo. Tem falta de foco.', subtitle:'São coisas diferentes e pedem soluções diferentes.', q:'single candle flame dark minimal', composition:'quote_pull' },
      { title:'O teste de uma semana.', subtitle:'Escolha uma hora do dia sem tela. Só uma. Veja o que aparece.', q:'morning window light book', composition:'list_beat' },
      { title:'Compartilha com quem precisa ler isso.', subtitle:'Provavelmente você já pensou em alguém.', q:'pearl white paper texture', composition:'cta_close' },
    ],
  },
  {
    id: 'antes_depois',
    name: 'Antes × Depois',
    desc: 'Transformação mostrada, não prometida',
    categoria: 'angulo',
    palette: 16, pairingId: 'display_condensado',
    creativePreset: 'quick_decodificacao',
    signature: {
      cultureHeaderLeft: 'ANTES',
      cultureHeaderYear: 'DEPOIS',
      showPageBadge: true,
    },
    slides: [
      { title:'Antes: ocupado. Depois: produtivo.', subtitle:'A mudança que não aparece na agenda.', q:'split image chaos and order', composition:'hook_fullbleed' },
      { title:'Antes.', subtitle:'Agenda cheia, dia inteiro reagindo, nada terminado.', q:'cluttered chaotic workspace', composition:'list_beat' },
      { title:'Depois.', subtitle:'Menos compromissos, mais entregas fechadas.', body:'A diferença não foi disciplina. Foi parar de confundir estar ocupado com estar avançando.', q:'clean organized desk single task', composition:'sandwich_editorial' },
      { title:'O que saiu da rotina.', subtitle:'Reuniões sem pauta, notificações e o hábito de responder na hora.', q:'crossed out calendar dramatic', composition:'split_ab' },
      { title:'3 blocos', subtitle:'Manhã para criar, tarde para resolver, fim do dia para fechar.', composition:'stat_proof' },
      { title:'Ocupado é fácil. Produtivo dói.', subtitle:'Porque exige dizer não para coisas boas.', q:'closed door minimal dramatic', composition:'quote_pull' },
      { title:'Como testar em uma semana.', subtitle:'Bloqueie duas horas por dia. Só isso. Não mexa em mais nada.', q:'time blocking calendar clean', composition:'list_beat' },
      { title:'Qual dos dois é você hoje?', subtitle:'Comenta antes ou depois — sem julgamento.', q:'purple yellow gradient abstract', composition:'cta_close' },
    ],
  },

  // ══ NICHOS ════════════════════════════════════════════════════════════════
  {
    id: 'marketing',
    name: 'Marketing',
    desc: 'Métrica de vaidade × métrica de decisão',
    categoria: 'nicho',
    palette: 17, pairingId: 'display_condensado',
    creativePreset: 'quick_erro_comum',
    signature: {
      cultureHeaderLeft: 'DADOS',
      cultureHeaderCenter: '{marca}',
      cultureHeaderYear: '{ano}',
      showPageBadge: true,
    },
    slides: [
      { title:'Alcance não é estratégia.', subtitle:'O número cresce. A marca continua no mesmo lugar.', q:'dark analytics room red data lines', composition:'hook_fullbleed' },
      { title:'O que o relatório mostra.', subtitle:'Impressões, alcance, engajamento. Tudo subindo.', q:'dashboard charts glowing dark', composition:'list_beat' },
      { title:'O que ele esconde.', subtitle:'Ninguém lembra da marca no dia seguinte.', body:'Métrica de vaidade mede quantas pessoas passaram. Métrica de decisão mede quantas mudaram de ideia.', q:'crowd passing by blur night', composition:'sandwich_editorial' },
      { title:'Onde o dinheiro vaza.', subtitle:'Verba comprando atenção que não vira memória nem venda.', q:'money burning cinematic dark', composition:'reveal_bridge' },
      { title:'1 métrica', subtitle:'Escolha a que muda a decisão da semana. Ignore o resto do painel.', composition:'stat_proof' },
      { title:'Se não muda a decisão, é entretenimento.', subtitle:'Caro, bonito e irrelevante.', q:'red signal light dark abstract', composition:'quote_pull' },
      { title:'O corte de amanhã.', subtitle:'Liste suas métricas. Risque as que não mudariam nenhuma decisão.', q:'strategist working dark office', composition:'list_beat' },
      { title:'Qual métrica você acompanha sem usar?', subtitle:'Comenta — aposto que todo mundo tem uma.', q:'burgundy abstract texture dark', composition:'cta_close' },
    ],
  },
  {
    id: 'criador_conteudo',
    name: 'Criador de Conteúdo',
    desc: 'Repertório vence frequência sem direção',
    categoria: 'nicho',
    palette: 18, pairingId: 'display_condensado',
    creativePreset: 'quick_tendencia',
    signature: {
      cultureHeaderLeft: '{handle}',
      footerPillText: '#SUAHASHTAG',
      footerPillArrow: false,
      showPageBadge: true,
    },
    slides: [
      { title:'Postar mais não vai te destacar.', subtitle:'Repertório vence frequência sem direção.', q:'creator studio camera notes real', composition:'hook_fullbleed' },
      { title:'O conselho que todo mundo repete.', subtitle:'Consistência. Volume. Aparecer todo dia.', q:'calendar full posts grid', composition:'list_beat' },
      { title:'O que ninguém completa.', subtitle:'Consistência de quê. Volume de qual ideia.', body:'Quem posta todo dia sem repertório vira ruído com horário fixo. O feed não perdoa — ele esquece.', q:'noisy static screen abstract', composition:'sandwich_editorial' },
      { title:'De onde vem o repertório.', subtitle:'Do que você consome fora da sua própria bolha.', q:'books films notes collage desk', composition:'reveal_bridge' },
      { title:'2 horas', subtitle:'Por semana consumindo algo que não é do seu nicho. É o mínimo.', composition:'stat_proof' },
      { title:'Você não tem bloqueio criativo. Tem falta de entrada.', subtitle:'Ninguém produz do nada.', q:'empty well dramatic light', composition:'quote_pull' },
      { title:'O exercício da semana.', subtitle:'Leia algo fora do seu tema e transforme em um post do seu tema.', q:'creator working desk authentic', composition:'list_beat' },
      { title:'O que você anda consumindo?', subtitle:'Deixa aí — eu roubo a ideia com orgulho.', q:'yellow blue collage paper texture', composition:'cta_close' },
    ],
  },
  {
    id: 'mentor',
    name: 'Mentor',
    desc: 'Seu aluno não precisa de mais conteúdo',
    categoria: 'nicho',
    palette: 19, pairingId: 'serif_alto_contraste',
    creativePreset: 'quick_decodificacao',
    signature: {
      cultureHeaderLeft: 'MENTORIA',
      cultureHeaderCenter: '{marca}',
      subtitleVisible: true,
      subtitleWeight: 500,
    },
    slides: [
      { title:'Seu aluno não precisa de mais conteúdo.', subtitle:'Ele precisa atravessar uma mudança.', q:'mentor conversation warm window light', composition:'hook_fullbleed' },
      { title:'O que a maioria entrega.', subtitle:'Módulos, planilhas, aulas gravadas. Muita informação.', q:'stacked folders documents warm', composition:'list_beat' },
      { title:'O que trava mesmo assim.', subtitle:'Ele sabe o que fazer e continua sem fazer.', body:'Informação resolve ignorância. Mentoria resolve o que vem depois: medo, prioridade errada e falta de espelho.', q:'person hesitating doorway warm light', composition:'sandwich_editorial' },
      { title:'O que muda o jogo.', subtitle:'Alguém que vê o ponto cego e não deixa passar.', q:'two people talking table intimate', composition:'reveal_bridge' },
      { title:'3 travas', subtitle:'Clareza, coragem e constância. Conteúdo só resolve a primeira.', composition:'stat_proof' },
      { title:'Ninguém muda sozinho lendo mais.', subtitle:'Muda com alguém olhando junto.', q:'hands guiding warm minimal', composition:'quote_pull' },
      { title:'O que revisar no seu programa.', subtitle:'Onde seu aluno trava? Se a resposta é sempre a mesma, é ali que falta você.', q:'notebook plan warm desk', composition:'list_beat' },
      { title:'Onde seus alunos mais travam?', subtitle:'Me conta — quero entender se é o mesmo padrão.', q:'warm espresso texture minimal', composition:'cta_close' },
    ],
  },
  {
    id: 'prestador_servico',
    name: 'Prestador de Serviço',
    desc: 'Você não cobra caro. Você explica mal.',
    categoria: 'nicho',
    palette: 20, pairingId: 'display_condensado',
    creativePreset: 'quick_erro_comum',
    signature: {
      cultureHeaderLeft: 'SEU SERVIÇO',
      cultureHeaderYear: '{ano}',
      footerPillText: 'FALE COMIGO',
    },
    slides: [
      { title:'Você não cobra caro. Você explica mal.', subtitle:'O cliente não recusa o preço. Recusa o que não entendeu.', q:'hands building blocks orange black', composition:'hook_fullbleed' },
      { title:'O que o cliente ouve.', subtitle:'Um preço. Sem referência de comparação.', q:'price tag isolated dramatic', composition:'list_beat' },
      { title:'O que ele deveria ouvir.', subtitle:'O que acontece se ele não resolver isso.', body:'Preço só parece alto quando o problema parece pequeno. Quem dimensiona o problema não precisa defender o valor.', q:'blueprint measuring precise work', composition:'sandwich_editorial' },
      { title:'A conversa que falta.', subtitle:'Quanto custa continuar do jeito que está.', q:'broken structure repair dramatic', composition:'reveal_bridge' },
      { title:'3 perguntas', subtitle:'O que trava hoje, há quanto tempo, e quanto isso já custou.', composition:'stat_proof' },
      { title:'Desconto resolve preço. Não resolve dúvida.', subtitle:'E quase sempre o problema é dúvida.', q:'orange accent minimal dark', composition:'quote_pull' },
      { title:'Como reescrever sua proposta.', subtitle:'Comece pelo problema dele, não pelo que você entrega.', q:'proposal document clean desk', composition:'list_beat' },
      { title:'Manda sua proposta atual.', subtitle:'Comento a primeira linha de quem postar aqui.', q:'charcoal orange texture minimal', composition:'cta_close' },
    ],
  },
  {
    id: 'consultoria',
    name: 'Consultoria',
    desc: 'Diagnóstico antes da solução',
    categoria: 'nicho',
    palette: 21, pairingId: 'suica_editorial',
    creativePreset: 'quick_decodificacao',
    signature: {
      cultureHeaderLeft: 'DIAGNÓSTICO',
      cultureHeaderCenter: '{marca}',
      cultureHeaderYear: '{ano}',
      showPageBadge: true,
    },
    slides: [
      { title:'A solução certa começa antes da resposta.', subtitle:'Consultoria é diagnóstico com consequência.', q:'project table evidence red thread', composition:'hook_fullbleed' },
      { title:'O pedido que chega.', subtitle:'"Preciso de mais leads." "Preciso reestruturar o time."', q:'meeting request notes minimal', composition:'list_beat' },
      { title:'O que quase sempre é.', subtitle:'Um sintoma que o cliente já traduziu em solução.', body:'Quem aceita o diagnóstico do cliente entrega o que foi pedido. Quem refaz o diagnóstico entrega o que resolve.', q:'magnifying glass documents analysis', composition:'sandwich_editorial' },
      { title:'O custo de pular essa etapa.', subtitle:'Meses de execução impecável no problema errado.', q:'wrong direction signs cinematic', composition:'reveal_bridge' },
      { title:'3 camadas', subtitle:'Sintoma, causa e consequência. A proposta só nasce na terceira.', composition:'stat_proof' },
      { title:'Não existe solução boa para pergunta errada.', subtitle:'Por mais bem executada que seja.', q:'red thread connecting points', composition:'quote_pull' },
      { title:'As perguntas da primeira reunião.', subtitle:'O que você já tentou, o que mudou desde então, e o que não pode mudar.', q:'consultant notebook clean light', composition:'list_beat' },
      { title:'Qual pedido você mais recebe?', subtitle:'Comenta e eu digo qual costuma ser a causa real.', q:'blueprint paper texture light', composition:'cta_close' },
    ],
  },
  {
    id: 'tecnologia',
    name: 'Tecnologia',
    desc: 'Tecnologia madura vira infraestrutura',
    categoria: 'nicho',
    palette: 22, pairingId: 'grotesca_tecnica',
    creativePreset: 'quick_tendencia',
    signature: {
      cultureHeaderLeft: '{marca}',
      cultureHeaderCenter: 'PRODUTO',
      cultureHeaderYear: '{ano}',
      showPageBadge: true,
    },
    slides: [
      { title:'A IA mais importante é a que some.', subtitle:'Tecnologia madura vira infraestrutura.', q:'translucent digital architecture dark', composition:'hook_fullbleed' },
      { title:'A fase do espanto.', subtitle:'Todo produto vira demo. Todo lançamento vira evento.', q:'crowded launch event screens', composition:'list_beat' },
      { title:'A fase que importa.', subtitle:'Quando ninguém mais comenta que tem IA dentro.', body:'Eletricidade deixou de ser diferencial quando virou tomada. Software segue o mesmo caminho — e é aí que ele passa a valer.', q:'power outlet wall minimal dark', composition:'sandwich_editorial' },
      { title:'O sinal de maturidade.', subtitle:'O usuário para de aprender a ferramenta e volta a fazer o trabalho.', q:'hands working invisible interface', composition:'reveal_bridge' },
      { title:'0 cliques', subtitle:'O melhor recurso é o que resolve antes de você abrir o menu.', composition:'stat_proof' },
      { title:'Se precisa explicar, ainda não está pronto.', subtitle:'Adoção é o único teste que conta.', q:'ice blue light abstract dark', composition:'quote_pull' },
      { title:'O que revisar no seu produto.', subtitle:'Onde o usuário precisa entender sua arquitetura para conseguir usar?', q:'clean product interface dark', composition:'list_beat' },
      { title:'Qual recurso seu ninguém usa?', subtitle:'Comenta — normalmente é o mais difícil de explicar.', q:'dark tech gradient abstract', composition:'cta_close' },
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    desc: 'Percepção vem antes da conversão',
    categoria: 'nicho',
    palette: 23, pairingId: 'display_condensado',
    creativePreset: 'quick_erro_comum',
    signature: {
      footerBarLeft: 'Produto|Sua linha',
      footerBarCenter: 'Por|{marca}',
      footerBarRight: 'Salve|para depois',
    },
    slides: [
      { title:'Seu produto não está caro. Está comum.', subtitle:'Percepção vem antes da conversão.', q:'product packaging flash diagonal', composition:'hook_fullbleed' },
      { title:'O que você ajusta primeiro.', subtitle:'Preço, frete, cupom. Sempre a margem.', q:'discount tags cluttered shelf', composition:'list_beat' },
      { title:'O que o cliente compara.', subtitle:'A sua página com outras seis abertas ao lado.', body:'Na comparação lado a lado, quem não tem motivo visível para custar mais vira o mais barato da lista — ou some.', q:'multiple browser tabs product blur', composition:'sandwich_editorial' },
      { title:'Onde a decisão trava.', subtitle:'Na foto que não mostra escala, uso nem acabamento.', q:'product photo detail texture macro', composition:'reveal_bridge' },
      { title:'3 fotos', subtitle:'Uma de escala, uma de uso, uma de detalhe. Antes de mexer no preço.', composition:'stat_proof' },
      { title:'Desconto compra o pedido. Percepção compra o próximo.', subtitle:'Um custa margem, o outro constrói marca.', q:'pink accent product minimal dark', composition:'quote_pull' },
      { title:'A auditoria de hoje.', subtitle:'Abra sua página ao lado de três concorrentes. O que salta primeiro?', q:'ecommerce page clean product', composition:'list_beat' },
      { title:'Manda o link do seu produto.', subtitle:'Digo o que eu ajustaria primeiro na página.', q:'black pink texture abstract', composition:'cta_close' },
    ],
  },
  {
    id: 'marca_pessoal',
    name: 'Marca Pessoal',
    desc: 'Autoridade não é parecer importante',
    categoria: 'nicho',
    palette: 24, pairingId: 'display_condensado',
    creativePreset: 'quick_comportamento',
    signature: {
      cultureHeaderLeft: '{handle}',
      cultureHeaderYear: '{ano}',
      showStarOrnament: true,
    },
    slides: [
      { title:'Autoridade não é parecer importante.', subtitle:'É tornar uma ideia impossível de ignorar.', q:'editorial portrait stone wall shadow', composition:'hook_fullbleed' },
      { title:'O que muita gente tenta.', subtitle:'Título maior, foto melhor, número de seguidores.', q:'business portrait staged formal', composition:'list_beat' },
      { title:'O que constrói de verdade.', subtitle:'Ser o nome que vem à cabeça em um assunto específico.', body:'Autoridade não é ser conhecido por muitos. É ser lembrado por poucos no momento exato em que eles precisam.', q:'single name spotlight minimal', composition:'sandwich_editorial' },
      { title:'O erro que dilui.', subtitle:'Falar de tudo para não perder ninguém.', q:'scattered light diffuse abstract', composition:'reveal_bridge' },
      { title:'1 assunto', subtitle:'Se você não consegue nomear o seu, o público também não consegue.', composition:'stat_proof' },
      { title:'Ser lembrado vale mais que ser visto.', subtitle:'Visibilidade passa. Associação fica.', q:'green accent stone minimal', composition:'quote_pull' },
      { title:'O teste do seu posicionamento.', subtitle:'Pergunte a três pessoas do que você fala. Se vierem três respostas, achamos o problema.', q:'portrait natural light editorial', composition:'list_beat' },
      { title:'Do que você quer ser lembrado?', subtitle:'Uma palavra. Comenta aí.', q:'stone texture warm minimal', composition:'cta_close' },
    ],
  },
];
