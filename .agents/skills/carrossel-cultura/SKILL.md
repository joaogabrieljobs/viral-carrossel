---
name: carrossel-cultura
description: Carrossel editorial estilo Tendência/Cultura (brandsdecoded). Valida tema como fenómeno já percebido — não dica solta; triagem, 8 headlines, arco 9 slides, HTML estático ou alinhamento com ViralCarrossel.jsx. Use quando o utilizador pedir Tendência/Cultura, pacote criativo cultura, brandsdecoded, carrossel editorial viral, slides Instagram cultura, fenómeno cultural, triagem editorial, arco S1–S9, ou alinhar copy/prompts ao preset tendencia_cultura.
user-invocable: true
argument-hint: "[nicho ou tema]"
---

# Carrossel Viral / Tendência Cultura — Sistema Editorial (brandsdecoded)

Replica o sistema **narrativo** deste formato. A referência visual da **app** está em `DESIGN.md` e `ViralCarrossel.jsx` (preset `tendencia_cultura`), não obrigatoriamente Playfair/Inter do fluxo HTML estático.

**Antes de gerar código ou copy**, ler também `html-template.md` **nesta pasta** (`.agents/skills/carrossel-cultura/html-template.md`) para checklist de slides estáticos.

**Integração com o repositório**

- Preset da app: `creativePreset === 'tendencia_cultura'` em `ViralCarrossel.jsx` (`buildGenerationSlideLayoutRules`, `buildTendenciaCulturaRefineSlideHint`, `attachGenerationCanvasLayouts`, layout sanduíche/`bodyAfterImage`, etc.).
- Documento legado (cópia fora do skill bridge): `../SKILL coded carroceis .md` na pasta pai do repo. A versão **oficial** para o agente Cursor é `.agents/skills/carrossel-cultura/SKILL.md`.

---

## Fundação Estratégica — O Que Faz um Carrossel Viralizar

**Este formato NÃO é:**

- Post de dicas soltas
- Conteúdo que só explica um conceito novo

**Este formato É:**

- Carrossel de **tendência e cultura** que organiza o que o público **já estava a sentir** — e dá nome.

**Gatilhos:** identificação, alívio, autoridade (ver copy original na raiz do doc legado se precisar de parágrafos longos de contexto).

**Teste do tema**

- O público **já sente** o fenómeno no quotidiano?
- O texto **nomeia e organiza** a percepção, em vez de palestra?
- Se for só tutorial/conceito → pedir pivot de ângulo.

---

## Fase 1 — Coleta de Inputs

Completar só o que faltar (argumento ou contexto do chat):

1. Marca — nome e @ Instagram  
2. Subtítulo do header (ex.: powered by…)  
3. Nicho  
4. Cor principal (hex ou 3 sugestões)  
5. Tipo: A) Tendência interpretada B) Tese contraintuitiva C) Case/benchmark D) Previsão/futuro  
6. CTA último slide  
7. Número de slides (padrão 9, máx. 12)  
8. Collab? (@ segundo handle)  
9. Fotos disponíveis?  

---

## Fase 2 — Triagem Editorial

Validar tema (teste acima). Depois:

- Triagem 3–4 linhas: fenómeno em curso, tensão, o que se vai nomear.  
- `Categoria · Funil: Topo / Meio / Fundo`  
- **8 headlines** (tabela) — tom “finalmente alguém disse isto”, usando os padrões de frase da versão longa (substantivo+muda, nova obsessão, grupo está a…, etc.).  
- Capa: branco + linha-chave em cor de marca.  
- **Pedir aprovação** antes do arco completo quando o utilizador quiser gate manual.

---

## Fase 3 — Arco Narrativo (9 slides — adaptar N se 6–12)

Cada slide = **um** parágrafo editorial; **primeira frase = gancho**; sem títulos separados.

| Slide | Papel | Notas |
|-------|--------|--------|
| S1 | Capa | Full-bleed foto; header; headline misto |
| S2 | Contexto | BG claro; accent forte; imagem |
| S3 | Mecanismo | BG escuro; denso |
| S4 | Dissonância | Claro; accent desconforto |
| S5 | Limite | Escuro |
| S6 | Stat | **Cor marca; sem imagem; sem accent** |
| S7 | Mecanismo duplo | Escuro; contraste A/B |
| S8 | Reframe | Claro; pesquisa/reframe |
| S9 | Meta-pergunta | CTA orgânico última linha |

**Fundos:** claro = evidência externa; escuro = mecanismo/psique; marca só S6 típico; accent ≤1 frase/slide.

---

## Fase 4 — HTML ou app

- **HTML estático:** seguir `html-template.md` nesta pasta.  
- **App React:** gerar/refinar JSON/slides coerentes com `tendencia_cultura` (título, subtítulo, `bodyAfterImage` onde aplicável, `imageQuery`, tons cultura) e não contradizer `buildGenerationSlideLayoutRules` no ficheiro principal.

**Checklist:** header em todos; S6 sem imagem/accent; accent S2/S4/S8 mínimo; contraste pill; texto escuro ≠ branco puro.

---

## Fase 5 — Exportação (só fluxo HTML + Puppeteer)

Ver `html-template.md`. Caminhos `/home/claude/...` são exemplos Claude Code — adaptar ao ambiente local.

---

## Fase 6 — Legenda

P1: insight como algo que o leitor já sentia; jornalístico, sem emoji.  
P2: pergunta de identificação + CTA.  
Hashtags 5–8 nicho.

---

## Critical Rules (resumo)

1. Validar tema (fenómeno real, não dica solta)  
2. Três gatilhos: identificação, alívio, autoridade  
3. Header + pill em todos  
4. Sem título separado do parágrafo — gancho na primeira frase  
5. S6 especial (marca, sem imagem/accent)  
6. Fundo escuro: texto creme, não branco puro  

---

## Tipos × fenómeno

| Tipo | Origem | Gatilho | Funil |
|------|--------|---------|--------|
| Tendência interpretada | Comportamento notado | Identificação | Topo |
| Tese contraintuitiva | Polémica/mercado | Alívio + autoridade | Topo/meio |
| Case/benchmark | Cultura em curso | Autoridade | Meio |
| Previsão/futuro | Mudança sentida | Autoridade | Topo |

Se sem argumentos: perguntar nicho e **que fenómeno o público já percebe**.
