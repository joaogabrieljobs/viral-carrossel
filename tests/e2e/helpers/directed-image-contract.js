import { expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Corpo do contrato de identidade: a montagem pode mudar o cabeçalho,
// mas não pode abreviar o papel da imagem nem confundi-lo com pose/cenário.
const IDENTITY_ANCHOR_BODY = 'The last attached image is the identity reference for the recurring person assigned to this scene. Match visible facial features, hair, skin tone and build. Use the project subject sheet for specified wardrobe. Use only the requested scene for action, pose, framing, setting and objects. Match neither the background nor the pose of the anchor unless the current scene calls for it.';

const normalized = value => String(value || '').normalize('NFC').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const containsFact = (prompt, fact) => !!normalized(fact) && normalized(prompt).includes(normalized(fact));
const variationFields = ['action', 'setting', 'shot'];

function attachmentProof(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is);
  if (!match) return { mime: null, bytes: 0, sha256: null };
  const bytes = Buffer.from(match[2], 'base64');
  return { mime: match[1], bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function compareStylePixels(page, sent, source) {
  return page.evaluate(async ({ sent, source }) => {
    const sample = async dataUrl => {
      const image = new Image(); image.src = dataUrl; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
      const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, 64, 64);
      context.drawImage(image, 0, 0, 64, 64);
      return { width: image.naturalWidth, height: image.naturalHeight,
        pixels: context.getImageData(0, 0, 64, 64).data };
    };
    const actual = await sample(sent), original = await sample(source);
    let difference = 0;
    for (let index = 0; index < actual.pixels.length; index++) {
      if (index % 4 !== 3) difference += Math.abs(actual.pixels[index] - original.pixels[index]);
    }
    return { sentSize: [actual.width, actual.height], sourceSize: [original.width, original.height],
      meanAbsoluteRgbError: difference / (64 * 64 * 3) };
  }, { sent, source });
}

function orphanHeadings(prompt) {
  return String(prompt).split(/\n\s*\n/).map(block => block.trim()).filter(block => {
    if (!block || block.includes('\n')) return false;
    const letters = block.replace(/\([^)]*\)/g, '').replace(/[^\p{L}]/gu, '');
    return letters.length > 5 && letters === letters.toUpperCase();
  });
}

function referencePolicyFacts(prompt, referenceCount) {
  const policies = String(prompt).split(/\n\s*\n/).filter(block =>
    /\b(?:moodboard|style reference)\b/i.test(block)
      && /\b(?:only|solely)\b[\s\S]{0,45}\b(?:look|visual|style)\b/i.test(block));
  const roles = [...String(prompt).matchAll(/\b(\d+)\s*[:.)-]\s*(moodboard|style(?:[- ]only)?|identity)\b/gi)]
    .map(match => ({ number: Number(match[1]), role: /^identity$/i.test(match[2]) ? 'identity' : 'style' }));
  return {
    policyCount: policies.length,
    lookOnlyExcludesContent: policies.some(block =>
      /\b(?:never|not|no|do not)\b[^.]*\b(?:people|faces|subjects)\b[^.]*\b(?:framing|composition|scene)\b/i.test(block)),
    roles,
    expectedRoles: Array.from({ length: referenceCount }, (_, index) =>
      ({ number: index + 1, role: index === 0 ? 'style' : 'identity' })),
  };
}

function referenceMapFacts(prompt, referenceCount, expectedAssignments) {
  const assignments = [...String(prompt).matchAll(/@([\p{L}\p{N}_-]+)\s*=\s*image\s+(\d+)\s*\((moodboard|subject|identity)\)/giu)]
    .map(match => ({ label: match[1], number: Number(match[2]), role: match[3].toLowerCase() }));
  const invalidIndexes = assignments.filter(item => item.number < 1 || item.number > referenceCount);
  return { assignments, expectedAssignments, invalidIndexes,
    unassignedMention: /\bREFERENCE MAP\b/i.test(prompt) && assignments.length === 0 };
}

function assertReferencePolicyFacts(facts, label) {
  expect.soft(facts.policyCount, `${label}: uma única política de referência visual`).toBe(1);
  expect.soft(facts.lookOnlyExcludesContent, `${label}: referência visual não fornece pessoas, cenas ou enquadramento`).toBe(true);
  expect.soft(facts.roles, `${label}: papel numerado de cada anexo real aparece uma única vez`).toEqual(facts.expectedRoles);
}

export function assertStyleReferencePolicy(request, label) {
  assertReferencePolicyFacts(referencePolicyFacts(request.prompt, request.imageList?.length || 0), label);
}

/**
 * Observa somente o JSON que saiu pelo HTTP real do app. A expectativa vem
 * da resposta editorial bruta; nenhum compositor/diretor do produto entra
 * no teste. Pontuação e nomes dos blocos não decidem a presença dos fatos.
 */
export async function assertDirectedImageRequests({
  page, testInfo, tag, requests, plans, expectedReferences, expectedReferenceMaps = {}, subjects = [],
}) {
  const photoPlans = plans.map((plan, index) => ({ ...plan, cardNumber: index + 1 }))
    .filter(plan => plan.scene && plan.design?.photo !== 'none');
  const photos = requests.filter(request => request.usageContext?.cardId !== 'deck-art');
  const transformedReferences = new Map();
  const records = await Promise.all(photos.map(async request => {
    const cardNumber = request.usageContext?.cardNumber;
    const plan = photoPlans.find(item => item.cardNumber === cardNumber);
    const prompt = String(request.prompt || '');
    const avoid = (Array.isArray(plan?.avoid) ? plan.avoid : [plan?.avoid]).filter(Boolean);
    const others = photoPlans.filter(item => item.cardNumber !== cardNumber)
      .filter(item => variationFields.every(field => item.scene[field]));
    const distinctNeighbors = [...new Map(others.map(item => [
      variationFields.map(field => normalized(item.scene[field])).join('|'), item,
    ])).values()];
    const matchingNeighbors = distinctNeighbors.filter(item =>
      variationFields.every(field => containsFact(prompt, item.scene[field])));
    const attachments = (request.imageList || []).map(attachmentProof);
    const expectedAttachments = (expectedReferences[cardNumber] || []).map(attachmentProof);
    const attachmentIdentity = await Promise.all(expectedAttachments.map(async (source, index) => {
      const actual = attachments[index];
      if (actual?.sha256 === source.sha256) return { role: index === 0 ? 'style' : 'identity', exactBytes: true };
      // O PNG do flyer excede 700 KiB. O cliente o envia como JPEG, mantendo
      // o original intacto. Verificamos a mesma imagem, dimensões e limite,
      // sem importar/reexecutar o compressor do produto como oracle.
      if (index !== 0 || actual?.mime !== 'image/jpeg' || source.mime !== 'image/png'
        || source.bytes <= 700 * 1024 || actual.bytes > 700 * 1024) {
        return { role: index === 0 ? 'style' : 'identity', exactBytes: false, validDerivative: false };
      }
      const key = `${actual.sha256}:${source.sha256}`;
      if (!transformedReferences.has(key)) transformedReferences.set(key,
        compareStylePixels(page, request.imageList[index], expectedReferences[cardNumber][index]));
      const pixels = await transformedReferences.get(key);
      return { role: 'style', exactBytes: false, ...pixels,
        validDerivative: pixels.meanAbsoluteRgbError <= 3
          && pixels.sentSize.every((size, i) => size === pixels.sourceSize[i]) };
    }));
    return {
      usageContext: request.usageContext, prompt, chars: prompt.length, aspectRatio: request.aspectRatio,
      expectedScene: plan?.scene, expectedAvoid: avoid,
      ownFacts: Object.fromEntries(['action', 'setting', 'shot', 'light'].map(field =>
        [field, containsFact(prompt, plan?.scene?.[field])])),
      missingAvoid: avoid.filter(line => !containsFact(prompt, line)),
      possibleNeighbors: distinctNeighbors.map(item => ({ cardNumber: item.cardNumber,
        ...Object.fromEntries(variationFields.map(field => [field, item.scene[field]])) })),
      matchingNeighbors: matchingNeighbors.map(item => item.cardNumber),
      orphanHeadings: orphanHeadings(prompt),
      referenceMap: referenceMapFacts(prompt, attachments.length, expectedReferenceMaps[cardNumber] || []),
      compositionPresent: /\bCOMPOSITION\b/.test(prompt),
      referencePolicy: referencePolicyFacts(prompt, expectedAttachments.length),
      literalSubjects: subjects.every(subject => prompt.includes(subject.en) && prompt.includes(subject.never)),
      literalAnchor: prompt.includes(IDENTITY_ANCHOR_BODY),
      attachments, expectedAttachments, attachmentIdentity,
    };
  }));
  const otherRequests = requests.filter(request => request.usageContext?.cardId === 'deck-art')
    .map(request => ({ usageContext: request.usageContext, prompt: request.prompt,
      chars: String(request.prompt || '').length, aspectRatio: request.aspectRatio,
      attachments: (request.imageList || []).map(attachmentProof) }));
  const evidence = { scope: 'HTTP /api/ai/sjinn-image, IA e conta simuladas', tag, records, otherRequests };
  const body = JSON.stringify(evidence, null, 2);
  await testInfo.attach(`contrato-pedidos-${tag}`, { body, contentType: 'application/json' });
  if (process.env.QA_IMAGE_PROMPTS_DIR) {
    fs.mkdirSync(process.env.QA_IMAGE_PROMPTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.QA_IMAGE_PROMPTS_DIR, `${tag}.json`), body);
  }

  expect.soft([...new Set(records.map(record => record.usageContext?.cardNumber))].sort((a, b) => a - b),
    `${tag}: todas as fotos planejadas chegam ao transporte`).toEqual(photoPlans.map(plan => plan.cardNumber));
  for (const request of otherRequests) expect.soft(request.chars,
    `${tag}: pedido de arte compartilhada dentro do limite SJinn`).toBeLessThanOrEqual(4000);
  for (const record of records) {
    const label = `${tag}, card ${record.usageContext?.cardNumber}`;
    expect.soft(record.chars, `${label}: pedido completo dentro do limite SJinn`).toBeLessThanOrEqual(4000);
    for (const [field, present] of Object.entries(record.ownFacts)) {
      expect.soft(present, `${label}: scene.${field} integral no pedido HTTP`).toBe(true);
    }
    expect.soft(record.missingAvoid, `${label}: exclusões específicas do plano preservadas`).toEqual([]);
    expect.soft(record.matchingNeighbors.length, `${label}: duas cenas distintas com ação, ambiente e enquadramento completos`)
      .toBeGreaterThanOrEqual(Math.min(2, record.possibleNeighbors.length));
    expect.soft(record.orphanHeadings, `${label}: nenhum cabeçalho órfão ou truncado`).toEqual([]);
    expect.soft(record.referenceMap.unassignedMention, `${label}: nenhuma menção a mapa sem atribuição real`).toBe(false);
    expect.soft(record.referenceMap.invalidIndexes, `${label}: o mapa só cita índices de anexos enviados`).toEqual([]);
    expect.soft(record.referenceMap.assignments, `${label}: mapa explícito da identidade preservado`)
      .toEqual(record.referenceMap.expectedAssignments);
    expect.soft(record.compositionPresent, `${label}: composição do card continua no transporte`).toBe(true);
    assertReferencePolicyFacts(record.referencePolicy, label);
    expect.soft(record.literalSubjects, `${label}: ficha visual literal`).toBe(true);
    if (subjects.length && record.expectedAttachments.length > 1) {
      expect.soft(record.literalAnchor, `${label}: papel da âncora literal e completo`).toBe(true);
    }
    expect.soft(record.attachments.length, `${label}: todos os anexos reais chegam ao HTTP na ordem prevista`)
      .toBe(record.expectedAttachments.length);
    for (const [index, identity] of record.attachmentIdentity.entries()) {
      expect.soft(identity.exactBytes || identity.validDerivative,
        `${label}: anexo ${index + 1} (${identity.role}) conserva a imagem de origem`).toBe(true);
    }
  }
  expect.soft(new Set(records.map(record => record.attachments[0]?.sha256)).size,
    `${tag}: a mesma referência de estilo acompanha todas as fotos`).toBe(1);
}
