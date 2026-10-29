# Publicação e recuperação

Referência: [CONTRACT.md](CONTRACT.md). Evidências da publicação atual: [RELEASE.md](RELEASE.md). Não há dados demonstrativos a importar em produção.

## Arquitetura e requisitos

- Node.js 22; frontend estático em `public/`; API na mesma origem em `/api/*`.
- Vercel executa `npm run build`, publica `public/` e encaminha a API conforme `vercel.json`. `/admin` corresponde a `/admin.html`.
- O servidor chama `POST /rest/v1/rpc/bussola_gateway` em HTTPS. A função `public.bussola_gateway(op text, payload jsonb)` é a fronteira de acesso ao schema privado `bussola`.
- O JWT do gateway usa o papel dedicado `bussola_api`. Não substitua isso por acesso público às tabelas, `anon` ou credencial privilegiada no navegador. Não é Supabase Auth.

## Configurar com segurança

1. Prepare banco e gateway sob controle do proprietário. Use ambientes separados para produção, preview e testes; nunca faça um preview escrever no banco de produção por conveniência.
2. Revise e aplique as migrações de `supabase/` na ordem, em banco apropriado. `001_bussola.sql` cria a estrutura inicial: não a execute novamente sobre uma base existente como se fosse reset seguro. Confirme permissões, schema privado e acesso somente à função para o papel de API.
3. Cadastre as variáveis abaixo no **servidor**, por ambiente. `.env.example` contém nomes e placeholders, não valores utilizáveis.
4. Configure a origem HTTPS definitiva e publique a revisão do código pretendida. Não insira segredos no Git, arquivos em `public/`, argumentos de shell, screenshots ou logs.

| Variável | Finalidade |
|---|---|
| `SUPABASE_URL` | Origem HTTPS do gateway REST |
| `SUPABASE_API_KEY` | Chave exigida pelo gateway, quando aplicável |
| `BUSSOLA_DB_JWT` | JWT restrito ao papel `bussola_api` |
| `ADMIN_TOKEN_HASH` | SHA-256 hexadecimal da chave administrativa aleatória |
| `SESSION_SECRET` | Segredo aleatório independente para assinar sessões; mínimo aceito: 32 caracteres |
| `RATE_LIMIT_SALT` | Segredo aleatório independente para limites de tentativas; mínimo aceito: 32 caracteres |
| `PORT` | Porta do servidor local; não define a porta pública da Vercel |

Gere a chave administrativa com gerador criptográfico, não com palavra-passe humana. O servidor aceita chaves de 32 a 512 caracteres. Guarde a original no Keychain do proprietário e apenas o hash no ambiente do servidor. O utilitário `scripts/admin-link.mjs` usa o item Keychain de serviço `mira/bussola/admin-token`; não executa provisionamento. `BUSSOLA_ORIGIN` configura a origem HTTPS desse utilitário, não é uma credencial.

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run build
```

Para desenvolvimento com arquivo local ignorado pelo Git:

```sh
node --env-file=.env.local server/dev.mjs
```

Abra `/admin.html` na URL local anunciada. Não relaxe cookies Secure/HttpOnly para contornar problemas de ambiente; use localhost compatível ou HTTPS. O comando `npm run dev` lê apenas o ambiente do processo.

## Verificação pós-publicação

- Consulte `/api/health`; exija `200` com `ok:true,database:true`. Uma página estática carregando não comprova acesso ao banco.
- Consulte lista, mapa e detalhe; a base inicialmente vazia é válida. Um `503` não é vazio.
- Sem sessão, `/api/admin/queue` e `/api/admin/audit` devem negar acesso. Credenciais públicas do banco não devem acessar o schema privado nem chamar o gateway restrito.
- Entre pelo painel; confirme remoção imediata do fragmento, cookie HttpOnly/Secure/SameSite=Strict e CSRF nas decisões. Não registre a chave durante a inspeção.
- Confirme `Cache-Control: no-store` nas respostas da API e exclusão de API/admin dos caches do service worker. Configure também HTML administrativo como `no-store` no host, especialmente se houver proxy adicional.
- Preserve CSP, política `no-referrer`, proteção contra framing e atribuição do mapa. Não remova controles para fazer um teste passar.
- Exercite publicar → correção → suspensão → arquivo **em homologação**, com dados sintéticos. Confira projeção pública e auditoria após cada mudança. Testes de produção devem ser somente leitura até haver conteúdo real autorizado.
- Verifique a política/capacidade do provedor de tiles antes de ampliar tráfego. Não faça download em massa ou mapas offline de tiles públicos.

## Rotação e recuperação

Se uma chave/link for exposto, substitua a chave no Keychain e seu hash no servidor, publique a configuração e confira que a antiga falha. Rotacionar `ADMIN_TOKEN_HASH` ou `SESSION_SECRET` invalida sessões anteriores; sair sozinho não revoga uma chave. Trate rotação de JWT e credenciais do banco como mudança coordenada de disponibilidade.

Antes de operar com dados reais, habilite e documente backup compatível com o serviço/plano. Inclua o schema privado, migrações e configuração de papéis/permissões; guarde segredos separadamente. Não há RPO/RTO garantido por este repositório.

Procedimento de restauração a validar: restaurar em ambiente **isolado**, conferir schema/permissões, contagens e integridade de revisões/auditoria, executar testes e comparar a projeção pública. Só depois planejar troca de produção. Não “teste” restauração sobrescrevendo a base ativa. Reverter código não reverte migrações nem decisões do banco.
