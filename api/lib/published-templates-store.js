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

/** Mesma resposta nas duas checagens do limite do dia (linhas da tabela e contador). */
export function templateDailyLimitError() {
  return fail('template_daily_limit', `Cada conta publica até ${MAX_PUBLISHES_PER_DAY} modelos por dia. Tente amanhã.`, 429, { limit: MAX_PUBLISHES_PER_DAY });
}

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

  // MOO-31: a migração 023 acrescenta `dismissed_at` e `counts_toward_hide`.
  // O código precisa funcionar antes dela; só o resultado positivo fica em
  // cache, então a função quente percebe a migração aplicada depois.
  let reportDismissalReady = false;
  async function hasReportDismissal(db = connection()) {
    if (reportDismissalReady) return true;
    const rows = await db.unsafe(`/* templates_report_columns */
      SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'moont' AND table_name = 'published_template_reports'
        AND column_name IN ('dismissed_at', 'counts_toward_hide')`);
    reportDismissalReady = Number(rows[0]?.n) === 2;
    return reportDismissalReady;
  }

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
        SELECT * FROM moont.published_templates WHERE owner_id = $1 AND status <> 'removed'
        ORDER BY created_at DESC LIMIT 50`, [id]);
      return rows.map((row) => publicRow(row, id));
    });
  }

  async function getTemplate(idValue, viewer) {
    const id = templateId(idValue);
    return guard(async () => {
      const rows = await connection().unsafe(`/* templates_get */
        SELECT * FROM moont.published_templates
        WHERE id = $1 AND (status = 'published' OR (owner_id = $2 AND status <> 'removed'))`, [id, viewer ?? '']);
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
        SELECT count(*) FILTER (WHERE status <> 'removed')::int AS total,
          count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS today
        FROM moont.published_templates WHERE owner_id = $1`, [id]);
      if (Number(counts?.total || 0) >= MAX_PUBLISHED_PER_OWNER) {
        throw fail('template_owner_limit', `Cada conta publica até ${MAX_PUBLISHED_PER_OWNER} modelos. Apague um para publicar outro.`, 409, { limit: MAX_PUBLISHED_PER_OWNER });
      }
      if (Number(counts?.today || 0) >= MAX_PUBLISHES_PER_DAY) {
        throw templateDailyLimitError();
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
        WHERE id = $1 AND owner_id = $2 AND status <> 'removed'
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
        DELETE FROM moont.published_templates WHERE id = $1 AND owner_id = $2 AND status <> 'removed' RETURNING id`, [tpl, id]);
      if (!rows[0]) throw fail('template_not_found', 'Modelo não encontrado.', 404);
      return { id: rows[0].id, deleted: true };
    });
  }

  /**
   * MOO-32: conta no máximo um uso por conta, modelo e dia de Brasília. A
   * marca em `published_template_uses` (migração 021) decide se o contador
   * sobe. Sem a tabela (migração ainda não aplicada), mantém o comportamento
   * anterior em vez de derrubar a galeria. A marca roda fora de transação:
   * um erro 42P01 dentro dela abortaria o resto.
   */
  async function recordUse(idValue, viewerValue) {
    const tpl = templateId(idValue);
    const viewer = owner(viewerValue);
    return guard(async () => {
      let firstUse = true;
      try {
        const marked = await connection().unsafe(`/* templates_use_mark */
          INSERT INTO moont.published_template_uses (template_id, owner_id, day)
          SELECT id, $2, (now() AT TIME ZONE 'America/Sao_Paulo')::date
          FROM moont.published_templates WHERE id = $1 AND status = 'published'
          ON CONFLICT (template_id, owner_id, day) DO NOTHING
          RETURNING template_id`, [tpl, viewer]);
        firstUse = marked.length > 0;
      } catch (error) {
        if (error?.code !== '42P01') throw error;
      }
      if (!firstUse) {
        const rows = await connection().unsafe(`/* templates_use_count */
          SELECT use_count FROM moont.published_templates WHERE id = $1 AND status = 'published'`, [tpl]);
        if (!rows[0]) throw fail('template_not_found', 'Modelo não encontrado.', 404);
        return { useCount: Number(rows[0].use_count) };
      }
      const rows = await connection().unsafe(`/* templates_use */
        UPDATE moont.published_templates SET use_count = use_count + 1
        WHERE id = $1 AND status = 'published' RETURNING use_count`, [tpl]);
      if (!rows[0]) throw fail('template_not_found', 'Modelo não encontrado.', 404);
      return { useCount: Number(rows[0].use_count) };
    });
  }

  /**
   * Denúncia: uma por conta e modelo, para sempre (MOO-31: depois de
   * dispensada pela moderação, a mesma conta não denuncia de novo). Só
   * denúncia que conta (`countsTowardHide`: assinatura ativa ou isenção)
   * soma para ocultar; com REPORTS_TO_HIDE dessas, o modelo sai da galeria
   * até a moderação rever. Denúncia de conta grátis fica registrada para a
   * fila. Ninguém denuncia o próprio modelo.
   */
  async function report(ownerValue, idValue, reason = '', { countsTowardHide = true } = {}) {
    const id = owner(ownerValue);
    const tpl = templateId(idValue);
    const why = String(reason || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    const counts = countsTowardHide === true;
    return guard(async () => {
      const dismissal = await hasReportDismissal();
      return connection().begin(async (tx) => {
        const found = await tx.unsafe(`/* templates_report_target */
          SELECT owner_id FROM moont.published_templates WHERE id = $1 AND status = 'published' FOR UPDATE`, [tpl]);
        if (!found[0]) throw fail('template_not_found', 'Modelo não encontrado.', 404);
        if (found[0].owner_id === id) throw fail('template_report_own', 'Você não pode denunciar o próprio modelo.', 400);
        const inserted = dismissal
          ? await tx.unsafe(`/* templates_report_insert */
            INSERT INTO moont.published_template_reports (template_id, reporter_id, reason, counts_toward_hide)
            VALUES ($1, $2, $3, $4) ON CONFLICT (template_id, reporter_id) DO NOTHING RETURNING template_id`, [tpl, id, why, counts])
          : await tx.unsafe(`/* templates_report_insert */
            INSERT INTO moont.published_template_reports (template_id, reporter_id, reason)
            VALUES ($1, $2, $3) ON CONFLICT (template_id, reporter_id) DO NOTHING RETURNING template_id`, [tpl, id, why]);
        if (!inserted[0]) return { reported: true, duplicate: true };
        if (dismissal) {
          // report_count = denúncias pendentes (todas, para a fila); a
          // ocultação olha só as pendentes que contam.
          await tx.unsafe(`/* templates_report_count */
            UPDATE moont.published_templates t
            SET report_count = c.pending,
                status = CASE WHEN c.counted >= $2 THEN 'hidden' ELSE t.status END
            FROM (SELECT count(*)::int AS pending,
                    count(*) FILTER (WHERE counts_toward_hide)::int AS counted
                  FROM moont.published_template_reports
                  WHERE template_id = $1 AND dismissed_at IS NULL) c
            WHERE t.id = $1`, [tpl, REPORTS_TO_HIDE]);
        } else if (counts) {
          // Sem a migração, denúncia de conta grátis fica guardada mas não soma.
          await tx.unsafe(`/* templates_report_count */
            UPDATE moont.published_templates
            SET report_count = report_count + 1,
                status = CASE WHEN report_count + 1 >= $2 THEN 'hidden' ELSE status END
            WHERE id = $1`, [tpl, REPORTS_TO_HIDE]);
        }
        return { reported: true, duplicate: false };
      });
    });
  }

  /** Moderador é uma conta listada em `moont.template_moderators`. */
  async function isModerator(ownerValue) {
    if (typeof ownerValue !== 'string' || !OWNER.test(ownerValue)) return false;
    return guard(async () => {
      const rows = await connection().unsafe(`/* templates_is_moderator */
        SELECT 1 FROM moont.template_moderators WHERE owner_id = $1`, [ownerValue]);
      if (rows.length > 0) return true;
      // Quem tem papel no console admin (migração 018) também modera.
      const roles = await connection().unsafe(`/* templates_is_admin */
        SELECT 1 FROM moont.admin_roles WHERE owner_id = $1 AND revoked_at IS NULL`, [ownerValue]).catch(() => []);
      return roles.length > 0;
    });
  }

  async function requireModerator(ownerValue) {
    // Para quem não modera, a fila nem existe: 404, igual a qualquer rota desconhecida.
    if (!await isModerator(ownerValue)) throw fail('template_not_found', 'Não encontrado.', 404);
  }

  /**
   * Fila de moderação: modelos com denúncia ainda não revista, os ocultos
   * primeiro, e com eles as denúncias (motivo e data; quem denunciou não sai).
   */
  async function listModerationQueue(ownerValue, { view = 'pending' } = {}) {
    await requireModerator(ownerValue);
    const removed = view === 'removed';
    return guard(async () => {
      const dismissal = await hasReportDismissal();
      // Com a migração 023, a fila mostra só denúncias pendentes e diz se
      // cada uma conta para ocultar (conta paga) ou só ficou registrada.
      const reportsSql = dismissal
        ? `json_agg(json_build_object('reason', r.reason, 'createdAt', r.created_at, 'countsTowardHide', r.counts_toward_hide) ORDER BY r.created_at DESC)
            FROM moont.published_template_reports r WHERE r.template_id = t.id AND r.dismissed_at IS NULL`
        : `json_agg(json_build_object('reason', r.reason, 'createdAt', r.created_at) ORDER BY r.created_at DESC)
            FROM moont.published_template_reports r WHERE r.template_id = t.id`;
      const rows = await connection().unsafe(`/* templates_moderation_queue */
        SELECT t.*,
          COALESCE((SELECT ${reportsSql}), '[]'::json) AS reports,
          (SELECT count(*)::int FROM moont.published_templates o WHERE o.owner_id = t.owner_id AND o.status <> 'removed') AS author_template_count,
          (SELECT count(*)::int FROM moont.template_moderation_events e
             WHERE e.template_owner_id = t.owner_id AND e.decision IN ('hide', 'remove')) AS author_strikes
        FROM moont.published_templates t
        WHERE CASE WHEN $1::boolean THEN t.status = 'removed'
                   ELSE t.status <> 'removed' AND (t.status = 'hidden' OR t.report_count > 0) END
        ORDER BY (t.status = 'hidden') DESC, t.removed_at DESC NULLS LAST, t.report_count DESC, t.created_at DESC
        LIMIT 100`, [removed]);
      return rows.map((row) => ({
        ...publicRow(row, null),
        status: row.status,
        reportCount: Number(row.report_count || 0),
        removedAt: row.removed_at ? new Date(row.removed_at).toISOString() : null,
        reports: Array.isArray(row.reports) ? row.reports.map((r) => ({
          reason: r.reason || '', createdAt: new Date(r.createdAt).toISOString(),
          ...(typeof r.countsTowardHide === 'boolean' ? { countsTowardHide: r.countsTowardHide } : {}),
        })) : [],
        // Contexto do autor sem identificá-lo: quantos modelos tem e quantos já saíram por moderação.
        authorTemplateCount: Number(row.author_template_count || 0),
        authorStrikes: Number(row.author_strikes || 0),
      }));
    });
  }

  /**
   * Decide um modelo: `keep` devolve à galeria e dispensa as denúncias
   * (MOO-31: ficam guardadas e quem já denunciou não denuncia de novo; sem a
   * migração 023, são apagadas como antes), `hide` tira da galeria sem apagar,
   * `remove` tira da galeria e dos modelos da autora mas guarda (João, 19/11),
   * e `restore` devolve um removido à galeria. Toda decisão vai para o histórico.
   */
  async function moderate(ownerValue, idValue, decision) {
    await requireModerator(ownerValue);
    const tpl = templateId(idValue);
    if (!['keep', 'hide', 'remove', 'restore'].includes(decision)) throw fail('template_bad_decision', 'Decisão inválida.');
    return guard(async () => {
      const dismissal = await hasReportDismissal();
      return connection().begin(async (tx) => {
        const found = (await tx.unsafe(`/* templates_moderate_target */
          SELECT * FROM moont.published_templates WHERE id = $1 FOR UPDATE`, [tpl]))[0];
        if (!found) throw fail('template_not_found', 'Modelo não encontrado.', 404);
        // Removido só volta por "restaurar"; restaurar só vale para removido.
        if ((found.status === 'removed') !== (decision === 'restore')) {
          throw fail('template_bad_state', decision === 'restore' ? 'Este modelo não está removido.' : 'Este modelo foi removido. Restaure antes de decidir de novo.', 409);
        }
        await tx.unsafe(`/* templates_moderation_event */
          INSERT INTO moont.template_moderation_events
            (template_id, template_name, template_owner_id, moderator_id, decision, report_count)
          VALUES ($1, $2, $3, $4, $5, $6)`, [tpl, found.name, found.owner_id, ownerValue, decision, Number(found.report_count || 0)]);
        const nextStatus = { keep: 'published', restore: 'published', hide: 'hidden', remove: 'removed' }[decision];
        if (nextStatus === 'published') {
          await tx.unsafe(dismissal
            ? `/* templates_moderation_dismiss */ UPDATE moont.published_template_reports
                SET dismissed_at = now() WHERE template_id = $1 AND dismissed_at IS NULL`
            : '/* templates_moderation_clear */ DELETE FROM moont.published_template_reports WHERE template_id = $1', [tpl]);
        }
        const rows = await tx.unsafe(`/* templates_moderation_update */
          UPDATE moont.published_templates
          SET status = $2,
              report_count = CASE WHEN $2 = 'published' THEN 0 ELSE report_count END,
              removed_at = CASE WHEN $2 = 'removed' THEN now() ELSE NULL END,
              reviewed_at = now()
          WHERE id = $1 RETURNING status`, [tpl, nextStatus]);
        return { id: tpl, decision, status: rows[0].status };
      });
    });
  }

  return {
    listGallery, listMine, getTemplate, publish, updateMine, deleteMine, recordUse, report,
    isModerator, listModerationQueue, moderate,
  };
}

const defaultStore = createPublishedTemplatesStore();
export default defaultStore;
