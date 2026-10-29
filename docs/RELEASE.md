# Entrega do piloto 0.1.0

## Acessos

- Aplicação: https://bussola-mira.vercel.app
- Administração: https://bussola-mira.vercel.app/admin
- Código: https://github.com/shknoww/bussola
- No Mac do proprietário: abra `Abrir painel.command` na pasta do projeto. Ele lê a chave no Keychain e abre o painel. Não é necessário copiar uma senha para o código.

## Verificado nesta entrega

| Camada | Resultado executado |
|---|---|
| Sintaxe e testes | `npm run check`; suíte Node com 31 aprovações, sem falhas, 3 verificações opt-in separadas |
| Revisão adversarial | Dois problemas P2 reproduzidos e corrigidos: limpeza de atributos privados no logout/pagehide e remoção de afirmações vencidas por relógio local, sem depender da rede; regressões Chromium incluídas |
| PostgreSQL nativo | Migração aplicada em banco de QA separado; testes SQL passaram, com rollback dos exemplos |
| Concorrência nativa | Duas sessões concorrentes: uma sugestão e uma publicação/auditoria; a outra decisão recebe conflito |
| API integrada | Envio, repetição idempotente, privacidade, aprovação, fonte inválida, correção, suspensão, retirada e CSRF passaram contra o Supabase real de QA |
| Dois navegadores | Jornada completa em Chromium e WebKit, com visitante e administrador em contextos separados |
| Atualização | Suspensão apareceu automaticamente na página aberta dentro do limite de 60 segundos |
| Produção | HTTPS, API, banco, login do proprietário e leitura da fila verificados no endereço público |
| Interface publicada | PT-BR/en-GB e larguras de 360, 390, 768 e 1440 px; sem overflow horizontal, erros JavaScript ou violações de CSP observadas |
| Offline publicado | Service worker real em Chromium/WebKit; reabertura offline; cache sem API, administração ou mapas externos |
| Recuperação | Backup de produção restaurado em banco separado; snapshot de QA com 5 lugares, 10 contribuições e 13 eventos restaurado com contagens e hashes iguais; zero referências órfãs |

O teste de navegador local usa HTTPS com certificado local de teste. O teste publicado usa o certificado HTTPS normal, sem ignorar erros TLS. Os testes de interface com API simulada são identificados como MOCK; não substituem os testes acima com banco real.

## Estado dos dados

A base pública foi entregue **sem estabelecimentos e sem sugestões inventadas**. Os exemplos usados para testar aprovação e retirada existem apenas em QA. A primeira informação real deve entrar pela fila e passar pela revisão humana. O painel já permite isso sem alterar código ou republicar o site.

## Limites conhecidos

- Piloto técnico, não lançamento editorial com base curada. Falta escolher operador/substituto e cadastrar fontes reais. A avaliação jurídica não foi realizada.
- Administração de um proprietário por chave de alta entropia. Não há múltiplos papéis, convites nem MFA nesta versão. Cookies duram até oito horas; logout limpa o navegador, mas não revoga uma cópia roubada de cookie. Rotacionar o segredo ou a chave invalida todas as sessões.
- Chrome/Android e Safari/iPhone em **aparelhos físicos não foram testados**. WebKit automatizado não equivale a instalação física no iPhone.
- A meta de 10 mil lugares / 50 consultas simultâneas / p95 abaixo de 800 ms ainda não foi homologada. A lista é paginada e o mapa agrupa acima de 200 pontos; consultas foram verificadas com 251 registros nos testes SQL.
- Proximidade ordena apenas a página atual, com indicação explícita. Não há ordenação global por distância.
- Fila e auditoria administrativas ainda não são paginadas. Planejar antes de aumentar o volume.
- Backups diários com retenção de 30 dias estão no mesmo servidor. Restauração lógica foi testada; proteção contra perda total do servidor exige cópia externa.
- Tiles públicos do OpenStreetMap não têm SLA. Não há download de mapas offline.

## Operação já instalada

- Migração: `supabase/001_bussola.sql`; dados no schema privado `bussola`. Produção e QA usam bancos distintos.
- Gateway HTTPS expõe apenas a função da Bússola, com JWT de papel dedicado. O navegador não recebe credenciais Supabase.
- Segredos no Keychain e nas variáveis criptografadas da Vercel, fora do repositório.
- Backup: cron diário às 02:20 UTC; script executado manualmente e arquivo restaurado nesta entrega. A primeira execução pelo agendador ainda não foi observada.
- Limpeza de hashes de rate limit: cron horário no minuto 17; execução manual verificada. Primeira execução agendada ainda não observada.
- JWT do banco expira em **27/01/2027 às 20:12 UTC**. Rotacionar antes dessa data, atualizar a variável `BUSSOLA_DB_JWT` na Vercel e republicar. Não rotacionar o segredo geral do Supabase como parte dessa tarefa.

## Recuperação

Use `infra/restore.sh` em um **novo banco** `bussola_restore_NOME`, com o dump completo do schema e a migração da mesma versão. O script recusa nomes fora desse prefixo. Nunca restaure sobre produção para testar.

O dump completo restaura dados antes das chaves estrangeiras e gatilhos. Não use `pg_restore --data-only` sem um procedimento próprio: a ordem pode quebrar referências e gatilhos temporais podem rejeitar revisões já vencidas. A função pública do gateway é reaplicada a partir da migração versionada.

## Licença

Código Apache-2.0 e NOTICE de Marcos Mendes. Textos e design originais CC BY 4.0. Uso comercial e adaptações são permitidos, mantendo os créditos e as condições das licenças.
