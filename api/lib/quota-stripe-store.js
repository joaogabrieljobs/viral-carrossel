/**
 * Contador de imagens guardado nos metadados do cliente Stripe.
 *
 * Porquê existir: a quota vivia só no Upstash e, quando a base foi apagada, o
 * fallback era um Map por instância — ou seja quota nenhuma, reiniciada a cada
 * cold start. O Stripe já é a fonte de verdade do acesso e do plano, está sempre
 * disponível e é por cliente, logo serve de contador sem juntar mais um serviço.
 *
 * Limites do sítio onde se grava: metadados do cliente aceitam 50 chaves e 500
 * caracteres por valor. Guardamos uma chave por período de facturação e podamos
 * as antigas, ficando com duas.
 *
 * Nota honesta: o Stripe não tem incremento atómico. Dois pedidos em paralelo
 * podem ler o mesmo valor e contar uma imagem a menos. Na prática o cliente gera
 * em série (o loop do wizard é sequencial) e o rate limit é de 12/min, logo o
 * desvio máximo é de uma ou duas imagens. Com Upstash configurado nada disto é
 * usado: esse caminho é atómico e continua a ser o preferido.
 */
import { getStripe } from './stripe.js';

const PREFIXO = 'vc_img_';
const MAX_PERIODOS_GUARDADOS = 2;

function chaveDoPeriodo(periodStartSec) {
  return `${PREFIXO}${periodStartSec || 'nop'}`;
}

async function lerMetadados(customerId) {
  const stripe = getStripe();
  const cliente = await stripe.customers.retrieve(customerId);
  if (!cliente || cliente.deleted) throw new Error('Cliente Stripe inexistente.');
  return cliente.metadata || {};
}

/** Escreve o contador e apaga períodos antigos (valor '' remove a chave no Stripe). */
async function escreverContador(customerId, metadados, chave, valor) {
  const patch = { [chave]: String(valor) };
  const antigas = Object.keys(metadados)
    .filter((k) => k.startsWith(PREFIXO) && k !== chave)
    .sort()
    .reverse()
    .slice(MAX_PERIODOS_GUARDADOS - 1);
  for (const k of antigas) patch[k] = '';
  const stripe = getStripe();
  await stripe.customers.update(customerId, { metadata: patch });
}

export async function stripeQuotaGet({ customerId, periodStartSec }) {
  const metadados = await lerMetadados(customerId);
  const bruto = Number(metadados[chaveDoPeriodo(periodStartSec)]);
  return Number.isFinite(bruto) && bruto > 0 ? Math.floor(bruto) : 0;
}

/** Lê, valida contra o tecto e grava. Devolve o total usado depois desta imagem. */
export async function stripeQuotaConsume({ customerId, periodStartSec, cap }) {
  const metadados = await lerMetadados(customerId);
  const chave = chaveDoPeriodo(periodStartSec);
  const atual = Number(metadados[chave]);
  const usadas = Number.isFinite(atual) && atual > 0 ? Math.floor(atual) : 0;
  if (usadas >= cap) return cap + 1; // sinaliza esgotado, sem gravar
  const proximo = usadas + 1;
  await escreverContador(customerId, metadados, chave, proximo);
  return proximo;
}

export async function stripeQuotaRefund({ customerId, periodStartSec }) {
  const metadados = await lerMetadados(customerId);
  const chave = chaveDoPeriodo(periodStartSec);
  const atual = Number(metadados[chave]);
  const usadas = Number.isFinite(atual) && atual > 0 ? Math.floor(atual) : 0;
  const proximo = Math.max(0, usadas - 1);
  await escreverContador(customerId, metadados, chave, proximo);
  return proximo;
}

export { chaveDoPeriodo as _chaveDoPeriodo };
