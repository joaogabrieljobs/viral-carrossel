import React, { useEffect } from 'react';
import { GLOBAL_STYLE } from './styles/global-style.js';

export const LEGAL_PAGES = {
  '/privacidade': {
    eyebrow: 'Privacidade',
    title: 'Política de privacidade',
    updated: '23 de outubro de 2026',
    sections: [
      {
        heading: 'Controlador dos dados',
        body: 'O controlador dos dados pessoais tratados pelo Moont é ELEVESSY GESTÃO, INOVAÇÃO, TECNOLOGIA E COMÉRCIO LTDA, inscrita no CNPJ sob o nº 52.038.549/0001-79, com sede em São Paulo/SP.',
      },
      {
        heading: 'O que este texto cobre',
        body: 'Esta página descreve como o Moont (moont.ai) trata os dados da conta, dos projetos e do pagamento. Ela vale para quem visita o site, cria uma conta ou usa o studio.',
      },
      {
        heading: 'Dados da conta',
        body: 'Para entrar, guardamos o e-mail e, se você criar senha, uma forma protegida dessa senha. O login com Google usa a identificação que o Google confirma. A sessão fica num cookie HttpOnly chamado vc_access. O pagamento é processado pela Stripe: o Moont guarda o identificador do cliente e o estado da assinatura, não o número completo do cartão.',
      },
      {
        heading: 'O que você cria',
        body: 'Projetos, textos, briefing, marcas e logos ficam associados à sua conta. As fotos ficam num armazenamento privado dessa conta. Um código de equipe permite que outra conta com assinatura leia aquele projeto e as fotos referenciadas nele. A outra conta não passa a ver o resto da sua biblioteca.',
      },
      {
        heading: 'Integração com o Codex',
        body: 'Se você criar um token em Perfil, ele autoriza um plugin no seu computador a ler e alterar o visual dos projetos dessa conta. O servidor guarda só o hash do token. Você pode revogar o token a qualquer momento. Trocar a senha encerra as integrações ativas.',
      },
      {
        heading: 'Para que usamos',
        body: 'Usamos esses dados para autenticar, cobrar o plano, sincronizar a biblioteca entre os seus navegadores, gerar e guardar as peças que você pede, e impedir que uma conta acesse o conteúdo de outra. Não vendemos a biblioteca.',
      },
      {
        heading: 'Operadores e serviços contratados',
        body: 'Para prestar o serviço, usamos fornecedores que tratam dados sob contrato e conforme a função necessária: Vercel para hospedagem, execução e armazenamento; Stripe para pagamentos; Google quando você escolhe entrar com Google; e os provedores de inteligência artificial escolhidos no Moont para processar as solicitações de texto ou imagem. Esses fornecedores podem usar suboperadores e aplicar transferências internacionais com as salvaguardas exigidas pela legislação aplicável.',
      },
      {
        heading: 'Guarda e exclusão',
        body: 'Mantemos os dados enquanto a conta estiver ativa e pelo período necessário para prestar o serviço, cumprir obrigações legais, prevenir fraude, exercer direitos e resolver disputas. Quando a exclusão for cabível, removemos ou anonimizamos os dados dos sistemas ativos e os eliminamos dos ciclos de backup conforme os prazos técnicos e legais aplicáveis. Dados fiscais, financeiros e registros necessários à defesa de direitos podem ser conservados pelo prazo legal correspondente.',
      },
      {
        heading: 'Os seus pedidos',
        body: 'Você pode pedir confirmação do tratamento, acesso, correção, portabilidade quando aplicável, informação sobre compartilhamento, revisão de decisões automatizadas, oposição, anonimização, bloqueio ou exclusão nos casos previstos em lei. A resposta simplificada a confirmação ou acesso será dada imediatamente quando possível; a declaração completa será fornecida em até 15 dias, conforme a LGPD. Outros pedidos serão respondidos em prazo razoável, considerando a complexidade e a legislação aplicável. Apagar a conta não apaga automaticamente uma cópia que outra pessoa já tenha puxado por um código de equipe.',
      },
    ],
  },
  '/termos': {
    eyebrow: 'Termos',
    title: 'Termos de uso',
    updated: '23 de outubro de 2026',
    sections: [
      {
        heading: 'O serviço',
        body: 'O Moont é um studio para criar narrativas visuais, carrosséis e apresentações. O plano define o que está incluído, como geração de texto e, nos planos que o preveem, geração de imagem. Os limites vigentes são os mostrados na página de planos no momento da assinatura.',
      },
      {
        heading: 'A sua conta',
        body: 'A conta é pessoal ou da organização que a contratou. Você é responsável pelo e-mail, pela senha e pelos tokens que criar. Não compartilhe a senha. Um código de equipe entrega o projeto ligado a esse código a quem o usar com uma assinatura ativa.',
      },
      {
        heading: 'O que você publica',
        body: 'Textos, marcas, logos e fotos que você envia continuam seus. Você confirma que tem o direito de usar esse material no Moont e de partilhá-lo com a equipe quando gera um código. O Moont não reivindica a autoria das peças.',
      },
      {
        heading: 'Pagamento',
        body: 'A cobrança recorrente é feita pela Stripe. Cancelar interrompe a renovação conforme as regras do checkout. O acesso aos recursos pagos depende de uma assinatura ativa.',
      },
      {
        heading: 'Arrependimento e reembolso',
        body: 'Quando a contratação estiver sujeita ao Código de Defesa do Consumidor, você pode exercer o direito de arrependimento em até 7 dias contados da assinatura, pelos canais oficiais do Moont. Os valores pagos nesse período serão devolvidos conforme a legislação aplicável e o meio de pagamento. Fora dessa hipótese, pedidos de reembolso serão analisados de acordo com a oferta contratada, o uso efetivo do serviço e os direitos obrigatórios do consumidor. O cancelamento evita novas cobranças, mas não apaga automaticamente a conta ou os projetos.',
      },
      {
        heading: 'Uso aceitável',
        body: 'Não use o Moont para invadir outra conta, contornar o limite do plano, ou publicar conteúdo que você não pode usar. Podemos suspender o acesso quando a conta coloca em risco as outras contas ou o serviço.',
      },
      {
        heading: 'Alterações',
        body: 'Estes termos e a política de privacidade podem ser atualizados nesta página. A data no topo indica a versão vigente. Continuar a usar o Moont depois de uma atualização significa aceitar a versão publicada aqui.',
      },
      {
        heading: 'Lei aplicável e foro',
        body: 'Estes termos seguem a legislação brasileira. Em relações de consumo, fica assegurado o foro do domicílio do consumidor e todos os direitos que não podem ser afastados por contrato. Nos demais casos, fica eleito o foro da comarca de São Paulo/SP, salvo regra legal obrigatória diferente.',
      },
    ],
  },
};

export default function LegalPage() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const page = LEGAL_PAGES[path] || LEGAL_PAGES['/privacidade'];

  useEffect(() => {
    document.title = `${page.title} — Moont`;
  }, [page.title]);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#000' }}>
      <style>{GLOBAL_STYLE}</style>
      <main style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 24px 96px',
      }}>
        <a href="/" style={{
          color: '#000',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}>
          Moont
        </a>
        <p className="section-label" style={{ marginTop: 32 }}>{page.eyebrow}</p>
        <h1 style={{
          margin: '8px 0 0',
          fontSize: 40,
          lineHeight: 1.1,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          color: '#000',
        }}>
          {page.title}
        </h1>
        <p style={{ margin: '12px 0 0', color: '#5c5c5c', fontSize: 14 }}>
          Atualizado em {page.updated}
        </p>
        {page.sections.map((section) => (
          <section key={section.heading} style={{ marginTop: 32 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#000' }}>{section.heading}</h2>
            <p style={{ margin: '8px 0 0', fontSize: 18, lineHeight: 1.45 }}>{section.body}</p>
          </section>
        ))}
        <nav style={{ display: 'flex', gap: 16, marginTop: 48, fontSize: 14 }}>
          <a href="/privacidade" style={{ color: '#000' }}>Privacidade</a>
          <a href="/termos" style={{ color: '#000' }}>Termos</a>
          <a href="/" style={{ color: '#000' }}>Voltar</a>
        </nav>
      </main>
    </div>
  );
}
