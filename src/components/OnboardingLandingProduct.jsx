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

const OUTPUTS = [
  {
    image: '/landing/moont-v2/outputs/carousel-editorial.webp',
    mode: 'Carrossel · cultura',
    title: 'Do feed previsível à escolha deliberada.',
  },
  {
    image: '/landing/moont-v2/outputs/carousel-health.webp',
    mode: 'Carrossel · saúde',
    title: 'Do “normal” à pergunta certa.',
  },
  {
    image: '/landing/moont-v2/outputs/carousel-b2b.webp',
    mode: 'Carrossel · dados',
    title: 'Um número só vale quando muda a decisão.',
  },
  {
    image: '/landing/moont-v2/outputs/carousel-launch.webp',
    mode: 'Carrossel · produto',
    title: 'Desejo primeiro. Detalhe depois.',
  },
  {
    image: '/landing/moont-v2/outputs/presentation-pitch.webp',
    mode: 'Apresentação · pitch',
    title: 'Uma tese que cabe numa sala de decisão.',
  },
  {
    image: '/landing/moont-v2/outputs/presentation-medical.webp',
    mode: 'Apresentação · aula',
    title: 'Do mecanismo à conduta clínica.',
  },
  {
    image: '/landing/moont-v2/outputs/presentation-brand.webp',
    mode: 'Apresentação · estratégia',
    title: 'Conhecimento que convida, não intimida.',
  },
];

const IMAGE_DIMENSIONS = {
  [PRODUCT.comunica]: [1600, 1000],
  [PRODUCT.apresenta]: [1600, 1000],
  [PRODUCT.mobile]: [780, 1688],
  [PRODUCT.workflow]: [1420, 700],
  [PRODUCT.responsiveMobile]: [780, 1688],
  [PRODUCT.hero]: [1140, 610],
  [PRODUCT.carousel]: [1600, 1000],
  [PRODUCT.presentation]: [1600, 1000],
  ...Object.fromEntries(OUTPUTS.map(({ image }) => [image, [1600, 1000]])),
  '/landing/moont-v2/portraits/01-social-strategist.webp': [1536, 1024],
  '/landing/moont-v2/portraits/02-designer-overhead.webp': [1536, 1024],
  '/landing/moont-v2/portraits/03-brand-founder-beauty.webp': [1536, 1024],
  '/landing/moont-v2/portraits/04-doctor-profile.webp': [1536, 1024],
  '/landing/moont-v2/portraits/05-creator-low-angle.webp': [1122, 1402],
  '/landing/moont-v2/portraits/06-creative-director-urban.webp': [1122, 1402],
  '/landing/moont-v2/portraits/07-team-critique.webp': [1672, 941],
  '/landing/moont-v2/portraits/08-founder-coffee.webp': [1536, 1024],
};

const USERS = [
  {
    image: '/landing/moont-v2/portraits/01-social-strategist.webp',
    role: 'Social media',
    title: 'Referência boa merece virar direção.',
    copy: 'Transforme repertório, pauta e intenção em uma sequência pronta para defender.',
    alt: 'Social media diante de um mural de referências visuais em seu espaço de trabalho',
  },
  {
    image: '/landing/moont-v2/portraits/02-designer-overhead.webp',
    role: 'Designers',
    title: 'Direção primeiro. Variação depois.',
    copy: 'Comece por um sistema visual e explore versões sem perder hierarquia, ritmo ou intenção.',
    alt: 'Designer trabalhando em uma composição visual vista de cima',
  },
  {
    image: '/landing/moont-v2/portraits/03-brand-founder-beauty.webp',
    role: 'Donos de marca',
    title: 'Do produto à campanha sem perder a marca.',
    copy: 'Repita voz, códigos e oferta mesmo quando o volume aumenta.',
    alt: 'Fundadora de uma marca de beleza apresentando seus produtos',
  },
  {
    image: '/landing/moont-v2/portraits/04-doctor-profile.webp',
    role: 'Especialistas',
    title: 'A complexidade fica. A confusão sai.',
    copy: 'Organize conhecimento técnico em uma história clara sem simplificar o que realmente importa.',
    alt: 'Profissional de saúde em seu consultório durante uma conversa profissional',
  },
  {
    image: '/landing/moont-v2/portraits/05-creator-low-angle.webp',
    role: 'Creators',
    title: 'Mais tempo no conceito. Menos tempo remontando.',
    copy: 'Leve a mesma ideia do roteiro ao post, com espaço para ajustar cada detalhe antes de publicar.',
    alt: 'Creator em produção diante de uma câmera',
  },
  {
    image: '/landing/moont-v2/portraits/06-creative-director-urban.webp',
    role: 'Direção criativa',
    title: 'Uma direção clara entra na sala antes do layout.',
    copy: 'Compare caminhos e leve uma posição visual pronta para a próxima conversa.',
    alt: 'Diretora criativa a caminho de uma reunião com um caderno de trabalho',
  },
  {
    image: '/landing/moont-v2/portraits/07-team-critique.webp',
    role: 'Times criativos',
    title: 'Todo mundo revisa a mesma história.',
    copy: 'Texto, visual e sequência convivem no mesmo projeto para a conversa avançar sem retrabalho.',
    alt: 'Time criativo revisando referências em conjunto',
  },
  {
    image: '/landing/moont-v2/portraits/08-founder-coffee.webp',
    role: 'Negócios independentes',
    title: 'Do balcão à apresentação, a mesma marca.',
    copy: 'Transforme produto, operação e visão em peças que parecem do mesmo negócio.',
    alt: 'Dono de cafeteria trabalhando no balcão de seu negócio',
  },
];

const STEPS = [
  ['01', 'Comece com o que já existe', 'Cole a ideia, o link, o brief ou a referência que está espalhada pela sua rotina.'],
  ['02', 'Transforme informação em percurso', 'A Moont organiza a ordem, encontra o gancho e propõe uma direção visual para cada formato.'],
  ['03', 'Dê o último olhar humano', 'Mude texto, imagem, ritmo e marca até a peça soar como sua — então exporte.'],
];

const FAQ = [
  ['Preciso saber design?', 'Não. A Moont cria uma primeira direção completa e mantém tudo editável para você ajustar.'],
  ['Carrossel e apresentação usam a mesma estrutura?', 'Não. Cada formato usa uma narrativa, uma proporção e uma hierarquia próprias.'],
  ['Posso usar a identidade da minha marca?', 'Sim. Você pode guardar contexto, paleta, referências e logo por projeto.'],
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
          <p className="moont-lp-kicker">Sua marca chega primeiro</p>
          <h2 id="moont-context-title">Sua marca entra antes do primeiro card.</h2>
          <p className="moont-lp-lead">
            Brief, voz, paleta, logo e referências vivem dentro do projeto. A primeira versão já começa mais perto do que torna seu trabalho reconhecível.
          </p>
          <ul className="moont-lp-checklist">
            {[
              'Um contexto próprio para cada projeto',
              'Texto e imagens podem ser gerados separadamente',
              'Logo aplicada somente nos cards que você escolher',
              'Tudo continua editável antes da exportação',
            ].map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}
          </ul>
          <ActionButton onClick={onEnter}>
            Criar com minha direção <ArrowRight aria-hidden="true" />
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
          <h2 id="moont-plans-title">Escolha pelo seu ritmo de criação.</h2>
          <p>Texto com IA em todos os planos. Imagens inclusas para quem quer produzir mais.</p>
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
            <p className="moont-lp-kicker">O studio para quem cria todos os dias</p>
            <h1>Do briefing ao carrossel.<br /><span>Da ideia à apresentação.</span></h1>
            <p className="moont-lp-hero__lead">
              A Moont transforma texto, links e referências em sequências visuais editáveis — com narrativa, design e identidade de marca no mesmo studio.
            </p>
            <div className="moont-lp-hero__actions">
              <ActionButton onClick={onEnter}>Começar a criar <ArrowRight aria-hidden="true" /></ActionButton>
              <button
                type="button"
                className="moont-lp-button moont-lp-button--secondary"
                onClick={() => scrollToSection('como-funciona')}
              >
                Ver como funciona
              </button>
            </div>
            <div className="moont-lp-hero__proof" aria-label="Recursos principais">
              <span><Check aria-hidden="true" /> Pare o scroll</span>
              <span><Check aria-hidden="true" /> Conduza a sala</span>
              <span><Check aria-hidden="true" /> Edite tudo</span>
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
          <p className="moont-lp-kicker">Resultado antes da ferramenta</p>
          <div className="moont-lp-section-heading moont-lp-section-heading--split">
            <h2 id="moont-results-title">Uma ideia não precisa sair com a mesma roupa.</h2>
            <p>Quatro carrosséis. Três apresentações. Sete direções criativas construídas para assuntos, públicos e momentos diferentes.</p>
          </div>
          <p className="moont-lp-swipe-hint" aria-hidden="true">Deslize para explorar as direções <ArrowRight /></p>
          <div className="moont-lp-results__grid" role="region" aria-label="Exemplos de carrosséis e apresentações" tabIndex={0}>
            {OUTPUTS.map((item, index) => (
              <figure key={item.image} className={`moont-lp-result moont-lp-result--${index + 1}`}>
                <ProductImage src={item.image} alt={`Exemplo demonstrativo de ${item.mode.toLowerCase()}: ${item.title}`} />
                <figcaption>
                  <div>
                    <span>{item.mode}</span>
                    <small>Conteúdo e dados ilustrativos</small>
                  </div>
                  <strong>{item.title}</strong>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <WorkflowDemo onEnter={onEnter} />

      <section id="modos" className="moont-lp-section moont-lp-formats" aria-labelledby="moont-formats-title">
        <div className="moont-lp-container">
          <p className="moont-lp-kicker">Duas cadências</p>
          <div className="moont-lp-section-heading">
            <h2 id="moont-formats-title">Um carrossel precisa parar o scroll. Uma apresentação precisa conduzir a sala.</h2>
            <p>A Moont muda estrutura, ritmo, hierarquia e proporção. Cada formato nasce para o gesto que precisa provocar.</p>
          </div>

          <p className="moont-lp-swipe-hint" aria-hidden="true">Deslize para comparar os formatos <ArrowRight /></p>
          <div className="moont-lp-formats__grid" role="region" aria-label="Comparação entre carrossel e apresentação" tabIndex={0}>
            <article className="moont-lp-format moont-lp-format--comunica">
              <div className="moont-lp-format__copy">
                <span>Feed · 4:5</span>
                <h3>Moont Comunica</h3>
                <p>Gancho que abre tensão, sequência que entrega valor e fechamento que pede o próximo gesto.</p>
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
                <p>Abertura que enquadra, desenvolvimento que organiza e conclusão que move uma decisão.</p>
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
              <p className="moont-lp-kicker">Sem folha em branco</p>
              <h2 id="moont-process-title">Cole a pauta. Escolha o ritmo. Ajuste antes de publicar.</h2>
            </div>
            <p>A primeira versão chega pronta para ser julgada, mexida e melhorada. O trabalho começa em um ponto mais interessante.</p>
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

      <section className="moont-lp-section moont-lp-users" aria-labelledby="moont-users-title">
        <div className="moont-lp-container">
          <p className="moont-lp-kicker">Do outro lado da pauta</p>
          <div className="moont-lp-section-heading moont-lp-section-heading--split">
            <h2 id="moont-users-title">Da aprovação no WhatsApp à reunião com o cliente.</h2>
            <p>A Moont entra onde o trabalho realmente acontece: na pauta atrasada, no ajuste de última hora e na ideia que precisa ficar clara hoje.</p>
          </div>
          <p className="moont-lp-swipe-hint" aria-hidden="true">Deslize para conhecer as rotinas <ArrowRight /></p>
          <div className="moont-lp-users__grid" role="region" aria-label="Perfis que usam a Moont" tabIndex={0}>
            {USERS.map((item) => (
              <article key={item.role}>
                <div className="moont-lp-users__media">
                  <ProductImage src={item.image} alt={item.alt} />
                </div>
                <div>
                  <span>{item.role}</span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="moont-lp-section moont-lp-responsive" aria-labelledby="moont-responsive-title">
        <div className="moont-lp-container moont-lp-responsive__grid">
          <div className="moont-lp-responsive__copy">
            <p className="moont-lp-kicker">Controle sem desmontar a ideia</p>
            <h2 id="moont-responsive-title">Abra o detalhe sem perder o conjunto.</h2>
            <p>Revise a sequência inteira, entre em cada card e ajuste o que importa. Texto, imagem, layout e marca continuam no mesmo fluxo.</p>
            <div className="moont-lp-responsive__features">
              <span><MonitorSmartphone aria-hidden="true" /> Revise no desktop ou no celular</span>
              <span><Layers3 aria-hidden="true" /> Compare a sequência completa</span>
              <span><ImageIcon aria-hidden="true" /> Troque texto e imagem por bloco</span>
              <span><Presentation aria-hidden="true" /> Aplique a marca sem travar a composição</span>
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
          <h2 id="moont-closing-title">A próxima pauta não precisa começar do zero.</h2>
          <p>Comece do contexto. Termine com algo que parece pensado até o último card.</p>
          <ActionButton onClick={onEnter}>Começar a criar <ArrowRight aria-hidden="true" /></ActionButton>
        </div>
      </section>

      <footer className="moont-lp-footer">
        <div className="moont-lp-container">
          <BrandLogo height={26} />
          <p>Comunicação e apresentação, com direção.</p>
          <button type="button" onClick={onLogin}>Entrar</button>
        </div>
      </footer>
    </main>
  );
}
