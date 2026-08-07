// Task 02 — RF-03: versionamento de docs persistidos.
import { describe, it, expect } from 'vitest';
import { migrateDoc, SCHEMA_VERSION } from '../../src/utils/schema-migration.js';

describe('migrateDoc', () => {
  it('doc legado sem __v recebe stamp da versão atual sem perder campos', () => {
    const doc = { slides: [{ title: 'a' }], caption: 'x' };
    const out = migrateDoc(doc);
    expect(out.__v).toBe(SCHEMA_VERSION);
    expect(out.slides).toEqual([{ title: 'a' }]);
    expect(out.caption).toBe('x');
  });

  it('doc já na versão atual volta intacto (mesma referência)', () => {
    const doc = { __v: SCHEMA_VERSION, slides: [] };
    expect(migrateDoc(doc)).toBe(doc);
  });

  it('valores não-objeto passam direto sem lançar', () => {
    expect(migrateDoc(null)).toBeNull();
    expect(migrateDoc(undefined)).toBeUndefined();
    expect(migrateDoc('string')).toBe('string');
  });
});
