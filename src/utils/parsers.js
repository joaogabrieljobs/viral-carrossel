/** Parsers tolerantes para respostas de LLM. Sem dependências. */

/** Extrai JSON de uma resposta de LLM mesmo quando vem com fences markdown,
 *  texto prefixo/sufixo ou múltiplos blocos.
 *  Estratégia em 2 passes:
 *    1. Tenta parse direto (depois de stripar fences ```);
 *    2. Varre buscando o primeiro objeto `{…}` válido respeitando strings/escapes.
 *  Loga em console.warn quando cai pro fallback (sem engolir o erro). */
export function extractJSON(raw) {
  if (!raw) throw new Error('IA retornou resposta vazia. Tente novamente.');
  const s = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(s);
  } catch (e1) {
    console.warn(
      '[extractJSON] parse direto falhou, tentando recorte por chaves:',
      e1.message,
      '| preview:',
      s.slice(0, 200),
    );
  }
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch (e2) {
          console.warn(
            '[extractJSON] recorte falhou, continuando varredura:',
            e2.message,
            '| slice preview:',
            s.slice(start, Math.min(start + 200, i + 1)),
          );
        }
      }
    }
  }
  throw new Error('Formato de resposta inválido. Tente novamente.');
}
