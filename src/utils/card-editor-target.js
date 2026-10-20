/** Para onde o menu vai quando a pessoa clica um item do card. */
const TEXT_KEYS = new Set(['text', 'title', 'subtitle', 'eyebrow', 'bodyAfterImage', 'offer']);

const BRAND_SECTIONS = {
  logo: 'marca-logo',
  headerBar: 'marca-barra',
  pageBadge: 'marca-ornamentos',
  star: 'marca-ornamentos',
  handleBadge: 'marca-perfil',
  pill: 'marca-selo',
  footerBar: 'marca-rodape',
};

export function cardElementEditorTarget(key) {
  const chave = String(key || '');
  if (!chave) return null;
  if (chave.startsWith('ov_')) return { tab: 'visual', section: 'visual-elementos', mode: 'criador' };
  if (chave === 'photo') return { tab: 'imagem', section: 'imagem-ajustes', mode: 'criador' };
  if (TEXT_KEYS.has(chave)) return { tab: 'texto', section: 'texto-caixa', mode: 'criador' };
  const section = BRAND_SECTIONS[chave];
  if (section) return { tab: 'brand', section, mode: 'criador' };
  return null;
}
