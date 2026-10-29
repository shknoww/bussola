# Bússola — design

Design original: **Marcos Mendes**. Textos/design originais: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Código: Apache-2.0. Dependências mantêm suas licenças.

## Direção

Preservar a referência existente: branco, violeta, tipografia DM Sans e informações organizadas em cartões discretos. O mapa público e o painel fazem parte do mesmo produto; administração não deve parecer um serviço externo. Tom direto, factual, sem transformar classificação política em nota de qualidade.

Para a administração, a composição adotada é **fila à esquerda + editor à direita**, com abas para Sugestões, Correções, Estabelecimentos e Auditoria. Em telas menores, fila e editor ficam empilhados. Uma tabela densa prejudicaria a leitura de fontes; uma edição modal limitaria formulários longos. O fluxo escolhido mantém o contexto da fila sem esconder o trabalho de revisão.

## Tokens de referência

Valores HEX são os usados em `public/admin.css`; OKLCH representa as mesmas cores, arredondadas. O frontend público pode usar seus tokens equivalentes sem importar a folha administrativa.

| Token | HEX | OKLCH | Uso |
|---|---|---|---|
| `--ink` | `#222738` | `oklch(27.59% 0.0324 271.51)` | Texto principal |
| `--muted` | `#626a7d` | `oklch(52.44% 0.0315 267.26)` | Ajuda e metadados |
| `--line` | `#e9eaf0` | `oklch(93.80% 0.0081 278.63)` | Divisórias |
| `--brand` | `#6255cb` | `oklch(52.69% 0.1762 283.54)` | Ação principal e identidade |
| `--brand-dark` | `#5145b2` | `oklch(46.64% 0.1665 282.81)` | Hover e links |
| `--soft` | `#f0eefc` | `oklch(95.47% 0.0188 292.61)` | Seleção e mensagem informativa |
| `--surface` | `#fafbfd` | `oklch(98.79% 0.0029 264.54)` | Fundo da página |
| `--danger` | `#a52c44` | `oklch(48.73% 0.1565 13.97)` | Erro, acompanhado de texto |

- **Tipo:** DM Sans local; pesos 400/500/600/700. Título administrativo 30 px, seção 19 px, rótulo 13 px, ajuda 12 px. Texto digitável usa tamanho herdado legível.
- **Espaço:** base 8 px; cartões com 24 px; layout com 24 px entre colunas; variações menores para rótulos e grupos.
- **Forma:** cartões 16 px; controles 9–10 px; identidade 14 px. Bordas suaves, sem sombras pesadas.
- **Controles:** altura mínima 44 px para botões e entradas; foco visível com outline de 3 px e afastamento de 4 px.
- **Motion:** somente transições de cor/borda de 150 ms, habilitadas quando `prefers-reduced-motion: no-preference`. Nenhuma animação contínua, transição que atrase digitação ou efeito que desloque o botão de decisão.

## Estados e componentes

- **Login:** ação única, explicação curta, chave mascarada, sem persistência no navegador.
- **Fila:** status + data + versão; seleção com texto e borda, não só cor. Vazio é diferente de erro.
- **Editor:** dados comerciais → fonte → justificativa → ação. Campos de publicação só ficam ativos quando a decisão é Publicar/atualizar.
- **Fonte:** link seguro, tipo, abrangência, data opcional e confirmação humana não pré-marcada. Data desconhecida fica em branco.
- **Feedback:** carregamento, erro, aceitação e verificação são estados distintos. Nenhum “salvo” otimista em moderação.
- **Auditoria:** resumos com expansão do JSON original. Conteúdo privado não é traduzido nem interpretado como HTML.
- **Responsividade:** duas colunas acima de 800 px; uma abaixo. Em até 420 px os campos passam a uma coluna. A fila tem altura limitada em mobile para não dominar a página inteira.

## Regras de uso

Faça: manter o mapa e a lista igualmente úteis; mostrar a fonte e os limites da informação; preservar campos ao trocar idioma; usar rótulos persistentes; respeitar teclado e movimento reduzido.

Não faça: usar cor política como julgamento moral; criar dados falsos para preencher telas vazias; chamar Não mencionado de neutro; esconder erros como zero resultados; publicar detalhes internos na interface pública; usar fotografias ou selos que sugiram verificação inexistente.

A inspeção local do painel cobriu desktop/mobile e overflow em 360/390/768/1440 px. Isso não é certificação WCAG nem medição de fluidez em dispositivos reais; veja [TESTING.md](docs/TESTING.md).
