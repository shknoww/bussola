# Contrato do piloto

Autoria original: Marcos Mendes. PT-BR é o idioma padrão; en-GB é a segunda tradução. Sem dados fictícios em produção. São Paulo é o ponto inicial, não um limite de cadastro. Sem coleta de contacto do colaborador neste piloto. Não há analytics. Base inicial vazia; contribuições entram na fila.

## HTTP

Todas as respostas JSON. Erros: `{error: "code"}` com 400/401/403/404/409/429/503. `Cache-Control: no-store`. API mesma origem `/api/*`. GET /api/health -> {ok:true,database:true}. GET /api/establishments?q=&city=&category=&position=all|left|right|unknown&bbox=west,south,east,north&offset=0 -> {items: Place[],total:number,next_offset:number|null,queried_at:ISO}. Página 50. GET /api/map mesmos filtros -> {items:Place[],total:number,clustered:boolean}; máximo 200 pontos/grupos, grupos {cluster:true,lat,lng,count}; filtro id opcional para lista de favoritos `ids=uuid,uuid`. GET /api/establishments/:id -> Place. GET /api/cities -> {items:string[]}.

Place: {id:uuid,name,category,city,state,address,neighbourhood,unit,lat:number,lng:number,position:'left'|'right'|'unknown',review_state:'current'|'none'|'suspended'|'expired',source_url:string|null,source_type:string|null,source_scope:string|null,source_published_at:ISO|null,verified_at:ISO|null,review_due_at:ISO|null,customer_statement:string|null,revision:number}. Códigos category: cafe,restaurant,bookshop,bar,shop,other. Source e customer statement só públicos quando vigentes. Posição nunca inferida.

POST /api/submissions body {idempotency_key:uuid,name,category,city,state,address,neighbourhood,unit,position:'left'|'right'|'unknown',source_url,notes,website:''}; website é honeypot. Fonte https obrigatória para left/right. -> 201 {id,status:'pending'}. Sem coordenadas exigidas na sugestão.
POST /api/establishments/:id/corrections body {idempotency_key:uuid,reason:'address'|'unit'|'source'|'outdated'|'association'|'other',notes,website:''} -> 201 {id,status:'pending'}.

## Administração

Autenticação de piloto com chave de acesso de alta entropia provisionada no Keychain do proprietário; hash no servidor. Chave nunca em URL query nem localStorage. POST /api/admin/login {token} -> {ok:true,csrf:string}, define cookie HttpOnly Secure SameSite=Strict. GET /api/admin/session -> {ok:true,csrf,role:'admin'}. POST /api/admin/logout -> {ok:true}. Todas escritas admin (excepto login) exigem cabeçalho X-CSRF-Token, origem mesma e sessão válida. Login rate-limited. GET /api/admin/queue -> {submissions:[],corrections:[],establishments:[]}; cada item tem id,revision,status,created_at e payload de sugestão. GET /api/admin/audit -> {items:[]}.
POST /api/admin/decision {kind:'submission'|'correction'|'establishment',id:uuid,expected_revision:number,action:'publish'|'reject'|'needs_info'|'suspend'|'archive'|'maintain',reason:string,place?:{name,category,city,state,address,neighbourhood,unit,lat,lng,position,source_url,source_type:'direct'|'third_party',source_scope,source_published_at:null|ISO,source_verified:boolean,review_due_at:ISO,customer_statement:string|null}} -> {ok:true,id,revision}. Publicação exige confirmação source_verified + direct + scope se política direcional ou statement. Não mencionado não exige fonte. Revisão 180 dias por padrão no formulário. Decisão atomicamente com auditoria e conflito 409.

## Infraestrutura

Vercel Node API usa HTTPS Supabase REST via função public.bussola_gateway(op text,payload jsonb), acessível apenas papel bussola_api (JWT servidor). Dados privados em schema bussola não exposto. Frontend não recebe credenciais Supabase. Testes em base/schema separado. Backend pode adaptar detalhes internamente, mas não alterar este contrato sem avisar integrador.

## Entrega

Código Apache-2.0 + NOTICE Marcos Mendes; textos/design originais CC BY 4.0. Dependências preservam licenças. README PT-BR, README.en-GB.md, dicionários simples. Publicar piloto honestamente; sem alegar validação física de PWA, curadoria real ou revisão jurídica inexistentes.
