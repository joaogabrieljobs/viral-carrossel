/**
 * Ponto único que troca o erro cru do navegador (armazenamento cheio, falha
 * de leitura ou de gravação no aparelho) por uma frase em português que diz o
 * que fazer. O texto do navegador vem em inglês e muda de um navegador para
 * outro; nenhum aviso da Moont deve repeti-lo.
 */
const FULL = 'O armazenamento deste navegador está cheio. Baixe um backup do projeto e apague projetos ou fotos que não usa mais para liberar espaço.';
const WRITE = 'O navegador não conseguiu gravar os dados neste aparelho. Baixe um backup do projeto, feche as outras abas da Moont e recarregue a página. Se o disco estiver cheio, libere espaço antes.';
const READ = 'O navegador não conseguiu ler os dados salvos neste aparelho. Recarregue a página. Se o aviso voltar, feche as outras abas da Moont e tente novamente.';

// Cada padrão cobre a frase inteira do navegador, para a troca não deixar restos.
const RAW_PATTERNS = [
  [/Failed to execute '[^']*' on '[^']*':[^.]*exceeded the quota\.?/gi, FULL],
  [/Encountered full disk[^.]*\.?/gi, FULL],
  [/The quota has been exceeded\.?/gi, FULL],
  [/NS_ERROR_DOM_QUOTA_REACHED/g, FULL],
  [/QuotaExceededError(?::\s*[^.]*\.?)?/g, FULL],
  [/Failed to write blobs(?:\s*\([^)]*\))?\.?/gi, WRITE],
  [/An internal error was encountered in the Indexed Database server\.?/gi, WRITE],
  [/Internal error (?:opening|committing|retrieving|deleting)[^.]*\.?/gi, WRITE],
  [/Failed to read large IndexedDB value\.?/gi, READ],
];

/** Troca só o trecho do navegador; o resto da frase ("Imagem do card 2: …") fica. */
export function translateStorageErrorText(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const [pattern, message] of RAW_PATTERNS) out = out.replace(pattern, message);
  return out;
}

const QUOTA_NAMES = new Set(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']);

/** Frase pronta para um erro de armazenamento do navegador; `null` para os demais. */
export function storageErrorMessage(error) {
  if (!error) return null;
  if (QUOTA_NAMES.has(error.name) || error.code === 22 || error.code === 1014) return FULL;
  const raw = String(error.message || '');
  const translated = translateStorageErrorText(raw);
  if (translated === raw) return null;
  return [FULL, WRITE, READ].find((message) => translated.includes(message)) || null;
}

/** Mensagem de um erro para a tela: traduz o de armazenamento, conserva os da Moont. */
export function readableErrorMessage(error, fallback = '') {
  return storageErrorMessage(error) || translateStorageErrorText(String(error?.message || '')) || fallback;
}
