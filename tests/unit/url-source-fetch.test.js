import { describe, expect, it, vi } from 'vitest';
import {
  extractHtmlMetadataText,
  fetchPublicHttp,
  htmlToPlainText,
  hostnameLooksPrivate,
  ipIsPrivateOrReserved,
  MAX_SOURCE_RESPONSE_BYTES,
  serverFetchUrlPlainText,
} from '../../urlSourceFetch.js';

describe('urlSourceFetch', () => {
  it('extrai descrição social mesmo quando o corpo depende de JavaScript', () => {
    const html = `<!doctype html><html><head>
      <title>Marca no Instagram</title>
      <meta property="og:description" content="Uma legenda autoral &amp; concreta sobre cultura e produto.">
      <meta name="twitter:description" content="Uma legenda autoral &amp; concreta sobre cultura e produto.">
    </head><body><script>segredo()</script><div id="app"></div></body></html>`;
    expect(extractHtmlMetadataText(html)).toContain('Uma legenda autoral & concreta');
    const text = htmlToPlainText(html);
    expect(text).toContain('Marca no Instagram');
    expect(text).toContain('Uma legenda autoral & concreta');
    expect(text).not.toContain('segredo');
  });

  it('mantém bloqueio sintático de hosts privados', () => {
    expect(hostnameLooksPrivate('localhost')).toBe(true);
    expect(hostnameLooksPrivate('127.0.0.1')).toBe(true);
    expect(hostnameLooksPrivate('192.168.1.10')).toBe(true);
    expect(hostnameLooksPrivate('[::1]')).toBe(true);
    expect(ipIsPrivateOrReserved('::ffff:127.0.0.1')).toBe(true);
    expect(ipIsPrivateOrReserved('2606:4700:4700::1111')).toBe(false);
    expect(hostnameLooksPrivate('instagram.com')).toBe(false);
  });

  it('bloqueia domínio público que resolve por DNS para IP privado antes do fetch', async () => {
    const fetchImpl = vi.fn();
    const lookupImpl = vi.fn(async () => [{ address: '10.20.30.40', family: 4 }]);

    await expect(fetchPublicHttp('https://perfil.exemplo.com/post', {}, {
      fetchImpl,
      lookupImpl,
      createDispatcher: vi.fn(),
    })).rejects.toThrow(/resolve para um endereço interno/i);

    expect(lookupImpl).toHaveBeenCalledWith('perfil.exemplo.com', { all: true, verbatim: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('revalida DNS a cada redirect e não visita destino que passa a apontar para rede privada', async () => {
    const close = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'https://destino.exemplo.com/conteudo' },
    }));
    const lookupImpl = vi.fn(async (hostname) => (
      hostname === 'origem.exemplo.com'
        ? [{ address: '93.184.216.34', family: 4 }]
        : [{ address: '192.168.1.25', family: 4 }]
    ));
    const createDispatcher = vi.fn(async () => ({ close }));

    await expect(fetchPublicHttp('https://origem.exemplo.com/inicio', {}, {
      fetchImpl,
      lookupImpl,
      createDispatcher,
    })).rejects.toThrow(/resolve para um endereço interno/i);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(lookupImpl).toHaveBeenCalledTimes(2);
    expect(createDispatcher).toHaveBeenCalledWith('origem.exemplo.com', [
      { address: '93.184.216.34', family: 4 },
    ]);
    expect(fetchImpl.mock.calls[0][1].dispatcher).toBeDefined();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('interrompe o streaming assim que o corpo ultrapassa 1 MB', async () => {
    const chunk = new Uint8Array(Math.ceil(MAX_SOURCE_RESPONSE_BYTES / 2) + 32);
    chunk.fill(65);
    let pulls = 0;
    const body = new ReadableStream({
      pull(controller) {
        pulls += 1;
        controller.enqueue(chunk);
        if (pulls >= 3) controller.close();
      },
    });
    const response = new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
    const close = vi.fn(async () => {});

    await expect(serverFetchUrlPlainText('https://texto.exemplo.com/publicacao', {
      lookupImpl: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
      createDispatcher: vi.fn(async () => ({ close })),
      fetchImpl: vi.fn(async () => response),
    })).rejects.toThrow(/excede o limite de 1 MB/i);

    expect(pulls).toBeLessThanOrEqual(3);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('recusa Content-Length acima do teto sem começar a ler o corpo', async () => {
    const getReader = vi.fn();
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'text/html',
        'content-length': String(MAX_SOURCE_RESPONSE_BYTES + 1),
      }),
      body: { getReader, cancel: vi.fn(async () => {}) },
    };

    await expect(serverFetchUrlPlainText('https://grande.exemplo.com', {
      lookupImpl: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
      createDispatcher: vi.fn(async () => ({ close: async () => {} })),
      fetchImpl: vi.fn(async () => response),
    })).rejects.toThrow(/excede o limite de 1 MB/i);

    expect(getReader).not.toHaveBeenCalled();
  });
});
