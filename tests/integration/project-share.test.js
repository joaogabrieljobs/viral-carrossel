import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stripeMock, resetStripeMock, subAtiva } from '../helpers/stripe-mock.js';

vi.mock('stripe', () => ({ default: class { constructor() { return stripeMock; } } }));

import { makeReq, makeRes } from '../helpers/http.js';
import { createAccessToken, COOKIE_NAME } from '../../api/lib/access.js';
import { resetActiveAccessCacheForTests } from '../../api/lib/require-access.js';
import { getSharedProject, putSharedProject, resetShareMemory } from '../../api/lib/project-share-store.js';
import * as librarySyncStore from '../../api/lib/library-sync-store.js';
import handler from '../../api/project-share.js';

const cookieFor = (customerId, email) =>
  `${COOKIE_NAME}=${encodeURIComponent(createAccessToken({ customerId, email }))}`;
const bindingByCode = new Map();

function post(body, customerId, email) {
  return makeReq({
    method: 'POST',
    body,
    cookie: cookieFor(customerId, email),
  });
}

beforeEach(() => {
  resetStripeMock();
  resetShareMemory();
  resetActiveAccessCacheForTests();
  bindingByCode.clear();
  stripeMock.subscriptions.list.mockImplementation(async ({ customer }) => ({
    data: [subAtiva(customer)],
  }));
});
afterEach(() => vi.unstubAllEnvs());

async function createShare() {
  const created = makeRes();
  await handler(post({
    action: 'create',
    name: 'Equipa',
    doc: { slides: [{ title: 'Original' }] },
  }, 'cus_owner', 'dona@teste.exemplo'), created);
  expect(created.statusCode).toBe(201);
  bindingByCode.set(created.body.code, created.body.projectId);
  return created.body.code;
}

function boundDoc(code, slide, shareRevision = 1) {
  return {
    shareCode: code,
    shareProjectId: bindingByCode.get(code) || `legacy_${code}`,
    shareRevision,
    slides: [slide],
  };
}

describe('POST /api/project-share', () => {
  it('recusa push de quem não é dono nem membro', async () => {
    const code = await createShare();

    const denied = makeRes();
    await handler(post({
      action: 'push',
      code,
      doc: { slides: [{ title: 'Invadido' }] },
    }, 'cus_other', 'outro@teste.exemplo'), denied);
    expect(denied.statusCode).toBe(403);

    const allowed = makeRes();
    await handler(post({
      action: 'push',
      code,
      doc: boundDoc(code, { title: 'Atualizado' }),
    }, 'cus_owner', 'dona@teste.exemplo'), allowed);
    expect(allowed.statusCode).toBe(200);
  });

  it('recusa publicar um projeto sem vínculo ou vinculado a outro código', async () => {
    const code = await createShare();

    for (const doc of [
      { slides: [{ title: 'Projeto pessoal sem vínculo' }] },
      { shareCode: code, slides: [{ title: 'Código sem identidade canônica' }] },
      boundDoc('OUTRO123', { title: 'Projeto de outra equipe' }),
    ]) {
      const denied = makeRes();
      await handler(post({ action: 'push', code, doc }, 'cus_owner', 'dona@teste.exemplo'), denied);
      expect(denied.statusCode).toBe(409);
      expect(denied.body.error).toMatch(/não pertence ao projeto/i);
    }

    const saved = await getSharedProject(code);
    expect(saved.doc.slides[0].title).toBe('Original');
    expect(saved.doc.shareCode).toBe(code);
    expect(saved.doc.shareProjectId).toBe(bindingByCode.get(code));
  });

  it('recusa revisão antiga também depois que o vínculo já foi migrado', async () => {
    const code = await createShare();
    const first = makeRes();
    await handler(post({
      action: 'push',
      code,
      doc: boundDoc(code, { title: 'Versão mais nova' }, 1),
    }, 'cus_owner', 'dona@teste.exemplo'), first);
    expect(first.statusCode).toBe(200);
    expect(first.body.revision).toBe(2);

    const stale = makeRes();
    await handler(post({
      action: 'push',
      code,
      doc: boundDoc(code, { title: 'Versão antiga atrasada' }, 1),
    }, 'cus_owner', 'dona@teste.exemplo'), stale);

    expect(stale.statusCode).toBe(409);
    expect(stale.body.error).toMatch(/versão da equipe mudou/i);
    expect(await getSharedProject(code)).toMatchObject({
      revision: 2,
      doc: { slides: [{ title: 'Versão mais nova' }] },
    });
  });

  it('recusa outro projeto que copiou o código mas não a identidade canônica', async () => {
    const code = await createShare();
    const denied = makeRes();
    await handler(post({
      action: 'push',
      code,
      doc: {
        shareCode: code,
        shareProjectId: 'sp_OUTROPROJETO1234',
        slides: [{ title: 'Projeto importado' }],
      },
    }, 'cus_owner', 'dona@teste.exemplo'), denied);
    expect(denied.statusCode).toBe(409);
    expect((await getSharedProject(code)).doc.slides[0].title).toBe('Original');
  });

  it('não confunde outro cliente Stripe com o dono pelo mesmo e-mail', async () => {
    const code = await createShare();
    await putSharedProject({
      code: 'OLDOWNER', ownerId: 'cus_owner', ownerEmail: 'dona@teste.exemplo',
      members: ['dona@teste.exemplo'], doc: { slides: [{ title: 'Original' }] }, revision: 0,
    });
    stripeMock.customers.retrieve.mockImplementation(async (id) => ({
      id,
      email: 'dona@teste.exemplo',
      metadata: { vc_google_sub: 'identidade-verificada' },
    }));
    for (const shareCode of [code, 'OLDOWNER']) {
      const denied = makeRes();
      await handler(post({ action: 'push', code: shareCode, doc: { slides: [{ title: 'Invadido' }] } },
        'cus_impostor', 'dona@teste.exemplo'), denied);
      expect(denied.statusCode).toBe(403);
    }
  });

  it('partilha legada por e-mail só aceita identidade Google verificada', async () => {
    await putSharedProject({
      code: 'LEGACY01', ownerEmail: 'dona@teste.exemplo', members: [],
      doc: { slides: [{ title: 'Original' }] }, revision: 0,
    });
    const unverified = makeRes();
    await handler(post({ action: 'push', code: 'LEGACY01', doc: { slides: [{ title: 'Invadido' }] } },
      'cus_unverified', 'dona@teste.exemplo'), unverified);
    expect(unverified.statusCode).toBe(403);

    stripeMock.customers.retrieve.mockImplementation(async (id) => ({
      id,
      email: 'dona@teste.exemplo',
      metadata: { vc_google_sub: 'google-owner-sub' },
    }));
    const verified = makeRes();
    await handler(post({
      action: 'push', code: 'LEGACY01',
      doc: { ...boundDoc('LEGACY01', { title: 'Da dona' }), shareRevision: 1 },
    },
      'cus_verified', 'dona@teste.exemplo'), verified);
    expect(verified.statusCode).toBe(200);
  });

  it('migra partilha legada com segurança depois de receber a revisão canônica', async () => {
    await putSharedProject({
      code: 'LEGACY03', ownerId: 'cus_owner', ownerEmail: 'dona@teste.exemplo',
      members: ['cus_owner'], doc: { shareCode: 'LEGACY03', slides: [{ title: 'Legado' }] }, revision: 0,
    });
    const getReq = makeReq({ cookie: cookieFor('cus_owner', 'dona@teste.exemplo') });
    getReq.query = { code: 'LEGACY03' };
    const pulled = makeRes();
    await handler(getReq, pulled);
    expect(pulled.statusCode).toBe(200);
    expect(pulled.body.projectId).toBe('legacy_LEGACY03');
    expect(pulled.body.doc).toMatchObject({
      shareCode: 'LEGACY03',
      shareProjectId: 'legacy_LEGACY03',
    });

    const pushed = makeRes();
    await handler(post({
      action: 'push', code: 'LEGACY03',
      doc: { ...pulled.body.doc, slides: [{ title: 'Migrado' }] },
    }, 'cus_owner', 'dona@teste.exemplo'), pushed);
    expect(pushed.statusCode).toBe(200);
    expect((await getSharedProject('LEGACY03'))).toMatchObject({
      shareProjectId: 'legacy_LEGACY03',
      doc: { shareProjectId: 'legacy_LEGACY03', slides: [{ title: 'Migrado' }] },
    });
  });

  it('migra a partilha legada no primeiro push sem apagar a edição local', async () => {
    await putSharedProject({
      code: 'LEGACY04', ownerId: 'cus_owner', ownerEmail: 'dona@teste.exemplo',
      members: ['cus_owner', 'cus_member'],
      doc: { shareCode: 'LEGACY04', slides: [{ title: 'Versão remota antiga' }] },
      revision: 3, keepRevision: true,
    });

    const pushed = makeRes();
    await handler(post({
      action: 'push', code: 'LEGACY04',
      doc: {
        shareCode: 'LEGACY04', shareRevision: 3,
        slides: [{ title: 'Edição local preservada' }],
      },
    }, 'cus_member', 'membro@teste.exemplo'), pushed);

    expect(pushed.statusCode).toBe(200);
    expect(pushed.body.projectId).toBe('legacy_LEGACY04');
    expect(await getSharedProject('LEGACY04')).toMatchObject({
      shareProjectId: 'legacy_LEGACY04',
      doc: {
        shareCode: 'LEGACY04',
        shareProjectId: 'legacy_LEGACY04',
        slides: [{ title: 'Edição local preservada' }],
      },
    });
  });

  it('recusa migração legada com revisão local desatualizada', async () => {
    await putSharedProject({
      code: 'LEGACY06', ownerId: 'cus_owner', members: ['cus_owner'],
      doc: { shareCode: 'LEGACY06', slides: [{ title: 'Remoto atual' }] },
      revision: 3, keepRevision: true,
    });
    const stale = makeRes();
    await handler(post({
      action: 'push', code: 'LEGACY06',
      doc: {
        shareCode: 'LEGACY06', shareRevision: 2,
        slides: [{ title: 'Edição local antiga' }],
      },
    }, 'cus_owner', 'dona@teste.exemplo'), stale);

    expect(stale.statusCode).toBe(409);
    expect(stale.body.error).toMatch(/versão da equipe mudou/i);
    expect(await getSharedProject('LEGACY06')).toMatchObject({
      revision: 3,
      doc: { slides: [{ title: 'Remoto atual' }] },
    });
  });

  it('recusa revisão desatualizada mesmo quando o GET legado já entregou o ID derivado', async () => {
    await putSharedProject({
      code: 'LEGACY09', ownerId: 'cus_owner', members: ['cus_owner'],
      doc: { shareCode: 'LEGACY09', slides: [{ title: 'Remoto atual' }] },
      revision: 3, keepRevision: true,
    });
    const stale = makeRes();
    await handler(post({
      action: 'push', code: 'LEGACY09',
      doc: {
        shareCode: 'LEGACY09', shareProjectId: 'legacy_LEGACY09', shareRevision: 2,
        slides: [{ title: 'Edição local antiga' }],
      },
    }, 'cus_owner', 'dona@teste.exemplo'), stale);

    expect(stale.statusCode).toBe(409);
    expect(stale.body.error).toMatch(/versão da equipe mudou/i);
    expect(await getSharedProject('LEGACY09')).toMatchObject({
      revision: 3,
      doc: { slides: [{ title: 'Remoto atual' }] },
    });
  });

  it('aceita ausência de revisão somente em partilha legada na revisão zero', async () => {
    await putSharedProject({
      code: 'LEGACY07', ownerId: 'cus_owner', members: ['cus_owner'],
      doc: { shareCode: 'LEGACY07', slides: [{ title: 'Inicial' }] }, revision: -1,
    });
    const pushed = makeRes();
    await handler(post({
      action: 'push', code: 'LEGACY07',
      doc: { shareCode: 'LEGACY07', slides: [{ title: 'Primeira edição' }] },
    }, 'cus_owner', 'dona@teste.exemplo'), pushed);

    expect(pushed.statusCode).toBe(200);
    expect(pushed.body.projectId).toBe('legacy_LEGACY07');
  });

  it('não confia no shareProjectId histórico guardado apenas dentro do documento', async () => {
    await putSharedProject({
      code: 'LEGACY08', ownerId: 'cus_owner', members: ['cus_owner'],
      doc: {
        shareCode: 'LEGACY08', shareProjectId: 'sp_NAOCANONICO1234',
        slides: [{ title: 'Legado' }],
      },
      revision: 0,
    });
    const getReq = makeReq({ cookie: cookieFor('cus_owner', 'dona@teste.exemplo') });
    getReq.query = { code: 'LEGACY08' };
    const viewed = makeRes();
    await handler(getReq, viewed);

    expect(viewed.statusCode).toBe(200);
    expect(viewed.body.projectId).toBe('legacy_LEGACY08');
    expect(viewed.body.doc.shareProjectId).toBe('legacy_LEGACY08');
  });

  it('não trata identidade inválida como ausência durante a migração legada', async () => {
    await putSharedProject({
      code: 'LEGACY05', ownerId: 'cus_owner', members: ['cus_owner'],
      doc: { shareCode: 'LEGACY05', slides: [{ title: 'Original' }] }, revision: 1,
    });
    const denied = makeRes();
    await handler(post({
      action: 'push', code: 'LEGACY05',
      doc: {
        shareCode: 'LEGACY05', shareProjectId: 'inválido!',
        slides: [{ title: 'Não deve entrar' }],
      },
    }, 'cus_owner', 'dona@teste.exemplo'), denied);

    expect(denied.statusCode).toBe(409);
    expect((await getSharedProject('LEGACY05')).doc.slides[0].title).toBe('Original');
  });

  it('membro legado por e-mail precisa de verificação; membro por ID pode publicar', async () => {
    await putSharedProject({
      code: 'LEGACY02', ownerId: 'cus_owner', ownerEmail: 'dona@teste.exemplo',
      members: ['membro@teste.exemplo', 'cus_member'],
      doc: { slides: [{ title: 'Original' }] }, revision: 0,
    });
    const unverified = makeRes();
    await handler(post({ action: 'push', code: 'LEGACY02', doc: { slides: [{ title: 'Invadido' }] } },
      'cus_unverified', 'membro@teste.exemplo'), unverified);
    expect(unverified.statusCode).toBe(403);

    const member = makeRes();
    await handler(post({
      action: 'push', code: 'LEGACY02',
      doc: { ...boundDoc('LEGACY02', { title: 'Por ID' }), shareRevision: 1 },
    },
      'cus_member', 'novo@teste.exemplo'), member);
    expect(member.statusCode).toBe(200);

    stripeMock.customers.retrieve.mockImplementation(async (id) => ({
      id,
      email: 'membro@teste.exemplo',
      metadata: { vc_google_sub: 'google-member-sub' },
    }));
    const verified = makeRes();
    await handler(post({
      action: 'push', code: 'LEGACY02',
      doc: boundDoc('LEGACY02', { title: 'Por e-mail verificado' }, 2),
    },
      'cus_verified', 'membro@teste.exemplo'), verified);
    expect(verified.statusCode).toBe(200);
  });

  it('GET por código continua aberto antes de entrar; membro pode publicar depois', async () => {
    const code = await createShare();
    const getReq = makeReq({ cookie: cookieFor('cus_guest', 'convidada@teste.exemplo') });
    getReq.query = { code };
    const viewed = makeRes();
    await handler(getReq, viewed);
    expect(viewed.statusCode).toBe(200);
    expect(viewed.body.doc.slides[0].title).toBe('Original');
    expect(viewed.body.doc.shareCode).toBe(code);
    expect(viewed.body.doc.shareProjectId).toBe(bindingByCode.get(code));
    expect(viewed.body.projectId).toBe(bindingByCode.get(code));
    expect(viewed.body).toMatchObject({ isOwner: false, isMember: false, memberCount: 1 });
    expect(viewed.body).not.toHaveProperty('ownerEmail');
    expect(viewed.body).not.toHaveProperty('members');

    const joined = makeRes();
    await handler(post({ action: 'join', code }, 'cus_guest', 'convidada@teste.exemplo'), joined);
    expect(joined.statusCode).toBe(200);
    expect(joined.body).toMatchObject({ isOwner: false, isMember: true, memberCount: 2 });
    expect(joined.body).not.toHaveProperty('ownerEmail');
    expect(joined.body).not.toHaveProperty('members');
    const pushed = makeRes();
    await handler(post({ action: 'push', code, doc: boundDoc(code, { title: 'Da convidada' }) },
      'cus_guest', 'convidada@teste.exemplo'), pushed);
    expect(pushed.statusCode).toBe(200);
  });

  it('joins simultâneos e push preservam todos os membros e a versão publicada', async () => {
    const code = await createShare();
    const a = makeRes();
    const b = makeRes();
    const published = makeRes();
    await Promise.all([
      handler(post({ action: 'join', code }, 'cus_a', 'a@teste.exemplo'), a),
      handler(post({ action: 'pull', code }, 'cus_b', 'b@teste.exemplo'), b),
      handler(post({ action: 'push', code, doc: boundDoc(code, { title: 'Nova versão' }) },
        'cus_owner', 'dona@teste.exemplo'), published),
    ]);
    expect([a.statusCode, b.statusCode, published.statusCode]).toEqual([200, 200, 200]);
    const final = makeRes();
    const getReq = makeReq({ cookie: cookieFor('cus_owner', 'dona@teste.exemplo') });
    getReq.query = { code };
    await handler(getReq, final);
    expect(final.body).toMatchObject({ isOwner: true, isMember: true, memberCount: 3 });
    expect(final.body).not.toHaveProperty('ownerEmail');
    expect(final.body).not.toHaveProperty('members');
    expect((await getSharedProject(code)).members).toEqual(expect.arrayContaining([
      'cus_owner', 'cus_a', 'cus_b',
    ]));
    expect(final.body.doc.slides[0].title).toBe('Nova versão');
    expect(final.body.revision).toBe(2);
  });

  it('dono remove membro, bloqueia nova entrada e o próximo push recebe 403', async () => {
    const code = await createShare();
    const joined = makeRes();
    await handler(post({ action: 'join', code }, 'cus_member', 'membro@teste.exemplo'), joined);
    expect(joined.statusCode).toBe(200);

    const current = await getSharedProject(code);
    await putSharedProject({
      ...current,
      doc: { slides: [{ title: 'Privado', bgImageAssetId: 'private-photo' }] },
      keepRevision: true,
    });

    const removed = makeRes();
    await handler(post({ action: 'removeMember', code, memberId: 'cus_member' },
      'cus_owner', 'dona@teste.exemplo'), removed);
    expect(removed.statusCode).toBe(200);
    expect(removed.body).toMatchObject({ isOwner: true, memberCount: 1 });
    expect(removed.body).not.toHaveProperty('members');

    const pushed = makeRes();
    await handler(post({ action: 'push', code, doc: { slides: [{ title: 'Sem acesso' }] } },
      'cus_member', 'membro@teste.exemplo'), pushed);
    expect(pushed.statusCode).toBe(403);

    const rejoined = makeRes();
    await handler(post({ action: 'join', code }, 'cus_member', 'membro@teste.exemplo'), rejoined);
    expect(rejoined.statusCode).toBe(403);

    const readReq = makeReq({ cookie: cookieFor('cus_member', 'membro@teste.exemplo') });
    readReq.query = { code };
    const read = makeRes();
    await handler(readReq, read);
    expect(read.statusCode).toBe(403);
    expect(read.body).not.toHaveProperty('doc');

    const assetSpy = vi.spyOn(librarySyncStore, 'getLibraryAsset');
    const assetReq = makeReq({ cookie: cookieFor('cus_member', 'membro@teste.exemplo') });
    assetReq.query = { code, asset: 'private-photo' };
    const asset = makeRes();
    await handler(assetReq, asset);
    expect(asset.statusCode).toBe(403);
    expect(assetSpy).not.toHaveBeenCalled();
    assetSpy.mockRestore();
  });

  it('somente o dono revoga a partilha e o código antigo passa a devolver 404', async () => {
    const code = await createShare();
    const denied = makeRes();
    await handler(post({ action: 'revoke', code }, 'cus_other', 'outro@teste.exemplo'), denied);
    expect(denied.statusCode).toBe(403);

    const revoked = makeRes();
    await handler(post({ action: 'revoke', code }, 'cus_owner', 'dona@teste.exemplo'), revoked);
    expect(revoked.statusCode).toBe(200);
    expect(revoked.body).toMatchObject({ ok: true, code, revoked: true });

    const getReq = makeReq({ cookie: cookieFor('cus_owner', 'dona@teste.exemplo') });
    getReq.query = { code };
    const missing = makeRes();
    await handler(getReq, missing);
    expect(missing.statusCode).toBe(404);
  });

  it('bypass de desenvolvimento mantém dono estável, mas não abre escrita em produção', async () => {
    vi.stubEnv('BILLING_DISABLED', 'true');
    vi.stubEnv('VERCEL_ENV', 'development');
    const created = makeRes();
    await handler(makeReq({ method: 'POST', body: {
      action: 'create', doc: { slides: [{ title: 'Dev' }] },
    } }), created);
    expect(created.statusCode).toBe(201);
    const code = created.body.code;
    bindingByCode.set(code, created.body.projectId);
    const updated = makeRes();
    await handler(makeReq({ method: 'POST', body: {
      action: 'push', code, doc: boundDoc(code, { title: 'Dev atualizado' }),
    } }), updated);
    expect(updated.statusCode).toBe(200);

    vi.stubEnv('VERCEL_ENV', 'production');
    const denied = makeRes();
    await handler(makeReq({ method: 'POST', body: {
      action: 'push', code, doc: { slides: [{ title: 'Não autorizado' }] },
    } }), denied);
    expect(denied.statusCode).toBe(401);
  });

  it('outra conta lê só a foto citada na partilha, no Blob do dono', async () => {
    const code = await createShare();
    await putSharedProject({
      code,
      ownerId: 'cus_owner',
      ownerEmail: 'dona@teste.exemplo',
      members: ['cus_owner'],
      doc: { slides: [{ id: 's1', title: 'Com foto', bgImageAssetId: 'photo-1' }] },
      revision: 1,
      keepRevision: true,
    });
    const spy = vi.spyOn(librarySyncStore, 'getLibraryAsset').mockResolvedValue({
      dataUrl: 'data:image/jpeg;base64,AAAA',
    });
    const ok = makeRes();
    const okReq = makeReq({ cookie: cookieFor('cus_other', 'outro@teste.exemplo') });
    okReq.query = { code, asset: 'photo-1' };
    await handler(okReq, ok);
    expect(ok.statusCode).toBe(200);
    expect(ok.body.asset.dataUrl).toContain('data:image/jpeg');
    expect(spy).toHaveBeenCalledWith('cus_owner', 'photo-1', { part: undefined });

    const missing = makeRes();
    const missingReq = makeReq({ cookie: cookieFor('cus_other', 'outro@teste.exemplo') });
    missingReq.query = { code, asset: 'photo-alheia' };
    await handler(missingReq, missing);
    expect(missing.statusCode).toBe(404);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('guarda a conta que publicou cada revisão e lê a foto no Blob do membro', async () => {
    await putSharedProject({
      code: 'MEMBER01',
      ownerId: 'cus_owner',
      ownerEmail: 'dona@teste.exemplo',
      members: ['cus_owner', 'cus_member'],
      doc: { slides: [{ id: 's1', title: 'Antes' }] },
      revision: 1,
      keepRevision: true,
    });

    const published = makeRes();
    await handler(post({
      action: 'push',
      code: 'MEMBER01',
      doc: {
        ...boundDoc('MEMBER01', { id: 's1', title: 'Foto do membro', bgImageAssetId: 'member-photo' }),
        shareRevision: 1,
      },
    }, 'cus_member', 'membro@teste.exemplo'), published);
    expect(published.statusCode).toBe(200);

    const spy = vi.spyOn(librarySyncStore, 'getLibraryAsset').mockImplementation(async (ownerId, assetId) => (
      ownerId === 'cus_member' && assetId === 'member-photo'
        ? { dataUrl: 'data:image/jpeg;base64,MEMBER' }
        : null
    ));
    const result = makeRes();
    const req = makeReq({ cookie: cookieFor('cus_guest', 'guest@teste.exemplo') });
    req.query = { code: 'MEMBER01', asset: 'member-photo' };
    await handler(req, result);

    expect(result.statusCode).toBe(200);
    expect(result.body.asset.dataUrl).toContain('MEMBER');
    expect(spy).toHaveBeenCalledWith('cus_member', 'member-photo', { part: undefined });
    spy.mockRestore();
  });

  it('recupera foto de revisão antiga procurando apenas entre dono e membros', async () => {
    await putSharedProject({
      code: 'LEGPHOTO',
      ownerId: 'cus_owner',
      members: ['cus_owner', 'cus_member', 'legado@teste.exemplo'],
      doc: { slides: [{ id: 's1', bgImageAssetId: 'legacy-member-photo' }] },
      revision: 3,
      keepRevision: true,
    });
    const spy = vi.spyOn(librarySyncStore, 'getLibraryAsset').mockImplementation(async (ownerId) => (
      ownerId === 'cus_member' ? { dataUrl: 'data:image/jpeg;base64,LEGACY' } : null
    ));
    const result = makeRes();
    const req = makeReq({ cookie: cookieFor('cus_guest', 'guest@teste.exemplo') });
    req.query = { code: 'LEGPHOTO', asset: 'legacy-member-photo' };
    await handler(req, result);

    expect(result.statusCode).toBe(200);
    expect(spy.mock.calls.map(([ownerId]) => ownerId)).toEqual(['cus_owner', 'cus_member']);
    expect(spy.mock.calls.some(([ownerId]) => ownerId.includes('@'))).toBe(false);
    spy.mockRestore();
  });
});
