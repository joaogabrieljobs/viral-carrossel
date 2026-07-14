// Status possíveis de um projeto salvo na biblioteca local.
export const STATUS_DEFS = [
  { id: 'draft',     label: 'Rascunho',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
  { id: 'ready',     label: 'Pronto',    color: '#86efac', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.3)' },
  { id: 'published', label: 'Publicado', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)',border: 'rgba(167,139,250,0.3)' },
];
export const STATUS_BY_ID = Object.fromEntries(STATUS_DEFS.map(s => [s.id, s]));

export const fmtDate = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' })
    + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
};

/** Detecta se `slides` ainda é o carrossel placeholder padrão (nunca editado). */
export const isDefault = (slides) =>
  Array.isArray(slides) &&
  slides.length === 1 &&
  slides[0]?.title === 'Seu título aqui';
