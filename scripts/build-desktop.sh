#!/usr/bin/env bash
# App desktop do Moont (Tauri 2): portão de build. A janela carrega a origem de
# PRODUÇÃO (https://moont.ai); não há export do web nem servidor
# embarcado, então o que entra no binário é só o crate em desktop/src-tauri.
#
# Uso (a partir da raiz do repositório):
#   npm run desktop:build        # portão + tauri build (.app e .dmg)
#   npm run desktop:dev          # portão rápido + tauri dev (janela de desenvolvimento)
#   ./scripts/build-desktop.sh --so-conferir   # só as conferências, sem compilar
#
# Portão: árvore do desktop limpa (ou MOONT_DESKTOP_PERMITIR_SUJO=1, que marca
# "sujo": true no version.json), varredura de segredo no crate e origem de
# produção no código, version.json com commit/branch/data/versão/canal (antes
# da suíte: o tauri-build exige o recurso na compilação), suíte vitest inteira
# + cargo test, tauri-cli instalado com lockfile congelado, tauri build.
set -euo pipefail

MODO="build"
for arg in "$@"; do
  case "$arg" in
    --so-conferir) MODO="conferir" ;;
    --dev) MODO="dev" ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Argumento desconhecido: $arg" >&2; exit 1 ;;
  esac
done

etapa() { printf "\n\033[1m━━━ %s ━━━\033[0m\n" "$1"; }
ok()    { printf "\033[32m✓\033[0m %s\n" "$1"; }
falha() { printf "\033[31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

cd "$(dirname "$0")/.."
[ -f package.json ] && [ -d desktop/src-tauri ] || falha "rode a partir da raiz do Moont (não achei desktop/src-tauri)"
ORIGEM="https://moont.ai"
CRATE="desktop/src-tauri"
VERSION_JSON="$CRATE/resources/version.json"

# rustup via Homebrew fica keg-only (fora do PATH).
if ! command -v cargo >/dev/null 2>&1; then
  for d in /opt/homebrew/opt/rustup/bin "$HOME/.cargo/bin"; do
    [ -x "$d/cargo" ] && export PATH="$d:$PATH" && break
  done
fi
command -v cargo >/dev/null 2>&1 || falha "cargo não encontrado. Instale Rust: brew install rustup && rustup default stable"

etapa "0/5 — Árvore"
# Só o que vai para o binário conta: o crate, o portão e os testes dele. O
# resto do monorepo (web, docs de outras sessões) não entra no .app, porque a
# janela carrega a produção; exigir o repositório inteiro limpo travaria o
# build por trabalho que não tem nada a ver com ele.
SUJO=false
PENDENTE=$(git status --porcelain -- desktop scripts/build-desktop.sh tests/unit/desktop-tauri.test.js | grep -v '/version.json' || true)
if [ -n "$PENDENTE" ]; then
  if [ "${MOONT_DESKTOP_PERMITIR_SUJO:-0}" = "1" ]; then
    SUJO=true
    printf "\033[33m! desktop/ com mudança não commitada (liberado por MOONT_DESKTOP_PERMITIR_SUJO=1)\033[0m\n"
  else
    echo "$PENDENTE" | head -10
    falha "Há mudança não commitada em desktop/ (ou no portão). Commite antes, ou MOONT_DESKTOP_PERMITIR_SUJO=1 para teste local."
  fi
fi
COMMIT=$(git rev-parse HEAD)
COMMIT_CURTO=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
VERSAO=$(node -p 'require("./package.json").version')
[ -n "$VERSAO" ] || falha "não achei version em package.json"
ok "commit ${COMMIT_CURTO} (${BRANCH}) · versão ${VERSAO}"

etapa "1/5 — Conferências do crate"
SEGREDOS=$(grep -rIlE 'sb_secret_|service_role|sk_live_|whsec_|PRIVATE KEY|SUPABASE_SERVICE_ROLE|SJINN_API_KEY=' "$CRATE/src" "$CRATE/tauri.conf.json" "$CRATE/capabilities" "$CRATE/Cargo.toml" || true)
if [ -n "$SEGREDOS" ]; then
  echo "$SEGREDOS" >&2
  falha "Possível segredo no crate — nada foi compilado."
fi
ok "nenhum padrão de segredo no crate"
grep -q "pub const ORIGEM: &str = \"${ORIGEM}\";" "$CRATE/src/origem.rs" || falha "origem.rs não aponta para ${ORIGEM}"
grep -q "\"frontendDist\": \"../placeholder\"" "$CRATE/tauri.conf.json" || falha "tauri.conf.json sem o placeholder como frontendDist"
grep -q '"permissions": \[\]' "$CRATE/capabilities/default.json" || falha "capability com permissão: nenhuma API do Tauri pode chegar à página"
ok "origem ${ORIGEM}, placeholder e capability vazia"

etapa "2/5 — version.json"
# Antes da suíte: o tauri-build confere `bundle.resources` já na compilação,
# então `cargo test` falha se o arquivo não existir (achado no worktree limpo
# de 29/10/2026; build.rs grava um placeholder para clone sem portão).
mkdir -p "$CRATE/resources"
printf '{"commit":"%s","commitCurto":"%s","branch":"%s","geradoEm":"%s","canal":"desktop","versao":"%s","origem":"%s","sujo":%s}\n' \
  "$COMMIT" "$COMMIT_CURTO" "$BRANCH" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$VERSAO" "$ORIGEM" "$SUJO" > "$VERSION_JSON"
ok "$VERSION_JSON"

etapa "3/5 — Suíte do projeto e cargo test"
if [ "$MODO" = "dev" ]; then
  npx vitest run tests/unit/desktop-tauri.test.js || falha "teste de invariantes do desktop vermelho"
else
  npm test || falha "vitest vermelho"
fi
(cd "$CRATE" && cargo test --quiet) || falha "cargo test vermelho"
ok "suíte verde"

[ "$MODO" = "conferir" ] && { printf "\nConferências ok. Para compilar: npm run desktop:build\n"; exit 0; }

etapa "4/5 — Dependências do Tauri"
npm --prefix desktop ci --no-audit --no-fund >/dev/null
ok "cargo $(cargo --version | awk '{print $2}') · tauri-cli $(cd desktop && npx tauri --version | awk '{print $2}')"

if [ "$MODO" = "dev" ]; then
  etapa "5/5 — tauri dev"
  cd desktop && exec npx tauri dev --config "{\"version\":\"${VERSAO}\"}"
fi

etapa "5/5 — tauri build (versão ${VERSAO})"
(cd desktop && npx tauri build --config "{\"version\":\"${VERSAO}\"}") || falha "tauri build falhou"
BUNDLE="$CRATE/target/release/bundle"
printf "\n\033[32mBuild pronto.\033[0m\n"
ls -d "$BUNDLE"/macos/*.app "$BUNDLE"/dmg/*.dmg 2>/dev/null || true
if [ "$SUJO" = true ]; then
  printf "\033[33m! build de árvore suja (version.json sujo=true): só para teste local, não distribua.\033[0m\n"
fi
printf "Sem assinatura Developer ID/notarização: o Gatekeeper pede clique direito → Abrir. Ver docs/DESKTOP-TAURI.md.\n"
