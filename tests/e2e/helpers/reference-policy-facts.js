export function referencePolicyFacts(prompt, referenceCount) {
  // Uma política pode repetir-se dentro do mesmo parágrafo. Contar seus
  // inícios evita aceitar duas cópias como um único bloco de referência.
  const policies = String(prompt).split(/\n\s*\n/).flatMap(block => {
    const starts = [...block.matchAll(/\b(?:moodboards?|style references?)(?:\s+images)?\s+(?:(?:only|solely)\s+for\s+(?:the\s+)?(?:look|visual|style)|supply\s+visual\s+language)\b/gi)];
    return starts.map((match, index) => block.slice(match.index, starts[index + 1]?.index ?? block.length));
  });
  const excludesContent = policy => {
    if (/^moodboards?\s+supply\s+visual\s+language\b/i.test(policy)) {
      // A versão com leitura visual não limita a referência a cor/textura:
      // exige também os limites e a precedência completos observados no HTTP.
      return [
        /\bnot the identity of the depicted person or an exact scene to copy\b/i,
        /\bexplicit written direction overrides their medium and look\b/i,
        /\botherwise preserve medium, detail and photo\/graphics hierarchy\b/i,
        /\bthe current scene and COMPOSITION govern the new image\b/i,
      ].every(clause => clause.test(policy));
    }
    return /\b(?:never|not|no|do not)\b[^.]*\b(?:people|faces|subjects)\b[^.]*\b(?:framing|composition|scene)\b/i.test(policy);
  };
  const roles = [...String(prompt).matchAll(/\b(\d+)\s*[:.)-]\s*(moodboard|style(?:[- ]only)?|identity)\b/gi)]
    .map(match => ({ number: Number(match[1]), role: /^identity$/i.test(match[2]) ? 'identity' : 'style' }));
  return {
    policyCount: policies.length,
    lookOnlyExcludesContent: policies.length > 0 && policies.every(excludesContent),
    roles,
    expectedRoles: Array.from({ length: referenceCount }, (_, index) =>
      ({ number: index + 1, role: index === 0 ? 'style' : 'identity' })),
  };
}
