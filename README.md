# Viral Carrossel — Gerador de Carrosséis Virais com IA

Gerador profissional de carrosséis para Instagram com IA integrada.

## Skills do agente (Cursor)

Skills em `.agents/skills/` são registadas em `.cursor/rules/skills-bridge.mdc` (sempre aplicadas ao agente).

| Skill | Ficheiro | Uso |
| ----- | -------- | --- |
| **polish** | `.agents/skills/polish/SKILL.md` | Pass final de UI (alinhamento, tipografia, estados, responsivo). |
| **carrossel-cultura** | `.agents/skills/carrossel-cultura/SKILL.md` | Formato editorial **Tendência/Cultura** (brandsdecoded): validação de tema, triagem, headlines, arco de slides; alinha com o preset `tendencia_cultura` em `ViralCarrossel.jsx`. Ver também `html-template.md` na mesma pasta para HTML estático / export fora da app. |

Cópia legada fora desta árvore: `../SKILL coded carroceis .md` (pasta parental do clone). A versão mantida para o Cursor é **carrossel-cultura** em `.agents/skills/`.

## Como usar

### Opção 1: Claude.ai (Artifact)

1. Abra o Claude.ai
2. Cole o conteúdo de `ViralCarrossel.jsx` num artifact React
3. Use direto no browser

### Opção 2: Rodar localmente com Vite

O projeto já vem pronto com `index.html`, `vite.config.js`, `src/main.jsx` e proxy de API.

```bash
npm install
npm run dev
# abre em http://localhost:5173
```

#### Configurando as chaves de IA (modo local)

Como o navegador bloqueia chamada direta para `api.anthropic.com` e `api.openai.com` (CORS), o `vite.config.js` proxia as requisições adicionando os headers de autenticação no servidor.

**Você só precisa de UMA das duas chaves**:


| Provider  | Como configurar                                                                                             | O que habilita                                               |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| OpenAI    | Cole a chave `sk-proj-...` no app via ⚙ no header (fica no localStorage do navegador)                       | Geração de texto via `gpt-4o` + GPT Image / DALL·E (imagens) |
| Anthropic | Crie `.env.local` na raiz com `ANTHROPIC_API_KEY=sk-ant-...` e reinicie `npm run dev` (veja `.env.example`) | Geração via Claude + **pesquisa de nicho** com `web_search`  |


Se você tem a chave Anthropic configurada, ela é usada por padrão (qualidade premium para o tom editorial). Sem ela, o app usa `gpt-4o` da OpenAI automaticamente para a geração de texto.

A pesquisa de nicho com tendências da web ao vivo só funciona com a chave Anthropic, porque depende da feature `web_search` do Claude.

## Funcionalidades

### Geração & estratégia

- **Gerador IA**: gera carrossel inteiro (gancho + slides + legenda) com um tema
- **Pesquisa de nicho**: busca tendências reais na web ao vivo (web_search)
- **Templates prontos**: 4 carrosséis arquetípicos (Erro Comum, Tendência, Decodificação de Marca, Mudança de Comportamento) — clique e preencha
- **Variações de gancho**: gera 5 alternativas de tese contraintuitiva pra escolher a melhor
- **Refinar slide individual**: instrução livre + presets ("mais direto", "tom técnico", etc)
- **Refinar TODOS os slides**: aplica uma instrução ao carrossel inteiro mantendo coerência narrativa

### Editor

- **Visual completo**: título, subtítulo, imagem de fundo, layout 3×3, tipografia, cores
- **Imagens**: **Web trend** — em desenvolvimento: servidor tenta **Unsplash** ou **Pexels** se você configurar chaves em `.env.local`; senão **Wikimedia Commons**. A query combina título do slide, hints temáticos (ex.: IA→data center) e `imageQuery` da IA · **GPT Image** (OpenAI, com chave)
- **Encaixe da foto**: cobrir o cartão (padrão novo), ver imagem inteira, ou zoom manual (%)
- **Identidade visual**: 8 paletas prontas, 8 fontes de título, 4 fontes de corpo, @handle
- **Reordenação por drag-and-drop**: arraste as miniaturas dos slides

### Histórico & persistência

- **Undo / Redo** com `⌘Z` / `⌘⇧Z` (mudanças próximas são agrupadas)
- **Autosave em localStorage**: seu carrossel não se perde ao recarregar
- **Toasts não-bloqueantes**: feedback claro de sucesso e erro

### Atalhos de teclado

- `⌘Z` / `⌘⇧Z` — desfazer / refazer
- `⌘D` — duplicar slide
- `⌘E` / `⌘S` — exportar slide / todos
- `←` `→` — navegar slides
- `N` — novo slide
- `Del` — apagar slide
- `?` — abrir ajuda

### Export

- **PNG**: slide individual ou batch dos N slides
- **PDF**: todos os slides em um único arquivo (multipage, dimensões reais)
- **Mobile-first**: drawer bottom-sheet, navegação por slides, barra inferior

## Requisitos

- React 18+
- lucide-react
- Tailwind CSS (via CDN ou instalado)
- Google Fonts (carregado automaticamente)
- html2canvas (carregado automaticamente via CDN, sob demanda)
- jsPDF (carregado automaticamente via CDN, sob demanda — só baixa quando você exporta PDF)

## Modelos de IA

Usa `claude-sonnet-4-6` via Anthropic API (autenticado automaticamente no Claude.ai).

## Formatos suportados


| Formato  | Dimensões | Uso              |
| -------- | --------- | ---------------- |
| Feed 4:5 | 1080×1350 | Carrossel padrão |
| Quadrado | 1080×1080 | Feed quadrado    |
| Stories  | 1080×1920 | Stories/Reels    |


