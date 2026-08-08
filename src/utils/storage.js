// Extraído de ViralCarrossel.jsx pelo extrator AST (scripts/extract-module.mjs).
import { Home } from 'lucide-react';

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────
// Chaves centralizadas — nunca use string literal de localStorage diretamente.
const SK = {
  library:       'vc_library',
  legacyDoc:     'vc_doc',
  activeDocId:   'vc_active_doc_id',
  brands:        'vc_brands',
  activeBrandId: 'vc_active_brand_id',
  openaiKey:     'vc_openai_key',
  /** Toggle: usuário escolheu manter chave persistida (true) ou apenas na sessão (false / ausente). */
  openaiKeyPersist: 'vc_openai_key_persist',
  /** Chave Anthropic do navegador (em local dev, vai via proxy). */
  anthropicKey:  'vc_anthropic_key',
  anthropicKeyPersist: 'vc_anthropic_key_persist',
  /** Modelo Claude preferido: 'sonnet' (default, rápido) ou 'opus' (qualidade máxima). */
  claudeModel:   'vc_claude_model',
  aiSettings:    'vc_ai_settings',
  aiKeys:        'vc_ai_keys',
  /** Biblioteca de hooks (capas) que o usuário aprovou — sugerida em novas gerações do mesmo nicho. */
  hookLibrary:   'vc_hook_library',
  onboarding:    'vc_onboarding_done',
  /** Landing cinematográfica — dispensada nesta sessão após "Entrar no studio". */
  landingDismissed: 'vc_landing_dismissed',
  /** Legado (não usar para decidir se abre a landing). */
  landingDone:   'vc_landing_done',
  shellView:     'vc_shell_view',
  /** Lista no editor: grelha de alinhamento sobre o preview (não exportada). */
  previewGrid:   'vc_preview_align_grid',
  /** Sistema de Modos (FASE 2 Narrative OS): criador (default, 90%
      dos users), diretor (intermediate), studio (avançado). Controla
      progressive disclosure global. */
  appMode:       'vc_app_mode',
  /** Onboarding dos 3 modos — primeira visita ou clique no chip "?". */
  modesIntro:    'vc_modes_intro_done',
};

/** Preferência Home vs Editor: persiste como JSON `"home"` | `"project"` */
function readInitialShellView() {
  try {
    const raw = localStorage.getItem(SK.shellView);
    if (raw != null) {
      const val = JSON.parse(raw);
      if (val === 'home' || val === 'project') return val;
    }
  } catch {
    /* ignore */
  }
  try {
    const rawLib = localStorage.getItem(SK.library);
    if (!rawLib) return 'home';
    const lib = JSON.parse(rawLib);
    if (Array.isArray(lib) && lib.length) {
      const hasNonTrivial = lib.some((e) => {
        const sl = e?.doc?.slides;
        if (!Array.isArray(sl) || sl.length !== 1) return true;
        return sl[0]?.title !== 'Seu título aqui';
      });
      if (hasNonTrivial) return 'project';
    }
  } catch {
    /* ignore */
  }
  return 'home';
}

// Evita spam de toast quando cada debounce de gravação volta a bater no limite.
let VC_QUOTA_SLIM_ALREADY_NOTIFIED = false;
let VC_QUOTA_HARD_ALREADY_NOTIFIED = false;

// lsSet retorna true em sucesso, false em falha.
// Em caso de QuotaExceededError dispara evento customizado que o App escuta para exibir toast.
const lsSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    const isQuota = err instanceof DOMException && (
      err.code === 22 || err.code === 1014 ||
      err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
    if (isQuota) {
      // Tenta salvar uma versão compacta: remove bgImage (base64) de todos os slides
      try {
        const slim = JSON.parse(JSON.stringify(value));
        if (key === 'vc_library' && Array.isArray(slim)) {
          slim.forEach(entry => {
            (entry.doc?.slides || []).forEach(s => { delete s.bgImage; });
          });
          localStorage.setItem(key, JSON.stringify(slim));
          if (!VC_QUOTA_SLIM_ALREADY_NOTIFIED) {
            VC_QUOTA_SLIM_ALREADY_NOTIFIED = true;
            window.dispatchEvent(new CustomEvent('vc:quota-warning', {
              detail: 'Limite de armazenamento quase atingido. Imagens de fundo foram omitidas do cache. Exporte seus projetos como JSON para não perder dados.',
            }));
          }
          return true;
        }
      } catch { /* fallback falhou também */ }
      if (!VC_QUOTA_HARD_ALREADY_NOTIFIED) {
        VC_QUOTA_HARD_ALREADY_NOTIFIED = true;
        window.dispatchEvent(new CustomEvent('vc:quota-exceeded', {
          detail: 'Limite de armazenamento do browser atingido. Exporte seus projetos como JSON antes que dados sejam perdidos.',
        }));
      }
    }
    return false;
  }
};

export {
  SK,
  readInitialShellView,
  VC_QUOTA_SLIM_ALREADY_NOTIFIED,
  VC_QUOTA_HARD_ALREADY_NOTIFIED,
  lsSet,
};
