import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const FORBIDDEN_VISIBLE_COPY = {
  'src/components/Paywall.jsx': ['para aceder'],
  'src/components/AccountHomeShell.jsx': ["cta: 'Guardar'"],
  'src/components/BrandsModal.jsx': ['Guardar a marca'],
  'src/components/CreateProjectFlow.jsx': ['guardar esta marca'],
  'src/components/KeysModal.jsx': ['active abaixo a sua própria chave', 'a tua conta', 'o teu plano'],
  'src/components/OnboardingLanding.jsx': ['seguir o seu pedido', 'login activo', 'noutro browser', 'mais controlos'],
  'ViralCarrossel.jsx': ['Não foi possível guardar a imagem'],
  'src/components/SidebarContent.jsx': ['mais controlos', 'do seleccionado', 'projeto guardado na marca'],
  'src/components/landing/ProjectWorkflowShowcase.jsx': ['seguir o seu pedido'],
  'src/components/panels/BrandTonePanel.jsx': ['Tom da marca guardado', 'antes de guardar', 'Guardar tom da marca', 'tente de novo'],
  'src/components/panels/BrandWorkspacePanel.jsx': ['Contexto da marca guardado', 'Guardar contexto da marca'],
  'src/components/panels/CriarRapidoHome.jsx': ['use um ficheiro maior'],
  'src/components/panels/ElementsPanel.jsx': ['do seleccionado'],
  'src/components/panels/ImagesLibraryPanel.jsx': ['Está a usar', 'A preparar', 'imagem guardada', 'imagens guardadas', 'O seu plano', 'num card'],
  'src/components/panels/PublicationResultsModal.jsx': ['permanece guardado', 'será guardada', 'O que o seu histórico'],
  'src/components/panels/SeriesPanel.jsx': ['Tente de novo'],
  'src/components/panels/SlideLogoPanel.jsx': ['ficheiro maior'],
  'src/hooks/useAccess.js': ['Tente de novo'],
  'src/hooks/useLibrary.js': ['no ficheiro'],
  'src/LegalPage.jsx': ['Os seus pedidos', 'A sua conta', 'gerar e guardar as peças', 'num cookie', 'num armazenamento'],
  'src/utils/ai-client.js': ['demorou demasiado', 'está a correr', 'ligação à internet', 'Tenta de novo', 'Espera um momento', 'tente de novo'],
  'src/utils/create-project-flow.js': ['conforme o seu briefing'],
  'src/utils/design-data.js': ['A sua página com', 'nomear o seu'],
  'src/utils/generation-prompts.js': ['convite a partilhar experiência', 'TEMA do utilizador', 'frase para guardar ou mandar'],
  'src/utils/image-store.js': ['antes de guardar a imagem'],
  'src/utils/library-sync.js': ['sync demasiado grande', 'Verifique a ligação', 'tente de novo', 'assinatura activa'],
  'src/utils/project-share.js': ['Falha na partilha', 'para partilhar', 'Não foi possível partilhar', 'Partilha indisponível', 'demasiado grande', 'tente de novo'],
  'src/utils/slide-reference.js': ['Não foi possível guardar a referência'],
  'src/utils/storage.js': ['tentar guardar as alterações'],
  'src/utils/video-store.js': ['antes de guardar o vídeo'],
  'api/anthropic/v1/messages.js': ['demorou demasiado', 'Tente de novo'],
  'api/ai/compatible.js': ['demasiado longo', 'demorou demasiado', 'Tente de novo'],
  'api/lib/sjinn.js': ['demorou demasiado', 'Tente de novo'],
};

describe('cópia visível em português brasileiro', () => {
  for (const [file, phrases] of Object.entries(FORBIDDEN_VISIBLE_COPY)) {
    it(`${file} não reintroduz termos PT-PT já corrigidos`, () => {
      const contents = source(file).toLocaleLowerCase('pt-BR');
      for (const phrase of phrases) expect(contents).not.toContain(phrase.toLocaleLowerCase('pt-BR'));
    });
  }
});
