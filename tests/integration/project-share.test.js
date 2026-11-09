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
  return created.body.code;
}

function boundDoc(code, slide) {
  return { shareCode: code, slides: [slide] };
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
    await handler(post({ action: 'push', code: 'LEGACY01', doc: boundDoc('LEGACY01', { title: 'Da dona' }) },
      'cus_verified', 'dona@teste.exemplo'), verified);
    expect(verified.statusCode).toBe(200);
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
    await handler(post({ action: 'push', code: 'LEGACY02', doc: boundDoc('LEGACY02', { title: 'Por ID' }) },
      'cus_member', 'novo@teste.exemplo'), member);
    expect(member.statusCode).toBe(200);

    stripeMock.customers.retrieve.mockImplementation(async (id) => ({
      id,
      email: 'membro@teste.exemplo',
      metadata: { vc_google_sub: 'google-member-sub' },
    }));
    const verified = makeRes();
    await handler(post({ action: 'push', code: 'LEGACY02', doc: boundDoc('LEGACY02', { title: 'Por e-mail verificado' }) },
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
      doc: boundDoc('MEMBER01', { id: 's1', title: 'Foto do membro', bgImageAssetId: 'member-photo' }),
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
