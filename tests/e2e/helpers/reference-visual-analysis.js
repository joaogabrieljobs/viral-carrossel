import { createHash } from 'node:crypto';

// Resposta multimodal SIMULADA para o flyer local já usado pelos testes.
// A observação foi transcrita da referência; o teste não chama nem avalia a
// leitura de um modelo real. Nenhum normalizador do aplicativo é importado.
export const APOTEOSE_REFERENCE_VISUAL_ANALYSIS = Object.freeze({
  schemaVersion: 1,
  evidence: {
    medium: 'Retrato fotográfico tratado em duotone, combinado a grafismos vetoriais.',
    palette: 'Fundo índigo, rosto âmbar, sombras violeta, manchas ciano e magenta e pontos verdes.',
    subjects: 'Rosto com óculos grandes decorados, voltado para a direita.',
    light: 'Luz quente âmbar no rosto; sombras violeta profundas com contraste alto.',
    finish: 'Grão visível e retícula de impressão, com textura fosca.',
    graphics: 'Manchas orgânicas ciano e magenta e pontos verdes sobre fundo índigo.',
    hierarchy: 'Retrato ocupa a região inferior e letras finas grandes ocupam o alto.',
    negativeSpace: 'Faixas de fundo índigo separam as letras dos grafismos.',
    typography: 'Letras brancas finas, geométricas e altas, sem identificação de família.',
  },
  interpretation: { atmosphere: 'Atmosfera festiva e noturna, com tratamento gráfico expressivo.' },
  briefingRelation: { supported: ['O contraste de fotografia e grafismos reforça a identidade festiva informada.'], proposals: [] },
  direction: {
    invariants: ['Combinar fotografia em duotone e grafismos.', 'Manter luz âmbar, sombras violeta e textura fosca.'],
    variables: ['Variar pessoas, gestos, ambiente e enquadramento.'],
    restrictions: ['Não copiar a identidade da pessoa, o logotipo ou as letras da referência.'],
    composition: 'Adaptar a área calma de texto à zona real de cada slide; não repetir o enquadramento do flyer.',
    background: {
      finish: 'Grão visível e retícula de impressão, com textura fosca.',
      graphics: 'Manchas orgânicas ciano e magenta e pontos verdes sobre fundo índigo.',
    },
  },
  uncertainties: ['Não é possível identificar o equipamento fotográfico ou a família tipográfica exata.'],
  synthesis: 'Combine duotone editorial photography with cyan and magenta organic graphics on a deep indigo field. Keep warm amber facial light, violet shadows, saturated accents and visible matte print grain. Leave a calm text region and vary the people, gestures, setting and framing.',
});

export const APOTEOSE_CLEAN_BACKGROUND_REQUEST = 'For the shared abstract background, use a smooth flat surface without grain, print texture or graphic motifs. Keep that background uniform; graphics: none.';

export function referenceVisualAnalysisReply({ cleanBackground = false } = {}) {
  const analysis = structuredClone(APOTEOSE_REFERENCE_VISUAL_ANALYSIS);
  if (cleanBackground) analysis.direction.background = {
    finish: 'Smooth flat color, no grain or print texture.', graphics: 'none',
  };
  return analysis;
}

// Guarda somente hashes e metadados dos bytes realmente enviados. A imagem
// original continua no kit; a cópia JPEG/PNG pode ser redimensionada no app.
export function referenceVisualRequestFacts(body) {
  const user = body.payload?.messages?.find(message => message.role === 'user');
  const parts = Array.isArray(user?.content) ? user.content : [];
  return {
    purpose: body.purpose, provider: body.provider, operation: body.operation,
    model: body.payload?.model, maxTokens: body.payload?.max_tokens, thinking: body.payload?.thinking,
    system: body.payload?.messages?.find(message => message.role === 'system')?.content,
    text: parts.filter(part => part.type === 'text').map(part => part.text).join('\n'),
    images: parts.filter(part => part.type === 'image_url').map(part => {
      const url = part.image_url?.url || '', match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
      const bytes = match ? Buffer.from(match[2], 'base64') : Buffer.alloc(0);
      const validSignature = match?.[1] === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : match?.[1] === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      return { mime: match?.[1] || null, chars: url.length, bytes: bytes.length, validSignature: !!validSignature,
        sha256: createHash('sha256').update(bytes).digest('hex') };
    }),
  };
}
