import { chromium } from '@playwright/test';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const gallerySourceDir = path.join(root, 'public/landing/moont-v3/gallery-source');
const outputDir = path.join(root, 'public/landing/moont-v2/outputs');
const tempDir = path.join(root, '.tmp/moont-gallery');

await mkdir(outputDir, { recursive: true });
await mkdir(tempDir, { recursive: true });

const imageFiles = {
  editorialDiscovery: [gallerySourceDir, '01-editorial-discovery.webp'],
  editorialChoice: [gallerySourceDir, '02-editorial-choice.webp'],
  healthConsultation: [gallerySourceDir, '03-health-consultation.webp'],
  beautyLaunch: [gallerySourceDir, '04-beauty-launch.webp'],
  logisticsHub: [gallerySourceDir, '05-logistics-hub.webp'],
  coffeeEducation: [gallerySourceDir, '06-coffee-education.webp'],
};

const photos = Object.fromEntries(
  await Promise.all(
    Object.entries(imageFiles).map(async ([key, [directory, filename]]) => {
      const file = await readFile(path.join(directory, filename));
      return [key, `data:image/webp;base64,${file.toString('base64')}`];
    }),
  ),
);

const photo = (name, position = 'center') =>
  `style="background-image:url('${photos[name]}');background-position:${position}"`;

const commonStyles = String.raw`
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  .board { position: relative; width: 1600px; height: 1000px; overflow: hidden; isolation: isolate; }
  .board-kicker { position:absolute; top:48px; left:64px; z-index:10; font-size:13px; line-height:1; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
  .board-title { position:absolute; top:76px; left:62px; z-index:10; margin:0; font-size:58px; line-height:.96; letter-spacing:-.045em; max-width:920px; }
  .board-note { position:absolute; right:66px; top:64px; z-index:10; width:330px; font-size:16px; line-height:1.35; }
  .serial { position:absolute; right:24px; bottom:22px; font:700 11px/1 "SFMono-Regular", Consolas, monospace; letter-spacing:.12em; text-transform:uppercase; opacity:.65; }
  .post { position:absolute; overflow:hidden; border-radius:6px; box-shadow:0 22px 48px rgba(0,0,0,.2); }
  .post.featured { width:400px; height:500px; left:62px; top:258px; }
  .post.p2 { width:330px; height:412px; left:488px; top:298px; }
  .post.p3 { width:330px; height:412px; left:844px; top:252px; }
  .post.p4 { width:330px; height:412px; left:1200px; top:315px; }
  .post-no { position:absolute; right:20px; top:18px; z-index:8; font:700 11px/1 "SFMono-Regular", Consolas, monospace; letter-spacing:.08em; }
  .eyebrow { font-size:11px; line-height:1.1; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
  .photo { background-size:cover; background-repeat:no-repeat; }
  .deck-board { background:#eceae4; color:#101010; }
  .deck-board .board-title { font-size:52px; }
  .slide { position:absolute; overflow:hidden; border-radius:5px; box-shadow:0 22px 55px rgba(0,0,0,.17); }
  .slide.main { left:60px; top:245px; width:930px; height:523px; }
  .slide.s2 { left:1030px; top:245px; width:500px; height:281px; }
  .slide.s3 { left:1030px; top:550px; width:500px; height:281px; }
  .slide-index { position:absolute; right:22px; bottom:18px; font:700 10px/1 "SFMono-Regular", Consolas, monospace; letter-spacing:.08em; }
  .grid-lines { position:absolute; inset:0; pointer-events:none; opacity:.12; background-image:linear-gradient(to right,currentColor 1px,transparent 1px),linear-gradient(to bottom,currentColor 1px,transparent 1px); background-size:48px 48px; }
`;

const carouselCulture = () => String.raw`
<main class="board culture">
  <div class="board-kicker">Moont Comunica · Editorial / cultura</div>
  <h1 class="board-title">A timeline não é<br>um repertório.</h1>
  <div class="board-note">Uma narrativa em quatro movimentos: tensão, diagnóstico, virada e gesto prático.</div>
  <article class="post featured culture-cover photo" ${photo('editorialDiscovery', '52% 42%')}>
    <div class="wash"></div><span class="post-no">01/04</span>
    <div class="culture-vertical">CADERNO 07 — ATENÇÃO</div>
    <div class="culture-cover-copy"><span>Você não perdeu<br>a curiosidade.</span><strong>A timeline<br>perdeu por você.</strong></div>
  </article>
  <article class="post p2 culture-paper"><span class="post-no">02/04</span>
    <div class="eyebrow">O diagnóstico</div><div class="red-rule"></div>
    <h2>O algoritmo não matou a descoberta.</h2>
    <p>Só trocou <b>curadoria</b> por retenção — e chamou repetição de gosto pessoal.</p>
    <div class="culture-foot">DESLIZE PARA DESPROGRAMAR →</div>
  </article>
  <article class="post p3 culture-data"><span class="post-no">03/04</span>
    <div class="eyebrow">O ciclo invisível</div>
    <div class="loop"><span>você pausa</span><i>→</i><span>a rede repete</span><i>→</i><span>você reconhece</span><i>→</i><span>parece gosto</span></div>
    <p>Quanto mais previsível o feed,<br>menor o risco de encontrar<br>algo que mude você.</p>
  </article>
  <article class="post p4 culture-end photo" ${photo('editorialChoice', '50% 52%')}><span class="post-no">04/04</span>
    <div class="end-panel"><div class="eyebrow">Um gesto simples</div><h2>Troque dez minutos de scroll por uma escolha deliberada.</h2><p>Um filme. Um ensaio. Um disco inteiro.</p><b>O repertório começa onde a recomendação termina.</b></div>
  </article>
  <div class="serial">MOONT / CASE 01</div>
</main>
<style>
  .culture{background:#f0e9dc;color:#141414}.culture:after{content:"";position:absolute;left:0;right:0;bottom:0;height:150px;background:#ff4d2e}.culture .board-kicker{color:#eb3d21}.culture .board-note{border-left:2px solid #eb3d21;padding-left:18px}
  .culture .post{border:1px solid rgba(20,20,20,.16)}.culture-cover{color:white}.culture-cover .wash{position:absolute;inset:0;background:linear-gradient(165deg,rgba(20,16,15,.05) 10%,rgba(20,16,15,.86) 82%)}.culture-vertical{position:absolute;left:20px;top:20px;font:700 10px/1 monospace;letter-spacing:.13em;writing-mode:vertical-rl}.culture-cover-copy{position:absolute;left:28px;bottom:30px}.culture-cover-copy span{display:block;font:italic 20px/1.05 Georgia,serif;margin-bottom:10px}.culture-cover-copy strong{display:block;font:900 48px/.88 Arial,sans-serif;letter-spacing:-.06em;text-transform:uppercase}
  .culture-paper{padding:28px;background:#fffaf0;color:#1b1b1b}.culture-paper .red-rule{width:50px;height:5px;background:#ff4d2e;margin:27px 0 25px}.culture-paper h2{font:italic 39px/.98 Georgia,serif;letter-spacing:-.04em;margin:0 0 30px}.culture-paper p{font-size:18px;line-height:1.35}.culture-foot{position:absolute;bottom:24px;font:800 10px/1 monospace;letter-spacing:.08em;color:#eb3d21}
  .culture-data{padding:28px;background:#1c26d9;color:white}.culture-data .loop{display:grid;gap:7px;margin:38px 0 20px}.culture-data .loop span{border:1px solid rgba(255,255,255,.55);padding:8px 12px;font-size:14px;font-weight:700}.culture-data .loop i{font-style:normal;line-height:3px;color:#ffcb3c}.culture-data p{font:italic 16px/1.22 Georgia,serif;color:#fff3c4;margin:0}
  .culture-end{color:#fff}.culture-end:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.7))}.culture-end .end-panel{position:absolute;inset:auto 18px 18px;padding:20px;background:#ff4d2e}.culture-end h2{font-size:27px;line-height:1;letter-spacing:-.035em;margin:12px 0}.culture-end p{font-size:13px}.culture-end b{font:italic 15px/1.2 Georgia,serif}
</style>`;

const carouselHealth = () => String.raw`
<main class="board health">
  <div class="board-kicker">Moont Comunica · Saúde / educação</div>
  <h1 class="board-title">Clareza clínica,<br>sem falar difícil.</h1>
  <div class="board-note">Informação responsável com proximidade: acolhe a dúvida antes de explicar o conceito.</div>
  <article class="post featured health-cover"><span class="post-no">01/04</span>
    <div class="pulse"></div><div class="eyebrow">CONSULTA ABERTA · 08</div>
    <h2>Seus exames deram <i>normais.</i><br>Seu corpo não recebeu o memo.</h2>
    <p>O laudo é um retrato. Sintomas contam o filme.</p><div class="health-arrow">↓</div>
  </article>
  <article class="post p2 health-portrait photo" ${photo('healthConsultation', '57% 50%')}><span class="post-no">02/04</span>
    <div class="doctor-label"><span>“NORMAL”</span><b>é uma faixa estatística.<br>Não é o fim da conversa.</b></div>
  </article>
  <article class="post p3 health-list"><span class="post-no">03/04</span><div class="eyebrow">Antes do próximo exame</div>
    <h2>Mapeie o padrão.</h2>
    <ul><li><b>01</b><span>Quando a energia cai?</span></li><li><b>02</b><span>O que muda com o sono?</span></li><li><b>03</b><span>A dor segue um ciclo?</span></li><li><b>04</b><span>Qual hábito melhora tudo?</span></li></ul>
  </article>
  <article class="post p4 health-end"><span class="post-no">04/04</span>
    <div class="orbit"><i></i><i></i><i></i></div><div class="eyebrow">Leve isto à consulta</div>
    <h2>“O que meus sintomas revelam que a média não mostra?”</h2>
    <p>Uma boa pergunta organiza uma boa investigação.</p><div class="save">SALVE PARA PERGUNTAR →</div>
  </article>
  <div class="serial">MOONT / CASE 02</div>
</main>
<style>
 .health{background:#dfe9e4;color:#12332c}.health:before{content:"";position:absolute;width:560px;height:560px;border:1px solid #71998d;border-radius:50%;right:-120px;top:-240px}.health .board-title{font-family:Georgia,serif;font-weight:400;letter-spacing:-.045em}.health .board-note{color:#315f54}.health .post{box-shadow:0 24px 60px rgba(20,68,57,.15)}
 .health-cover{padding:30px;background:#0e4639;color:#f4f0e7}.health-cover .pulse{position:absolute;width:280px;height:280px;border:46px solid #c8ff6b;border-radius:50%;right:-105px;top:-55px;opacity:.9}.health-cover h2{position:relative;font:400 40px/1.02 Georgia,serif;letter-spacing:-.04em;margin:118px 0 20px;max-width:330px}.health-cover h2 i{color:#c8ff6b}.health-cover p{font-size:17px;line-height:1.4;max-width:260px}.health-arrow{position:absolute;bottom:26px;right:28px;font-size:34px;color:#c8ff6b}
 .health-portrait{color:white}.health-portrait:before{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(8,34,29,.82),rgba(8,34,29,0) 70%)}.doctor-label{position:absolute;left:20px;right:20px;bottom:22px}.doctor-label span{font:900 42px/.9 Arial,sans-serif;color:#c8ff6b;letter-spacing:-.05em}.doctor-label b{display:block;margin-top:8px;font:400 18px/1.2 Georgia,serif}
 .health-list{padding:28px;background:#f7f4ec}.health-list h2{font:400 35px/1 Georgia,serif;margin:22px 0 25px}.health-list ul{list-style:none;margin:0;padding:0}.health-list li{display:grid;grid-template-columns:38px 1fr;align-items:center;border-top:1px solid #96afa7;padding:13px 0;font-size:14px}.health-list li b{font:700 11px/1 monospace;color:#5f7f76}
 .health-end{padding:28px;background:#c8ff6b;color:#10352d}.health-end .orbit{position:absolute;right:-65px;top:-65px;width:220px;height:220px;border:1px solid #347264;border-radius:50%}.health-end .orbit i{position:absolute;width:10px;height:10px;background:#0e4639;border-radius:50%}.health-end .orbit i:nth-child(1){left:15px;top:100px}.health-end .orbit i:nth-child(2){left:100px;bottom:8px}.health-end .orbit i:nth-child(3){right:18px;top:48px}.health-end h2{position:relative;font:400 34px/1.04 Georgia,serif;letter-spacing:-.035em;margin:75px 0 20px}.health-end p{font-size:16px;line-height:1.35}.health-end .save{position:absolute;bottom:24px;font:800 10px/1 monospace;letter-spacing:.08em}
</style>`;

const carouselB2B = () => String.raw`
<main class="board b2b">
  <div class="grid-lines"></div><div class="board-kicker">Moont Comunica · B2B / dados</div>
  <h1 class="board-title">Dados que provocam<br>uma decisão.</h1>
  <div class="board-note">Um carrossel executivo com leitura instantânea: números grandes, contexto e próxima pergunta.</div>
  <article class="post featured b2b-cover"><span class="post-no">01/04</span><div class="eyebrow">MÉTRICA SOB SUSPEITA</div>
    <div class="warning">!</div><h2>Seu dashboard pode estar <em>mentindo</em><br>sem errar um número.</h2><p>O problema começa quando medir substitui decidir.</p>
  </article>
  <article class="post p2 b2b-split"><span class="post-no">02/04</span><div class="eyebrow">Cenário ilustrativo</div>
    <div class="metric good"><strong>+18%</strong><span>receita</span></div><div class="metric bad"><strong>−9%</strong><span>margem</span></div>
    <p>O topo comemorou crescimento.<br>O caixa sentiu o custo.</p>
  </article>
  <article class="post p3 b2b-bars"><span class="post-no">03/04</span><div class="eyebrow">Vaidade × decisão</div>
    <div class="bar"><span>IMPRESSÕES</span><i style="width:94%"></i><b>alto</b></div><div class="bar"><span>LEADS CERTOS</span><i style="width:52%"></i><b>médio</b></div><div class="bar"><span>MARGEM POR CANAL</span><i style="width:19%"></i><b>?</b></div>
    <blockquote>Quanto mais bonito o painel,<br>mais fácil esquecer a pergunta.</blockquote>
  </article>
  <article class="post p4 b2b-end"><span class="post-no">04/04</span><div class="eyebrow">A pergunta de segunda-feira</div>
    <h2>Qual decisão este gráfico muda?</h2><p>Se a resposta for “nenhuma”, você tem decoração — não inteligência.</p><div class="cursor">↗</div><div class="share">ENVIE PARA QUEM MONTA O REPORT</div>
  </article>
  <div class="serial">MOONT / CASE 03</div>
</main>
<style>
 .b2b{background:#071628;color:#e9f0f5}.b2b .board-kicker{color:#47e6a4}.b2b .board-note{color:#90a6b7}.b2b .post{border:1px solid #28445a;box-shadow:0 26px 55px rgba(0,0,0,.4);border-radius:3px}.b2b .post-no{color:#6d879a}
 .b2b-cover{padding:28px;background:#0b2034}.warning{position:absolute;right:26px;top:62px;width:54px;height:54px;display:grid;place-items:center;background:#ff5a45;color:#071628;border-radius:50%;font:900 34px/1 Arial}.b2b-cover h2{font-size:41px;line-height:.98;letter-spacing:-.05em;margin:120px 0 20px;max-width:330px}.b2b-cover h2 em{font-style:normal;color:#47e6a4}.b2b-cover p{font-size:16px;line-height:1.4;color:#a9bdca;max-width:270px}
 .b2b-split{padding:26px;background:#0e293f}.b2b-split .metric{position:absolute;top:92px;width:132px;height:134px;padding:14px;border:1px solid #3c5b70}.b2b-split .metric.good{left:26px}.b2b-split .metric.bad{right:26px}.b2b-split .metric strong{display:block;font:800 48px/1 Arial;letter-spacing:-.06em}.b2b-split .metric.good strong{color:#47e6a4}.b2b-split .metric.bad strong{color:#ff6a55}.b2b-split .metric span{text-transform:uppercase;font:700 10px/1 monospace;letter-spacing:.08em}.b2b-split p{position:absolute;left:26px;bottom:34px;font-size:18px;line-height:1.35}
 .b2b-bars{padding:28px;background:#071b2c}.b2b-bars .bar{position:relative;margin-top:34px}.b2b-bars .bar span{display:block;font:700 10px/1 monospace;letter-spacing:.07em;margin-bottom:8px}.b2b-bars .bar i{display:block;height:13px;background:#47e6a4}.b2b-bars .bar b{position:absolute;right:0;bottom:1px;font:700 10px/1 monospace;color:#a5bac8}.b2b-bars blockquote{margin:40px 0 0;padding-left:16px;border-left:3px solid #ff5a45;font-size:18px;line-height:1.25;color:#d8e3e9}
 .b2b-end{padding:28px;background:#47e6a4;color:#071628}.b2b-end h2{font-size:41px;line-height:.97;letter-spacing:-.05em;margin:78px 0 24px}.b2b-end p{font-size:18px;line-height:1.35;max-width:260px}.cursor{position:absolute;right:28px;bottom:66px;font-size:50px}.share{position:absolute;bottom:24px;font:800 9px/1 monospace;letter-spacing:.08em}
</style>`;

const carouselLaunch = () => String.raw`
<main class="board launch">
  <div class="board-kicker">Moont Comunica · Lançamento de produto</div>
  <h1 class="board-title">Desejo primeiro.<br>Detalhe depois.</h1>
  <div class="board-note">Uma campanha de lançamento com ritmo de revista: manifesto, produto, prova e convite.</div>
  <article class="post featured launch-cover photo" ${photo('beautyLaunch', '42% 50%')}><span class="post-no">01/04</span><div class="launch-shade"></div>
    <div class="wordmark">LUME/01</div><div class="cover-copy"><span>NOVO SÉRUM NOTURNO</span><h2>Sua pele não precisa de 12 passos.<br><i>Precisa do passo certo.</i></h2></div>
  </article>
  <article class="post p2 launch-product"><span class="post-no">02/04</span><div class="eyebrow">MENOS CAMADAS · MAIS INTENÇÃO</div>
    <div class="bottle"><b>L</b><i></i></div><h2>Três ativos.<br>Uma fórmula que sabe a hora de parar.</h2><p>Niacinamida 5% · ectoína · esqualano vegetal.</p>
  </article>
  <article class="post p3 launch-proof"><span class="post-no">03/04</span><div class="eyebrow">CENÁRIO ILUSTRATIVO · 28 NOITES</div><strong>91%</strong><h2>sentiram a pele mais estável, não apenas mais hidratada.</h2><p>Amostra fictícia para demonstração de layout. Resultados individuais variam.</p><div class="line-chart"><i></i><i></i><i></i><i></i></div>
  </article>
  <article class="post p4 launch-end"><span class="post-no">04/04</span><div class="moon"></div><div class="eyebrow">PRÉ-VENDA · 18 OUT</div>
    <h2>Menos ruído<br>na prateleira.<br>Mais calma<br>na pele.</h2><div class="cta">CONHECER LUME/01 <b>↗</b></div>
  </article>
  <div class="serial">MOONT / CASE 04</div>
</main>
<style>
 .launch{background:#e8d6cc;color:#401e26}.launch:after{content:"";position:absolute;width:510px;height:510px;background:#b64158;border-radius:50%;right:-90px;top:-250px}.launch .board-title{font-family:Georgia,serif;font-weight:400}.launch .board-note{z-index:11;color:#562934}.launch .post{border-radius:0;box-shadow:0 25px 50px rgba(88,36,45,.2)}
 .launch-cover{color:white}.launch-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(43,11,20,.05),rgba(43,11,20,.75))}.wordmark{position:absolute;top:26px;left:26px;font:500 18px/1 Georgia,serif;letter-spacing:.18em}.cover-copy{position:absolute;left:26px;right:26px;bottom:28px}.cover-copy span{font:800 10px/1 monospace;letter-spacing:.12em}.cover-copy h2{font:400 31px/1.05 Georgia,serif;letter-spacing:-.03em;margin:13px 0}.cover-copy h2 i{color:#f3c4c6}
 .launch-product{padding:25px;background:#f5eee8}.launch-product .bottle{position:relative;margin:48px auto 24px;width:90px;height:155px;border-radius:40px 40px 14px 14px;background:linear-gradient(145deg,#a82547,#5a0f28);box-shadow:18px 20px 35px rgba(83,15,37,.25);display:grid;place-items:center;color:#f6ddd2;font:400 40px/1 Georgia}.launch-product .bottle i{position:absolute;width:38px;height:18px;background:#3d1520;top:-17px}.launch-product h2{font:400 26px/1.05 Georgia,serif;margin:0}.launch-product p{font-size:11px;line-height:1.35;margin-top:14px;color:#754550}
 .launch-proof{padding:26px;background:#7d1535;color:#f7e9e2}.launch-proof strong{display:block;font:400 86px/.9 Georgia,serif;margin-top:55px;color:#f7c8bf}.launch-proof h2{font:400 25px/1.1 Georgia,serif;margin:10px 0 16px}.launch-proof p{font-size:10px;line-height:1.4;color:#e8b9b5}.line-chart{display:flex;align-items:end;gap:8px;height:60px;margin-top:15px}.line-chart i{width:40px;background:#f7c8bf}.line-chart i:nth-child(1){height:18px}.line-chart i:nth-child(2){height:28px}.line-chart i:nth-child(3){height:43px}.line-chart i:nth-child(4){height:58px}
 .launch-end{padding:27px;background:#29131d;color:#f4dfd6}.launch-end .moon{position:absolute;width:180px;height:180px;border-radius:50%;background:#c74c62;right:-54px;top:-62px}.launch-end h2{position:relative;font:400 38px/.95 Georgia,serif;letter-spacing:-.045em;margin:86px 0 0}.launch-end .cta{position:absolute;left:25px;right:25px;bottom:25px;padding:14px 16px;border:1px solid #e1a9ac;font:800 10px/1 monospace;letter-spacing:.08em}.launch-end .cta b{float:right;font-size:18px}
</style>`;

const presentationPitch = () => String.raw`
<main class="board deck-board pitch">
  <div class="board-kicker">Moont Apresenta · Pitch deck</div><h1 class="board-title">Uma tese que cabe<br>numa sala de decisão.</h1><div class="board-note">Narrativa de investimento: problema visível, modelo claro e números que sustentam a ambição.</div>
  <section class="slide main pitch-main"><div class="pitch-photo photo" ${photo('logisticsHub', '43% 48%')}></div><div class="pitch-block"><span class="eyebrow">ONDA · SEED ROUND 2026</span><h2>O último quilômetro<br>não precisa ser<br>o mais caro.</h2><p>Infraestrutura circular para entregas urbanas.</p></div><div class="slide-index">01 / 12</div></section>
  <section class="slide s2 pitch-market"><div class="eyebrow">MERCADO · DADO ILUSTRATIVO</div><strong>R$ 4,8 bi</strong><h3>gastos por ano em entregas de até 5 km nas capitais.</h3><div class="market-line"><i></i><i></i><i></i><i></i><i></i></div><div class="slide-index">04 / 12</div></section>
  <section class="slide s3 pitch-economics"><div class="eyebrow">CENÁRIO ILUSTRATIVO</div><div class="economics"><div><b>−31%</b><span>custo</span></div><div><b>+22%</b><span>entregas/h</span></div><div><b>0</b><span>emissão local</span></div></div><p>Hubs modulares + frota elétrica compartilhada.</p><div class="slide-index">08 / 12</div></section>
  <div class="serial">DECK SYSTEM / ONDA</div>
</main>
<style>
 .pitch{background:#e9e3d5;color:#173f35}.pitch .board-note{color:#4b665e}.pitch .slide{border:1px solid rgba(23,63,53,.18)}
 .pitch-main{display:grid;grid-template-columns:48% 52%;background:#173f35;color:#f2ecdf}.pitch-photo{background-size:cover}.pitch-block{padding:52px 42px;display:flex;flex-direction:column;justify-content:center}.pitch-block .eyebrow{color:#e0ff5c}.pitch-block h2{font:400 52px/.94 Georgia,serif;letter-spacing:-.05em;margin:22px 0}.pitch-block p{font-size:17px;color:#b9cbc5}.pitch-market{padding:32px;background:#e0ff5c;color:#173f35}.pitch-market strong{display:block;font-size:70px;line-height:.9;letter-spacing:-.07em;margin:38px 0 12px}.pitch-market h3{font-size:17px;line-height:1.25;margin:0;max-width:360px}.market-line{display:flex;align-items:end;gap:7px;position:absolute;right:30px;bottom:28px;height:75px}.market-line i{width:13px;background:#173f35}.market-line i:nth-child(1){height:22px}.market-line i:nth-child(2){height:36px}.market-line i:nth-child(3){height:49px}.market-line i:nth-child(4){height:61px}.market-line i:nth-child(5){height:74px}.pitch-economics{padding:30px;background:#f7f2e8;color:#173f35}.economics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:32px}.economics div{border-top:2px solid #173f35;padding-top:10px}.economics b{display:block;font-size:34px;letter-spacing:-.05em}.economics span{font:700 9px/1 monospace;text-transform:uppercase}.pitch-economics p{font-size:13px;margin-top:24px;color:#46665d}
</style>`;

const presentationMedical = () => String.raw`
<main class="board deck-board medical">
  <div class="board-kicker">Moont Apresenta · Médica / educacional</div><h1 class="board-title">Ciência que a plateia<br>consegue acompanhar.</h1><div class="board-note">Uma aula visual com hierarquia rigorosa: afirmação, mecanismo e aplicação clínica.</div>
  <section class="slide main med-main"><div class="med-spine">AULA 03 · METABOLISMO</div><div class="med-content"><span class="eyebrow">O PONTO DE PARTIDA</span><h2>Antes de mudar a dieta,<br>observe o sono.</h2><p>Privação de sono altera sinais de fome, resposta à insulina e escolhas alimentares no dia seguinte.</p><div class="source">EXEMPLO EDITORIAL · CONTEÚDO ILUSTRATIVO</div></div><div class="cell"><i></i><i></i><i></i></div><div class="slide-index">01 / 18</div></section>
  <section class="slide s2 med-cycle"><div class="eyebrow">O CICLO EM 24 HORAS</div><div class="cycle"><span>sono curto</span><i>→</i><span>mais fome</span><i>→</i><span>pior escolha</span><i>→</i><span>mais fadiga</span></div><div class="slide-index">07 / 18</div></section>
  <section class="slide s3 med-action"><div class="eyebrow">APLICAÇÃO CLÍNICA</div><h3>Uma semana de diário do sono antes da próxima mudança.</h3><div class="check"><b>✓</b><span>horário</span><b>✓</b><span>despertares</span><b>✓</b><span>energia ao acordar</span></div><div class="slide-index">14 / 18</div></section>
  <div class="serial">DECK SYSTEM / EDUCAÇÃO EM SAÚDE</div>
</main>
<style>
 .medical{background:#e8eef5;color:#10264f}.medical .board-kicker{color:#ee4e45}.medical .board-note{color:#4b5e7c}.medical .slide{border:1px solid #b8c8da}
 .med-main{display:grid;grid-template-columns:68px 1fr;background:#fff;color:#10264f}.med-spine{background:#10264f;color:#fff;writing-mode:vertical-rl;transform:rotate(180deg);padding:28px 24px;font:700 10px/1 monospace;letter-spacing:.1em}.med-content{padding:64px 58px;position:relative}.med-content .eyebrow{color:#ee4e45}.med-content h2{font-size:56px;line-height:.96;letter-spacing:-.055em;margin:26px 0 22px;max-width:650px}.med-content p{font-size:18px;line-height:1.4;max-width:520px;color:#4a5d79}.source{position:absolute;left:58px;bottom:36px;font:700 9px/1 monospace;letter-spacing:.08em}.cell{position:absolute;right:-42px;bottom:-42px;width:230px;height:230px;border:28px solid #ffcbc8;border-radius:50%}.cell i{position:absolute;width:16px;height:16px;border-radius:50%;background:#ee4e45}.cell i:nth-child(1){left:30px;top:30px}.cell i:nth-child(2){right:25px;top:78px}.cell i:nth-child(3){left:75px;bottom:12px}
 .med-cycle{padding:28px;background:#10264f;color:#fff}.med-cycle .eyebrow{color:#ff8b83}.cycle{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:42px}.cycle span{padding:12px 13px;border:1px solid #8291ad;font-size:14px;font-weight:700}.cycle i{font-style:normal;color:#ff8b83}.med-action{padding:29px;background:#ffcbc8;color:#10264f}.med-action h3{font-size:25px;line-height:1.05;letter-spacing:-.03em;margin:30px 0 24px;max-width:390px}.check{display:grid;grid-template-columns:18px 1fr;gap:8px 10px;font-size:12px}.check b{color:#e03932}
</style>`;

const presentationBrand = () => String.raw`
<main class="board deck-board brand">
  <div class="board-kicker">Moont Apresenta · Estratégia de marca</div><h1 class="board-title">Posicionamento com<br>uma ideia central.</h1><div class="board-note">Estratégia vira imagem, voz e decisão: cada slide avança a mesma tese sem repetir a forma.</div>
  <section class="slide main brand-main"><div class="brand-photo photo" ${photo('coffeeEducation', '62% 48%')}></div><div class="brand-card"><span class="eyebrow">RUIDO · ESTRATÉGIA 2027</span><h2>Café especial<br>sem a prova<br>de admissão.</h2><p>Conhecimento que convida,<br>não intimida.</p></div><div class="slide-index">01 / 16</div></section>
  <section class="slide s2 brand-tension"><div class="eyebrow">A TENSÃO</div><div class="versus"><strong>“Eu gosto de café.”</strong><span>vira</span><strong>“Mas não entendo o suficiente.”</strong></div><div class="slide-index">05 / 16</div></section>
  <section class="slide s3 brand-voice"><div class="eyebrow">NOSSA VOZ</div><div class="voice-grid"><div><b>CLARA</b><span>explica sem aula</span></div><div><b>CURIOSA</b><span>abre uma porta</span></div><div><b>PRECISA</b><span>não inventa regra</span></div></div><div class="brand-line">SABER MAIS DEVE AUMENTAR O PRAZER.</div><div class="slide-index">11 / 16</div></section>
  <div class="serial">DECK SYSTEM / RUIDO CAFÉ</div>
</main>
<style>
 .brand{background:#f2d9c9;color:#251f5c}.brand .board-kicker{color:#f04734}.brand .board-note{color:#574e82}.brand .slide{border:1px solid rgba(37,31,92,.18);box-shadow:0 24px 55px rgba(63,37,56,.19)}
 .brand-main{background:#211a57;color:#fff}.brand-photo{position:absolute;inset:0 0 0 47%;background-size:cover}.brand-photo:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#211a57 0%,rgba(33,26,87,.1) 50%)}.brand-card{position:absolute;left:52px;top:52px;bottom:48px;width:470px;z-index:2}.brand-card .eyebrow{color:#ff715b}.brand-card h2{font:400 60px/.89 Georgia,serif;letter-spacing:-.06em;margin:35px 0 24px}.brand-card p{font-size:18px;line-height:1.35;color:#e5cfef}
 .brand-tension{padding:30px;background:#ff6c57;color:#241c56}.versus{margin-top:34px}.versus strong{display:block;font:400 26px/1.03 Georgia,serif}.versus span{display:block;margin:10px 0;font:800 10px/1 monospace;letter-spacing:.1em;text-transform:uppercase}.brand-voice{padding:28px;background:#fff5e9;color:#241c56}.voice-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:32px}.voice-grid div{border-top:5px solid #241c56;padding-top:10px}.voice-grid b{display:block;font-size:15px}.voice-grid span{display:block;font-size:10px;margin-top:5px}.brand-line{position:absolute;left:28px;right:28px;bottom:28px;padding:12px;background:#d6ff51;font:800 10px/1 monospace;letter-spacing:.07em;text-align:center}
</style>`;

const boards = [
  ['carousel-editorial', carouselCulture],
  ['carousel-health', carouselHealth],
  ['carousel-b2b', carouselB2B],
  ['carousel-launch', carouselLaunch],
  ['presentation-pitch', presentationPitch],
  ['presentation-medical', presentationMedical],
  ['presentation-brand', presentationBrand],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

try {
  for (const [name, render] of boards) {
    await page.setContent(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${commonStyles}</style></head><body>${render()}</body></html>`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const png = path.join(tempDir, `${name}.png`);
    const webp = path.join(outputDir, `${name}.webp`);
    await page.screenshot({ path: png, type: 'png' });
    const result = spawnSync('cwebp', ['-quiet', '-q', '88', '-m', '6', png, '-o', webp], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`cwebp falhou para ${name}: ${result.stderr}`);
    console.log(`✓ ${path.relative(root, webp)}`);
  }
} finally {
  await browser.close();
  await rm(tempDir, { recursive: true, force: true });
}
