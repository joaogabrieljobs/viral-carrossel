---
name: moont-setup
description: Conecta a conta Moont ao plugin local do Codex usando um token guardado no Chaves do macOS.
---

# Conectar Moont ao Codex

1. Oriente a pessoa a abrir **Perfil → Integração Codex** no Moont, gerar um token de leitura e escrita e copiá-lo. Não peça que cole o token na conversa.
2. Execute `sh "${PLUGIN_ROOT}/bin/setup.sh" add` em um terminal interativo do Mac. O próprio Chaves pedirá o token sem mostrá-lo nem incluí-lo no histórico.
3. Verifique com `sh "${PLUGIN_ROOT}/bin/setup.sh" status`, que só informa se há credencial, e use `get_visual_schema` para confirmar a conexão. Nunca mostre a credencial, execute `security ... -w` para lê-la em conversa, nem a grave em arquivos.
4. Se o plugin acabou de ser instalado, o Codex pode exigir reinicialização para registrar as ferramentas MCP.
