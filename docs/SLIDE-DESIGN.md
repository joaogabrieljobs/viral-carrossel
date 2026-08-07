# Design system de slides (Instagram)

Documento de qualidade dos **cards exportados** — separado do chrome da app (`DESIGN.md` / Figma).

Código: `src/utils/slide-design-system.js`, templates em `src/utils/design-data.js`, renderer em `ViralCarrossel.jsx`.

## Princípios

1. **Uma ideia por slide** — hook em ≤2s na capa.
2. **Máx. 2 famílias tipográficas** — preferir pairings curados.
3. **Corpo ≥24px @1080** — AutoFit/Overflow floor `0.85`.
4. **Fundos escuros** — tinta creme `#F2EDE4`, nunca branco puro no body.
5. **Safe zones** — Feed/Stories: margem 8%; topo 12–14%; Stories bottom 18%.
6. **Arco** — hook → stake → setup → payoff → CTA (7–9 slides nos templates).

## Pairings (UI Marca → Texto)

| ID | Título | Corpo | Uso |
|----|--------|-------|-----|
| `editorial_cultura` | Instrument Serif | Inter Tight | Tendência/Cultura |
| `autoridade_b2b` | Outfit | Inter | Erro comum / case |
| `hype_escuro` | Syne | DM Sans | Viral / promo |
| `magazine_cream` | Fraunces | Source Sans 3 | Decodificação |
| `minimal_clean` | Inter Tight | Inter Tight | How-to |

## Composições (`composition`)

| ID | Canvas | Papel |
|----|--------|-------|
| `hook_fullbleed` | classic cover | Capa |
| `sandwich_editorial` | sandwich | Mecanismo |
| `stat_proof` | stat | Prova / número |
| `split_ab` | classic | Contraste |
| `quote_pull` | classic | Autoridade |
| `list_beat` | classic | Framework |
| `reveal_bridge` | classic + edge peek | Swipe |
| `cta_close` | classic cover | Fecho (sem cue →) |

## Escala tipográfica (@1080)

| Papel | titleSize % | Notas |
|-------|-------------|--------|
| hook | 78 | ~70px sobre base 0.084·w |
| sandwich / miolo | 48–52 | Hierarquia mobile |
| stat | 145 | Número dominante |
| cta | 68 | Fecho legível |

## Acabamento

- Foto inset / sanduíche: `box-shadow: var(--shadow-product)`.
- Overlay default por composition (capa ~62, sandwich 0).
- Cue → nos slides não-finais (`showSwipeCue`).
- Visual presets podem sugerir `creativePreset` (pele + arco).

## Checklist rápido

- [ ] Capa com 1 promessa específica  
- [ ] Pairing tipográfico (não 4 fontes misturadas)  
- [ ] Contraste OK no dark (creme)  
- [ ] Margens ≥8%  
- [ ] CTA no último slide  
- [ ] Foto com propósito (ou slide stat sem foto)  
