/**
 * E-mails da Moont com a identidade da marca (27/11/2026).
 * Antes: os quatro e-mails saíam em texto puro, sem logo, com travessão no assunto.
 * Também cobre o idioma dos e-mails da Stripe e as mensagens de erro de entrada.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ICONE_EMAIL_MOONT,
  emailCodigoAdmin,
  emailContaExistente,
  emailRecuperacaoSenha,
  emailSenhaAlterada,
  escaparHtml,
  layoutEmailMoont,
  saudacaoPorNome,
} from '../../api/lib/email-layout.js';
import { MSG_SEM_CONEXAO, erroDoServidor, mensagemErroAuth } from '../../src/lib/auth-error-message.js';

const ler = (p) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const TRAVESSAO = /[—–]/;
const NOME_ANTIGO = /viral\s*carrossel|viralcarrossel/i;

const todos = () => [
  emailRecuperacaoSenha({ link: 'https://moont.ai/redefinir-senha#token=abc' }),
  emailContaExistente({ linkEntrar: 'https://moont.ai/?app=1' }),
  emailSenhaAlterada({ linkRecuperacao: 'https://moont.ai/redefinir-senha' }),
  emailCodigoAdmin({ codigo: '482913', intent: 'grant', minutos: 10 }),
];

describe('layout único', () => {
  it('escapa tudo que chega, inclusive texto, dados, destaque, botão e aviso', () => {
    const html = layoutEmailMoont({
      titulo: '<t>',
      saudacao: saudacaoPorNome('<b>Ana</b> Lima'),
      paragrafos: ['<script>alert(1)</script>'],
      dados: [['<r>', '"v"&']],
      destaque: { rotulo: '<x>', texto: '<img src=x onerror=1>' },
      botao: { texto: '<i>ir</i>', url: 'https://moont.ai/?a=1&b="2"' },
      observacao: '<o>',
      aviso: '<a href="https://mal.example">clique</a>',
    });
    expect(html).not.toMatch(/<script>|<img src=x|<b>Ana|<i>ir|<a href="https:\/\/mal/);
    expect(html).toContain('Olá, &lt;b&gt;Ana&lt;/b&gt;,');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;v&quot;&amp;');
    expect(html).toContain('href="https://moont.ai/?a=1&amp;b=&quot;2&quot;"');
    expect(html).toContain('<title>&lt;t&gt;</title>');
  });

  it('link que não é https vira o site da Moont', () => {
    const html = layoutEmailMoont({ titulo: 't', saudacao: 'Olá,', paragrafos: [], aviso: 'a', botao: { texto: 'Ir', url: 'javascript:alert(1)' } });
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="https://moont.ai"');
  });

  it('saudação pelo primeiro nome, ou só "Olá,"', () => {
    expect(saudacaoPorNome('Maria Souza')).toBe('Olá, Maria,');
    expect(saudacaoPorNome('  ')).toBe('Olá,');
    expect(saudacaoPorNome(null)).toBe('Olá,');
    expect(escaparHtml("a'b")).toBe('a&#39;b');
  });

  it('ícone PNG em https, sem SVG nem data URI, e sem <style>', () => {
    expect(ICONE_EMAIL_MOONT).toBe('https://moont.ai/icon-192.png');
    for (const { html } of todos()) {
      expect(html).toContain(`src="${ICONE_EMAIL_MOONT}"`);
      expect(html).not.toMatch(/\.svg|data:image|<style|display:\s*flex/i);
    }
  });
});

describe('cada e-mail: português, Moont, sem nome antigo, sem travessão', () => {
  it.each(todos().map((m) => [m.subject, m]))('%s', (_, m) => {
    for (const parte of [m.subject, m.html, m.text]) {
      expect(parte).not.toMatch(TRAVESSAO);
      expect(parte).not.toMatch(NOME_ANTIGO);
      expect(parte).not.toMatch(/\b(Confirm your|Reset your|Click here|password)\b/i);
    }
    expect(m.html).toContain('lang="pt-BR"');
    expect(m.html).toContain('Equipe Moont');
    expect(m.html).toContain('Ideias que ganham forma. Histórias que movem.');
    expect(m.html).toContain('Este endereço não recebe respostas.');
    expect(m.html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it('assuntos', () => {
    expect(todos().map((m) => m.subject)).toEqual([
      'Crie uma nova senha na Moont',
      'Você já tem conta na Moont',
      'Sua senha da Moont foi alterada',
      'Código do console admin: 482913',
    ]);
  });

  it('o texto puro mantém o link como primeiro endereço (contrato dos testes de recuperação)', () => {
    const link = 'https://moont.ai/redefinir-senha#token=abc';
    const m = emailRecuperacaoSenha({ link, minutos: 30 });
    expect(m.text.match(/https:\/\/\S+/)[0]).toBe(link);
    expect(m.html).toContain(`href="${link}"`);
    expect(m.html).toContain('30 minutos');
  });

  it('código do admin aparece em destaque e a ação certa', () => {
    expect(emailCodigoAdmin({ codigo: '1', intent: 'revoke', minutos: 10 }).html).toContain('revogar uma isenção');
  });
});

describe('rotas chamam o layout', () => {
  it('recuperação, conta existente e senha alterada', () => {
    const src = ler('api/lib/password-reset.js');
    expect(src).toContain("from './email-layout.js'");
    expect(src).toContain('...emailRecuperacaoSenha({');
    expect(src).toContain('...emailContaExistente({');
    expect(src).toContain('...emailSenhaAlterada({');
    expect(src).toContain('subject, html, text }');
    expect(src).not.toMatch(TRAVESSAO);
  });
  it('código do console admin', () => {
    const src = ler('api/admin.js');
    expect(src).toContain('emailCodigoAdmin({ codigo: code, intent');
    expect(src).not.toContain('Seu código para ${what}');
  });
  it('nenhum outro envio ao Resend fora dos dois pontos conhecidos', () => {
    const raiz = resolve(__dirname, '..', '..');
    const achados = readdirSync(resolve(raiz, 'api'), { recursive: true })
      .filter((f) => /\.m?js$/.test(f))
      .filter((f) => /api\.resend\.com|nodemailer|sendgrid|mailgun|postmark/i.test(readFileSync(resolve(raiz, 'api', f), 'utf8')))
      .map((f) => `api/${f}`).sort();
    expect(achados).toEqual(['api/admin.js', 'api/lib/password-reset.js']);
  });
});

describe('Stripe manda recibo e fatura em português', () => {
  it.each([
    'api/auth/register.js', 'api/auth/google/callback.js', 'api/lib/billing-handlers.js',
  ])('%s cria o cliente com pt-BR', (p) => {
    const src = ler(p);
    const blocos = src.split('customers.create(').slice(1).map((b) => b.slice(0, 400));
    expect(blocos.length).toBeGreaterThan(0);
    for (const b of blocos) expect(b).toContain("preferred_locales: ['pt-BR']");
  });
  it('password-auth: as duas criações com pt-BR', () => {
    const blocos = ler('api/lib/password-auth.js').split('customers.create(').slice(1).map((b) => b.slice(0, 400));
    expect(blocos).toHaveLength(2);
    for (const b of blocos) expect(b).toContain("preferred_locales: ['pt-BR']");
  });
});

describe('erros de entrada sempre em português', () => {
  const padrao = 'Não foi possível autenticar. Tente novamente.';
  it('falta de rede do navegador vira mensagem de conexão', () => {
    expect(mensagemErroAuth(new TypeError('Failed to fetch'), padrao)).toBe(MSG_SEM_CONEXAO);
    expect(mensagemErroAuth(new TypeError('Load failed'), padrao)).toBe(MSG_SEM_CONEXAO);
    expect(mensagemErroAuth(new Error('NetworkError when attempting to fetch resource.'), padrao)).toBe(MSG_SEM_CONEXAO);
  });
  it('texto da nossa API passa; inglês da plataforma cai no padrão', () => {
    expect(mensagemErroAuth(erroDoServidor('E-mail ou senha incorretos.'), padrao)).toBe('E-mail ou senha incorretos.');
    expect(mensagemErroAuth(erroDoServidor('Method not allowed'), padrao)).toBe(padrao);
    expect(mensagemErroAuth(erroDoServidor('Internal Server Error'), padrao)).toBe(padrao);
    expect(mensagemErroAuth(new Error('Unexpected token < in JSON'), padrao)).toBe(padrao);
  });
  it('telas usam a função e nunca o texto cru', () => {
    expect(ler('src/components/LoginModal.jsx')).toContain('setError(mensagemErroAuth(err,');
    expect(ler('src/PasswordRecoveryPage.jsx')).toContain('setError(mensagemErroAuth(e,');
    expect(ler('src/PasswordRecoveryPage.jsx')).not.toContain('setError(e.message)');
    expect(ler('src/lib/billing.js')).toContain("throw erroDoServidor(data.error || 'Não foi possível entrar')");
    expect(ler('src/lib/password-recovery.js')).toContain('throw erroDoServidor(');
  });
});
