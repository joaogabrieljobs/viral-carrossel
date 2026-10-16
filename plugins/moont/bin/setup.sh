#!/bin/sh
set -eu

service='br.com.viralcarrossel.moont.agent'
account='default'

if [ -n "${MOONT_TOKEN:-}" ]; then
  printf 'MOONT_TOKEN está definido. O plugin usa essa variável e não grava a chave no Chaves.\n'
  printf 'Reinicie o Codex neste terminal para a variável valer.\n'
  exit 0
fi

if [ "$(uname -s)" != 'Darwin' ]; then
  printf 'Fora do macOS, exporte a chave criada em Perfil → Integração Codex:\n' >&2
  printf '  export MOONT_TOKEN="cole-a-chave"\n' >&2
  printf 'O plugin lê essa variável. O Chaves do macOS é opcional.\n' >&2
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
