/** Auditoria 11/11, achado 1: todo cron agendado no vercel.json precisa passar
 *  pelo middleware sem redirect em host técnico, porque o agendador da Vercel
 *  chama o domínio .vercel.app e não segue 308. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import middleware from '../../middleware.js';

const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const cronPaths = vercel.crons.map((cron) => cron.path);
const request = (host, path) => new Request(`https://${host}${path}`, { headers: { host } });

describe('middleware: crons do vercel.json em host técnico', () => {
  it('o vercel.json agenda pelo menos os dois crons conhecidos', () => {
    expect(cronPaths).toContain('/api/cron/cleanup-image-references');
    expect(cronPaths).toContain('/api/cron/reconcile-image-credits');
  });

  it.each(cronPaths)('%s chega à função sem redirect em .vercel.app', (path) => {
    expect(middleware(request('viral-carrossel.vercel.app', path))).toBeUndefined();
    expect(middleware(request('viral-carrossel-elevessy-s-projects.vercel.app', path))).toBeUndefined();
  });

  it('um caminho qualquer continua indo para o endereço principal com 308', () => {
    for (const path of ['/?app=1', '/api/status', '/api/cronica', '/api/cron']) {
      const res = middleware(request('viral-carrossel.vercel.app', path));
      expect(res.status).toBe(308);
      expect(res.headers.get('location')).toBe(`https://moont.ai${path}`);
    }
  });
});
