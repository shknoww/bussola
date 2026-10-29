# Moderação do piloto

A base começa vazia. Um painel funcional não substitui operador, curadoria ou avaliação jurídica. O proprietário deve definir quem acompanha a fila; o piloto tem acesso administrativo único, não contas individuais de equipe. Não há prazo de atendimento garantido.

## Entrar e escolher um registro

1. Abra `/admin.html` pela origem correta. Use a chave do proprietário ou o link gerado localmente por `npm run admin:link`. Não compartilhe a chave/link.
2. Escolha Sugestões, Correções ou Estabelecimentos. A fila pode ser filtrada por status e é exibida dos mais antigos para os mais recentes.
3. Leia observações, versão e possíveis duplicatas. Os IDs indicados como duplicatas são pistas, não uma autorização para mesclar. Não publique outro cadastro antes de conferir nome, endereço e unidade.
4. Em correções, confira o estabelecimento vinculado. O formulário usa os dados comerciais atuais, mas a decisão continua vinculada à versão do pedido.

## Antes de publicar

- Confirme que é um estabelecimento físico identificável, com endereço comercial e coordenadas corretas. Não publique endereço residencial nem perfil político de pessoa física. Latitude e longitude não são geocodificadas automaticamente pelo painel.
- Confira unidade, cidade, estado/região e duplicidade. Redes não recebem uma classificação única por associação.
- Abra a fonte HTTPS original. Confirme autoria, vínculo com o negócio, conteúdo e abrangência da unidade. Não confunda opinião pessoal de funcionário/proprietário com declaração institucional.
- **Direita/Esquerda** exigem autodeclaração elegível; não deduza posição por clientes, bairro, aparência, seguidores, silêncio, crítica a um lado ou apoio partidário sem regra editorial específica.
- Print isolado ou lista de terceiros pode motivar investigação, mas não sustenta classificação pública. O formulário permite registrar tipo de fonte; uma fonte de terceiro não é elegível para publicação direcional ou declaração sobre clientes.
- **Não mencionado** significa ausência de classificação vigente; não significa centro, neutralidade ou ausência de opinião. Não exige uma fonte política artificial.
- Declaração sobre clientes é um campo factual separado: não transforme uma frase em conclusão de crime, recusa de atendimento ou discriminação comprovada.
- Deixe a data original em branco quando desconhecida. Nunca a substitua pela data de captura. As datas do formulário usam o horário local do navegador.
- Marque a confirmação de fonte apenas depois de verificá-la novamente. O painel nunca pré-marca uma confirmação antiga.

## Decidir

| Decisão | Efeito pretendido |
|---|---|
| Publicar / atualizar | Envia o cadastro revisado; exige coordenadas e, quando aplicável, fonte direta verificada, abrangência e validade |
| Rejeitar | Rejeita a contribuição, sem publicar os campos |
| Pedir complemento | Marca a contribuição como aguardando informação; não envia e-mail nem mensagem neste piloto |
| Suspender classificação | Retira a classificação vigente, mantendo o cadastro comercial |
| Arquivar estabelecimento | Retira o estabelecimento da consulta pública |
| Manter decisão atual | Registra a justificativa sem alterar conteúdo nem renovar a verificação |

Toda decisão exige justificativa privada e versão esperada. O formulário de publicação propõe revisão em **180 dias a partir da abertura do registro**. Ajuste conforme a evidência; publicar uma atualização inicia uma nova revisão. Suspensão ou vencimento não devem aparecer como posição vigente. Para mudar um lugar de contribuição já decidida, use a aba Estabelecimentos.

## Conflitos e falhas

- `409`: outra decisão mudou a versão, ou o pedido de correção se refere a uma versão anterior do estabelecimento. Copie o que precisar, atualize a fila e reavalie. Não force a versão. Se o pedido antigo não puder mais modificar o lugar, revise o lugar na aba Estabelecimentos e resolva o pedido com justificativa adequada.
- `400`: revise campos, limites e elegibilidade da fonte. `401/403`: entre novamente. `429`: aguarde. `503` ou queda de rede: o resultado pode ser incerto.
- Uma resposta aceita é seguida de releitura da fila e da auditoria. O painel só mostra confirmação completa quando encontra a versão e o evento correspondentes. Se isso falhar, confira o histórico antes de repetir.
- Depois de publicar, suspender ou arquivar, confira também a consulta pública em outro navegador. A confirmação privada não comprova que todos os clientes já atualizaram.
- A auditoria guarda os dados originais no idioma em que foram escritos. Não inclua contatos, dados pessoais desnecessários ou segredos nas observações/justificativas.

Ao terminar, use **Sair** e feche a aba. Uma chave exposta deve ser substituída; simplesmente sair não revoga a chave compartilhada.
