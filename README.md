# Bússola

**Lugares com contexto.** Projeto original de **Marcos Mendes**. [English (UK)](README.en-GB.md)

**[Abrir aplicação](https://bussola-mira.vercel.app)** · [Painel](https://bussola-mira.vercel.app/admin) · [Entrega verificada e limites](docs/RELEASE.md)

Piloto técnico para consultar estabelecimentos, fontes e estados de revisão. A base pública começa vazia: não é um diretório já curado. São Paulo é o ponto inicial do mapa, não um limite de cadastro. Não há publicação automática de sugestões, classificação por votação nem inferência de opinião política de pessoas.

## O que está no projeto

- Interface pública em HTML, CSS e JavaScript, com mapa/lista, contribuições e favoritos locais.
- Painel em `/admin.html` (também `/admin` na configuração Vercel), com fila de sugestões, correções, estabelecimentos e auditoria.
- API Node na mesma origem, banco via gateway Supabase e migração SQL versionada.
- PT-BR como padrão e en-GB como segunda tradução.

O [contrato do piloto](docs/CONTRACT.md) define a API implementada. O [PRD original](docs/PRD.md) preserva hipóteses e requisitos mais amplos; não é uma declaração de que todos os seus critérios foram validados. Instalação em aparelhos reais, restauração de backup, curadoria e revisão jurídica não devem ser presumidas.

## Desenvolvimento

Requisito: Node.js 22 e npm.

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run dev
```

O servidor lê variáveis de ambiente do processo; `npm run dev` não carrega `.env` automaticamente. Para uma configuração **local de teste**, use as chaves de `.env.example` em um arquivo local ignorado pelo Git e execute:

```sh
node --env-file=.env.local server/dev.mjs
```

Use a URL exibida no terminal e `/admin.html`. Sem banco e segredos configurados, a API pode responder `503`; isso não é uma base vazia. Não conecte testes destrutivos à produção. Consulte [publicação](docs/DEPLOYMENT.md) e [testes](docs/TESTING.md).

## Administração

A autenticação do piloto usa uma chave aleatória de alta entropia, **não Supabase Auth**. A chave original pertence ao Keychain do proprietário; o servidor recebe apenas seu hash. O painel aceita a chave pelo formulário ou por fragmento `#token=…`, remove o fragmento imediatamente e faz `POST /api/admin/login`. Não salva a chave em localStorage/sessionStorage. A sessão usa cookie HttpOnly, Secure, SameSite=Strict e CSRF nas escritas.

O script `npm run admin:link` abre o painel usando o Keychain local. Configure `BUSSOLA_ORIGIN` para a origem HTTPS correta. `npm run admin:link -- --print` imprime um **link secreto**: não o coloque em issues, capturas, logs ou documentação. A chave não é descartável só porque saiu da barra de endereço.

Cada decisão exige justificativa e versão esperada. Publicar posição direcional ou declaração sobre clientes exige fonte HTTPS direta, autoria/abrangência verificadas e prazo de revisão. O formulário começa com 180 dias; **Manter** não renova a revisão. Veja [moderação](docs/MODERATION.md).

## Traduções: dicionários simples

- Público: `public/i18n/public-pt-BR.js` e `public-en-GB.js` exportam objetos de mensagens.
- Administração: `public/i18n/admin-pt-BR.js` e `admin-en-GB.js` registram objetos em `window.BUSSOLA_ADMIN_I18N`.
- Adicione a mesma chave nos dois idiomas. Traduza texto, rótulos, ajuda e erros; não traduza códigos da API, IDs, URLs ou conteúdo enviado por pessoas.
- Preserve placeholders usados pelo código. No painel, `data-i18n` traduz texto e `data-i18n-aria` traduz rótulos acessíveis. Use texto, não HTML, nas mensagens.
- Ao criar um idioma, adicione seu dicionário, carregamento e opção de seleção. Teste troca de idioma com formulário preenchido, erros, conteúdo longo e teclado.

## Documentação

[Moderação](docs/MODERATION.md) · [Publicação e recuperação](docs/DEPLOYMENT.md) · [Privacidade](docs/PRIVACY.md) · [Testes](docs/TESTING.md) · [Design](DESIGN.md)

## Licenças e autoria

- **Código original:** [Apache License 2.0](LICENSE). Autoria original: Marcos Mendes. Preserve o [NOTICE](NOTICE).
- **Textos, documentação e design originais:** [Creative Commons Attribution 4.0 International — CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) ([texto jurídico](https://creativecommons.org/licenses/by/4.0/legalcode)). Ao reutilizar, dê crédito a Marcos Mendes e ao projeto Bússola, inclua o link da licença e indique alterações. Isso não implica endosso.
- Dependências, fontes, mapas e conteúdos externos mantêm suas próprias licenças. Leaflet: BSD-2-Clause; DM Sans: SIL Open Font License 1.1; dados OpenStreetMap: ODbL. Preserve os avisos em `public/vendor/` e a atribuição do mapa.
- A licença do projeto não relicencia fontes de terceiros, declarações de estabelecimentos, dados pessoais nem marcas.
