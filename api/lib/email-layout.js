/**
 * Layout único dos e-mails da Moont (27/11/2026). Antes, os quatro e-mails do
 * produto saíam em texto puro, sem logo, com travessão no assunto.
 *
 * Estrutura: cabeçalho com o símbolo e o nome; cartão com saudação, texto curto,
 * dados opcionais, caixa de destaque opcional, botão opcional e "Obrigado,
 * Equipe Moont"; bloco da marca; aviso final com o canal de contato.
 *
 * Só tabelas e estilo inline: clientes de e-mail ignoram <style>, flexbox e SVG.
 * Cores e fontes de `brand/moont-brand-kit/design-system/tokens.json`. Tom de voz
 * de `brand/moont-brand-kit/tom-de-voz/tom-de-voz.md`: "a Moont", você, frases
 * curtas, sem travessão, sem promessa que a plataforma não controla.
 *
 * Todo texto recebido passa por `escaparHtml` aqui dentro: quem chama entrega
 * texto puro, nunca HTML.
 */

/** Símbolo Sequência sobre Midnight, servido por https://moont.ai (public/icon-192.png). */
export const ICONE_EMAIL_MOONT = 'https://moont.ai/icon-192.png';
export const SITE_MOONT = 'https://moont.ai';

const COR = {
  midnight: '#090A0F',
  graphite: '#181B25',
  borda: '#262A36',
  moonlight: '#F3F0E7',
  mist: '#BBB9C7',
  apagado: '#8B8997',
  orbital: '#5B53E8',
  aurora: '#D7FF5A',
};
const FONTE = "Inter,'SF Pro Text',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FONTE_TITULO = "Manrope,Inter,'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const FRASE_MARCA = 'Ideias que ganham forma. Histórias que movem.';
export const DESCRICAO_MARCA = 'A Moont transforma contexto em narrativas visuais para comunicação e apresentações.';

export function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Só https: um link de outro esquema vira o site da Moont. */
function urlSegura(url) {
  const texto = String(url ?? '').trim();
  return /^https:\/\//i.test(texto) ? texto : SITE_MOONT;
}

/** "Olá, Maria," com o primeiro nome; sem nome, "Olá,". Devolve texto puro. */
export function saudacaoPorNome(nome) {
  const primeiro = String(nome ?? '').trim().split(/\s+/)[0] || '';
  return primeiro ? `Olá, ${primeiro},` : 'Olá,';
}

const p = (texto, cor = COR.mist, extra = '') =>
  `<p style="margin:0 0 16px;font-family:${FONTE};font-size:16px;line-height:1.6;color:${cor}${extra}">${escaparHtml(texto)}</p>`;

/**
 * @param {{
 *   titulo: string,               // <title> e pré-cabeçalho da caixa de entrada
 *   saudacao: string,
 *   paragrafos: string[],
 *   dados?: Array<[string, string]>,
 *   destaque?: { rotulo?: string, texto: string, grande?: boolean },
 *   botao?: { texto: string, url: string, mostrarEndereco?: boolean },
 *   observacao?: string,
 *   aviso: string,
 * }} e
 */
export function layoutEmailMoont(e) {
  const titulo = escaparHtml(e.titulo);
  const paragrafos = (e.paragrafos || []).map((t) => p(t)).join('\n              ');
  const dados = e.dados?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">${e.dados
      .map(([rotulo, valor]) => `<tr><td style="padding:2px 12px 2px 0;font-family:${FONTE};font-size:14px;color:${COR.apagado};white-space:nowrap;vertical-align:top">${escaparHtml(rotulo)}</td><td style="padding:2px 0;font-family:${FONTE};font-size:14px;color:${COR.moonlight};font-weight:600">${escaparHtml(valor)}</td></tr>`)
      .join('')}</table>`
    : '';
  const destaque = e.destaque
    ? `${e.destaque.rotulo ? `<p style="margin:0 0 8px;font-family:${FONTE};font-size:13px;color:${COR.apagado}">${escaparHtml(e.destaque.rotulo)}</p>` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr><td style="background:${COR.midnight};border:1px solid ${COR.borda};border-left:3px solid ${COR.aurora};border-radius:12px;padding:16px 18px;font-family:${e.destaque.grande ? FONTE_TITULO : FONTE};font-size:${e.destaque.grande ? '30px' : '15px'};${e.destaque.grande ? 'font-weight:800;letter-spacing:6px;' : ''}line-height:1.6;color:${COR.moonlight};white-space:pre-wrap">${escaparHtml(e.destaque.texto)}</td></tr></table>`
    : '';
  const url = e.botao ? escaparHtml(urlSegura(e.botao.url)) : '';
  const botao = e.botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px">
                <tr>
                  <td style="border-radius:12px;background:${COR.orbital}">
                    <a href="${url}" style="display:inline-block;padding:15px 28px;font-family:${FONTE};font-size:16px;font-weight:700;color:${COR.moonlight};text-decoration:none;border-radius:12px">${escaparHtml(e.botao.texto)}</a>
                  </td>
                </tr>
              </table>${e.botao.mostrarEndereco ? `
              <p style="margin:0 0 16px;font-family:${FONTE};font-size:13px;line-height:1.5;color:${COR.apagado}">Se o botão não abrir, copie e cole este endereço no navegador:<br><a href="${url}" style="color:${COR.mist};word-break:break-all;text-decoration:underline">${url}</a></p>` : ''}`
    : '';
  const observacao = e.observacao
    ? `<p style="margin:0 0 16px;font-family:${FONTE};font-size:13px;line-height:1.5;color:${COR.apagado}">${escaparHtml(e.observacao)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:${COR.midnight}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${titulo}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COR.midnight}">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
        <tr>
          <td style="padding:0 0 24px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle"><img src="${ICONE_EMAIL_MOONT}" width="40" height="40" alt="Moont" style="display:block;width:40px;height:40px;border-radius:10px;border:0"></td>
                <td style="vertical-align:middle;padding-left:12px;font-family:${FONTE_TITULO};font-size:22px;font-weight:800;color:${COR.moonlight};letter-spacing:-0.3px">Moont</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:${COR.graphite};border:1px solid ${COR.borda};border-radius:16px;padding:32px 28px">
              ${p(e.saudacao, COR.moonlight, ';font-weight:600')}
              ${paragrafos}
              ${dados}
              ${destaque}
              ${botao}
              ${observacao}
              <p style="margin:0 0 4px;font-family:${FONTE};font-size:16px;line-height:1.6;color:${COR.mist}">Obrigado,</p>
              <p style="margin:0;font-family:${FONTE};font-size:16px;line-height:1.6;color:${COR.moonlight};font-weight:700">Equipe Moont</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 0 0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COR.moonlight};border-radius:16px">
              <tr>
                <td style="padding:28px">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">
                    <tr>
                      <td style="vertical-align:middle"><img src="${ICONE_EMAIL_MOONT}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border-radius:12px;border:0"></td>
                      <td style="vertical-align:middle;padding-left:12px;font-family:${FONTE_TITULO};font-size:28px;font-weight:800;color:${COR.midnight};letter-spacing:-0.5px">Moont</td>
                    </tr>
                  </table>
                  <p style="margin:0 0 12px;font-family:${FONTE_TITULO};font-size:17px;line-height:1.45;color:${COR.midnight};font-weight:800">${escaparHtml(FRASE_MARCA)}</p>
                  <p style="margin:0;font-family:${FONTE};font-size:15px;line-height:1.55;color:#2A2C36">${escaparHtml(DESCRICAO_MARCA)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0;font-family:${FONTE};font-size:12px;line-height:1.5;color:${COR.apagado}">
            ${escaparHtml(e.aviso)}<br>
            Este endereço não recebe respostas. Para falar com a Moont, acesse <a href="${SITE_MOONT}" style="color:${COR.mist};text-decoration:underline">moont.ai</a>.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/* ---------- Um e-mail por função. Cada uma devolve { subject, html, text }. ---------- */

/** Recuperação de senha (api/auth/forgot-password.js). */
export function emailRecuperacaoSenha({ link, nome = null, minutos = 30 }) {
  const subject = 'Crie uma nova senha na Moont';
  return {
    subject,
    html: layoutEmailMoont({
      titulo: subject,
      saudacao: saudacaoPorNome(nome),
      paragrafos: ['Recebemos um pedido para redefinir a senha da sua conta na Moont. Toque no botão abaixo para criar uma nova senha.'],
      botao: { texto: 'Criar nova senha', url: link, mostrarEndereco: true },
      observacao: `Por segurança, o link vale por ${minutos} minutos e só pode ser usado uma vez.`,
      aviso: 'Se você não fez este pedido, ignore este e-mail. Sua senha continua a mesma.',
    }),
    text: `Recebemos um pedido para redefinir sua senha na Moont.\n\nAbra o link abaixo para criar uma nova senha. Ele vale por ${minutos} minutos e só pode ser usado uma vez:\n\n${link}\n\nSe você não fez este pedido, ignore este e-mail. Sua senha continua a mesma.\n\nEquipe Moont`,
  };
}

/** Cadastro com e-mail que já tem conta (api/auth/register.js, MOO-16). */
export function emailContaExistente({ linkEntrar, nome = null }) {
  const subject = 'Você já tem conta na Moont';
  return {
    subject,
    html: layoutEmailMoont({
      titulo: subject,
      saudacao: saudacaoPorNome(nome),
      paragrafos: [
        'Recebemos um pedido para criar uma conta na Moont com este e-mail, mas ele já tem uma conta.',
        'Para entrar, use sua senha ou o Google. Se não lembra a senha, toque em "Esqueci minha senha" na tela de entrada.',
      ],
      botao: { texto: 'Entrar na Moont', url: linkEntrar },
      aviso: 'Se você não fez este pedido, ignore este e-mail. Nada mudou na sua conta.',
    }),
    text: `Recebemos um pedido para criar uma conta na Moont com este e-mail, mas ele já tem uma conta.\n\nPara entrar, abra ${linkEntrar} e use sua senha ou o Google. Se não lembra a senha, toque em "Esqueci minha senha" na tela de entrada.\n\nSe você não fez este pedido, ignore este e-mail. Nada mudou na sua conta.\n\nEquipe Moont`,
  };
}

/** Aviso depois da troca de senha (api/auth/reset-password.js). */
export function emailSenhaAlterada({ linkRecuperacao, nome = null }) {
  const subject = 'Sua senha da Moont foi alterada';
  return {
    subject,
    html: layoutEmailMoont({
      titulo: subject,
      saudacao: saudacaoPorNome(nome),
      paragrafos: [
        'A senha da sua conta na Moont foi alterada. As sessões abertas antes da troca foram encerradas.',
        'Se foi você, não precisa fazer nada. Se não foi você, peça uma nova recuperação de senha agora.',
      ],
      botao: { texto: 'Recuperar minha conta', url: linkRecuperacao },
      aviso: 'Você recebeu este e-mail porque a senha da sua conta na Moont foi alterada.',
    }),
    text: `Sua senha da Moont foi alterada. As sessões anteriores foram encerradas.\n\nSe não foi você, solicite uma nova recuperação de senha em ${linkRecuperacao}.\n\nEquipe Moont`,
  };
}

/** Código de confirmação do console admin (api/admin.js). Uso interno da equipe. */
export function emailCodigoAdmin({ codigo, intent, minutos }) {
  const acao = intent === 'grant' ? 'conceder uma isenção' : 'revogar uma isenção';
  const subject = `Código do console admin: ${codigo}`;
  return {
    subject,
    html: layoutEmailMoont({
      titulo: subject,
      saudacao: 'Olá,',
      paragrafos: [`Use o código abaixo para ${acao} no console admin da Moont.`],
      destaque: { rotulo: 'Código', texto: codigo, grande: true },
      observacao: `O código vale por ${minutos} minutos e só serve para essa ação.`,
      aviso: 'Se não foi você, ignore este e-mail e avise o time.',
    }),
    text: `Seu código para ${acao} no console admin da Moont é ${codigo}.\n\nEle vale por ${minutos} minutos e só serve para essa ação.\n\nSe não foi você, ignore este e-mail e avise o time.`,
  };
}
