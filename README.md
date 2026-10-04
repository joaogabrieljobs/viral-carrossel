# Viral. Carrossel Studio

Studio para criar, editar e exportar carrosséis para Instagram com IA, contexto por projeto e controle sobre texto e imagem.

**Produção:** [viralcarrossel.com.br](https://viralcarrossel.com.br) · Vite + React 18 · API serverless na Vercel.

## Criar no studio

1. Abra um projeto e vá a **Narrativa → Usar contexto da marca**. Salve um nome para o contexto, brief, estilo visual, até quatro referências e, se quiser, uma logo PNG transparente.
2. Em **Prompt para gerar**, diga o que criar e quantos cards deseja. Escolha **Só texto** ou **Texto e imagens** e um modo narrativo, incluindo **Nenhum**.
3. Refine o card ou use **Refazer com tom alternativo**. Selecione um dos oito tons, escolha o escopo e confirme. O remix só de texto mantém imagens, fontes, cores e composição.
4. Para reutilizar a logo, selecione o card e abra **Editar Card → Aplicar logo do projeto neste card**. Ajuste tamanho e posição. O upload para o projeto não aplica a logo em todos os cards.
5. Exporte em PNG ou PDF. Faça também um **backup JSON** pela biblioteca para preservar o projeto editável e seus arquivos.

**Cancelar geração** fica disponível durante os trabalhos de IA, mesmo ao trocar de aba. O que já ficou pronto permanece. Uma imagem já enviada ao provedor ainda pode consumir crédito.

Guia completo: [Projetos, contexto e geração](docs/product/guia-projetos-geracao.md).

## Recursos atuais

- Brief separado da matéria-prima do post, estilo e referências por projeto; aviso **Contexto ON** no topo.
- Oito modos narrativos e opção **Nenhum**; presets criativos e densidade de texto.
- Geração de slides e legenda, revisão editorial, cinco variações de gancho e refinamento de um ou de todos os cards.
- Oito tons de remix: Analítico, Provocador, Leve, Didático, Inspirador, Acolhedor, Técnico e Comercial.
- Pesquisa de nicho: web ao vivo com chave Anthropic; sem essa chave, hipóteses de pauta identificadas como tal.
- Identidade de marca, padrões visuais, layout, fontes, paleta e logo PNG reutilizável por card.
- Editor responsivo, histórico de alterações, biblioteca de projetos e exportação.
- Login por e-mail/senha ou Google, mostrar/ocultar senha e recuperação por link via Resend.

Os modos de interface **Criador, Diretor e Studio** controlam a quantidade de ferramentas visíveis. São distintos dos **modos narrativos**, que orientam a estrutura do conteúdo.

## Planos e IA

Valores e saldo de imagens vêm de [`shared/plans.js`](shared/plans.js), compartilhado entre app, landing e servidor.

| Plano | Mensalidade | Imagens de IA inclusas por ciclo mensal |
| --- | --- | --- |
| Essencial | R$ 19,90 | 0 |
| Criador | R$ 97 | 50 |
| Pro | R$ 197 | 150 |
| Max | R$ 297 | 300 |

Todos incluem o editor e texto com IA pela plataforma. Imagens inclusas usam o serviço do plano; imagens próprias podem ser importadas. Chaves próprias de IA são opcionais e seu consumo é cobrado pelo provedor. As opções e modelos disponíveis estão em [`src/config/ai-providers.js`](src/config/ai-providers.js).

## Persistência e backup

- O documento e a biblioteca ficam no `localStorage`; bytes de imagens, referências e logos de projeto/cards ficam no `IndexedDB`.
- O contexto é isolado por projeto. O perfil global de marca e o material do post são conceitos diferentes.
- Não há sincronização automática de projetos entre aparelhos. Use exportação/importação JSON para transferir o projeto com seus arquivos.
- Não limpe os dados do navegador sem um backup. PNG/PDF são arquivos para publicação, não substituem o backup editável.

## Desenvolvimento local

Execute os comandos na raiz **aninhada do app**: `/Users/elevessy/Documents/viral-carrossel/viral-carrossel`.

```bash
npm install
npm run dev
```

O Vite serve a interface em `http://localhost:5173`. Para rotas serverless de autenticação/assinatura, use o ambiente Vercel; `vercel dev` executa essas rotas localmente. As variáveis estão descritas em `.env.example` e [configuração de acesso/planos](docs/STRIPE.md). Não versione `.env.local` nem exponha segredos de servidor com prefixo `VITE_`.

O app usa imports de `src/`, dependências npm e rotas `api/`; copiar apenas `ViralCarrossel.jsx` para um artifact não reproduz o produto.

## Validação e publicação

```bash
npm test                 # identificadores, props, unitários e integração
npm run test:e2e         # Playwright; APIs simuladas, sem créditos pagos
npm run build
```

O push para `main` aciona CI e deploy Vercel. Só considerar a publicação concluída depois dos jobs **test** e **e2e** aprovados e do domínio oficial apontar para a versão pronta.

Base publicada em 28/09/2026: `d2043b6`, **343 testes de código + 66 testes de navegador**. Contagens registram essa versão; a suíte pode crescer.

## Formatos e atalhos

| Formato | Dimensões |
| --- | --- |
| Feed 4:5 | 1080 × 1350 |
| Quadrado | 1080 × 1080 |
| Stories | 1080 × 1920 |

`⌘/Ctrl+S` salva o projeto; `⌘/Ctrl+E` exporta o card; `⌘/Ctrl+Z` desfaz; `⌘/Ctrl+⇧Z` refaz. Setas navegam, `N` adiciona card e `?` abre a ajuda quando o foco não está em um campo de texto.

## Documentação

- [Guia de projetos e geração](docs/product/guia-projetos-geracao.md)
- [Organização por pastas e calendário editorial](docs/product/organizacao-calendario.md)
- [Controles de geração e logo: contratos e testes](docs/engineering/controles-geracao-projeto.md)
- [Copy da landing](docs/LANDING-COPY.md)
- [Revisão editorial dos prompts](docs/revisao-prompts-texto.md)
- [Revisão do kit por projeto — caso MUSA](docs/revisao-style-kit-musa.md)
- [Referências de imagem do plano](docs/engineering/referencias-imagem-plano.md)
- [Recuperação de senha](docs/engineering/recuperacao-senha.md)
- [Objetivos editoriais](docs/product/geracao-editorial-por-objetivo.md) e [registro de resultados](docs/product/resultados-editoriais.md)
- [Design dos slides](docs/SLIDE-DESIGN.md)
- [PRD](docs/product/PRD-suite-testes-confianca.md) e [TDD](docs/engineering/TDD-suite-testes-confianca.md) da suíte de confiança

Auditorias datadas descrevem a versão examinada na época; não substituem o código atual nem os contratos acima. As skills locais de apoio ficam em `.agents/skills/`, incluindo `carrossel-cultura` e `polish`.
