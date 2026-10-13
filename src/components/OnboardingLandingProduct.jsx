import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Layers3,
  MonitorSmartphone,
  Presentation,
} from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import { PLAN_ORDER, PLAN_TIERS } from '../../shared/plans.js';
import '../styles/landing-product.css';

const PRODUCT = {
  comunica: '/landing/moont-v3/product/01-interface-comunica-desktop.webp',
  apresenta: '/landing/moont-v3/product/02-interface-apresenta-desktop.webp',
  mobile: '/landing/moont-v3/product/03-interface-mobile.webp',
  workflow: '/landing/moont-v3/product/04-interface-workflow-desktop-v2.webp',
  responsiveMobile: '/landing/moont-v3/product/05-interface-responsive-mobile.webp',
  hero: '/landing/moont-v3/product/06-interface-hero-desktop.webp',
  carousel: '/landing/moont-v3/formats/01-comunica-panel.webp',
  presentation: '/landing/moont-v3/formats/02-apresenta-panel.webp',
};

const RESULT_STORY = {
  feed: '/landing/moont-v3/gallery-source/01-editorial-discovery.webp',
  deck: '/landing/moont-v3/gallery-source/02-editorial-choice.webp',
};

const WORKDAY_STORY = {
  brief: '/landing/moont-v4/story/01-pauta-no-dia-a-dia.webp',
  review: '/landing/moont-v4/story/03-revisao-em-equipe.webp',
  culture: '/landing/moont-v4/story/04-direcao-cultura.webp',
  creator: '/landing/moont-v4/story/05-direcao-creator.webp',
  education: '/landing/moont-v4/story/06-direcao-educacao.webp',
  final: '/landing/moont-v4/story/07-versao-final.webp',
};

const IMAGE_DIMENSIONS = {
  [PRODUCT.comunica]: [1600, 1000],
  [PRODUCT.apresenta]: [1600, 1000],
  [PRODUCT.mobile]: [780, 1688],
  [PRODUCT.workflow]: [1420, 700],
  [PRODUCT.responsiveMobile]: [780, 1688],
  [PRODUCT.hero]: [1140, 610],
  [PRODUCT.carousel]: [1600, 1000],
  [PRODUCT.presentation]: [1600, 1000],
  [RESULT_STORY.feed]: [1122, 1402],
  [RESULT_STORY.deck]: [1122, 1402],
  [WORKDAY_STORY.brief]: [1122, 1402],
  [WORKDAY_STORY.review]: [1508, 806],
  [WORKDAY_STORY.culture]: [1122, 1402],
  [WORKDAY_STORY.creator]: [1122, 1402],
  [WORKDAY_STORY.education]: [1122, 1402],
  [WORKDAY_STORY.final]: [1122, 1402],
};

const STEPS = [
  ['01', 'Junte o material', 'Cole a pauta, o link, o briefing ou a referência que está espalhada pelo seu dia.'],
  ['02', 'Escolha o formato', 'Defina carrossel ou apresentação. A Moont cria a estrutura e o visual para esse uso.'],
  ['03', 'Revise com liberdade', 'Ajuste texto, imagem, ordem, layout e marca até a peça ficar pronta para sair.'],
];

const FAQ = [
  ['Preciso saber design?', 'Não. A Moont entrega uma primeira versão completa. Você escolhe o caminho, troca o que quiser e exporta quando estiver satisfeito.'],
  ['Carrossel e apresentação usam a mesma estrutura?', 'Não. Cada formato recebe uma narrativa, uma proporção e uma hierarquia próprias.'],
  ['Posso usar a identidade da minha marca?', 'Sim. Cada projeto guarda briefing, tom de voz, paleta, logo e referências.'],
];

function ActionButton({ children, onClick, tone = 'primary', className = '' }) {
  return (
    <button type="button" onClick={onClick} className={`moont-lp-button moont-lp-button--${tone} ${className}`}>
      {children}
    </button>
  );
}

function scrollToSection(id) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
}

function ProductImage({ src, alt, className = '', eager = false }) {
  const [width, height] = IMAGE_DIMENSIONS[src] || (src.includes('/moont-users/') ? [1440, 960] : []);
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
    />
  );
}

function ProductWindow({ src, alt, className = '', eager = false }) {
  return (
    <figure className={`moont-lp-window ${className}`}>
      <div className="moont-lp-window__bar" aria-hidden="true">
        <span /><span /><span />
        <small>moont · studio</small>
      </div>
      <ProductImage src={src} alt={alt} eager={eager} />
    </figure>
  );
}

function WorkflowDemo({ onEnter }) {
  const [scope, setScope] = useState('images');
  const [selected, setSelected] = useState(0);
  const [logos, setLogos] = useState([]);
  const cards = [
    ['Sua ideia não está fraca. Está sem direção.', '/landing/moont-v3/demo-source/01-direction.webp'],
    ['O detalhe que muda o resultado.', '/landing/moont-v3/demo-source/02-detail.webp'],
    ['Da pauta à campanha sem recomeçar.', '/landing/moont-v3/demo-source/03-campaign-system.webp'],
  ];

  const toggleLogo = () => {
    setLogos((current) => (
      current.includes(selected)
        ? current.filter((index) => index !== selected)
        : [...current, selected]
    ));
  };

  return (
    <section id="contexto-projeto" className="moont-lp-section moont-lp-context" aria-labelledby="moont-context-title">
      <div className="moont-lp-container moont-lp-context__grid">
        <div className="moont-lp-context__copy">
          <p className="moont-lp-kicker">Sua marca já está no projeto</p>
          <h2 id="moont-context-title">Cada nova peça começa com o que você já definiu.</h2>
          <p className="moont-lp-lead">
            Salve o briefing, o tom de voz, a paleta, a logo e as referências uma vez. Quando a próxima pauta entrar, esse contexto já estará ali.
          </p>
          <ul className="moont-lp-checklist">
            {[
              'Um contexto separado para cada projeto',
              'Texto e imagem juntos ou por etapa',
              'Logo aplicada card a card',
              'Tudo continua editável antes da exportação',
            ].map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}
          </ul>
          <ActionButton onClick={onEnter}>
            Criar com minha marca <ArrowRight aria-hidden="true" />
          </ActionButton>
        </div>

        <div className="moont-lp-demo" aria-label="Demonstração do projeto">
          <div className="moont-lp-demo__header">
            <div>
              <span className="moont-lp-demo__eyebrow">Projeto</span>
              <strong>Lançamento · coleção N01</strong>
            </div>
            <span className="moont-lp-demo__state"><i /> Contexto ON</span>
          </div>

          <fieldset className="moont-lp-scope">
            <legend>O que você quer criar?</legend>
            <label className={scope === 'text' ? 'is-active' : ''}>
              <input type="radio" name="landing-product-demo-scope" checked={scope === 'text'} onChange={() => setScope('text')} />
              Só texto
            </label>
            <label className={scope === 'images' ? 'is-active' : ''}>
              <input type="radio" name="landing-product-demo-scope" checked={scope === 'images'} onChange={() => setScope('images')} />
              Texto e imagens
            </label>
          </fieldset>

          <p className="moont-lp-demo__status" role="status">
            {scope === 'text'
              ? 'A narrativa ganha forma primeiro. As imagens entram quando você decidir.'
              : 'Texto e direção visual juntos. Tudo continua editável antes de publicar.'}
          </p>

          <div className="moont-lp-demo__cards" role="group" aria-label="Cards da demonstração">
            {cards.map(([title, image], index) => (
              <button
                key={title}
                type="button"
                aria-label={`Selecionar card ${index + 1} da demonstração`}
                aria-pressed={selected === index}
                className={selected === index ? 'is-selected' : ''}
                onClick={() => setSelected(index)}
              >
                {scope === 'images' && <img src={image} alt="" aria-hidden="true" loading="lazy" />}
                <span>{title}</span>
                {logos.includes(index) && <b aria-label={`Logo aplicada no card ${index + 1}`}>MOONT</b>}
              </button>
            ))}
          </div>

          <button type="button" className="moont-lp-demo__logo" onClick={toggleLogo}>
            {logos.includes(selected) ? 'Remover logo' : 'Aplicar logo salva'} no card {selected + 1}
          </button>
        </div>
      </div>
    </section>
  );
}

function Plans({ onEnter }) {
  return (
    <section id="planos" className="moont-lp-section moont-lp-plans" aria-labelledby="moont-plans-title">
      <div className="moont-lp-container">
        <p className="moont-lp-kicker">Planos</p>
        <div className="moont-lp-section-heading moont-lp-section-heading--split">
          <h2 id="moont-plans-title">Escolha quanto você quer criar por mês.</h2>
          <p>Todos os planos incluem texto com IA, editor completo, contexto por projeto e exportação. Os planos com imagem trazem um saldo mensal para gerar e trocar visuais.</p>
        </div>
        <p className="moont-lp-swipe-hint" aria-hidden="true">Deslize para comparar os planos <ArrowRight /></p>
        <div className="moont-lp-plans__grid" role="region" aria-label="Comparação dos planos da Moont" tabIndex={0}>
          {PLAN_ORDER.map((id) => {
            const plan = PLAN_TIERS[id];
            return (
              <article key={id} aria-label={`Plano ${plan.name}`} className={id === 'creator' ? 'is-featured' : ''}>
                {id === 'creator' && <span className="moont-lp-plan__tag">Mais escolhido</span>}
                <h3>{plan.name}</h3>
                <p className="moont-lp-plan__price"><strong>{plan.priceLabel}</strong><span>/mês</span></p>
                <p className="moont-lp-plan__quota">{plan.imageQuota ? `${plan.imageQuota} imagens por mês` : 'Sem imagens de IA inclusas'}</p>
                <ul>
                  {[
                    'Texto com IA incluso',
                    'Editor e exportação completos',
                    'Contexto e logo por projeto',
                  ].map((line) => <li key={line}><Check aria-hidden="true" />{line}</li>)}
                </ul>
              </article>
            );
          })}
        </div>
        <div className="moont-lp-plans__action">
          <ActionButton onClick={onEnter}>Escolher meu plano <ArrowRight aria-hidden="true" /></ActionButton>
          <p>O saldo de imagens renova a cada ciclo mensal.</p>
        </div>
      </div>
    </section>
  );
}

export default function OnboardingLandingProduct({ onEnter, onLogin }) {
  return (
    <main className="moont-product-landing">
      <a className="moont-lp-skip" href="#conteudo-principal">Ir para o conteúdo</a>

      <header className="moont-lp-header">
        <div className="moont-lp-container moont-lp-header__inner">
          <a href="#topo" className="moont-lp-logo" aria-label="Moont — início">
            <BrandLogo height={31} />
          </a>
          <nav aria-label="Navegação principal">
            <a href="#resultados">Resultados</a>
            <a href="#modos">Produto</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#planos">Planos</a>
          </nav>
          <div className="moont-lp-header__actions">
            <button type="button" className="moont-lp-login" onClick={onLogin}>Entrar</button>
            <ActionButton onClick={onEnter} className="moont-lp-header__cta">Começar a criar</ActionButton>
          </div>
        </div>
      </header>

      <section id="topo" className="moont-lp-hero">
        <div id="conteudo-principal" className="moont-lp-container moont-lp-hero__inner">
          <div className="moont-lp-hero__copy">
            <p className="moont-lp-kicker">Para quem cria todos os dias</p>
            <h1>A pauta chegou.<br /><span>O prazo já está correndo.</span></h1>
            <p className="moont-lp-hero__lead">
              Reúna briefing, links e referências na Moont. A plataforma organiza a narrativa, propõe uma direção visual e prepara a primeira versão do carrossel ou da apresentação para você revisar.
            </p>
            <div className="moont-lp-hero__actions">
              <ActionButton onClick={onEnter}>Criar meu primeiro projeto <ArrowRight aria-hidden="true" /></ActionButton>
              <button
                type="button"
                className="moont-lp-button moont-lp-button--secondary"
                onClick={() => scrollToSection('como-funciona')}
              >
                Ver a Moont em ação
              </button>
            </div>
            <div className="moont-lp-hero__proof" aria-label="Recursos principais">
              <span><Check aria-hidden="true" /> Estruturas próprias para cada formato</span>
              <span><Check aria-hidden="true" /> Sua marca salva em cada projeto</span>
              <span><Check aria-hidden="true" /> Texto, imagem e layout editáveis</span>
            </div>
          </div>

          <div className="moont-lp-hero__product">
            <ProductWindow
              src={PRODUCT.hero}
              alt="Interface da Moont exibindo no desktop três cards da mesma campanha de beleza mostrada no celular"
              eager
            />
            <figure className="moont-lp-hero__mobile">
              <ProductImage src={PRODUCT.mobile} alt="Interface da Moont em um celular" eager />
            </figure>
          </div>
        </div>
      </section>

      <section id="resultados" className="moont-lp-section moont-lp-results" aria-labelledby="moont-results-title">
        <div className="moont-lp-container">
          <p className="moont-lp-kicker">Um briefing. Dois formatos.</p>
          <div className="moont-lp-section-heading moont-lp-section-heading--split">
            <h2 id="moont-results-title">A mesma ideia pode virar carrossel hoje e apresentação amanhã.</h2>
            <p>A Moont reaproveita o contexto e reorganiza a história para cada formato. A marca continua reconhecível, enquanto o ritmo muda para quem vai ler, assistir ou decidir.</p>
          </div>
          <div className="moont-lp-results__proof" role="group" aria-label="A mesma campanha adaptada para carrossel e apresentação">
            <div className="moont-lp-results__direction">
              <div>
                <span>O que continua</span>
                <strong>A identidade da história</strong>
              </div>
              <ul aria-label="Decisões preservadas nos dois formatos">
                <li>Tom de voz</li>
                <li>Paleta</li>
                <li>Referências</li>
              </ul>
            </div>

            <div className="moont-lp-results__formats">
              <article className="moont-lp-output moont-lp-output--feed" aria-label="Exemplo de carrossel para feed">
                <ProductImage
                  src={RESULT_STORY.feed}
                  alt="Mulher saindo de uma livraria à noite, em uma rua molhada pela chuva"
                />
                <div className="moont-lp-output__topline" aria-hidden="true">
                  <span>moont · comunica</span>
                  <b>01 / 06</b>
                </div>
                <div className="moont-lp-output__message">
                  <span>Carrossel · 4:5</span>
                  <h3>Pare de salvar.<br />Comece a usar.</h3>
                  <p>Referência só ganha valor quando orienta uma escolha.</p>
                </div>
              </article>

              <article className="moont-lp-output moont-lp-output--deck" aria-label="Exemplo de apresentação em formato widescreen">
                <div className="moont-lp-output__deck-copy">
                  <span>Apresentação · 16:9</span>
                  <h3>Da referência solta à direção aprovada.</h3>
                  <p>Uma tese clara para alinhar, produzir e publicar.</p>
                  <small>01 / 08</small>
                </div>
                <div className="moont-lp-output__deck-photo">
                  <ProductImage
                    src={RESULT_STORY.deck}
                    alt="Mulher pesquisando livros e discos em uma loja de arte"
                  />
                  <span aria-hidden="true">Escolha → sistema</span>
                </div>
              </article>
            </div>

            <div className="moont-lp-results__continuity" aria-label="Fluxo de adaptação da Moont">
              <span>Briefing</span>
              <i aria-hidden="true" />
              <span>Carrossel</span>
              <i aria-hidden="true" />
              <span>Apresentação</span>
            </div>
          </div>
        </div>
      </section>

      <WorkflowDemo onEnter={onEnter} />

      <section id="modos" className="moont-lp-section moont-lp-formats" aria-labelledby="moont-formats-title">
        <div className="moont-lp-container">
          <p className="moont-lp-kicker">Cada formato tem seu ritmo</p>
          <div className="moont-lp-section-heading">
            <h2 id="moont-formats-title">No feed, cada card precisa dar vontade de ver o próximo. Na apresentação, cada slide precisa sustentar a conversa.</h2>
            <p>A Moont cria estruturas diferentes porque as pessoas leem, assistem e decidem de jeitos diferentes.</p>
          </div>

          <p className="moont-lp-swipe-hint" aria-hidden="true">Deslize para comparar os formatos <ArrowRight /></p>
          <div className="moont-lp-formats__grid" role="region" aria-label="Comparação entre carrossel e apresentação" tabIndex={0}>
            <article className="moont-lp-format moont-lp-format--comunica">
              <div className="moont-lp-format__copy">
                <span>Feed · 4:5</span>
                <h3>Moont Comunica</h3>
                <p>Começa com um gancho claro, desenvolve uma ideia por card e fecha com um próximo passo.</p>
                <ul><li>Carrosséis</li><li>Posts</li><li>Stories</li></ul>
              </div>
              <div className="moont-lp-format__visual">
                <ProductImage
                  src={PRODUCT.carousel}
                  className="moont-lp-format__panel"
                  alt="Painel do Moont Comunica com quatro cards de uma campanha editorial"
                />
              </div>
            </article>

            <article className="moont-lp-format moont-lp-format--apresenta">
              <div className="moont-lp-format__copy">
                <span>Deck · 16:9</span>
                <h3>Moont Apresenta</h3>
                <p>Abre com o problema, organiza o raciocínio e leva a sala até uma decisão.</p>
                <ul><li>Propostas</li><li>Aulas</li><li>Apresentações</li></ul>
              </div>
              <div className="moont-lp-format__visual">
                <ProductImage
                  src={PRODUCT.presentation}
                  className="moont-lp-format__panel"
                  alt="Painel do Moont Apresenta com capa, dado e recomendação de um deck estratégico"
                />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="moont-lp-section moont-lp-process" aria-labelledby="moont-process-title">
        <div className="moont-lp-container">
          <div className="moont-lp-section-heading moont-lp-section-heading--split">
            <div>
              <p className="moont-lp-kicker">Da pauta à primeira versão</p>
              <h2 id="moont-process-title">Cole o material e receba uma sequência pronta para revisar.</h2>
            </div>
            <p>Você avalia o trabalho cedo, enquanto ainda é fácil trocar o texto, mudar a imagem e ajustar o rumo.</p>
          </div>
          <ol className="moont-lp-process__steps">
            {STEPS.map(([number, title, copy]) => (
              <li key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></li>
            ))}
          </ol>
          <ProductWindow
            src={PRODUCT.workflow}
            alt="Interface da Moont com uma apresentação em edição no desktop"
            className="moont-lp-process__window"
          />
        </div>
      </section>

      <section className="moont-lp-section moont-lp-journey" aria-labelledby="moont-journey-title">
        <div className="moont-lp-container">
          <p className="moont-lp-kicker">Do primeiro rascunho à publicação</p>
          <div className="moont-lp-section-heading moont-lp-section-heading--split">
            <h2 id="moont-journey-title">Uma ideia passa por muita gente antes de ficar pronta.</h2>
            <p>A pauta muda, o cliente comenta e o time encontra um caminho melhor. A Moont mantém cada ajuste no mesmo projeto e na versão mais recente.</p>
          </div>
          <p className="moont-lp-swipe-hint" aria-hidden="true">Deslize para acompanhar a história <ArrowRight /></p>
          <div className="moont-lp-journey__grid" role="region" aria-label="Jornada da pauta à publicação" tabIndex={0}>
            <article className="moont-lp-journey__chapter moont-lp-journey__chapter--capture">
              <div className="moont-lp-journey__capture-media">
                <figure><ProductImage src={WORKDAY_STORY.brief} alt="Profissional reunindo referências no celular enquanto trabalha no notebook" /></figure>
              </div>
              <div className="moont-lp-journey__copy">
                <span>01 · Quando a pauta aparece</span>
                <h3>Capture o que surgiu.</h3>
                <p>Guarde pauta, link e referência assim que aparecerem. O material pode chegar aos poucos; o projeto continua no mesmo lugar.</p>
              </div>
            </article>

            <article className="moont-lp-journey__chapter moont-lp-journey__chapter--direction">
              <div className="moont-lp-journey__outputs" aria-label="Três exemplos de direções visuais para cultura, produto e estratégia">
                <figure><ProductImage src={WORKDAY_STORY.creator} alt="Carrossel sobre como transformar repertório em uma presença mais reconhecível" /></figure>
                <figure><ProductImage src={WORKDAY_STORY.culture} alt="Carrossel editorial sobre o retorno de experiências offline" /></figure>
                <figure><ProductImage src={WORKDAY_STORY.education} alt="Carrossel para educação sobre aprendizagem como processo de mudança" /></figure>
              </div>
              <div className="moont-lp-journey__copy">
                <span>02 · Quando a história ganha forma</span>
                <h3>Cada pauta encontra uma direção própria.</h3>
                <p>Organize o raciocínio, compare caminhos e escolha uma linguagem visual que combine com o que precisa ser dito.</p>
              </div>
            </article>

            <article className="moont-lp-journey__chapter moont-lp-journey__chapter--review">
              <figure className="moont-lp-journey__media"><ProductImage src={WORKDAY_STORY.review} alt="Equipe reunida diante do computador para revisar uma sequência visual" /></figure>
              <div className="moont-lp-journey__copy">
                <span>03 · Quando chega a hora de decidir</span>
                <h3>Revise com quem precisa aprovar.</h3>
                <p>Mostre o conjunto, compare caminhos e registre os ajustes sobre a mesma versão.</p>
              </div>
            </article>

            <article className="moont-lp-journey__chapter moont-lp-journey__chapter--final">
              <figure className="moont-lp-journey__media"><ProductImage src={WORKDAY_STORY.final} alt="Carrossel editorial finalizado com uma cena verde ao ar livre" /></figure>
              <div className="moont-lp-journey__copy">
                <span>04 · Quando a versão fica pronta</span>
                <h3>Faça o último ajuste e exporte.</h3>
                <p>Troque o que ainda não convenceu, exporte a versão aprovada e mantenha o projeto pronto para a próxima pauta.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="moont-lp-section moont-lp-responsive" aria-labelledby="moont-responsive-title">
        <div className="moont-lp-container moont-lp-responsive__grid">
          <div className="moont-lp-responsive__copy">
            <p className="moont-lp-kicker">Tudo continua editável</p>
            <h2 id="moont-responsive-title">Revise a sequência inteira e ajuste um detalhe por vez.</h2>
            <p>Veja o conjunto, abra qualquer card e mude texto, imagem, layout ou logo. No desktop ou no celular, a versão mais recente continua no mesmo projeto.</p>
            <div className="moont-lp-responsive__features">
              <span><Layers3 aria-hidden="true" /> Veja todos os cards lado a lado</span>
              <span><ImageIcon aria-hidden="true" /> Edite texto e imagem separadamente</span>
              <span><Presentation aria-hidden="true" /> Aplique a logo onde fizer sentido</span>
              <span><MonitorSmartphone aria-hidden="true" /> Revise no desktop e no celular</span>
            </div>
          </div>
          <div className="moont-lp-responsive__visual">
            <ProductWindow src={PRODUCT.comunica} alt="Projeto de carrossel visto na interface desktop da Moont" />
            <figure><ProductImage src={PRODUCT.responsiveMobile} alt="O mesmo projeto de carrossel adaptado ao editor no celular" /></figure>
          </div>
        </div>
      </section>

      <Plans onEnter={onEnter} />

      <section className="moont-lp-section moont-lp-faq" aria-labelledby="moont-faq-title">
        <div className="moont-lp-container moont-lp-faq__grid">
          <div>
            <p className="moont-lp-kicker">Dúvidas</p>
            <h2 id="moont-faq-title">Antes de assinar</h2>
          </div>
          <div className="moont-lp-faq__items">
            {FAQ.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}<ChevronDown aria-hidden="true" /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="moont-lp-closing" aria-labelledby="moont-closing-title">
        <div className="moont-lp-container moont-lp-closing__inner">
          <span className="moont-lp-closing__mark" aria-hidden="true" />
          <h2 id="moont-closing-title">A próxima pauta já pode começar com tudo o que você reuniu hoje.</h2>
          <p>Traga o briefing e as referências. A Moont organiza esse material em uma primeira versão pronta para revisar.</p>
          <ActionButton onClick={onEnter}>Criar meu primeiro projeto <ArrowRight aria-hidden="true" /></ActionButton>
        </div>
      </section>

      <footer className="moont-lp-footer">
        <div className="moont-lp-container">
          <BrandLogo height={26} />
          <p>Carrosséis e apresentações que começam com contexto.</p>
          <button type="button" onClick={onLogin}>Entrar</button>
        </div>
      </footer>
    </main>
  );
}
