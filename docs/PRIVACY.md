# Privacidade — piloto técnico

Este documento descreve o escopo técnico, não uma certificação de conformidade ou parecer jurídico. Antes de ampliar o piloto, o responsável pela operação deve definir atendimento, retenção e base jurídica apropriada.

## Dados e finalidade

| Dados | Uso e exposição |
|---|---|
| Nome, unidade, endereço comercial e coordenadas de estabelecimento | Consulta pública após aprovação |
| Fonte, posição e declaração sobre clientes | Conteúdo contextual publicado somente enquanto a revisão é vigente |
| Sugestões, correções, notas e justificativas | Revisão e auditoria privadas; não são conteúdo público automático |
| Cookie administrativo | Autenticação restrita; HttpOnly, Secure, SameSite=Strict |
| Identificador derivado do IP para limite de tentativas | Proteção contra abuso; a aplicação deriva um HMAC com chave e dia, não grava o IP bruto nessa tabela |
| Favoritos no aparelho | Identificação mínima de lugares, sem sincronização de conta |

O piloto não solicita contato do colaborador, orientação política do visitante nem conta pública. Não há analytics de produto. Não inclua CPF, telefone, e-mail pessoal, dados sensíveis ou informações residenciais em campos livres. Eles podem chegar à fila privada se alguém os escrever espontaneamente.

A localização do visitante depende de ação/permissão no navegador; não deve ser gravada no banco. Os filtros de busca passam pela API para executar a consulta, mas não devem virar perfil individual ou evento de analytics. Favoritos, cache e preferências locais podem ser removidos pelos controles do app ou limpando os dados do site no navegador.

## Serviços externos

O navegador se conecta ao provedor de mapas. Esse provedor pode receber IP e pedidos de imagens que indicam a área visualizada. Fontes e rotas abertas pelo visitante usam sites externos, sujeitos às próprias políticas. A aplicação usa política de referência `no-referrer`, mas não controla os registros desses destinos. Não envie a posição política selecionada a serviços de rota.

Hospedagem e banco também podem manter registros técnicos de infraestrutura; “sem analytics” não significa “nenhum log de rede”. A operação deve revisar configurações e contratos desses serviços. Não habilite captura de corpos de login, notas, coordenadas do visitante, cookies ou cabeçalhos de autenticação em logs, traces ou monitoramento.

## Administração e conservação

A chave administrativa não é persistida pelo painel. Um link com `#token=…` é secreto: o fragmento não integra a requisição HTTP inicial, mas pode ser visto por quem receber o link, extensões do navegador ou ferramentas locais. Sua remoção da barra de endereço não torna a chave descartável. A sessão do servidor tem validade limitada; sair remove o cookie deste navegador. Rotação da chave/hash ou do segredo de sessão invalida sessões anteriores.

A auditoria preserva decisões e versões. **Não há política automática de expurgo de contribuições/auditoria definida neste piloto.** Antes de operar com conteúdo real, estabeleça prazo, acesso, tratamento de pedidos e compatibilidade com backups. Os limites de tentativas expiram por janela; a exclusão física dessas linhas é oportunista em novas requisições de limite, não uma garantia de remoção imediata sem tráfego.

Para contestar um cadastro, use **Solicitar correção** no detalhe público. Esse fluxo cria uma fila, não retirada imediata nem canal completo de direitos de titulares. Um canal operacional separado para solicitações de privacidade deve ser definido antes de ampliar a coleta; este repositório não publica contatos pessoais do proprietário.
