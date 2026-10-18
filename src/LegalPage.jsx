import React, { useEffect } from 'react';
import { GLOBAL_STYLE } from './styles/global-style.js';

const PAGES = {
  '/privacidade': {
    eyebrow: 'Privacidade',
    title: 'Política de privacidade',
    updated: '16 de outubro de 2026',
    sections: [
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
        heading: 'Os seus pedidos',
        body: 'Você pode pedir acesso, correção ou exclusão dos dados associados ao e-mail com que entra no Moont. O pedido identifica essa conta. Esta página não publica um e-mail de contato separado. Apagar a conta não apaga automaticamente uma cópia que outra pessoa já tenha puxado por um código de equipe.',
      },
    ],
  },
  '/termos': {
    eyebrow: 'Termos',
    title: 'Termos de uso',
    updated: '16 de outubro de 2026',
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
        heading: 'Uso aceitável',
        body: 'Não use o Moont para invadir outra conta, contornar o limite do plano, ou publicar conteúdo que você não pode usar. Podemos suspender o acesso quando a conta coloca em risco as outras contas ou o serviço.',
      },
      {
        heading: 'Alterações',
        body: 'Estes termos e a política de privacidade podem ser atualizados nesta página. A data no topo indica a versão vigente. Continuar a usar o Moont depois de uma atualização significa aceitar a versão publicada aqui.',
      },
    ],
  },
};

export default function LegalPage() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const page = PAGES[path] || PAGES['/privacidade'];

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
