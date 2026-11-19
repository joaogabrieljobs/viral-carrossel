/** Art direction is deterministic. The model supplies content, never CSS. */
const box = (x, y, w, h) => ({ x, y, w, h });
const noPhoto = () => box(96, 94, 1, 1);

export function presentationFamily(id = '') {
  const value = String(id);
  for (const [pattern, family] of [
    [/photo.essay/, 'photo'], [/editorial.magazine/, 'editorial'],
    [/typographic.bold/, 'typographic'], [/cinematic/, 'cinematic'],
    [/data.first/, 'data'], [/swiss.grid/, 'swiss'],
    [/modular.cards/, 'modular'], [/technical.blueprint/, 'technical'],
    [/premium.dark/, 'premium'],
  ]) if (pattern.test(value)) return family;
  return 'executive';
}

/** Each family has a spatial grammar, including pages with no photography. */
export function artDirectedPresentationZones(kind, slide, family, { visual, structured }) {
  if (structured) {
    // Full-width evidence with a short introduction. A long argument belongs
    // on another page/notes; it must not be repeated above the same table.
    const top = family === 'technical' || family === 'swiss' ? 12 : 14;
    return { title: box(6, top, 88, 17), subtitle: box(6, top + 19, 88, 16), evidence: box(6, top + 39, 88, 39), photo: noPhoto() };
  }
  if (!visual) {
    if (kind === 'cover') return { title: box(7, 17, 84, 39), subtitle: box(8, 63, 70, 26), photo: noPhoto() };
    if (kind === 'divider') return { title: box(8, 20, 84, 36), subtitle: box(8, 64, 70, 25), photo: noPhoto() };
    if (kind === 'closing') return { title: box(8, 18, 82, 31), subtitle: box(9, 58, 74, 32), photo: noPhoto() };
    if (family === 'editorial' || family === 'premium') return { title: box(7, 16, 36, 52), subtitle: box(51, 20, 42, 68), photo: noPhoto() };
    if (family === 'typographic' || family === 'cinematic') return { title: box(6, 16, 46, 65), subtitle: box(59, 24, 34, 64), photo: noPhoto() };
    if (family === 'swiss') return { title: box(6, 13, 54, 28), subtitle: box(34, 48, 60, 41), photo: noPhoto() };
    if (family === 'technical') return { title: box(7, 13, 80, 24), subtitle: box(16, 44, 72, 45), photo: noPhoto() };
    if (family === 'modular') return { title: box(8, 14, 83, 25), subtitle: box(12, 48, 76, 39), photo: noPhoto() };
    if (family === 'photo') return { title: box(12, 16, 76, 25), subtitle: box(22, 50, 64, 39), photo: noPhoto() };
    if (family === 'data') return { title: box(6, 13, 86, 22), subtitle: box(7, 43, 78, 46), photo: noPhoto() };
    return { title: box(6, 14, 88, 24), subtitle: box(6, 44, 88, 46), photo: noPhoto() };
  }
  // An editorial correction may need more explanation than the original
  // short draft. Reflow the composition before validating its new limits;
  // don't force a complete argument into a narrow demo caption or drop copy.
  const readingWeight = String(slide.subtitle || '').length + String(slide.bodyAfterImage || '').length * 0.8;
  if (readingWeight > 300) {
    const leftPhoto = family === 'editorial' || family === 'photo';
    return {
      title: box(6, 13, 88, 23),
      subtitle: box(leftPhoto ? 39 : 6, 42, 55, 49),
      photo: box(leftPhoto ? 6 : 68, 40, 26, 50),
    };
  }
  const rhythm = ['executive', 'editorial', 'data', 'swiss', 'cinematic', 'typographic', 'modular', 'photo', 'technical', 'premium'].indexOf(family) % 3;
  if (kind === 'data') return {
    title: box(6, 13, 88, 22), subtitle: box(43 + rhythm, 46, 50 - rhythm, 43), photo: box(6, 44, 30 + rhythm, 45),
  };
  if (kind === 'demo') return {
    title: box(6, 13, 88, 23), subtitle: box(7, 45, 29 + rhythm, 43), photo: box(44 + rhythm, 42, 50 - rhythm, 47),
  };
  if (kind === 'divider') return {
    title: box(8, 17, 45, 29), subtitle: box(9, 56, 43, 32), photo: box(62 + rhythm, 12, 31 - rhythm, 76),
  };
  const cover = kind === 'cover', close = kind === 'closing', divider = kind === 'divider';
  if (family === 'editorial') return {
    title: box(46, close ? 20 : 13, 48, cover ? 32 : 27),
    subtitle: box(47, cover ? 51 : close ? 54 : 46, 46, cover ? 38 : 39),
    photo: cover ? box(0, 0, 40, 100) : close ? box(4, 12, 35, 76) : box(5, 16, 34, 69),
  };
  if (family === 'photo') return {
    title: box(6, close ? 18 : 14, 34, cover ? 33 : 30),
    subtitle: box(6, close ? 55 : 52, 32, 36),
    photo: cover ? box(44, 0, 56, 100) : close ? box(44, 8, 51, 84) : box(43, 13, 53, 76),
  };
  if (family === 'cinematic') return {
    title: box(close ? 62 : 6, divider ? 16 : 12, close ? 32 : 34, 31),
    subtitle: box(close ? 62 : 6, divider ? 53 : 49, close ? 32 : 34, 39),
    photo: close ? box(0, 0, 56, 100) : divider ? box(44, 6, 50, 88) : cover ? box(44, 0, 56, 100) : box(45, 12, 49, 77),
  };
  if (family === 'typographic') return {
    title: box(6, 13, close ? 53 : 48, cover ? 41 : 36),
    subtitle: box(7, cover ? 61 : 56, 45, 32),
    photo: close ? box(65, 22, 29, 65) : cover ? box(60, 12, 34, 76) : box(59, 26, 35, 62),
  };
  if (family === 'premium') return {
    title: box(8, cover ? 18 : 14, 44, cover ? 33 : 28),
    subtitle: box(9, close ? 53 : 52, 40, 36),
    photo: cover ? box(59, 8, 35, 84) : close ? box(61, 20, 31, 70) : box(58, 19, 36, 69),
  };
  if (family === 'swiss') return {
    title: box(6, 13, close ? 49 : 55, cover ? 33 : 27),
    subtitle: box(7, cover ? 56 : 49, 44, 39),
    photo: cover ? box(64, 27, 30, 60) : close ? box(60, 13, 34, 75) : box(58, 47, 36, 41),
  };
  if (family === 'technical') return {
    title: box(7, 13, 47, 26), subtitle: box(8, 46, 44, 42),
    photo: cover ? box(59, 13, 34, 75) : close ? box(64, 32, 29, 55) : box(59, 25, 34, 62),
  };
  if (family === 'modular') return {
    title: box(7, cover ? 16 : 13, 50, 28), subtitle: box(8, close ? 53 : 50, 48, 38),
    photo: cover ? box(63, 12, 31, 76) : close ? box(64, 22, 29, 66) : box(62, 19, 32, 69),
  };
  if (family === 'data') return {
    title: box(6, 13, cover ? 52 : 55, 28), subtitle: box(7, 48, 47, 40),
    photo: cover ? box(63, 17, 31, 71) : close ? box(66, 34, 28, 54) : box(63, 45, 31, 43),
  };
  // Executive is deliberately quiet, with a different photographic balance
  // for opening, argument, transition, data, demonstration and decision.
  const photos = {
    cover: box(64, 0, 36, 100), content: box(64, 36, 30, 54),
    divider: box(66, 27, 28, 65), data: box(6, 46, 28, 46),
    demo: box(66, 25, 28, 67), closing: box(66, 0, 34, 100),
  };
  if (kind === 'data') return { title: box(6, 14, 88, 20), subtitle: box(39, 46, 55, 46), photo: photos.data };
  return { title: box(6, cover ? 16 : close ? 18 : 14, cover ? 52 : 54, cover ? 28 : 25), subtitle: box(6, cover ? 51 : close ? 52 : 46, 51, cover ? 38 : 42), photo: photos[kind] || photos.content };
}

export function presentationTypeDirection(family, kind) {
  const display = kind === 'cover' || kind === 'divider' || kind === 'closing';
  const scale = {
    executive: [62, 45], editorial: [76, 46], data: [56, 42], swiss: [76, 48],
    cinematic: [86, 60], typographic: [88, 62], modular: [64, 46], photo: [72, 46],
    technical: [55, 42], premium: [76, 48],
  }[family] || [62, 45];
  return { titleSize: display ? scale[0] : scale[1], bodySize: family === 'editorial' || family === 'photo' ? 62 : 60 };
}
