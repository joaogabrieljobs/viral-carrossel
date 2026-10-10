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
  comunica: '/landing/moont-product/01-interface-comunica-desktop.webp',
  apresenta: '/landing/moont-product/02-interface-apresenta-desktop.webp',
  mobile: '/landing/moont-product/03-interface-mobile.webp',
  carousel: '/landing/moont-product/04-carousel-output.webp',
  presentation: '/landing/moont-product/05-presentation-output.webp',
};

const IMAGE_DIMENSIONS = {
  [PRODUCT.comunica]: [1600, 1000],
  [PRODUCT.apresenta]: [1600, 1000],
  [PRODUCT.mobile]: [390, 844],
  [PRODUCT.carousel]: [360, 450],
  [PRODUCT.presentation]: [877, 494],
};

const USERS = [
  {
    image: '/landing/moont-users/01-social-media.webp',
    product: PRODUCT.comunica,
    screen: { left: '49.2%', top: '21.2%', width: '42.1%', height: '40.8%', clipPath: 'polygon(2% 3%, 100% 0, 98% 100%, 0 92%)' },
    role: 'Social media',
    title: 'Uma pauta vira uma semana de conteúdo.',
    copy: 'Planeje a sequência, refine os cards e publique sem remontar tudo em outra ferramenta.',
  },
  {
    image: '/landing/moont-users/02-brand-owner.webp',
    product: PRODUCT.comunica,
    screen: { left: '47.9%', top: '41.2%', width: '28.3%', height: '28.9%', clipPath: 'polygon(6% 1%, 100% 0, 95% 91%, 0 100%)' },
    role: 'Quem cuida da própria marca',
    title: 'A identidade continua reconhecível.',
    copy: 'Paleta, voz, logo e referências acompanham cada novo projeto.',
  },
  {
    image: '/landing/moont-users/03-doctor.webp',
    product: PRODUCT.apresenta,
    screen: { left: '45.7%', top: '20.1%', width: '43.3%', height: '37.4%', clipPath: 'polygon(2% 2%, 100% 0, 97% 100%, 0 94%)' },
    role: 'Especialistas',
    title: 'Conhecimento técnico ganha clareza.',
    copy: 'Organize um tema complexo em uma narrativa que o público consegue acompanhar.',
  },
  {
    image: '/landing/moont-users/04-advertising.webp',
    product: PRODUCT.apresenta,
    screen: { left: '42.7%', top: '19.9%', width: '49.3%', height: '37%', clipPath: 'polygon(2% 2%, 100% 0, 98% 100%, 0 95%)' },
    role: 'Times criativos',
    title: 'Do rascunho à revisão com menos retrabalho.',
    copy: 'Texto, direção visual e apresentação convivem no mesmo espaço de trabalho.',
  },
  {
    image: '/landing/moont-users/05-creator.webp',
    product: PRODUCT.comunica,
    screen: { left: '48.1%', top: '18.1%', width: '46%', height: '45.2%', clipPath: 'polygon(7% 0, 96% 5%, 100% 95%, 0 100%)' },
    role: 'Creators',
    title: 'Crie no computador. Ajuste onde estiver.',
    copy: 'A interface acompanha o seu ritmo no desktop e no celular.',
  },
];

const STEPS = [
  ['01', 'Traga o contexto', 'Cole a ideia, o brief, as referências ou o material que já existe.'],
  ['02', 'Escolha o formato', 'Carrossel para circular. Apresentação para explicar, convencer e avançar.'],
  ['03', 'Edite e publique', 'Ajuste texto, imagens e marca no studio antes de exportar.'],
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
  const [scope, setScope] = useState('text');
  const [selected, setSelected] = useState(0);
  const [logos, setLogos] = useState([]);
  const cards = [
    ['Uma ideia merece direção.', '/landing/sample-01.webp'],
    ['O contexto muda o resultado.', '/landing/sample-06.webp'],
    ['A identidade fecha a história.', '/landing/sample-10.webp'],
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
          <p className="moont-lp-kicker">Contexto de marca</p>
          <h2 id="moont-context-title">A Moont aprende a direção antes de criar.</h2>
          <p className="moont-lp-lead">
            Brief, voz, logo e referências vivem dentro do projeto. Assim, cada nova peça começa mais perto da sua identidade.
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
            Criar com o contexto da minha marca <ArrowRight aria-hidden="true" />
          </ActionButton>
        </div>

        <div className="moont-lp-demo" aria-label="Demonstração do projeto">
          <div className="moont-lp-demo__header">
            <div>
              <span className="moont-lp-demo__eyebrow">Projeto</span>
              <strong>Campanha de lançamento</strong>
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
              ? 'A narrativa ganha forma. Você adiciona ou gera as imagens quando quiser.'
              : 'Texto e direção visual juntos. Gerar imagens usa o saldo do plano ou a sua chave.'}
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
        <div className="moont-lp-plans__grid">
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
            <p className="moont-lp-kicker">Narrativa de comunicação e apresentação</p>
            <h1>Ideias que ganham forma.<br /><span>E seguem em frente.</span></h1>
            <p className="moont-lp-hero__lead">
              Transforme uma ideia, um brief ou um conteúdo existente em carrosséis e apresentações com narrativa, design e identidade de marca.
            </p>
            <div className="moont-lp-hero__actions">
              <ActionButton onClick={onEnter}>Começar a criar <ArrowRight aria-hidden="true" /></ActionButton>
              <button
                type="button"
                className="moont-lp-button moont-lp-button--secondary"
                onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Ver como funciona
              </button>
            </div>
            <div className="moont-lp-hero__proof" aria-label="Recursos principais">
              <span><Check aria-hidden="true" /> Carrossel e apresentação</span>
              <span><Check aria-hidden="true" /> Identidade por projeto</span>
              <span><Check aria-hidden="true" /> Edição completa</span>
            </div>
          </div>

          <div className="moont-lp-hero__product">
            <ProductWindow
              src={PRODUCT.comunica}
              alt="Interface da Moont exibindo um projeto de carrossel no desktop"
              eager
            />
            <figure className="moont-lp-hero__mobile">
              <ProductImage src={PRODUCT.mobile} alt="Interface da Moont em um celular" eager />
            </figure>
          </div>
        </div>
      </section>

      <section id="modos" className="moont-lp-section moont-lp-formats" aria-labelledby="moont-formats-title">
        <div className="moont-lp-container">
          <p className="moont-lp-kicker">Um studio. Dois formatos.</p>
          <div className="moont-lp-section-heading">
            <h2 id="moont-formats-title">Cada formato pede uma narrativa própria.</h2>
            <p>A Moont muda estrutura, ritmo e proporção. Você não recebe a mesma peça apenas redimensionada.</p>
          </div>

          <div className="moont-lp-formats__grid">
            <article className="moont-lp-format moont-lp-format--comunica">
              <div className="moont-lp-format__copy">
                <span>Feed · 4:5</span>
                <h3>Moont Comunica</h3>
                <p>Gancho, argumento, ritmo visual e fechamento para uma ideia circular nas redes.</p>
                <ul><li>Carrosséis</li><li>Posts</li><li>Stories</li></ul>
              </div>
              <div className="moont-lp-format__visual moont-lp-format__visual--portrait">
                <ProductImage src={PRODUCT.carousel} alt="Carrossel criado e editado na Moont" />
              </div>
            </article>

            <article className="moont-lp-format moont-lp-format--apresenta">
              <div className="moont-lp-format__copy">
                <span>Deck · 16:9</span>
                <h3>Moont Apresenta</h3>
                <p>Contexto, desenvolvimento e conclusão para explicar uma ideia e conduzir uma decisão.</p>
                <ul><li>Propostas</li><li>Aulas</li><li>Apresentações</li></ul>
              </div>
              <div className="moont-lp-format__visual moont-lp-format__visual--landscape">
                <ProductImage src={PRODUCT.presentation} alt="Slide de apresentação criado e editado na Moont" />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="moont-lp-section moont-lp-process" aria-labelledby="moont-process-title">
        <div className="moont-lp-container">
          <div className="moont-lp-section-heading moont-lp-section-heading--split">
            <div>
              <p className="moont-lp-kicker">Fluxo direto</p>
              <h2 id="moont-process-title">Da matéria-prima à peça pronta.</h2>
            </div>
            <p>Você traz o conteúdo. A Moont organiza a narrativa, propõe a direção visual e deixa cada escolha ao seu alcance.</p>
          </div>
          <ol className="moont-lp-process__steps">
            {STEPS.map(([number, title, copy]) => (
              <li key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></li>
            ))}
          </ol>
          <ProductWindow
            src={PRODUCT.apresenta}
            alt="Interface da Moont com uma apresentação em edição no desktop"
            className="moont-lp-process__window"
          />
        </div>
      </section>

      <section className="moont-lp-section moont-lp-users" aria-labelledby="moont-users-title">
        <div className="moont-lp-container">
          <p className="moont-lp-kicker">Feita para o trabalho real</p>
          <div className="moont-lp-section-heading moont-lp-section-heading--split">
            <h2 id="moont-users-title">A ferramenta entra na rotina de quem cria.</h2>
            <p>Do planejamento à última revisão, a Moont acompanha quem transforma conhecimento e estratégia em comunicação.</p>
          </div>
          <div className="moont-lp-users__grid">
            {USERS.map((item) => (
              <article key={item.role}>
                <div className="moont-lp-users__media">
                  <ProductImage src={item.image} alt={`${item.role} usando a Moont no trabalho`} />
                  <span className="moont-lp-users__screen" style={item.screen} aria-hidden="true">
                    <ProductImage src={item.product} alt="" />
                  </span>
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

      <WorkflowDemo onEnter={onEnter} />

      <section className="moont-lp-section moont-lp-responsive" aria-labelledby="moont-responsive-title">
        <div className="moont-lp-container moont-lp-responsive__grid">
          <div className="moont-lp-responsive__copy">
            <p className="moont-lp-kicker">Onde o trabalho acontece</p>
            <h2 id="moont-responsive-title">Uma visão ampla no desktop. Controle no celular.</h2>
            <p>Revise o conjunto, entre em cada card e faça ajustes sem perder a noção do projeto inteiro.</p>
            <div className="moont-lp-responsive__features">
              <span><MonitorSmartphone aria-hidden="true" /> Interface responsiva</span>
              <span><Layers3 aria-hidden="true" /> Visão do projeto completo</span>
              <span><ImageIcon aria-hidden="true" /> Imagens e texto no mesmo fluxo</span>
              <span><Presentation aria-hidden="true" /> Saídas para social e apresentação</span>
            </div>
          </div>
          <div className="moont-lp-responsive__visual">
            <ProductWindow src={PRODUCT.comunica} alt="Projeto de carrossel visto na interface desktop da Moont" />
            <figure><ProductImage src={PRODUCT.mobile} alt="O mesmo studio adaptado a um celular" /></figure>
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
          <h2 id="moont-closing-title">Uma boa ideia merece mais do que um template.</h2>
          <p>Dê contexto. Escolha o formato. Construa uma narrativa que leva alguém até o próximo passo.</p>
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
