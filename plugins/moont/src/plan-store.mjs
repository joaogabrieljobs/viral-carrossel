import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const planIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class FilePlanStore {
  constructor(directory = join(process.env.PLUGIN_DATA || join(homedir(), '.local', 'share', 'moont-codex'), 'plans')) {
    this.directory = directory;
    this.cache = new Map();
  }

  pathFor(planId) {
    if (!planIdPattern.test(planId)) throw new Error('Invalid plan ID');
    return join(this.directory, `${planId}.json`);
  }

  async get(planId) {
    if (this.cache.has(planId)) return this.cache.get(planId);
    try {
      const plan = JSON.parse(await readFile(this.pathFor(planId), 'utf8'));
      this.cache.set(planId, plan);
      return plan;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async set(planId, plan) {
    const path = this.pathFor(planId);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try { await chmod(this.directory, 0o700); } catch { /* o diretório já pode existir sem permitir chmod */ }
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(plan), { mode: 0o600, flag: 'wx' });
    await rename(temporaryPath, path);
    this.cache.set(planId, plan);
  }
}
