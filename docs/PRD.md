# PRD Bússola

Documento de requisitos para desenvolvimento

Versão 1.0 • 29 de outubro de 2026 • Responsável pelo produto: Marcos

## 1 Objetivo e contexto

Desenvolver um PWA para consultar estabelecimentos em um mapa, com filtros de posicionamento político: Direita, Esquerda e Não mencionado. A experiência deve permitir encontrar um lugar, entender a origem da classificação e abrir uma rota. O MVP deve transformar o protótipo existente em um serviço com banco de dados compartilhado, contribuições e revisão administrativa.

O problema observado na conversa é a circulação de listas e comunicados em redes sociais que relacionam negócios a posições políticas. Esses materiais são difíceis de consultar por localização e nem sempre permitem identificar autoria, unidade, data ou atualização. As imagens recebidas motivam a hipótese do produto; não demonstram sua demanda, a abrangência do fenômeno ou a autenticidade de cada alegação.

**Confirmado pelo solicitante:** mapa semelhante à experiência de navegação do Google Maps, os três filtros, formato PWA e interesse em exportar o código ou publicar via GitHub e Vercel. Bússola é o nome de trabalho utilizado no protótipo.

**Proposta deste PRD:** lançamento com base revisada, sugestões sem publicação automática, fontes identificadas, canal de correção e painel administrativo. Arquitetura, regras editoriais, metas e cidade piloto abaixo são recomendações para validação; não representam decisões já aprovadas pelo solicitante. Os requisitos P0 descrevem o MVP proposto para estimativa.

### Objetivos do MVP

- Permitir que uma pessoa encontre um estabelecimento e consulte sua fonte sem precisar criar conta.
- Garantir que toda classificação publicada como Direita ou Esquerda tenha uma declaração elegível, responsável pela revisão e data de verificação.
- Permitir que a operação corrija, suspenda ou remova uma classificação sem alterar o código ou refazer a publicação do aplicativo.
- Entregar código, infraestrutura e documentação sob controle das contas do responsável pelo produto.

### Referência existente

Protótipo: [Bússola](https://bussola-lugares-mm-291026.shknoww.chatgpt.site/). O acesso atual é restrito ao proprietário; compartilhar o acesso ou enviar o pacote de código ao programador. O pacote disponível é `bussola-github-vercel.zip`.

O protótipo tem HTML, CSS e JavaScript, Leaflet, 18 lugares fictícios em São Paulo e Rio de Janeiro, filtros, favoritos locais, rotas externas, manifesto e service worker. As sugestões ficam somente no navegador. Não há API, banco de dados, autenticação administrativa ou revisão compartilhada. Os prints recebidos não foram incorporados como cadastros reais.

## 2 Usuários e jornadas

| Perfil | Necessidade | Permissão proposta |
|---|---|---|
| Visitante | Explorar lugares, fontes e rotas | Ler apenas dados publicados e salvar favoritos no aparelho |
| Colaborador | Sugerir lugar, fonte ou correção | Enviar informação para revisão; não alterar registros públicos |
| Representante de um negócio | Corrigir identidade, endereço ou classificação | Enviar contestação e comprovação; não recebe controle automático do cadastro |
| Moderador | Verificar registros e decidir publicações | Revisar, publicar, suspender e justificar decisões |
| Administrador | Operar o produto e a equipe | Gerenciar permissões, configurações e auditoria |

**Descoberta:** abrir o mapa → selecionar cidade ou autorizar localização → aplicar filtros → escolher um resultado → ler posicionamento e fonte → abrir rota. Login não deve bloquear essa jornada.

**Contribuição:** abrir Sugerir lugar → informar nome, cidade, endereço e categoria → indicar eventual declaração e seu link → revisar o envio → receber confirmação de que a sugestão aguarda análise. O mapa permanece inalterado até a aprovação.

**Revisão:** moderador abre a fila → verifica duplicidade e unidade → confirma endereço e ponto no mapa → abre a fonte original → registra decisão e justificativa → publica ou devolve/rejeita. Aprovação e alteração pública devem ocorrer na mesma transação.

**Contestação:** visitante abre o detalhe → escolhe Solicitar correção → informa motivo e, opcionalmente, contato → moderação avalia → mantém, corrige, suspende ou retira a informação. Identificar-se como proprietário não concede acesso administrativo.

### Histórias prioritárias

- Como visitante, quero combinar cidade, categoria e posição para encontrar negócios relevantes na região.
- Como visitante, quero entender por que um lugar recebeu uma classificação e quando ela foi verificada.
- Como visitante que não autorizou localização, quero continuar pesquisando por cidade e bairro.
- Como colaborador, quero enviar uma fonte sem que minha sugestão apareça imediatamente como fato público.
- Como representante, quero apontar um cadastro incorreto ou desatualizado e ter o caso registrado para revisão.
- Como moderador, quero suspender uma informação contestada e manter o histórico das decisões.

## 3 Regras de informação

Estas são as regras editoriais propostas para o MVP. O responsável pelo produto deve validá-las antes de incluir estabelecimentos reais.

### Posicionamento político

| Valor público | Definição proposta |
|---|---|
| Direita | Declaração pública elegível em que o estabelecimento se identifica explicitamente com a direita, confirmada pela moderação |
| Esquerda | Declaração pública elegível em que o estabelecimento se identifica explicitamente com a esquerda, confirmada pela moderação |
| Não mencionado | Ausência de classificação direcional vigente e verificada no cadastro; não significa centro, neutralidade ou ausência de opinião |

O posicionamento é uma informação contextual, não uma nota de qualidade. O sistema não recomenda um lado político, não infere o voto do usuário e não usa essas classificações para pontuar negócios.

**Fonte direta elegível:** publicação ou página do próprio estabelecimento, ou declaração de representante explicitamente em nome do negócio. A moderação deve confirmar o vínculo da fonte com a empresa e a unidade abrangida. Opinião pessoal de proprietário ou funcionário não é automaticamente posição institucional.

**Lista de terceiros ou print isolado:** pode abrir uma investigação interna. Não confirma a classificação, não vira selo público e não autoriza publicar alegações ainda não revisadas. Uma captura pode servir de material de apoio, mas o MVP deve priorizar o link original; envio de anexos fica para P1.

**Inferências proibidas pelo produto:** transformar crítica à esquerda em identificação automática com a direita, ou o inverso; deduzir posição por clientes, seguidores, aparência, bairro ou silêncio; transformar apoio a uma pessoa ou partido em um dos lados sem regra editorial explícita aprovada. Casos fora da taxonomia permanecem sem classificação direcional.

**Unidade de cadastro:** um estabelecimento físico identificável, com endereço comercial. Não criar perfis políticos de pessoas físicas nem publicar endereços residenciais. Lojas de uma rede são registros separados; uma declaração da marca só se aplica às unidades que sua abrangência efetivamente cobre.

### Declarações sobre clientes

Este campo é separado do posicionamento. Deve registrar uma descrição factual curta do conteúdo publicado, link, data e revisão. Exemplo fictício: “A publicação pede que clientes de determinada orientação não frequentem o local”.

Não converter essa descrição em “recusa atendimento”, crime, discriminação comprovada ou outra conclusão que a fonte não estabeleça. No MVP, não haverá filtro de “quem atende ou não atende”, nem campo binário de recusa. Uma declaração sobre clientes pode existir mesmo quando a posição direcional continuar em Não mencionado.

### Validade e mudanças

Cada classificação aceita precisa de `verified_at`, `reviewed_by` e `review_due_at`. Propõe-se revisão a cada 180 dias, configurável. Ao vencer o prazo, a posição deixa de ser usada nos filtros Direita/Esquerda e passa a exigir revisão; o detalhe explica “Classificação aguardando atualização”.

Conflitos entre fontes exigem decisão humana; quantidade de denúncias ou popularidade de um post não decidem a classificação. Uma contestação abre uma fila, mas não derruba automaticamente o cadastro. O moderador pode suspender a classificação enquanto apura. Toda substituição preserva a versão anterior na auditoria privada.

## 4 Escopo e prioridades

P0 é obrigatório para o MVP público proposto. P1 é melhoria após o piloto. P2 fica fora da primeira versão.

| Prioridade | Entregas |
|---|---|
| P0 | Mapa e lista; filtros; detalhes e fontes; banco compartilhado; sugestões; correções; moderação; permissões; instalação PWA; publicação e documentação |
| P1 | Favoritos sincronizados; anexos privados; avisos por e-mail; histórico público resumido; importação CSV administrativa; verificação de representante |
| P2 | Aplicativos nativos; expansão nacional operada em escala; API para parceiros; novas taxonomias políticas; monetização |

**Fora do MVP:** avaliações e comentários abertos, estrelas, rankings políticos, mensagens entre usuários, campanhas de boicote, classificação por votação, busca de opinião pessoal e coleta automática em massa de redes sociais. Esses recursos ampliam a operação e não são necessários para validar a consulta por mapa e fonte.

## 5 Requisitos funcionais e critérios de aceite

### RF01 Explorar mapa e lista P0

Exibir somente estabelecimentos publicados. Em computador, lista e mapa ficam lado a lado; no celular, devem alternar com um botão. Selecionar um cartão destaca o pino e abre o mesmo detalhe. Pinos agrupados devem poder ser expandidos ao aproximar o mapa.

**Aceite:** um cadastro oculto, pendente ou arquivado não aparece em mapa, busca, detalhe por ID nem resposta pública da API. Lista, contagem e mapa usam a mesma consulta e o mesmo conjunto de resultados, respeitada a paginação. Todos os lugares devem ser acessíveis pela lista, sem depender de manipular o mapa.

### RF02 Buscar e filtrar P0

Busca por nome, bairro e categoria, ignorando acentos e diferenças entre maiúsculas e minúsculas. Os filtros políticos são mutuamente exclusivos: Todos, Direita, Esquerda e Não mencionado. Cidade, categoria e busca combinam por interseção. Trocar de cidade limpa a área previamente selecionada no mapa.

“Buscar nesta área” aplica os limites visíveis do mapa. Apenas arrastar o mapa não deve disparar consultas em sequência. Cidade funciona como ponto inicial e filtro explícito; resultados fora dela exigem removê-la ou trocá-la. Ordenação inicial alfabética; proximidade disponível após autorização de localização, com distâncias em linha reta identificadas.

**Aceite:** buscar “cafe” encontra “Café”; Direita + Restaurante retorna apenas restaurantes classificados como Direita; limpar filtros restaura Todos sem apagar a cidade. Ausência de resultados mostra ação para ampliar a busca. Falha de rede aparece como erro com Tentar novamente, não como zero resultados.

### RF03 Localização e rotas P0

Solicitar localização somente após ação do usuário. Negar a permissão não bloqueia o app. Não armazenar localização precisa no banco ou em analytics. Abrir a rota em serviço externo, usando coordenadas do estabelecimento, sem calcular itinerário próprio.

**Aceite:** sem permissão, cidade e busca continuam funcionando; com permissão, a distância usa a posição recebida; abrir rota não envia o filtro político. Sem conexão, informar que o serviço de rotas exige internet.

### RF04 Detalhes e origem P0

Mostrar nome, categoria, unidade, endereço, localização, posicionamento vigente, explicação de Não mencionado, tipo de fonte, link original, data da publicação quando conhecida e data da última revisão. Incluir Salvar, Abrir rota e Solicitar correção. Data original desconhecida deve aparecer como “Data não informada”, sem ser substituída pela data de captura.

**Aceite:** clicar na fonte abre o endereço externo correto; informação política suspensa ou vencida não aparece como vigente. Contatos de colaboradores, notas internas e documentos de representação nunca aparecem na resposta pública. Declaração sobre clientes aparece em bloco distinto da posição.

### RF05 Favoritos locais P0

Manter favoritos sem login no aparelho, com opção de remover e limpar todos. Explicar que não sincronizam entre navegadores. Armazenar apenas ID e dados mínimos para identificação offline, como nome e bairro; não salvar histórico de filtros ou fontes políticas no favorito.

**Aceite:** favoritos persistem após recarregar. Ao reconectar, um ID retirado da base pública aparece como indisponível e seu conteúdo antigo não reaparece. Falha no armazenamento local gera mensagem e não simula sucesso.

### RF06 Sugerir lugar ou atualização P0

Formulário com nome, categoria, cidade, endereço comercial, referência da unidade, eventual posição proposta, link da declaração e observações. E-mail de contato é opcional e privado. Para propor Direita/Esquerda ou declaração sobre clientes, a fonte é obrigatória. Não mencionado não exige declaração política, mas a identidade e o endereço precisam ser revisados.

**Aceite:** o envio cria uma sugestão pendente no servidor, gera confirmação somente após gravação e não publica um lugar. Duplo clique ou repetição da mesma requisição com a mesma chave de idempotência cria um único registro. Falha preserva os campos para nova tentativa. Duplicidade provável por nome e endereço deve ser sinalizada à moderação, sem mesclar automaticamente.

### RF07 Fila e decisão administrativa P0

Disponibilizar login restrito à equipe autorizada, fila por status e idade, editor do estabelecimento, posição do pino, fontes e justificativa. Moderador pode aprovar, rejeitar, pedir complemento, suspender ou retirar. Aprovação de classificação política exige fonte direta elegível, revisão registrada e prazo de reavaliação.

**Aceite:** usuário público não consegue executar uma decisão por chamada direta à API. Aprovar grava cadastro, classificação, decisão e auditoria em transação. Duas revisões simultâneas sobre a mesma versão produzem conflito controlado, sem sobrescrever a decisão anterior. Nenhum cadastro fictício entra em produção.

### RF08 Correção e contestação P0

Aceitar pedidos de endereço incorreto, unidade errada, fonte inadequada, informação desatualizada ou associação indevida. Contato e identificação do solicitante permanecem privados. A retirada de uma classificação não precisa retirar todo o estabelecimento se os demais dados continuarem válidos.

**Aceite:** o pedido entra em fila e recebe confirmação; não altera o mapa automaticamente. Uma suspensão remove a classificação dos filtros políticos em até 60 segundos para clientes online ativos. A tela pública apresenta o estado de revisão sem expor a denúncia ou a identidade do remetente.

### RF09 Instalação e comportamento offline P0

Publicar em HTTPS com manifesto, ícones e service worker. Oferecer instruções de instalação compatíveis com o navegador. O escopo offline inclui a estrutura do app e a identificação mínima dos favoritos. Mapas, fontes, rotas, envios e classificações políticas vigentes exigem conexão.

**Aceite:** após um primeiro acesso, o app abre offline e mostra “Informação política indisponível offline”; não exibe classificação antiga como atual nem finge concluir envios. API administrativa, autenticação, contato privado e alegações não são armazenados no cache do PWA. Reconexão revalida dados. A atualização do app não elimina favoritos nem cria um ciclo de recarregamento.

### RF10 Compartilhar e operar P0

Cada estabelecimento publicado tem URL estável. Abrir essa URL diretamente deve funcionar na hospedagem e carregar o registro correto. ID privado ou retirado não pode revelar detalhes antigos. O responsável pelo produto controla repositório, conta de hospedagem, banco, domínio e permissões.

**Aceite:** um segundo navegador acessa o mesmo cadastro publicado; uma correção no painel aparece sem editar arquivos estáticos. Ambientes de teste e produção usam bancos separados. Segredos ficam em variáveis do servidor e não aparecem no código entregue ao navegador.

## 6 Dados e estados

### Modelo mínimo proposto

| Entidade | Campos principais | Exposição |
|---|---|---|
| establishments | id, nome, categoria, unidade, cidade, UF, endereço comercial, localização geográfica, publication_status, revision, timestamps | Somente versão publicada e campos aprovados |
| sources | id, establishment_id, URL original, tipo direto ou terceiro, data original opcional, captured_at, verificação de identidade, status | Apenas fontes aprovadas para contexto público |
| position_assertions | id, establishment_id, source_id, posição proposta, status, reviewed_by, verified_at, review_due_at, motivo | Apenas classificação vigente aprovada |
| customer_statements | id, establishment_id, source_id, descrição factual, status, revisão, prazo | Somente conteúdo revisado e vigente |
| submissions | id, tipo, dados propostos, status, idempotency_key, timestamps | Privada, acessível à moderação |
| correction_requests | id, establishment_id, motivo, relato, status, decisão, timestamps | Privada, acessível à moderação |
| private_contacts | id, submission_id ou correction_id, e-mail opcional, prazo de retenção | Acesso restrito, nunca incluída em projeção pública |
| staff_profiles | auth_user_id, papel, ativo | Uso interno de autorização |
| moderation_events | id, ator, ação, entidade, versão anterior e nova, motivo, created_at | Histórico interno sem edição por moderadores |

Usar UUIDs, chaves estrangeiras, validação de coordenadas e índices de busca e geografia. Uma unidade pode ter várias fontes e histórico, mas apenas uma classificação direcional vigente. Não mencionado é derivado da ausência dessa classificação; não exige uma declaração artificial de neutralidade.

**Invariantes:** uma classificação aceita deve apontar para fonte direta verificada da mesma unidade; dados fictícios não podem ser publicados em produção; tipo de fonte e abrangência devem ser persistidos; revisão vencida não é vigente mesmo que uma tarefa agendada ainda não tenha rodado. A API deve avaliar a validade temporal na leitura.

### Transições

- Sugestão: pendente → em análise → aprovada, rejeitada ou aguardando complemento. Um complemento retorna à análise.
- Estabelecimento: rascunho → em revisão → publicado → oculto ou arquivado. Republicação exige nova decisão registrada.
- Classificação: proposta → aceita ou rejeitada. Uma aceita pode ser suspensa, substituída ou vencer por prazo. Retomar exige revisão.
- Contestação: aberta → em análise → resolvida com manutenção, correção, suspensão ou retirada. O motivo da decisão é obrigatório.

Publicação do lugar, classificação política e declaração sobre clientes têm estados independentes. Ocultar um estabelecimento retira toda sua representação pública; suspender somente a classificação mantém os dados comerciais válidos.

## 7 Arquitetura e contratos técnicos

**Arquitetura sugerida:** frontend baseado na interface existente; API no servidor da Vercel; PostgreSQL com extensão PostGIS para consultas geográficas; Supabase como opção de banco gerenciado e autenticação da equipe. Framework do frontend é decisão da engenharia: não reescrever toda a interface apenas para trocar de tecnologia. PostGIS fornece tipos e operações geográficas adequados a consultas por área e distância. [Referência](https://supabase.com/docs/guides/database/extensions/postgis).

O frontend lê uma projeção pública dos dados. Envios e decisões passam pelo servidor. Se a API de dados do banco estiver exposta, aplicar políticas de acesso por linha; credenciais privilegiadas permanecem no servidor. Permissões devem impedir acesso público a rascunhos, contatos e auditoria, mesmo fora da interface. [Controle de acesso](https://supabase.com/docs/guides/database/postgres/row-level-security) e [segurança de dados](https://supabase.com/docs/guides/database/secure-data).

### Contratos mínimos da API

| Operação | Comportamento esperado |
|---|---|
| GET /api/establishments | Busca pública paginada; parâmetros q, city, category, position, bbox, sort e cursor; retorna itens, total, próximo cursor e momento da consulta |
| GET /api/map | Mesmos filtros; retorna pinos ou grupos agregados, total e informação explícita de agrupamento |
| GET /api/establishments/{id} | Detalhe público com fontes aprovadas, estado de revisão e datas |
| POST /api/submissions | Cria sugestão pendente; recebe chave de idempotência; retorna protocolo sem dados privados |
| POST /api/establishments/{id}/corrections | Cria pedido de correção, separado do conteúdo público |
| GET /api/admin/review-queue | Lista privada de sugestões, contestações e revisões vencidas |
| PATCH /api/admin/establishments/{id} | Edita dados comerciais com controle de versão |
| POST /api/admin/reviews/{id}/decision | Decide caso com justificativa e versão esperada; aplica mudança e auditoria atomicamente |

As rotas são contratos propostos; nomes podem mudar desde que os comportamentos e as permissões sejam preservados. Usar respostas consistentes: 400 para entrada inválida; 401/403 para acesso indevido; 404 para conteúdo sem versão pública; 409 para conflito de revisão; 429 para limite excedido. Respostas não devem revelar a existência ou o conteúdo de registros privados.

**Volume de referência para estimativa:** até 10 mil estabelecimentos e 50 consultas simultâneas no piloto. São parâmetros de teste, não previsão de demanda. Paginar a lista em 50 itens; limitar o mapa a 200 elementos visuais, agrupando o restante. Não truncar silenciosamente. Ordenação deve ter desempate estável por ID; invalidar cursor quando filtros mudarem.

Cache público de dados deve ter revalidação máxima de 60 segundos; clientes online ativos atualizam ao retornar à aba e durante a consulta. Respostas administrativas e de envio usam no-store. Logs não devem registrar coordenadas precisas, texto de denúncias, e-mails, valores de filtros políticos ou tokens.

### Mapas e geocodificação

Separar biblioteca do mapa, fornecedor de imagens e geocodificador. Manter fornecedor configurável. O moderador confirma o endereço e a posição antes de publicar; geocodificação é auxílio e não prova da identidade do negócio.

Se usar os tiles públicos do OpenStreetMap, preservar atribuição e cache HTTP normal, sem download em massa ou função de mapas offline. A disponibilidade desse serviço não é garantida; dimensionar um fornecedor adequado ao tráfego esperado. [Política de tiles](https://operations.osmfoundation.org/policies/tiles/).

Não implementar autocomplete sobre o Nominatim público. Se ele for usado para consultas pontuais de baixo volume, respeitar o limite global do serviço, identificação da aplicação e cache de resultados. Para um produto que precise de maior volume ou autocomplete, selecionar outro serviço compatível ou infraestrutura própria. [Política do Nominatim](https://operations.osmfoundation.org/policies/nominatim/).

### Publicação e migração

O `vercel.json` entregue hoje configura somente uma aplicação estática. O programador precisa adaptar a publicação para incluir API e autenticação e verificar diretamente uma rota de servidor antes do aceite. Importar um repositório não cria automaticamente banco ou painel. [Configuração da Vercel](https://vercel.com/docs/project-configuration/vercel-json).

Versionar migrações do banco e configuração sem segredos. O primeiro cadastro real entra pela revisão administrativa. Manter os 18 exemplos apenas em ambiente de demonstração identificado. Favoritos do protótipo não podem ser convertidos para negócios reais por coincidência de nome.

## 8 Qualidade e operação

- **Acessibilidade:** operação por teclado, foco visível, rótulos de formulário, cor acompanhada de texto e acesso por lista. Testar larguras de 360, 390, 768 e 1440 pixels sem rolagem horizontal da página.
- **Desempenho proposto:** em ambiente de teste definido, consulta pública p95 abaixo de 800 ms com a carga de referência; controles de busca utilizáveis em até 3 segundos em conexão móvel simulada. Separar falha do provedor de mapas de falha da aplicação.
- **Proteção de envios:** validação no servidor, limites de tamanho e frequência, tratamento seguro de texto e prevenção de reenvio. URLs de fontes não são baixadas automaticamente no MVP; assim, uma URL arbitrária não vira acesso interno pelo servidor.
- **Acesso administrativo:** equipe por convite, papéis verificados no servidor e autenticação reforçada para administradores. Um papel enviado pelo navegador nunca concede permissão.
- **Privacidade:** não coletar orientação política do usuário, não criar perfis a partir dos filtros e não enviar essa seleção a serviços de analytics. Definir aviso de privacidade, finalidade e retenção de contatos antes de habilitar coleta real. A avaliação jurídica necessária ao lançamento é uma decisão do responsável pelo produto.
- **Recuperação:** backup automático, procedimento de restauração e teste em ambiente separado. Proposta operacional para estimativa: perda máxima de 24 horas de dados e recuperação em até um dia útil; infraestrutura e equipe precisam confirmar viabilidade.
- **Operação editorial:** nomear quem revisa e quem recebe contestações. Meta inicial proposta de primeira análise em até dois dias úteis, sem prometer conclusão nesse prazo. Uma tela administrativa sem operador não constitui operação de moderação.

## 9 Métricas de validação

As metas abaixo são hipóteses para o piloto, sem linha de base atual. Confirmá-las antes do lançamento e revisar após 30 dias.

| Indicador | Meta proposta | Medição |
|---|---|---|
| Encontrar lugar e consultar fonte | Pelo menos 8 de 10 participantes concluem em até 60 segundos | Teste moderado com tarefas equivalentes |
| Classificações rastreáveis | 100% de Direita/Esquerda publicadas têm fonte elegível e revisão vigente | Verificação automatizada diária e antes da publicação |
| Revisão de contribuições | Pelo menos 90% recebem primeira análise em dois dias úteis | Datas da fila, com calendário operacional definido |
| Correções aplicadas | Mudança autorizada refletida em até 60 segundos para clientes online ativos | Teste de ponta a ponta e monitoramento de atualização |
| Falhas de envio | Abaixo de 1% de erros do servidor, excluindo validação e limites | Contagens agregadas por rota e código de resposta |

Instrumentar eventos agregados de busca concluída, detalhe aberto, fonte aberta e pedido enviado. Não registrar o lado político escolhido, nome do visitante ou sua localização precisa. Nenhuma meta deve incentivar classificar mais negócios como direita ou esquerda.

## 10 Plano de entrega

Não há prazo ou orçamento aprovado. Solicita-se ao programador estimativa por etapa, dependências, custos recorrentes e proposta de calendário antes do início da implementação.

| Etapa | Entrega verificável | Dependência |
|---|---|---|
| 1 Definição | Cidade piloto, regras editoriais, responsável por revisão e desenho técnico confirmados | Responsável pelo produto e engenharia |
| 2 Fundação | Repositório nas contas do responsável, ambientes separados, migrações, API e login administrativo | Acesso às contas e serviços |
| 3 Descoberta | Mapa, lista, filtros, fontes, rotas, favoritos e URLs estáveis ligados ao banco | Dados de teste e contratos de API |
| 4 Contribuição e revisão | Sugestões, contestações, decisões, atualização de filtros e auditoria | Política editorial validada |
| 5 Piloto | Carga inicial revisada, teste de instalação, testes de acesso e restauração, publicação | Conteúdo real aprovado e operador disponível |

### Definição de pronto

- Os critérios de RF01 a RF10 passam em ambiente de homologação.
- Testes impedem leitura de registros privados e decisões por visitantes, inclusive por chamada direta à API.
- Uma sugestão enviada em um navegador é revisada no painel e aparece em outro navegador somente após aprovação.
- Suspensão, vencimento e mudança de fonte retiram a classificação antiga dos filtros conforme as regras definidas.
- Há testes de envio duplicado, edição concorrente, fonte inválida, rede indisponível e falha do mapa.
- Instalação e reabertura são verificadas em Chrome no Android e Safari no iPhone, em aparelhos reais ou serviço de testes equivalente; registrar limitações encontradas.
- Não há exemplos fictícios, segredos, contatos privados ou rascunhos na base pública de produção.
- Código, migrações, variáveis de exemplo, manual de publicação, manual de moderação e procedimento de restauração são entregues nas contas do responsável.
- O proprietário recebe acesso administrativo e consegue publicar, corrigir e retirar um cadastro sem assistência do programador.

## 11 Decisões pendentes para o briefing

| Decisão | Responsável | Momento necessário | Recomendação inicial |
|---|---|---|---|
| Cidade piloto e origem da carga inicial | Produto | Antes da curadoria real | Uma cidade; escolher conforme disponibilidade de fontes revisáveis |
| Regras para atribuir Direita/Esquerda e tratar fontes indiretas | Produto e responsável editorial | Antes de publicar classificações | Adotar a regra restrita da seção 3 |
| Quem revisa, contesta e cobre ausências | Produto | Antes de receber contribuições públicas | Nomear operador e substituto |
| Provedor de banco, mapas e autenticação | Engenharia e produto | Antes de contratar e integrar | Avaliar a arquitetura proposta e apresentar custo mensal |
| Contas GitHub e Vercel, domínio e público de acesso | Produto | Antes da publicação externa | Repositório privado; decidir acesso ao site separadamente |
| Retenção de contato, política de privacidade e termos | Produto e assessoria apropriada | Antes da coleta real | Coletar somente o necessário para tratar contribuições |
| Prazo, orçamento e suporte após entrega | Produto e programador | Antes de contratar a implementação | Orçar o P0 por etapa e P1 separadamente |
| Nome definitivo e identidade visual | Produto | Pode ocorrer durante o desenvolvimento | Manter Bússola e a interface atual no piloto |

O programador pode iniciar avaliação do código, estimativa e modelagem com este documento. As decisões pendentes acima devem ser registradas e refletidas numa nova versão do PRD antes de implementar comportamentos que dependam delas.
