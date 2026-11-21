// Corpo de erro que pode chegar ao usuário (MOO-40). Só erro criado pela
// própria aplicação (código snake_case + status) leva a mensagem adiante;
// exceção de biblioteca externa (Stripe, pg, rede) vira a frase padrão, e o
// detalhe fica só no log do servidor.
const APP_CODE = /^[a-z]+(?:_[a-z]+)+$/;

function isAppError(error) {
  if (!error || typeof error.message !== 'string' || !error.message) return false;
  if (String(error.type || '').startsWith('Stripe') || error.raw) return false;
  return APP_CODE.test(String(error.code || '')) && Number.isInteger(error.status);
}

export function publicErrorBody(error, fallbackCode, fallbackMessage) {
  return isAppError(error)
    ? { error: error.message, code: error.code }
    : { error: fallbackMessage, code: fallbackCode };
}
