# AGENTS.md — Frontend do Cub's

Guia de convenções para trabalhar neste repositório. Detalhes de setup e
arquitetura estão no [README.md](README.md).

## Comandos

- `npm run dev` — dev server (Vite) em http://localhost:5173
- `npm run build` — `tsc -b` + build de produção
- `npm run lint` — oxlint

Após criar/mover rotas ou adicionar classes Tailwind NOVAS, o dev server em
execução às vezes não regenera; valide com `npm run build` (ou reinicie o dev).

## Arquitetura

Frontend (:5173) → **cubs-backend** (Express, :3000) → **rqlite** (:8000, dev).
O frontend fala com a API do backend (rotas `/auth`, `/users`, ...), nunca com
o rqlite direto. API HTTP e socket.io são o MESMO servidor
(`src/lib/connection.ts`). Em dev, sem env definida, tudo passa pelo proxy do
Vite (`API_BASE_PATH` e `/socket.io` → :3000); em prod, o nginx do container
faz esse papel (`nginx/nginx.conf`, porta 80 — ver `Dockerfile` e o compose de
prod em `cubs-backend/docker/docker-compose.prod.yml`).

**O `/api` é REAL nos dois lados** — o backend monta todos os routers sob `/api`
(`API_PREFIX` em `cubs-backend/src/core/http/http-server.ts`) e os mediadores
(Vite em dev, nginx em prod) repassam o path INTACTO, sem reescrever. O prefixo
ainda serve para o proxy separar chamada de API de rota da SPA na mesma origem,
mas não morre ali. Os services pedem o path direto (`/pages/:id`) porque quem
prende o prefixo é o `baseURL` do axios — que termina em `/api` inclusive
quando `VITE_CUBS_API_URL` aponta direto para o backend. Valor único em
`API_BASE_PATH` (`src/constants/api.ts`), com o `nginx.conf` espelhando na mão.
O `/socket.io` fica FORA do prefixo (raiz do backend).

## Base de dados (CubsDatabase)

O backend modela páginas como **árvore recursiva** (`page_edges`: parent →
child): não existe página "raiz" como tipo. Uma base/tabela é só uma página
cujas FILHAS são as linhas — a mesma página é filha num nível e parent no
seguinte. A workspace só resolve o **ponto de entrada**
(`/workspaces/:id/page_root`, GET-or-create); daí para baixo é página → página,
e o que muda é apenas o id.

- `src/services/DatabaseService.ts` — I/O. A unidade é `loadPage(pageId)` (as 3
  leituras da página em paralelo); `loadWorkspace(workspaceId)` é o caso
  particular que resolve o id de entrada e delega. Nada assume workspace única:
  a workspace em foco é o PARÂMETRO da rota (`/$lang/myworkspace/$workspaceId`),
  e `DEFAULT_WORKSPACE_ID` sobrevive só como destino dos redirects de quem
  chega sem id (sign-in/sign-up), até existir a listagem de workspaces.
- `src/lib/databaseParser.ts` — adaptador API → modelo da lib `cubs-database`,
  puro e testável. A lib é agnóstica ao backend de propósito, então a tradução
  mora só aqui. O que ele resolve, e que não é óbvio:
  - `pages.title` não é uma coluna — vira a coluna sintética `TITLE_COLUMN_ID`
    (`page_title`), sempre a primeira;
  - `select` guarda o **ULID da option**, não o texto — e o valor segue CRU até
    a lib: o parser anexa as `options` (id → label/cor) na PRÓPRIA coluna
    (`HeaderCol.options`) e quem resolve é o render/editor; id órfão vira
    célula vazia, nunca um ULID cru na tela;
  - valores vêm no envelope `{"value":<T>}` **como string JSON**, e o
    `column_data` do dataset também;
  - as colunas saem de `/pages/parent/:id/columns`, NUNCA do dataset — o JOIN
    dele parte dos valores, então coluna ainda sem valor não apareceria;
  - `pages.data` guarda o **snapshot** (ver abaixo); entrada com formato
    inesperado é descartada, e base sem view cai num fallback de id FIXO.

### Snapshot (personalização por view)

**"Snapshot" é o nome oficial do padrão** — use o termo em código, comentário e
commit. É o que `pages.data` guarda: a personalização de cada view da base,
indexada pelo **ULID da view** (que é a identidade da tab — gerar um novo a cada
render trocaria a view ativa a cada refetch):

```jsonc
{ "<ulid-da-view>": {
    "view": "table",              // table | board | calendar
    "name": "Docentes",
    "filters": "",                // string opaca; o backend nunca interpreta
    "orderedHeaderCols": ["page_title", "<id-da-coluna>"],
    "orderedRows": ["<id-de-pagina>"],      // opcional; ausente = ordem natural
    "columnWidths": { "page_title": 280 }   // opcional; gravado pelo resize
} }
```

`orderedRows` segue o MESMO contrato do `orderedHeaderCols` (índice do array é
a ordem; reordenar = array NOVO; id desconhecido ignorado na leitura) e mora na
view pelo mesmo motivo: ordem de linha é apresentação, cada view tem a sua.

Cada entrada é o **retrato completo** da view, não campos remendáveis. Daí o
nome — e daí a armadilha:

> `PUT /pages/:id` substitui `data` **INTEIRO**. Não há rota por view. Salvar
> uma view exige reenviar todas as outras (read-modify-write); mandar só a
> editada **apaga as demais**.

**Por que assim:** o snapshot é estrutura **associativa** — vem junto com a
página numa leitura só, sem join. A ordem das colunas é o ÍNDICE DO ARRAY em
`orderedHeaderCols`, não um campo `order` numérico: evita reindexar/rebalancear
frações a cada movimentação, e reordenar já custa a reescrita do objeto inteiro
de qualquer jeito. E mora na view — não em `page_edges`, que é por LINHA — para
não multiplicar dado por linha nem misturar dois eixos (a mesma coluna pode ser
larga numa view e estreita em outra).

**Custo aceito:** o snapshot cita ids de coluna, então deletar uma coluna deixa
referência pendurada em `orderedHeaderCols`/`columnWidths` — e essa limpeza não
existe hoje. É benigno na leitura: `reorderByIds` ignora id desconhecido, então
coluna morta vira lixo, não UI quebrada. Ao implementar a escrita, podar em vez
de ressuscitar.

**Estado:** leitura e ESCRITA prontas. Quem grava é
`PageWriteService.saveViewSnapshot(pageId, settings, viewId, patch)` — a
assinatura exige o `settings` ATUAL de propósito: ela faz o read-modify-write,
e é o guard-rail contra o erro de mandar só a view editada. View desconhecida
(o `FALLBACK_VIEW_ID`, que não existe no banco) não é gravada: criaria uma tab
fantasma para todo mundo.

Definição canônica, invariantes e pontos em aberto (incl. o que fazer com o
`FALLBACK_VIEW_ID` ao persistir): `cubs-backend/docs/INTEGRACAO.md` §2.

### Edição de células (cellMap) — terreno do realtime

A tabela edita quando `onCellChange` é passado à `<CubsDatabase />`; sem a
prop, tudo segue read-only. O despacho é o **cellMap**
(`src/shared/cubs-database/components/cells`): `CELL_EDITORS: Record<tipo,
editor | null>` — um editor `React.memo` por tipo de `page_columns` (`date` é
`null` por ora e cai no render read-only). Para criar um editor novo:
implemente `CellEditorProps` (`types.ts` da lib) e registre no map.

- **Ciclo de commit**: text/numeric commitam no **blur** (Enter → blur; Escape
  reverte e NÃO commita); checkbox e select commitam no clique. `onCommit` só
  dispara se o valor MUDOU — é o que mantém o transporte livre de eco. O
  rascunho de text/numeric passa por `useExternalDraft` (ver "Colaboração e
  realtime"): protege a digitação em foco do broadcast e, no blur SEM edição,
  adota o valor externo em vez de commitar o antigo.
- **Payload**: `CellChange { rowId, columnId, value, previousValue }` — já no
  formato do futuro evento `cell-updated`; o `pageId`/room entra do lado do
  app. A arquitetura inteira (store por célula via TanStack Query, um listener
  por página, escrita SEMPRE via HTTP e socket só para broadcast pós-commit)
  está em `docs/cubs-database-realtime-arquitetura.md` — esta leva implementa
  o §9 (componentes de escrita primeiro, socket depois).
- **Select**: a célula guarda o **id** da option (`{"value":"<option.id>"}`,
  como o backend); label/cor saem de `HeaderCol.options`. O editor é um
  `Popover` com as options arrastáveis (dnd-kit, Pointer + Keyboard sensor):
  soltar emite `onColumnOptionsChange(columnId, arrayCompleto)` —
  read-modify-write, como o snapshot. Cores de option = `OptionColor`
  (`red|orange|yellow|green|blue|grey`, espelho do backend) via classes
  escritas por extenso em `cells/optionColors.ts`.
- **Numeric**: `HeaderCol.format` É a máscara do editor e a formatação do
  read-only (`formatNumericValue`): `currency` armazena **CENTAVOS inteiros**;
  `percentage` armazena o inteiro (42 → "42%"); sem format, campo livre que
  valida no commit (lixo reverte).
- **Reordenação (linhas E colunas)**: drag pelo handle (dnd-kit; sensores
  compartilhados em `components/dndSensors.ts` — Pointer + Keyboard). O handle
  de LINHA é o da célula de controles; o de COLUNA fica centralizado no topo
  do header, visível no hover. Drop emite `onRowOrderChange(viewId,
  orderedRows)` / `onColumnOrderChange(viewId, orderedHeaderCols)` — array
  COMPLETO de ids, pronto para o read-modify-write do snapshot da view. A
  ordem local é otimista e re-sincroniza quando as props mudarem. A PRESENÇA
  do callback habilita o drag; sem ele, handle decorativo/ausente.
- **Seleção (`selectedPagesIds`)**: checkbox de linha com intervalo por
  Shift — a âncora é o último clique; com Shift pressionado
  (`useShiftKey`, o shiftContext) a área [âncora, hover] ganha wash roxo, e
  shift+click aplica o estado ao intervalo inteiro. O estado é um
  `useReducer` (`selectionReducer`, ids num `Set`); toda mudança sobe completa
  por `onSelectionChange` — o terreno do futuro `batchRealtimeUpdate`. Ver
  "Memoização da tabela".
- **Menu da coluna** (`ColumnHeaderMenu`): botão DIREITO no header abre o
  painel (mesmo padrão do ContextMenu das tabs) com o TIPO readonly + campo
  de renomear → `onColumnRename(columnId, name)`, o payload do
  `column-renamed`. Habilitado pela presença de `onColumnRename`.
- **Seleção em massa**: com pelo menos uma linha marcada, a célula de controles
  do HEADER exibe o "selecionar todas" (`indeterminate` quando é parcial), que
  também limpa tudo. É o terreno do `batchRealtimeUpdate`.
- **Largura e resize**: alça na borda direita do header (pointer capture, NÃO
  dnd-kit — não há reordenação), otimista durante o arrasto, e no soltar
  `onColumnWidthChange(viewId, columnWidths)` com o mapa COMPLETO. **Não existe
  teto de largura**: a tabela é `w-max` dentro de `overflow-x-auto`, então
  coluna larga empurra a rolagem horizontal em vez de ser truncada (um teto
  faria a largura salva divergir da exibida). Só o piso `MIN_COLUMN_WIDTH`
  continua. A borda direita da ÚLTIMA coluna vem por PROP (`isLast`), não por
  `last:border-r`: o `DndContext` injeta uma live-region de a11y como último
  irmão, e o seletor pegaria ela.
- **Escrita**: ligada — `src/services/PageWriteService.ts`. Ver a seção
  "Colaboração e realtime" abaixo.

## Colaboração e realtime

**A SALA É A PÁGINA** (`page-database:{pageId}`), nunca a workspace. É o que
faz dono e colaborador se enxergarem: o dono chega pela workspace (que só
resolve o id da página de entrada) e o colaborador pela url `/page/:id` — os
dois acabam no MESMO id, logo na mesma sala. Sala por workspace separaria
justamente quem está olhando a mesma tabela.

**Escrita SEMPRE por HTTP; o socket só propaga depois do commit.** A base é
rqlite/Raft: quem grava é a API (que fala com o líder), e o socket notifica.
Isso evita escrita duplicada, fora de ordem ou num nó que não é líder.

### As duas portas de entrada

Ambas caem na mesma view (`PageDatabaseView`) sobre o mesmo `pageId`:

- `/$lang/myworkspace/$workspaceId` → `WorkspaceEntryPage` resolve o
  `page_root` e passa o id adiante;
- `/$lang/page/$pageId` → id direto da URL (é para cá que os cards de
  **Colaborando** apontam, e para onde "Abrir ›" desce na árvore).

Tudo vive sob o layout pathless `_private` (guard de auth + `AppLayout` +
`WorkspaceProvider`). Como `workspaceId` só existe numa das rotas, o layout lê
params com `useParams({ strict: false })` e cai em `DEFAULT_WORKSPACE_ID`.

**`PageShell`** (`src/components/PageShell.tsx`) é a moldura padrão da página
(título + `children`) e o ÚNICO lugar que entra na sala (`usePageRealtime`):
entrar vira consequência de ABRIR a página, não um passo que cada tela lembra
de dar. Ele mostra a presença (quantos com a página aberta) quando há
companhia.

### Eventos (espelhados nos DOIS repos)

| Evento | Quando | Sala |
|---|---|---|
| `cell-updated` | POST/PUT/DELETE do valor de célula | parent da linha |
| `row-updated` | PUT da página com `title` (o TÍTULO da linha) | parent da linha |
| `column-updated` | PUT da coluna (rename e options) | a própria parent |
| `view-updated` | PUT da página com `data` (o snapshot) | a própria página |
| `row-created` / `row-deleted` | filha criada/removida | parent |
| `page-presence` | entrou/saiu da sala | a própria página |

`PUT /pages/:id` emite para DUAS salas diferentes porque carrega duas coisas
diferentes: `data` é o snapshot DAQUELA página (sala dela), enquanto `title` é
o rótulo dela enquanto LINHA de outra (sala da parent, que é a tabela onde ela
aparece). O título não é `page_columns` — por isso evento próprio, que o
frontend deposita na coluna sintética `TITLE_COLUMN_ID`.

Comandos do client são IMPERATIVOS (`join-page-database`), eventos do servidor
são PARTICÍPIO (`joined-page-database`) — event sourcing como vocabulário.

Contrato: `cubs-backend/src/core/socket/realtime-service.ts` ×
`src/services/SocketService.ts`. **Ao criar um evento novo, atualize os dois.**

Todo payload leva `updatedAt` e `originUserId`, e são as duas guardas do merge
(`src/lib/databaseRealtime.ts`, redutor PURO sobre `ParsedDatabase`):

- **ordem** (a ÚNICA guarda do redutor): evento mais VELHO que o dado é
  descartado — a rede não garante ordem, e sem isso uma edição nova "voltaria
  no tempo".

**O autor RECEBE o próprio eco.** Não há mais filtro por `originUserId` no
redutor (`applyRealtimeEvent` nem recebe o id do usuário atual). O servidor
emite para a sala inteira, inclusive quem escreveu, e o eco é tratado como
CONFIRMAÇÃO. Isso fecha um buraco real: o caminho otimista não carimba o
relógio de propósito (o tempo é do servidor), então sem aceitar o eco a edição
do autor não deixava marca temporal — e um evento mais VELHO de outra pessoa
passava pela guarda de ordem e sobrescrevia o que ele acabara de escrever. O
eco chega com o `updatedAt` do commit e SELA a chave. `originUserId` continua
no payload como AUDITORIA, não como regra de merge.

Linha criada/removida e RECONEXÃO caem no mesmo remédio: reler a base. O
socket.io não reenvia o que passou durante a queda, e recarregar é mais barato
que reconstruir um replay.

**A edição própria é aplicada LOCALMENTE** (`applyLocalCellChange`,
`applyLocalColumnRename`), antes da escrita HTTP — é o prefixo otimista que dá
resposta imediata; o eco é a confirmação autoritativa logo atrás. O caminho
otimista NÃO mexe no relógio: o carimbo é do servidor, e adiantá-lo com a hora
local faria eventos legítimos de outras pessoas parecerem velhos.

**O eco não pode atropelar quem está digitando.** Como o autor agora recebe o
próprio eco (e edições de terceiros sempre chegaram), os editores de texto
protegem o campo em foco via `useExternalDraft`
(`components/cells/useExternalDraft.ts`): com foco, o valor externo espera; sem
edição do usuário, o blur ADOTA o valor externo em vez de commitar (senão sair
de uma célula que outra pessoa editou gravaria o valor velho de volta). É
estado derivado em RENDER, não `useEffect` — o efeito custaria um render
descartado por evento. Limite conhecido: reeditar a MESMA célula antes do eco
chegar deixa o servidor vencer (a escrita otimista não tem carimbo); com commit
no blur a janela é estreita.

**Célula vazia é POST, não PUT**: `PUT .../value` exige que a linha já exista
em `page_columns_values` (404 quando não). O `previousValue` do `CellChange` é
o que distingue os dois casos — preencher célula em branco falhava calado.

### Acesso (backend)

`canAccessPage(userId, pageId)` = dono **ou** colaborador
(`page_collaborators`), e o acesso é **HERDADO pela árvore** (CTE recursivo
subindo `page_edges`): é o que permite ao colaborador editar as LINHAS, que são
páginas filhas que ninguém compartilhou explicitamente. Aplicado via
`requirePageAccess` nas leituras e escritas de página/dataset/colunas/valores —
antes disso `GET /pages/:id` filtrava por `owner_id` (bloqueando o colaborador)
enquanto dataset e colunas não checavam nada. DELETE da página segue exclusivo
do dono.

O vínculo se chama **colaborador** (`page_collaborators`, rotas
`/pages/:id/collaborators`) e não "membro": é o nome que o produto usa (a aba
"Colaborando") e evita a confusão com membro de workspace/turma.

`GET /pages/shared` lista as páginas onde sou colaborador e não dono — a aba
**Colaborando**. Ela é caminho FIXO e por isso é registrada pelo
`staticRoutes()` do `BaseRouter`, ANTES do `/:id` do CRUD: o express casa na
ordem de registro, e o `super()` (que registra o CRUD) roda antes do corpo do
construtor — `/pages/shared` chegava a virar `id="shared"` e dar 404.

### Estado e rollback da escrita

`usePageDatabase` guarda UM `ParsedDatabase` por página, não um cache por
célula como o doc de arquitetura descreve (§6). É consciente: na escala do
protótipo o re-render é irrelevante, e com a regra de merge isolada num redutor
puro, migrar para chaves por célula (`["cell", cellId]`) é um passo mecânico
sem tocar em componente.

**A escrita otimista REVERTE quando falha.** A célula usa `useMutation` (o
padrão que SignIn/SignUp já seguem): `onMutate` aplica o otimismo, `onError`
desfaz voltando ao `previousValue` ("se deu erro, não era para atualizar"),
MARCA a célula (`cellErrors: Set<string>`, chave `cellErrorKey` — desce até a
célula, que ganha `aria-invalid` + anel `ring-p-red`) e dispara `feedback(...)`.
A marca some na reedição (o `onMutate` a limpa). As OUTRAS escritas (rename,
options, snapshot) revertem pelo remédio grosso — `.catch` → `feedback` +
`reload` (re-sincroniza com o servidor). O erro vira mensagem por
`classifyWriteError` (puro; `status` → chave `feedback.escrita.*`), sendo o
**409** o único que nasce da colaboração (dois preenchendo a mesma célula).

O canal de aviso é o `feedback()`/`Toaster` (`src/contexts/FeedbackContext.tsx`
+ `src/components/Toaster.tsx`): fila via `useReducer`, portal no canto,
componente BURRO (strings já traduzidas pelo caller). Montado no `main.tsx`.

Arquitetura completa e pontos em aberto:
`docs/cubs-database-realtime-arquitetura.md`.

### Memoização da tabela

Os componentes da tabela (`TableRow`, `TableCell`, `SortableHeaderCell`, os
editores do cellMap) são `React.memo`, e comparação rasa MORRE com prop
recriada a cada render. A regra que sustenta isso, de cima para baixo:

- **o app host coopera** (`PageDatabaseView`): `labels`/`viewMenuItems`
  memoizados, handlers em `useCallback`, e os fallbacks de "carregando"
  (`settings`/`headerCols`/`rows`) são CONSTANTES DE MÓDULO — um `?? {}` inline
  desce até cada célula e anula tudo abaixo;
- **os callbacks descem estáveis** (`TableView`): o que precisaria de closure
  por linha (o índice) virou PARÂMETRO — `TableRow` recebe `rowIndex` e monta a
  closure lá dentro, onde não cruza fronteira de memo. O `onCommit` da célula é
  `useCallback` (deps `[onCellChange, row.id, column.id, previousValue]`), e é
  ELE que finalmente liga o memo dos editores;
- **a seleção é `useReducer`** (`selectionReducer`): `dispatch` é estável por
  definição, e os ids num `Set` (não array) matam o `includes` O(n²) mantendo a
  leitura `ids.has(id)`. O redutor é puro; `onSelectionChange` sobe por efeito;
- **estado derivado de prop é ajustado em RENDER**, não em `useEffect` (a ordem
  otimista local do `TableView`): o efeito custava dois renders por mudança de
  prop.

Medida: editar UMA célula numa tabela de N linhas re-renderiza só as células da
LINHA editada (×2, otimista + eco), não a tabela inteira.

## Sessão e storage

**Onde cada coisa mora — a regra que evita o próximo `localStorage.setItem`
avulso:**

| Dado | Onde | Por quê |
|---|---|---|
| Refresh token (7d) | cookie `HttpOnly` (backend) | JS nunca lê; um XSS não exfiltra |
| Access token (15min) | memória (`sessionStore`) | some no reload; o cookie o recupera |
| Usuário logado | memória (`AuthService.cachedUser`) | resultado do `restore()`, não persistência |
| Tema, sidebar | `localStorage` via `clientStorage` | preferência, sem risco no navegador |

**`sessionStore`** (`src/services/sessionStore.ts`) guarda SÓ o access token,
numa variável de módulo. Nunca toca `localStorage`/`cookie` — há um teste que
falha de propósito se alguém reintroduzir persistência. A sessão sobrevive ao
F5 pelo COOKIE, não por storage: `AuthService.restore()` faz
`POST /auth/refresh` → `GET /auth/me`.

**Quem chama `restore()` é o `AuthProvider`, num `useEffect` que roda UMA vez
no boot** — não o guard de rota. Sessão não é realtime: uma checagem no
carregamento basta, sem refresh proativo a cada navegação (isso estourava o
rate limit e travava o login). Os guards (`_private`/`_public/route.tsx`) são
REATIVOS: leem `{ user, restoring }` do contexto. Enquanto `restoring`, o
layout não monta nada nem redireciona (evita o flash de "deslogado"); depois,
sem `user` vai ao sign-in, com `user` monta o conteúdo. **Nenhum `beforeLoad`
faz fetch.** No backend, o limite agressivo anti-brute-force fica só em
`login`/`register`; `refresh`/`me`/`logout` estão sob o limite global.

**`ApiService`** tem `withCredentials: true` (sem isso o cookie não viaja) e o
retry-uma-vez do 401 renova o access via cookie. Rotas de cookie
(`/auth/refresh`, `/auth/logout`) levam o header `X-Cubs-Client` — a guarda de
CSRF, que dispensa double-submit token porque `SameSite=Lax` já fecha o vetor.

**Logout derruba o socket e sincroniza as abas.** `AuthContext.signOut` chama
`socketService.disconnect()` (força, não é o `release()` por contagem — a
conexão foi autenticada no handshake e sobreviveria à sessão) e publica num
`BroadcastChannel('cubs-session')`; as outras abas ouvem, limpam o access da
memória, derrubam o socket e recarregam → o guard cai no sign-in. É
`BroadcastChannel` e não o evento `storage` porque a sessão NÃO vive no
`localStorage`. A reautenticação PASSIVA do socket (access que expira numa
conexão longa) continua fora — `docs/demanda-backend.md` §1.

**`clientStorage`** (`src/lib/clientStorage.ts`, hook
`useLocalStorageState`) é o ÚNICO caminho para `localStorage`, e só para
PREFERÊNCIA: namespace `cubs.` por dentro (o chamador nunca escreve o prefixo),
JSON quebrado devolve `undefined` e limpa a chave, storage indisponível vira
no-op. O `theme-init.js` (anti-flash, em `public/`, fora do bundle por causa da
CSP `script-src 'self'`) lê a chave crua porque roda antes de qualquer módulo —
espelha `cubs.theme` na mão, como o `nginx.conf` faz com `API_BASE_PATH`.

**Política por ambiente** é FONTE ÚNICA em `cubs-backend`
(`core/auth/cookie.config.ts` + `core/env.ts`): dev usa `cubs_rt` sem `Secure`;
prod usa `__Host-cubs_rt` com `Secure`, e o boot FALHA sem segredo JWT ou
`CORS_ORIGINS`. `core/env.ts` é fail-safe: `NODE_ENV` ausente conta como
produção. Quando o contrato de `/auth` mudar, atualize `docs/INSOMNIA.md` no
backend — é o guia de como reconfigurar o cliente de teste.

## Convenções

- **Dependências**: sempre versão exata (`npm install --save-exact`, sem `^`/`~`).
- **i18n**: TODO texto de tela passa por `i18n('pages.secao.chave')`
  (`src/lib/i18n.ts`); traduções em `src/locales/pt-br.json`. Nada de string
  solta em componente.
- **Nomes**: funções `camelCase`; Components/Services/Sections `PascalCase`;
  rotas kebab-case.
- **Aliases**: `@/*`, `@components`, `@contexts`, `@locales`. As libs autorais
  (`cubs-components`, `cubs-database`) também são aliases — apontam para a
  FONTE em `src/shared/`, não para o `node_modules`.
- **Classes**: componha com `cn` (de `cubs-components`). O Tailwind só gera
  classe que aparece **escrita por extenso** no código — nada de
  `bg-${cor}-600` montado em runtime.

## Tema e design tokens

- `src/index.css` tem SÓ a base: `background`, `contrast`, `active`, `divider`,
  `divider-contrast`, `foreground` (valores via `theme(--color-zinc-*)`) +
  `--font-sans` (Noto Sans). **Sem tokens por-componente.** Adicionar um token
  de cor = 2 passos: (1) definir `--x` em `:root` e `.dark`; (2) registrar
  `--color-x: var(--x)` em `@theme inline` (é isso que gera `bg-x`, `text-x`, ...).
- **Cores de destaque = utilitários nativos `p-*`** (definidos em `index.css`):
  os nomes semânticos mapeiam para hues (`red→rose`, `blue→blue`,
  `purple→violet`, `green→emerald`; para as cores de option de select também
  `orange→orange`, `yellow→amber`, `grey→zinc`). Use direto no `className`,
  sem importar nada:
  - Tom cheio, theme-aware: `bg-p-red`, `text-p-red`, `border-p-red`,
    `shadow-p-red` (600 no light / 500 no dark). `shadow-p-red` só dá a COR —
    combine com um tamanho (`shadow-xl shadow-p-red`).
  - Escala completa p/ controle fino: `bg-p-red-500`, `text-p-red-600
    dark:text-p-red-400`, `shadow-p-red-600/20 dark:shadow-p-red-500/20`, etc.
  - `PALETTE` (de `cubs-components`) é só para cor **dinâmica por prop**
    (`<Button color={cor} />`) — compõe as mesmas classes `p-*`. Para cor fixa,
    prefira os utilitários e NÃO importe `PALETTE`. Filled colorido usa texto
    branco (`text-white`).
- `src/components/Typography.tsx` — todo texto usa variants (`h1`..`caption`).

## Onde mora um componente

Duas casas, e a regra é o acoplamento:

- **`src/shared/cubs-components/`** — primitiva que não sabe nada do app:
  `Button`, `TextField`, `Checkbox`, `Select`, `Switch`, `ContextMenu`,
  `Popover`, mais `cn`/`PALETTE`/`applyMask`. É pacote versionável (mesmo
  esquema da `cubs-database`: FONTE em `src/shared`, `packages/` é o artefato).
- **`src/components/`** — componente que FALA com o app: router, contexto,
  i18n. Hoje: `SearchBar` (query params), `Modal` (i18n), `ThemeToggle`
  (contexto de tema), `Typography`.

Componente do pacote **nunca chama `i18n`** — recebe rótulo por prop
(`labels?.select ?? 'Selecionar linha'`). É o que permite ele servir a lib e o
app sem arrastar o i18n junto.

**Contrato de tokens.** O pacote emite classes que só renderizam certo se o
consumidor definir as variáveis do `src/index.css` (`background`, `contrast`,
`active`, `divider`, `divider-contrast`, `foreground`, `glass` e as escalas
`p-*`). Está declarado em `packages/cubs-components/README.md`.

**Ordem de build.** `cubs-database` importa `cubs-components`, e o build do
pacote resolve pelo `node_modules` (dist), não pelo alias — então o dist do
`cubs-components` precisa estar atualizado ANTES. O script
`cubs-database:build` já encadeia os dois; rodar o `build.mjs` na mão pula isso
e falha com "has no exported member".

> **shadcn é scaffolding, não fonte.** Existe um `components.json`, mas NÃO
> existe `src/components/ui/` e nenhum componente veio do CLI. Radix entra
> quando a mecânica vale (a11y, teclado, portal — `Checkbox`, `Select`,
> `Modal`); a APARÊNCIA é sempre reescrita com os tokens acima. Não rode
> `npx shadcn add` esperando que o resultado se encaixe: ele traz outro
> vocabulário de tokens (`border-input`, `text-muted-foreground`, ...) que
> briga com esta seção.

## Componentes dual-mode (form OU state)

**Nada de elemento de formulário cru.** `<input>`, `<select>`, `<textarea>` e
`<button>` de ação só existem DENTRO de `cubs-components` — em página, section
ou lib, use o componente. O motivo não é estética: o campo cru não tem o erro,
o `aria-invalid`, a máscara nem os tokens de tema, e cada cópia diverge da
seguinte. (Exceção tolerada: `<button>` de ícone puro dentro de um componente,
como o "limpar" da `SearchBar`.)

**Formulário é react-hook-form.** Havendo mais de um campo, ou qualquer
validação, o caminho é `useForm` + `<FormProvider>` + os campos por `name` —
não `useState` por campo. `useState` fica para campo solto sem validação (a
busca da topbar, um filtro).

Os componentes funcionam nos **dois fluxos**, e a escolha é pela presença da
prop `name`:

- **`name` presente → modo FORM** (react-hook-form): o componente se registra
  sozinho no `<FormProvider>` acima (estado, validação e erro vêm do form).
- **sem `name` → modo STATE**: componente controlado comum (`value`/`onChange`
  ou `checked`/`onCheckedChange`), com erro via prop.

```tsx
// TextField — `rules` só faz sentido no modo form
<TextField name="cpf" label="CPF" mask="cpf" rules={validators.cpf()} />        // form
<TextField label="Busca" value={q} onChange={(e) => setQ(e.target.value)} />    // state

// Checkbox — `indeterminate` é SÓ do modo state (agregado, não valor submetido)
<Checkbox name="aceito" label="Aceito os termos" rules={validators.required()} /> // form
<Checkbox checked={marcadas} onCheckedChange={setTodas} aria-label="Todas" />     // state

// Select — `options` por prop; o form guarda o `value`, não o label
<Select name="uf" label="UF" options={ufs} rules={validators.required()} />     // form
<Select options={ufs} value={uf} onValueChange={setUf} aria-label="UF" />       // state

// Switch
<Switch name="ativo" label="Ativo" />                                           // form
<Switch checked={dark} onCheckedChange={setDark} label="Modo escuro" />         // state
```

Sem `label` visível, passe `aria-label` — o campo precisa de nome acessível.
Com `label`, a associação é implícita (o `<label>` envolve o input), sem id.

`TextField` cobre também os campos que não têm cara de formulário, via `size`
(`sm` h-9 / `md` h-10), `surface` (`background` / `contrast`) e os slots
`startAdornment`/`endAdornment`. A `SearchBar` é exatamente isso — não um
`<input>` avulso com classes copiadas.

Ao criar um componente de campo novo, siga o mesmo padrão: um `*View`
controlado + um wrapper de form (`useController`/`register`) + um público que
decide por `name`. Modo form exige `<FormProvider>` acima.

## Estado na URL (query)

Busca, filtro, aba aberta, página da listagem: mora na URL, não em `useState` —
é o estado que o usuário espera copiar, favoritar e desfazer com o "voltar".
Estado efêmero (modal aberta, hover) continua em `useState`.

- `src/lib/queryParams.ts` — semântica pura (merge, coerção de leitura),
  testável sem React nem router.
- `src/hooks/useQueryParams.ts` — liga aquilo ao TanStack. Funciona em qualquer
  componente sob o `<RouterProvider>`: sem `from`, sem a rota declarar nada.

```tsx
const query = useQueryParams<'q' | 'view'>()   // o generic só tipa as CHAVES

query.get('q')                          // string | undefined
query.getNumber('page')                 // number | undefined
query.set('view', 'board')              // preserva as outras chaves
query.set({ name: 'Helder', age: 20 })  // ?name=Helder&age=20, 1 navegação só
query.remove('q')                       // ou set('q', null)
```

**Vazio é ausente**: `null`, `undefined` e `''` apagam a chave ao escrever e
voltam `undefined` na leitura — nunca sobra `?q=` pendurado.

**Leitura é sempre explícita.** O router coage o valor antes de você ver
(`?age=20` chega como number, `?ok=true` como boolean, chave repetida como
array). Por isso `get` devolve SEMPRE string e number/boolean/lista se pedem
por método (`getNumber`, `getBoolean`, `getAll`).

Duas armadilhas do router, ambas por causa da mesma regra — `navigate` sem
`search` **zera a query**:

- escrevendo à mão, use a forma funcional (`search: (prev) => ...`), que é o
  que o hook já faz. `navigate({ to })` seco apaga tudo;
- `<Link to="...">` também apaga. Para preservar, `search={(prev) => prev}` (ou
  `search={true}`). Os links de seção da sidebar apagam **de propósito**: a
  busca é da tela que ficou para trás.

`<SearchBar>` (topbar) é o exemplo montado: o estado dele é `?q=`, ninguém
passa `value`/`onChange`, e quem consome lê `useQueryParams().get('q')` de onde
estiver. Entrada contínua escreve com `{ replace: true }` — sem isso cada tecla
vira uma entrada no histórico.

Quando uma rota quiser garantias de verdade (default, coerção, recusar lixo),
o caminho é `validateSearch` + `Route.useSearch()` NELA; este hook segue
valendo para o resto.

## Verificação

Ao mudar UI, verifique no browser. Cuidado: no browser pane embutido as
**transições CSS congelam** (`currentTime: 0`) — para ler o estado final de algo
animado, desligue a transição (`element.style.transition = 'none'`) ou cheque
`getAnimations()`.
