import { createHash, randomUUID } from 'node:crypto';
import { MoontApiError } from './client.mjs';
import { FilePlanStore } from './plan-store.mjs';

const objectSchema = { type: 'object', additionalProperties: true };
const selectorProperties = {
  projectId: { type: 'string', description: 'Um projeto.' },
  projectIds: { type: 'array', items: { type: 'string' }, description: 'Vários projetos; sem limite total.' },
  allProjects: { type: 'boolean', description: 'Inclui todos os projetos da conta, percorrendo todas as páginas.' },
};

export const TOOL_DEFINITIONS = [
  {
    name: 'list_projects',
    description: 'Lista uma página de projetos Moont da conta conectada. Use nextCursor para percorrer todas as páginas. Nunca retorna fotos. A seleção allProjects nos lotes percorre a biblioteca inteira internamente.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 100 },
        cursor: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_project_design',
    description: 'Lê versão e campos visuais dos cards de um projeto. Não retorna mídia. Textos são somente leitura.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        includeText: { type: 'boolean', default: false },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_visual_schema',
    description: 'Mostra os campos visuais aceitos pelo Moont, tipos e faixas. Consulte antes de preparar uma alteração.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'preview_visual_batch',
    description: 'Faz prévia de alterações visuais em um, vários ou todos os projetos. Nenhum projeto é alterado. Retorna planId, necessário para aplicar a mesma mudança; títulos, legendas e fotos permanecem intocados. Se interrompida, use resumePlanId.',
    inputSchema: {
      type: 'object',
      properties: {
        ...selectorProperties,
        slideIds: { type: 'array', items: { type: 'string' }, description: 'IDs de cards quando projectId identifica um único projeto. Omitir aplica a todos os cards.' },
        slideIdsByProject: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } }, description: 'Seleção opcional de cards por ID de projeto.' },
        patch: { ...objectSchema, description: 'Apenas campos visuais retornados por get_visual_schema. Campos de texto ou mídia são recusados pelo servidor.' },
        brandScope: { type: 'string', enum: ['project'], description: 'Obrigatório quando patch.brand está presente; mudanças da marca afetam o projeto inteiro.' },
        resumePlanId: { type: 'string', description: 'Retoma uma prévia parcial sem alterar sua seleção ou patch.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'apply_visual_batch',
    description: 'Aplica exatamente uma prévia criada por preview_visual_batch. Usa controle de versão e IDs idempotentes. Se algum projeto mudar após a prévia, para e exige nova prévia. Pode atingir todos os cards/projetos selecionados, sem limite artificial.',
    inputSchema: {
      type: 'object',
      properties: { planId: { type: 'string' } },
      required: ['planId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_batch_preview',
    description: 'Lê uma página da prévia salva, inclusive após reiniciar o plugin. A paginação limita apenas a resposta, nunca a quantidade de projetos ou cards editados.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        offset: { type: 'integer', minimum: 0, default: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      required: ['planId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_batch_status',
    description: 'Consulta o resultado de uma alteração em lote por planId local ou requestIds do Moont. IDs de requisição permitem consulta após reiniciar o plugin.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        requestIds: { type: 'array', items: { type: 'string' } },
        offset: { type: 'integer', minimum: 0, default: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'undo_visual_batch',
    description: 'Reverte alterações de um lote usando requestIds, planId ou resumeUndoPlanId. O progresso fica salvo após cada projeto; repetir a mesma chamada retoma sem desfazer duas vezes. O servidor só reverte quando a versão ainda é a produzida pelo lote.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        requestIds: { type: 'array', items: { type: 'string' } },
        resumeUndoPlanId: { type: 'string', description: 'Retoma uma reversão parcial já iniciada.' },
      },
      additionalProperties: false,
    },
  },
];

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new MoontApiError(`${label} é obrigatório.`, { code: 'invalid_input' });
  return value.trim();
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MoontApiError(`${label} deve ser um objeto.`, { code: 'invalid_input' });
  }
  return value;
}

function cleanIds(value, label) {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new MoontApiError(`${label} deve ser uma lista de IDs.`, { code: 'invalid_input' });
  }
  return [...new Set(value.map((id) => id.trim()))];
}

function selectSlideIds(args, projectId) {
  if (args.slideIdsByProject !== undefined) {
    const map = requirePlainObject(args.slideIdsByProject, 'slideIdsByProject');
    return Object.hasOwn(map, projectId) ? cleanIds(map[projectId], `slideIdsByProject.${projectId}`) : null;
  }
  return args.slideIds === undefined ? null : cleanIds(args.slideIds, 'slideIds');
}

function summarizeChanges(changes) {
  if (!Array.isArray(changes)) return { changeCount: 0, fields: [] };
  const fields = new Set();
  for (const change of changes) {
    if (typeof change?.field === 'string') fields.add(change.field);
    if (typeof change?.path === 'string') fields.add(change.path);
    if (Array.isArray(change?.fields)) change.fields.filter((field) => typeof field === 'string').forEach((field) => fields.add(field));
    else if (change?.fields && typeof change.fields === 'object') Object.keys(change.fields).forEach((field) => fields.add(field));
  }
  return { changeCount: changes.length, fields: [...fields].sort() };
}

function undoId(requestId) {
  return `undo:${createHash('sha256').update(requestId).digest('hex')}`;
}

function stableUndoPlanId(source) {
  const hash = createHash('sha256').update(source).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function pageBounds(args) {
  const offset = args.offset === undefined ? 0 : Number(args.offset);
  const limit = args.limit === undefined ? 20 : Number(args.limit);
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new MoontApiError('Use offset >= 0 e limit entre 1 e 100.', { code: 'invalid_pagination' });
  }
  return { offset, limit };
}

function paged(items, args) {
  const { offset, limit } = pageBounds(args);
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    nextOffset: offset + limit < items.length ? offset + limit : null,
  };
}

function previewItem(item) {
  return {
    projectId: item.projectId,
    name: item.name,
    baseVersion: item.baseVersion,
    selectedSlideCount: item.preview.selectedSlideCount ?? item.preview.slideCount,
    changedSlideCount: item.preview.changedSlideCount,
    brandChanges: item.preview.brandChanges,
    ...summarizeChanges(item.preview.changes),
  };
}

export function createMoontTools(client, { plans = new FilePlanStore(), timeBudgetMs = 20000 } = {}) {

  async function listAllProjects({ limit = 100, cursor } = {}) {
    const projects = [];
    const seenIds = new Set();
    const seenCursors = new Set();
    let pageCursor = cursor;
    let total;

    while (true) {
      const page = await client.listProjects({ limit, cursor: pageCursor });
      total = page.total;
      for (const project of page.projects || []) {
        if (!seenIds.has(project.id)) {
          seenIds.add(project.id);
          projects.push(project);
        }
      }
      if (!page.nextCursor) break;
      if (seenCursors.has(page.nextCursor)) throw new MoontApiError('A paginação da biblioteca repetiu um cursor.', { code: 'pagination_loop' });
      seenCursors.add(page.nextCursor);
      pageCursor = page.nextCursor;
    }

    return { ok: true, projects, nextCursor: null, total: total ?? projects.length };
  }

  async function projectIdsFor(args) {
    const selectors = Number(args.projectId !== undefined) + Number(args.projectIds !== undefined) + Number(args.allProjects === true);
    if (selectors !== 1) {
      throw new MoontApiError('Escolha exatamente um de projectId, projectIds ou allProjects.', { code: 'invalid_selection' });
    }
    if (args.projectId !== undefined) return [requireString(args.projectId, 'projectId')];
    if (args.projectIds !== undefined) return cleanIds(args.projectIds, 'projectIds');
    return (await listAllProjects()).projects.map((project) => project.id);
  }

  async function previewBatch(args) {
    const startedAt = Date.now();
    let plan;
    if (args.resumePlanId !== undefined) {
      const planId = requireString(args.resumePlanId, 'resumePlanId');
      if (Object.keys(args).some((key) => key !== 'resumePlanId')) {
        throw new MoontApiError('Ao retomar uma prévia, informe somente resumePlanId.', { code: 'invalid_input' });
      }
      plan = await plans.get(planId);
      if (!plan) throw new MoontApiError('Prévia parcial não encontrada.', { code: 'preview_not_found' });
    } else {
      const patch = requirePlainObject(args.patch, 'patch');
      if (Object.keys(patch).length === 0) throw new MoontApiError('A mudança visual está vazia.', { code: 'empty_patch' });
      if (patch.brand !== undefined && args.brandScope !== 'project') {
        throw new MoontApiError('Defina brandScope: "project" ao alterar a marca, pois isso afeta todos os cards do projeto.', { code: 'brand_scope_required' });
      }
      if (args.slideIds !== undefined && args.projectId === undefined) {
        throw new MoontApiError('Use slideIdsByProject ao selecionar mais de um projeto.', { code: 'invalid_selection' });
      }
      const projectIds = await projectIdsFor(args);
      if (projectIds.length === 0) throw new MoontApiError('Nenhum projeto foi selecionado.', { code: 'empty_selection' });
      plan = {
        planId: randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'previewing',
        projectIds,
        patch: structuredClone(patch),
        brandScope: args.brandScope,
        slideIds: args.slideIds,
        slideIdsByProject: args.slideIdsByProject,
        items: [],
      };
      await plans.set(plan.planId, plan);
    }

    for (const projectId of plan.projectIds.slice(plan.items.length)) {
      try {
        const detail = await client.getProject(projectId);
        const project = detail.project;
        if (!project || project.version === undefined) {
          throw new MoontApiError(`O projeto ${projectId} veio sem versão.`, { code: 'invalid_response' });
        }
        const slideIds = selectSlideIds(plan, projectId);
        const preview = await client.preview({
          projectId, baseVersion: project.version, slideIds, patch: plan.patch, brandScope: plan.brandScope,
        });
        plan.items.push({
          projectId,
          name: project.name,
          baseVersion: project.version,
          slideIds,
          preview,
          requestId: `moont:${randomUUID()}`,
          result: null,
        });
        await plans.set(plan.planId, plan);
        if (plan.items.length < plan.projectIds.length && Date.now() - startedAt >= timeBudgetMs) {
          return {
            ok: true,
            status: 'in_progress',
            planId: plan.planId,
            previewedProjectCount: plan.items.length,
            pendingProjectCount: plan.projectIds.length - plan.items.length,
            instruction: 'Continue com preview_visual_batch({resumePlanId: planId}). A prévia ainda não pode ser aplicada.',
          };
        }
      } catch (error) {
        return {
          ok: false,
          status: 'partial_preview',
          planId: plan.planId,
          previewedProjectCount: plan.items.length,
          pendingProjectCount: plan.projectIds.length - plan.items.length,
          failed: { projectId, code: error.code || 'request_failed', message: error.message },
          instruction: 'Retome com preview_visual_batch({resumePlanId: planId}); nenhum projeto foi alterado.',
        };
      }
    }

    plan.status = 'previewed';
    await plans.set(plan.planId, plan);
    return {
      ok: true,
      planId: plan.planId,
      status: 'previewed',
      projectCount: plan.items.length,
      changedSlideCount: plan.items.reduce((sum, item) => sum + (Number(item.preview.changedSlideCount) || 0), 0),
      projects: plan.items.slice(0, 20).map(previewItem),
      nextOffset: plan.items.length > 20 ? 20 : null,
      patch: plan.patch,
      brandScope: plan.brandScope,
      instruction: 'Revise a prévia; aplique com apply_visual_batch(planId). O Moont recusará se a versão de algum projeto mudar.',
    };
  }

  async function applyBatch(args) {
    const startedAt = Date.now();
    const planId = requireString(args.planId, 'planId');
    const plan = await plans.get(planId);
    if (!plan) throw new MoontApiError('Prévia não encontrada nesta sessão do plugin. Gere uma nova prévia.', { code: 'preview_not_found' });
    if (plan.status !== 'previewed' && plan.status !== 'applying' && plan.status !== 'applied') {
      throw new MoontApiError('A prévia ainda está incompleta. Retome-a antes de aplicar.', { code: 'preview_incomplete' });
    }
    plan.status = 'applying';
    await plans.set(planId, plan);
    const results = [];
    for (const item of plan.items) {
      if (item.result?.status === 'applied') {
        results.push(item.result);
        continue;
      }
      try {
        item.attempted = true;
        await plans.set(planId, plan);
        const response = await client.apply({
          projectId: item.projectId,
          baseVersion: item.baseVersion,
          slideIds: item.slideIds,
          patch: plan.patch,
          brandScope: plan.brandScope,
          requestId: item.requestId,
        });
        item.result = response.job || { projectId: item.projectId, requestId: item.requestId, status: 'applied' };
        await plans.set(planId, plan);
        results.push(item.result);
        if (results.length < plan.items.length && Date.now() - startedAt >= timeBudgetMs) {
          const resultPage = paged(results, {});
          return {
            ok: true,
            status: 'in_progress',
            planId,
            appliedCount: results.length,
            pendingProjectCount: plan.items.length - results.length,
            applied: resultPage.items,
            nextOffset: resultPage.nextOffset,
            instruction: 'Continue com apply_visual_batch({planId}). Projetos já aplicados não serão regravados.',
          };
        }
      } catch (error) {
        const resultPage = paged(results, {});
        return {
          ok: false,
          status: results.length ? 'partial' : 'failed',
          planId,
          appliedCount: results.length,
          applied: resultPage.items,
          nextOffset: resultPage.nextOffset,
          failed: { projectId: item.projectId, code: error.code || 'request_failed', message: error.message, cloudVersion: error.cloudVersion },
          pendingProjectCount: plan.items.length - results.length - 1,
          instruction: 'Não gere outra operação para os projetos já aplicados. Use get_batch_status ou undo_visual_batch com os requestIds; refaça a prévia se houver conflito de versão.',
        };
      }
    }
    plan.status = 'applied';
    await plans.set(planId, plan);
    const resultPage = paged(results, {});
    return { ok: true, status: 'applied', planId, appliedCount: results.length, applied: resultPage.items, nextOffset: resultPage.nextOffset };
  }

  async function jobsFor(args, { includeAttempted = false } = {}) {
    if (args.planId !== undefined && args.requestIds !== undefined) {
      throw new MoontApiError('Use planId ou requestIds, não ambos.', { code: 'invalid_selection' });
    }
    if (args.planId !== undefined) {
      const plan = await plans.get(requireString(args.planId, 'planId'));
      if (!plan) throw new MoontApiError('Lote não encontrado nesta sessão. Use os requestIds retornados na aplicação.', { code: 'plan_not_found' });
      return plan.items.filter((item) => item.result || (includeAttempted && item.attempted)).map((item) => item.requestId);
    }
    if (args.requestIds !== undefined) return cleanIds(args.requestIds, 'requestIds');
    throw new MoontApiError('Informe planId ou requestIds.', { code: 'invalid_selection' });
  }

  return {
    plans,
    async invoke(name, rawArgs = {}) {
      const args = requirePlainObject(rawArgs, 'arguments');
      switch (name) {
        case 'list_projects': {
          const limit = args.limit === undefined ? 100 : Number(args.limit);
          if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new MoontApiError('limit deve estar entre 1 e 100 por página.', { code: 'invalid_input' });
          return client.listProjects({ limit, cursor: args.cursor });
        }
        case 'get_project_design': {
          const projectId = requireString(args.projectId, 'projectId');
          const data = await client.getProject(projectId);
          if (args.includeText === true) return data;
          return { ...data, project: {
            ...data.project,
            slides: (data.project?.slides || []).map(({ id, index, visual, overlays, hasPhoto, hasLogo }) => ({
              id,
              index,
              visual,
              hasPhoto,
              hasLogo,
              overlays: Array.isArray(overlays) ? overlays.map((overlay) => ({ id: overlay.id, type: overlay.type, visual: overlay.visual })) : undefined,
            })),
          } };
        }
        case 'get_visual_schema':
          return client.getVisualSchema();
        case 'preview_visual_batch':
          return previewBatch(args);
        case 'apply_visual_batch':
          return applyBatch(args);
        case 'get_batch_preview': {
          const planId = requireString(args.planId, 'planId');
          const plan = await plans.get(planId);
          if (!plan) throw new MoontApiError('Prévia não encontrada.', { code: 'preview_not_found' });
          const page = paged(plan.items, args);
          return { ok: true, planId, status: plan.status, total: page.total, offset: page.offset, nextOffset: page.nextOffset, projects: page.items.map(previewItem) };
        }
        case 'get_batch_status': {
          if (args.planId !== undefined) {
            const stored = await plans.get(requireString(args.planId, 'planId'));
            if (stored?.kind === 'undo') {
              const page = paged(stored.items, args);
              return {
                ok: true,
                kind: 'undo',
                status: stored.status,
                total: page.total,
                offset: page.offset,
                nextOffset: page.nextOffset,
                jobs: page.items.map((item) => item.result || { requestId: item.requestId, status: 'pending' }),
              };
            }
          }
          const requestIds = await jobsFor(args, { includeAttempted: true });
          const page = paged(requestIds, args);
          const jobs = [];
          for (const requestId of page.items) {
            try {
              jobs.push((await client.getJob(requestId)).job);
            } catch (error) {
              jobs.push({ requestId, status: 'unknown', code: error.code || 'request_failed' });
            }
          }
          return { ok: true, total: page.total, offset: page.offset, nextOffset: page.nextOffset, jobs };
        }
        case 'undo_visual_batch': {
          const startedAt = Date.now();
          let undoPlan;
          if (args.resumeUndoPlanId !== undefined) {
            if (args.planId !== undefined || args.requestIds !== undefined) {
              throw new MoontApiError('Ao retomar, informe somente resumeUndoPlanId.', { code: 'invalid_selection' });
            }
            undoPlan = await plans.get(requireString(args.resumeUndoPlanId, 'resumeUndoPlanId'));
            if (!undoPlan || undoPlan.kind !== 'undo') throw new MoontApiError('Reversão parcial não encontrada.', { code: 'undo_plan_not_found' });
          } else {
            const requestIds = (await jobsFor(args)).reverse();
            const source = args.planId !== undefined
              ? `plan:${args.planId}`
              : `requests:${requestIds.join(',')}`;
            const undoPlanId = stableUndoPlanId(source);
            undoPlan = await plans.get(undoPlanId);
            if (!undoPlan) {
              undoPlan = {
                kind: 'undo',
                planId: undoPlanId,
                status: 'undoing',
                createdAt: new Date().toISOString(),
                items: requestIds.map((requestId) => ({ requestId, undoRequestId: undoId(requestId), result: null })),
              };
              await plans.set(undoPlanId, undoPlan);
            }
          }
          for (const item of undoPlan.items) {
            if (item.result?.status === 'undone') continue;
            try {
              const response = await client.undo({ requestId: item.requestId, undoRequestId: item.undoRequestId });
              item.result = response.job || { requestId: item.requestId, status: 'undone' };
              await plans.set(undoPlan.planId, undoPlan);
              const completedCount = undoPlan.items.filter((entry) => entry.result).length;
              if (completedCount < undoPlan.items.length && Date.now() - startedAt >= timeBudgetMs) {
                return {
                  ok: true,
                  status: 'in_progress',
                  undoPlanId: undoPlan.planId,
                  undoneCount: completedCount,
                  pendingProjectCount: undoPlan.items.length - completedCount,
                  instruction: 'Continue com undo_visual_batch({resumeUndoPlanId: undoPlanId}).',
                };
              }
            } catch (error) {
              const completed = undoPlan.items.filter((entry) => entry.result);
              return {
                ok: false,
                status: completed.length ? 'partial' : 'failed',
                undoPlanId: undoPlan.planId,
                undoneCount: completed.length,
                undone: completed.slice(0, 20).map((entry) => entry.result),
                failed: { requestId: item.requestId, code: error.code || 'request_failed', message: error.message, cloudVersion: error.cloudVersion },
                instruction: 'Retome com undo_visual_batch({resumeUndoPlanId}). O progresso já concluído não será repetido.',
              };
            }
          }
          undoPlan.status = 'undone';
          await plans.set(undoPlan.planId, undoPlan);
          const jobs = undoPlan.items.map((item) => item.result);
          return { ok: true, status: 'undone', undoPlanId: undoPlan.planId, undoneCount: jobs.length, jobs: jobs.slice(0, 20), nextOffset: jobs.length > 20 ? 20 : null };
        }
        default:
          throw new MoontApiError(`Ferramenta desconhecida: ${name}`, { code: 'unknown_tool' });
      }
    },
  };
}
