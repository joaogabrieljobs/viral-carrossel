/**
 * Loja dos modelos publicados (Postgres, esquema `moont`).
 *
 * Toda escrita compara o dono no próprio SQL (`WHERE id = $1 AND owner_id = $2`):
 * modelo de outra conta não é atualizado nem apagado, e a resposta é "não
 * encontrado", sem revelar que ele existe. `owner_id` nunca sai daqui.
 */
import { randomBytes } from 'node:crypto';
import { getPostgresConnection } from './postgres-connection.js';

export const MAX_PUBLISHED_PER_OWNER = 10;
export const MAX_PUBLISHES_PER_DAY = 5;
export const REPORTS_TO_HIDE = 3;
export const GALLERY_PAGE_SIZE = 24;

const OWNER = /^[A-Za-z0-9_.-]{1,255}$/;
const TEMPLATE_ID = /^tpl_[a-z0-9]{20}$/;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const fail = (code, message, status = 400, extra = {}) => Object.assign(new Error(message), { code, status, ...extra });

export function newTemplateId() {
  const bytes = randomBytes(20);
  let id = 'tpl_';
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return id;
}

function owner(value) {
  if (typeof value !== 'string' || !OWNER.test(value)) throw fail('template_bad_owner', 'Conta inválida.');
  return value;
}

export function validTemplateId(value) {
  return typeof value === 'string' && TEMPLATE_ID.test(value);
}

function templateId(value) {
  if (!validTemplateId(value)) throw fail('template_bad_id', 'Modelo inválido.');
  return value;
}

/** Linha pública: o que a galeria mostra. Sem dono, sem contagem de denúncias. */
function publicRow(row, viewer) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    authorName: row.author_name || null,
    format: row.format,
    content: row.content,
    useCount: Number(row.use_count || 0),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    mine: viewer != null && row.owner_id === viewer,
    ...(viewer != null && row.owner_id === viewer ? { status: row.status } : {}),
  };
}

function encodeCursor(row) {
  return Buffer.from(`${new Date(row.created_at).toISOString()}|${row.id}`).toString('base64url');
}

function decodeCursor(value) {
  if (value == null || value === '') return null;
  let text;
  try { text = Buffer.from(String(value), 'base64url').toString('utf8'); } catch { text = ''; }
  const [at, id] = text.split('|');
  if (!validTemplateId(id) || Number.isNaN(Date.parse(at))) throw fail('template_bad_cursor', 'Página inválida.');
  return { at, id };
}

async function guard(work) {
  try { return await work(); }
  catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('template_')) throw error;
    if (error?.code === 'library_storage_unconfigured') throw fail('template_storage_unconfigured', 'A galeria de modelos está indisponível.', 503);
    if (error?.code === '42P01' || error?.code === '3F000') throw fail('template_storage_unconfigured', 'A galeria de modelos ainda não foi ativada.', 503);
    console.error('[templates] storage', error?.code || '', error?.message || error);
    throw fail('template_storage_unavailable', 'A galeria de modelos está indisponível. Tente novamente.', 503);
  }
}

export function createPublishedTemplatesStore({ sql: injectedSql } = {}) {
  const connection = () => injectedSql || getPostgresConnection();

  async function listGallery({ viewer, cursor, format } = {}) {
    const after = decodeCursor(cursor);
    const fmt = format == null || format === '' ? null : String(format);
    return guard(async () => {
      const rows = await connection().unsafe(`/* templates_gallery */
        SELECT * FROM moont.published_templates
        WHERE status = 'published'
          AND ($1::text IS NULL OR format = $1)
          AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::text))
        ORDER BY created_at DESC, id DESC
        LIMIT $4`, [fmt, after?.at ?? null, after?.id ?? null, GALLERY_PAGE_SIZE + 1]);
      const page = rows.slice(0, GALLERY_PAGE_SIZE);
      return {
        templates: page.map((row) => publicRow(row, viewer)),
        nextCursor: rows.length > GALLERY_PAGE_SIZE ? encodeCursor(page.at(-1)) : null,
      };
    });
  }

  async function listMine(ownerValue) {
    const id = owner(ownerValue);
    return guard(async () => {
      const rows = await connection().unsafe(`/* templates_mine */
        SELECT * FROM moont.published_templates WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]);
      return rows.map((row) => publicRow(row, id));
    });
  }

  async function getTemplate(idValue, viewer) {
    const id = templateId(idValue);
    return guard(async () => {
      const rows = await connection().unsafe(`/* templates_get */
        SELECT * FROM moont.published_templates
        WHERE id = $1 AND (status = 'published' OR owner_id = $2)`, [id, viewer ?? '']);
      if (!rows[0]) throw fail('template_not_found', 'Modelo não encontrado.', 404);
      return publicRow(rows[0], viewer);
    });
  }

  /** Publica com limite por conta: total publicado e publicações nas últimas 24 h. */
  async function publish(ownerValue, { name, description, authorName, format, content, contentBytes }) {
    const id = owner(ownerValue);
    return guard(() => connection().begin(async (tx) => {
      // Serializa publicações da mesma conta: duas abas não furam o limite.
      await tx.unsafe('/* templates_lock */ SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`published-templates:${id}`]);
      const [counts] = await tx.unsafe(`/* templates_counts */
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS today
        FROM moont.published_templates WHERE owner_id = $1`, [id]);
      if (Number(counts?.total || 0) >= MAX_PUBLISHED_PER_OWNER) {
        throw fail('template_owner_limit', `Cada conta publica até ${MAX_PUBLISHED_PER_OWNER} modelos. Apague um para publicar outro.`, 409, { limit: MAX_PUBLISHED_PER_OWNER });
      }
      if (Number(counts?.today || 0) >= MAX_PUBLISHES_PER_DAY) {
        throw fail('template_daily_limit', `Cada conta publica até ${MAX_PUBLISHES_PER_DAY} modelos por dia. Tente amanhã.`, 429, { limit: MAX_PUBLISHES_PER_DAY });
      }
      const rows = await tx.unsafe(`/* templates_insert */
        INSERT INTO moont.published_templates
          (id, owner_id, name, description, author_name, format, content, content_bytes)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        RETURNING *`, [newTemplateId(), id, name, description, authorName, format, JSON.stringify(content), contentBytes]);
      return publicRow(rows[0], id);
    }));
  }

  async function updateMine(ownerValue, idValue, { name, description, authorName }) {
    const id = owner(ownerValue);
    const tpl = templateId(idValue);
    return guard(async () => {
      const rows = await connection().unsafe(`/* templates_update */
        UPDATE moont.published_templates
        SET name = $3, description = $4, author_name = $5, updated_at = now()
        WHERE id = $1 AND owner_id = $2
        RETURNING *`, [tpl, id, name, description, authorName]);
      if (!rows[0]) throw fail('template_not_found', 'Modelo não encontrado.', 404);
      return publicRow(rows[0], id);
    });
  }

  /** Despublicar = apagar: a galeria é pública e não há modelo guardado fora dela. */
  async function deleteMine(ownerValue, idValue) {
    const id = owner(ownerValue);
    const tpl = templateId(idValue);
    return guard(async () => {
      const rows = await connection().unsafe(`/* templates_delete */
        DELETE FROM moont.published_templates WHERE id = $1 AND owner_id = $2 RETURNING id`, [tpl, id]);
      if (!rows[0]) throw fail('template_not_found', 'Modelo não encontrado.', 404);
      return { id: rows[0].id, deleted: true };
    });
  }

  async function recordUse(idValue) {
    const tpl = templateId(idValue);
    return guard(async () => {
      const rows = await connection().unsafe(`/* templates_use */
        UPDATE moont.published_templates SET use_count = use_count + 1
        WHERE id = $1 AND status = 'published' RETURNING use_count`, [tpl]);
      if (!rows[0]) throw fail('template_not_found', 'Modelo não encontrado.', 404);
      return { useCount: Number(rows[0].use_count) };
    });
  }

  /**
   * Denúncia: uma por conta e modelo. Com REPORTS_TO_HIDE contas diferentes, o
   * modelo sai da galeria até o João rever. Ninguém denuncia o próprio modelo.
   */
  async function report(ownerValue, idValue, reason = '') {
    const id = owner(ownerValue);
    const tpl = templateId(idValue);
    const why = String(reason || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    return guard(() => connection().begin(async (tx) => {
      const found = await tx.unsafe(`/* templates_report_target */
        SELECT owner_id FROM moont.published_templates WHERE id = $1 AND status = 'published' FOR UPDATE`, [tpl]);
      if (!found[0]) throw fail('template_not_found', 'Modelo não encontrado.', 404);
      if (found[0].owner_id === id) throw fail('template_report_own', 'Você não pode denunciar o próprio modelo.', 400);
      const inserted = await tx.unsafe(`/* templates_report_insert */
        INSERT INTO moont.published_template_reports (template_id, reporter_id, reason)
        VALUES ($1, $2, $3) ON CONFLICT (template_id, reporter_id) DO NOTHING RETURNING template_id`, [tpl, id, why]);
      if (!inserted[0]) return { reported: true, duplicate: true };
      await tx.unsafe(`/* templates_report_count */
        UPDATE moont.published_templates
        SET report_count = report_count + 1,
            status = CASE WHEN report_count + 1 >= $2 THEN 'hidden' ELSE status END
        WHERE id = $1`, [tpl, REPORTS_TO_HIDE]);
      return { reported: true, duplicate: false };
    }));
  }

  return { listGallery, listMine, getTemplate, publish, updateMine, deleteMine, recordUse, report };
}

const defaultStore = createPublishedTemplatesStore();
export default defaultStore;
