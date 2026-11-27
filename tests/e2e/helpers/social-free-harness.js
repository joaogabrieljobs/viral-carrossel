import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/** Conta vazia e APIs com persistência em memória; o app cria todo o projeto. */
export function socialFreeCloud({ brand = null, session, useV2 = false }) {
  const cloud = { rows: new Map(), writes: [], assets: new Map(), chunks: new Map(), revision: 1, metaRevision: 1,
    metadata: { brands: brand ? [brand] : [], folders: [], activeDocId: null, activeBrandId: brand?.id ?? null,
      userProfile: null, assetIds: [], onboardingDone: '1', modesIntroDone: '1' } };
  for (const ref of brand?.styleKit?.refImages || []) cloud.assets.set(ref.assetId || ref.id, ref.dataUrl);
  const manifest = () => ({ vcVersion: 3, customerId: session.customerId, ...cloud.metadata,
    revision: cloud.revision, updatedAt: Date.now(), docs: [...cloud.rows.values()].map(row => row.entry),
    deletedIds: [], assetIds: [...cloud.assets.keys()] });
  const status = () => ({ ok: true, customerId: session.customerId, empty: cloud.rows.size === 0,
    meta: { revision: cloud.revision, updatedAt: Date.now(), projectCount: cloud.rows.size, assetIds: [...cloud.assets.keys()] } });
  const routes = {
    '/api/account-library-meta': route => {
      const request = route.request();
      if (request.headers()['x-account-owner'] !== session.customerId) return route.fulfill({ status: 409, json: { code: 'account_meta_owner_changed' } });
      if (request.method() !== 'GET') {
        const body = request.postDataJSON();
        if (body.baseRevision !== cloud.metaRevision) return route.fulfill({ status: 409, json: { code: 'account_meta_conflict', cloudRevision: cloud.metaRevision } });
        cloud.metadata = { ...cloud.metadata, ...body.metadata }; cloud.metaRevision++;
      }
      return route.fulfill({ json: { ok: true, metadata: cloud.metadata, revision: cloud.metaRevision, updatedAt: Date.now() } });
    },
    '/api/projects': route => {
      const request = route.request(), url = new URL(request.url());
      if (request.headers()['x-project-owner'] !== session.customerId) return route.fulfill({ status: 409, json: { code: 'project_owner_changed' } });
      if (request.method() === 'GET' && url.searchParams.has('id')) {
        const row = cloud.rows.get(url.searchParams.get('id'));
        return row ? route.fulfill({ json: { ok: true, project: { id: row.entry.id, ...row, deleted: false } } })
          : route.fulfill({ status: 404, json: { code: 'project_not_found' } });
      }
      if (request.method() === 'GET') return route.fulfill({ json: { ok: true, total: cloud.rows.size, nextCursor: null,
        projects: [...cloud.rows.values()].map(row => ({ id: row.entry.id, version: row.version, deleted: false,
          entry: { id: row.entry.id, name: row.entry.name, status: row.entry.status || 'draft' } })) } });
      const body = request.postDataJSON(), previous = cloud.rows.get(body.entry.id);
      if (body.baseVersion !== (previous?.version || 0)) return route.fulfill({ status: 409, json: { code: 'project_conflict', cloudVersion: previous?.version || 0 } });
      const row = { entry: structuredClone(body.entry), version: body.baseVersion + 1 };
      cloud.rows.set(row.entry.id, row); cloud.writes.push(row.entry); cloud.revision++;
      return route.fulfill({ json: { ok: true, project: { id: row.entry.id, ...row, deleted: false } } });
    },
    '/api/library-sync': route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === 'GET' && url.searchParams.has('asset')) {
        const dataUrl = cloud.assets.get(url.searchParams.get('asset'));
        return dataUrl ? route.fulfill({ json: { ok: true, asset: { dataUrl } } })
          : route.fulfill({ status: 404, json: { error: 'Imagem ausente na conta simulada.' } });
      }
      if (url.searchParams.get('full') === '1') return route.fulfill({ json: { ok: true, manifest: manifest() } });
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        if (body.action === 'putAsset') {
          cloud.assets.set(body.assetId, body.dataUrl);
          return route.fulfill({ json: { ok: true, assetId: body.assetId, complete: true } });
        }
        if (body.action === 'putAssetChunk') {
          const chunks = cloud.chunks.get(body.assetId) || [];
          chunks[body.index] = body.data; cloud.chunks.set(body.assetId, chunks);
          const complete = Array.from({ length: body.total }, (_, i) => chunks[i]).every(Boolean);
          if (complete) cloud.assets.set(body.assetId, chunks.join(''));
          return route.fulfill({ json: { ok: true, assetId: body.assetId, complete } });
        }
        if (body.action === 'push') {
          if (useV2) return route.fulfill({ status: 400, json: { error: 'V2 deve persistir por projeto.' } });
          for (const project of body.manifest.docs || []) {
            const copy = structuredClone(project);
            cloud.rows.set(copy.id, { entry: copy, version: 1 }); cloud.writes.push(copy);
          }
          cloud.metadata = { ...cloud.metadata, ...body.manifest }; cloud.revision++;
          return route.fulfill({ json: { ...status(), revision: cloud.revision, updatedAt: Date.now(),
            projectCount: cloud.rows.size, assetIds: [...cloud.assets.keys()] } });
        }
      }
      return route.fulfill({ json: status() });
    },
  };
  return { cloud, routes };
}

/** Arte e marca de teste desenhadas localmente, sem IA ou imagens externas. */
export async function localSocialAssets(page) {
  return page.evaluate(() => {
    const art = document.createElement('canvas'); art.width = 1080; art.height = 1920;
    const ctx = art.getContext('2d'); ctx.fillStyle = '#2B2158'; ctx.fillRect(0, 0, 1080, 1920);
    for (const [color, x, y, rx, ry, rotation] of [
      ['#9D2559', 1060, 1110, 165, 500, 0.3],
      ['#F8701E', 1110, 1220, 130, 440, -0.25],
      ['#28B2D4', 1120, 600, 190, 430, 0.45],
    ]) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, 2 * Math.PI); ctx.fill();
    }
    const logo = document.createElement('canvas'); logo.width = 160; logo.height = 160;
    const mark = logo.getContext('2d'); mark.strokeStyle = '#FFFFFF'; mark.lineWidth = 18;
    mark.lineJoin = 'round'; mark.beginPath(); mark.moveTo(31, 133); mark.lineTo(80, 26); mark.lineTo(129, 133);
    mark.moveTo(48, 100); mark.lineTo(112, 100); mark.stroke();
    return { art: art.toDataURL('image/png').split(',')[1], logo: logo.toDataURL('image/png') };
  });
}

/** Mede o DOM que o exportador usa; o teste não importa o diretor do produto. */
export async function socialRenderGeometry(page) {
  return page.locator('[data-vc-export-tree] [data-vc-card-surface]').evaluateAll(roots => roots.map(root => {
    const frame = root.getBoundingClientRect();
    const rect = value => ({ x: value.left - frame.left, y: value.top - frame.top,
      w: value.width, h: value.height, right: value.right - frame.left, bottom: value.bottom - frame.top });
    const photoRects = [...root.querySelectorAll('[data-vc-photo-zone]')].map(node => rect(node.getBoundingClientRect()));
    const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1
      && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
    const rgb = value => {
      const match = String(value).match(/^rgba?\(([^)]+)\)/);
      if (!match) return null;
      const values = match[1].split(/[, /]+/).map(Number);
      return { rgb: values.slice(0, 3), alpha: values[3] ?? 1 };
    };
    const background = node => {
      for (let current = node; current && root.contains(current); current = current.parentElement) {
        const color = rgb(getComputedStyle(current).backgroundColor);
        if (color && color.alpha >= 0.999) {
          const bounds = current.getBoundingClientRect();
          return { rgb: color.rgb, panel: bounds.width < frame.width * 0.95 || bounds.height < frame.height * 0.95 };
        }
      }
      return { rgb: rgb(getComputedStyle(root).backgroundColor)?.rgb || null, panel: false };
    };
    const text = [];
    for (const node of root.querySelectorAll('*')) {
      if (['SCRIPT', 'STYLE', 'SVG', 'PATH'].includes(node.tagName)) continue;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || !node.getClientRects().length) continue;
      const directText = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
      if (!directText.length) continue;
      for (const child of directText) {
        const range = document.createRange(); range.selectNodeContents(child);
        const boxes = [...range.getClientRects()].filter(box => box.width > 0 && box.height > 0).map(rect);
        if (!boxes.length) continue;
        const surface = background(node);
        text.push({ text: child.textContent.trim(), tag: node.tagName, fontPx: parseFloat(style.fontSize),
          fontFamily: style.fontFamily, color: rgb(style.color), background: surface.rgb, boxes,
          onPhoto: !surface.panel && boxes.some(box => photoRects.some(photo => intersects(box, photo))),
          zone: node.closest('[data-vc-zone]')?.getAttribute('data-vc-zone') || null,
          device: node.closest('[data-vc-art-device]')?.getAttribute('data-vc-art-device') || null,
          chrome: node.closest('[data-vc-chrome]')?.getAttribute('data-vc-chrome') || null });
      }
    }
    return { id: root.getAttribute('data-vc-card-surface'), width: frame.width, height: frame.height,
      text, photoRects, logos: [...root.querySelectorAll('img[data-vc-brand-logo]')].map(node => rect(node.getBoundingClientRect())),
      visibleLogos: [...root.querySelectorAll('[data-vc-logo-visible-rect]')].map(node => {
        const [left, top, width, height] = node.getAttribute('data-vc-logo-visible-rect').split(',').map(Number);
        const parent = node.getBoundingClientRect(), scale = parent.width / node.offsetWidth;
        const x = parent.left - frame.left + left * scale, y = parent.top - frame.top + top * scale;
        return { x, y, w: width * scale, h: height * scale, right: x + width * scale, bottom: y + height * scale };
      }),
      headers: [...root.querySelectorAll('[data-vc-chrome="headerBar"]')].map(node => rect(node.getBoundingClientRect())),
      // Linhas da grade e quadros da família; blocos nativos (lista, tabela).
      devices: [...root.querySelectorAll('[data-vc-art-device^="grid-"], [data-vc-art-device^="frame-"]')]
        .filter(node => getComputedStyle(node).display !== 'none')
        .map(node => ({ key: node.getAttribute('data-vc-art-device'), ...rect(node.getBoundingClientRect()) })),
      blocks: [...root.querySelectorAll('[data-vc-presentation-block]')].map(node => rect(node.getBoundingClientRect())),
      footer: [...root.querySelectorAll('[data-vc-chrome="pill"], [data-vc-chrome="footerBar"]')].map(node => rect(node.getBoundingClientRect())),
      // O cue do renderer é uma seta de duas bordas dentro de um círculo,
      // sem texto/glifo que possa mudar por idioma ou fonte.
      swipeCues: [...root.querySelectorAll('span')].filter(node => {
        const style = getComputedStyle(node), parent = getComputedStyle(node.parentElement);
        return parseFloat(style.borderTopWidth) > 0 && parseFloat(style.borderRightWidth) > 0
          && parseFloat(style.borderBottomWidth) === 0 && parseFloat(style.borderLeftWidth) === 0
          && parent.borderRadius === '50%' && parent.position === 'absolute';
      }).map(node => rect(node.parentElement.getBoundingClientRect())),
      overflow: [...root.querySelectorAll('[data-vc-overflow-at-floor="true"]')].map(node => node.textContent.trim().slice(0, 120)) };
  }));
}

export function contrastRatio(foreground, background) {
  const luminance = rgb => rgb.map(channel => channel / 255).map(channel => channel <= 0.04045
    ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Hash dos bytes realmente ligados ao DOM depois de reabrir a biblioteca. */
export async function socialRenderedMedia(page) {
  return page.locator('[data-vc-export-tree] [data-vc-card-surface]').evaluateAll(async roots => {
    const digest = async source => {
      const bytes = await (await fetch(source)).arrayBuffer();
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map(value => value.toString(16).padStart(2, '0')).join('');
    };
    return Promise.all(roots.map(async (root, index) => {
      const nodes = [
        ...[...root.querySelectorAll('[data-vc-photo-zone] img')].map(node => ({ kind: 'photo', node })),
        ...[...root.querySelectorAll('[data-vc-photo-zone] *')]
          .filter(node => getComputedStyle(node).backgroundImage.startsWith('url('))
          .map(node => ({ kind: 'photo', node })),
        ...[...root.querySelectorAll('[data-vc-deck-art]')].map(node => ({ kind: 'art', node })),
        ...[...root.querySelectorAll('img[data-vc-brand-logo]')].map(node => ({ kind: 'logo', node })),
      ];
      const images = await Promise.all(nodes.map(async ({ kind, node }) => {
        const source = node.tagName === 'IMG' ? node.currentSrc || node.src
          : getComputedStyle(node).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
        if (!source) return { kind, loaded: false, bytesSha256: null };
        const decoded = node.tagName === 'IMG' ? node : new Image();
        if (node.tagName !== 'IMG') decoded.src = source;
        await decoded.decode();
        return { kind, loaded: decoded.naturalWidth > 0, bytesSha256: await digest(source) };
      }));
      return { card: index + 1, images };
    }));
  });
}

/** Capturas da UI em 1080px, somente por zoom do editor e navegação dos cards. */
export async function captureSocialDeck(page, directory, height, indexes = Array.from({ length: 8 }, (_, index) => index)) {
  if (!directory) return;
  fs.mkdirSync(directory, { recursive: true });
  await page.setViewportSize({ width: 1960, height: 2500 });
  const cards = page.locator('main [data-vc-card-surface]');
  await expect(cards).toHaveCount(8);
  await page.getByLabel('Ir para o card', { exact: true }).selectOption('0');
  await cards.first().scrollIntoViewIfNeeded();
  const width = await cards.first().evaluate(node => node.getBoundingClientRect().width);
  const viewport = page.locator('#vc-cards-viewport');
  const bounds = await viewport.boundingBox();
  await viewport.dispatchEvent('wheel', { ctrlKey: true, deltaY: -Math.log(1080 / width) / 0.008,
    clientX: bounds.x + 200, clientY: bounds.y + 200 });
  await expect.poll(() => cards.first().evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(1080);
  await page.evaluate(() => document.fonts.ready);
  const captures = [];
  for (const i of indexes) {
    await page.getByLabel('Ir para o card', { exact: true }).selectOption(String(i));
    await cards.nth(i).scrollIntoViewIfNeeded();
    const notices = page.getByRole('button', { name: 'Fechar notificação', exact: true });
    while (await notices.count()) await notices.first().click();
    await page.mouse.move(10, 10);
    const bounds = await cards.nth(i).boundingBox();
    expect(bounds.width, `card ${i + 1}: largura DOM nativa`).toBeCloseTo(1080, 4);
    expect(bounds.height, `card ${i + 1}: altura DOM nativa`).toBeCloseTo(height, 4);
    const clip = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: 1080, height };
    const viewport = page.viewportSize();
    expect(clip.x, 'captura dentro da viewport').toBeGreaterThanOrEqual(0);
    expect(clip.y, 'captura dentro da viewport').toBeGreaterThanOrEqual(0);
    expect(clip.x + clip.width).toBeLessThanOrEqual(viewport.width);
    expect(clip.y + clip.height).toBeLessThanOrEqual(viewport.height);
    // locator.screenshot envolve coordenadas fracionárias para fora e pode
    // acrescentar 1px. A UI já está nativa; este clip usa exatamente seus pixels.
    const png = await page.screenshot({ path: path.join(directory, `card-${String(i + 1).padStart(2, '0')}.png`), clip, animations: 'disabled' });
    expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }, `card ${i + 1}: captura nativa`).toEqual({ width: 1080, height });
    captures.push({ card: i + 1, dom: bounds, clip });
  }
  fs.writeFileSync(path.join(directory, 'capturas.json'), JSON.stringify(captures, null, 2));
}
