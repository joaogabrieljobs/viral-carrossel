#!/bin/sh
set -eu

service='br.com.viralcarrossel.moont.agent'
account='default'

if [ "$(uname -s)" != 'Darwin' ]; then
  printf 'A configuração local deste plugin requer o Chaves do macOS.\n' >&2
  exit 1
fi

case "${1:-add}" in
  add)
    printf 'Gere um token em Perfil > Integração Codex no Moont.\n'
    printf 'Cole o token no prompt seguro do Chaves abaixo. O valor não ficará no histórico do terminal.\n'
    /usr/bin/security add-generic-password -a "$account" -s "$service" -l 'Moont Codex' -U -w
    printf 'Conta conectada ao plugin Moont.\n'
    ;;
  status)
    if /usr/bin/security find-generic-password -a "$account" -s "$service" >/dev/null 2>&1; then
      printf 'Credencial Moont encontrada no Chaves.\n'
    else
      printf 'Nenhuma credencial Moont encontrada.\n'
      exit 1
    fi
    ;;
  remove)
    /usr/bin/security delete-generic-password -a "$account" -s "$service" >/dev/null
    printf 'Credencial Moont removida do Chaves.\n'
    ;;
  *)
    printf 'Uso: %s [add|status|remove]\n' "$0" >&2
    exit 2
    ;;
esac
