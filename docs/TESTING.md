# Testes e evidências

Teste comportamento e persistência separadamente. Fixtures sintéticas ficam em ambiente isolado; não publique exemplos em produção para obter evidência.

## Comandos

```sh
npm ci
npx playwright install chromium webkit
npm run check
npm test
node --check public/admin.js
node --check public/i18n/admin-pt-BR.js
node --check public/i18n/admin-en-GB.js
```

Os testes de navegador precisam do Chromium do Playwright (`npx playwright install chromium`). Os harnesses públicos podem ser executados diretamente:

```sh
node tests/frontend-browser.mjs
node tests/frontend-offline.mjs
```

Leia os arquivos de teste antes de habilitar opções de integração. Suítes PostgreSQL/live têm configuração própria e são ignoradas quando não configuradas. Um teste ignorado não comprova o banco. A configuração padrão não é permissão para usar produção.

A jornada real está em `e2e/real-flow.spec.mjs`, com Chromium e WebKit. No Mac provisionado, use `BUSSOLA_SECRETS_PROFILE=qa` com `scripts/with-secrets.mjs`, gateway de QA e servidor HTTPS local (variáveis `TLS_CERT_FILE` e `TLS_KEY_FILE`). Os testes leem a chave exclusiva `mira/bussola/qa-admin-token` do Keychain.

```sh
QA_ORIGIN=https://127.0.0.1:4174 RUN_LIVE_QA=isolated-qa npm run test:e2e
# API real; NODE_EXTRA_CA_CERTS deve apontar para o certificado de teste local.
QA_ORIGIN=https://127.0.0.1:4174 RUN_LIVE_QA=isolated-qa node --test tests/live-api.mjs
# Produção: somente leituras, validação de entrada inválida e sessão; não cria lugares.
node scripts/deployed-smoke.mjs
```

Resultados integrados e limites: [RELEASE.md](RELEASE.md).

## Painel administrativo: roteiro repetível

Use banco/gateway de teste e chave **exclusiva de teste**, com captura de rede sem segredos. Não grave token, cookie ou payload de login em artefatos compartilhados.

1. Sem sessão: fila/auditoria negadas; chave incorreta sem falso sucesso. Entre manualmente e confira campo apagado.
2. Abra `/admin.html#token=…`; verifique que o fragmento foi removido **antes** do POST de login e não está em requisições, localStorage ou sessionStorage. Confira cookie HttpOnly, Secure, SameSite=Strict.
3. Teste PT-BR/en-GB em login, fila, formulário e erros. Trocar idioma não deve apagar campos.
4. Sugestão: confira notas como texto literal, possíveis duplicatas, versão, justificativa obrigatória, coordenadas e prazo inicial de 180 dias.
5. Tente publicar posição direcional sem fonte, com fonte de terceiro, sem abrangência ou sem confirmação. Nenhum caso deve ser aceito. Repita para declaração sobre clientes com posição Não mencionado.
6. Publique com fonte elegível; confirme `expected_revision`, `X-CSRF-Token`, revisão retornada e evento da auditoria. Só o servidor decide autorização; desabilitar botões não é segurança.
7. Correção: confira preenchimento a partir do estabelecimento vinculado. Exercite Manter, Suspender e Arquivar; esses payloads não devem carregar `place`. Não confunda a versão do pedido com a versão do lugar.
8. Simule conflito `409`: preserve os campos, mostre mensagem clara e bloqueie repetição até atualizar. Contribuição já decidida não pode ser submetida novamente pelo painel.
9. Simule falha de rede, `400`, `401/403`, `429`, `503`, JSON inválido e falha da releitura após POST aceito. Nunca mostre sucesso quando o resultado for incerto. Verifique a recuperação, não só a mensagem.
10. Saia: confirme sessão inválida em nova leitura, fila privada removida e ausência de dados antigos ao voltar pelo histórico. Reabra para verificar reautenticação.
11. Use teclado e larguras 360, 390, 768 e 1440 px. Confira foco visível, nomes acessíveis, campos longos e ausência de rolagem horizontal. Teste zoom e movimento reduzido.

## Evidência local do painel

Na implementação, verificações de sintaxe dos três arquivos JavaScript passaram. Um harness Chromium isolado executou **9 grupos de verificações**, usando o handler Node real para autenticação/validação e um gateway sintético em memória:

- Consumo do fragmento antes do login, ausência de token no armazenamento e atributos reais do cookie.
- Texto não confiável inerte, aviso de duplicatas e prazo de 180 dias.
- Elegibilidade de fonte, preservação de campos na tradução, coordenadas/versão/CSRF e releitura de decisão/auditoria.
- Contribuição final sem reenvio, preenchimento de correção e suspensão sem `place`.
- Conflito preservando campos e bloqueando repetição.
- POST aceito sem auditoria correspondente não tratado como sucesso.
- Ausência de overflow nas quatro larguras, com inspeção de capturas desktop/mobile.
- Logout seguido de sessão `401` e limpeza da fila.
- Login manual e falha de servidor com resultado incerto, sem apagar a justificativa.

Essa evidência **não** equivale a execução do painel contra PostgreSQL real, deployment de produção, teste de carga, auditoria completa de acessibilidade ou teste de aparelhos físicos. O harness de implementação foi temporário; o roteiro acima especifica a regressão que deve ser mantida pela suíte do projeto.

## Gates separados antes de ampliar o piloto

- Banco: permissões diretas, atomicidade, revisão concorrente, idempotência e vencimento avaliados na leitura.
- Integração: sugestão em um navegador → moderação → atualização pública em outro; suspensão/arquivo sem vazamento em detalhe, busca ou favoritos.
- Offline: nenhuma informação política antiga tratada como vigente; API/admin fora do cache; nenhum envio com confirmação falsa.
- Dispositivos: instalação/reabertura no Android Chrome e iPhone Safari. Não inferir validação física de emulação desktop.
- Operação: backup restaurado em isolamento, segredos revisados, operador definido e base pública sem fixtures.

Guarde comandos, ambiente, revisão do código, resultados e limitações junto ao relatório de cada release. Não transforme uma lista de testes planejados em declaração de aprovação.
