# Cub's — Frontend

Frontend do Cub's construído com **React 19 + TypeScript + Vite**, usando
**TanStack Router** (file-based routing), **TanStack Query**, **Tailwind CSS v4**
e infraestrutura do **shadcn/ui**.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck (tsc -b) + build de produção
npm run lint       # oxlint
```

O sign-in/sign-up falam com o **backend do Cub's** (`cubs-backend`, Express +
JWT + bcrypt), que por sua vez usa o **rqlite** como banco. A cadeia é:

```
frontend (:5173)  ->  cubs-backend (:3000)  ->  rqlite (:8000)
```

Em dev, as chamadas do frontend vão para `/api/...` e o Vite proxeia para
`http://localhost:3000`. Para o fluxo de auth funcionar, o backend precisa
estar no ar (no repo `cubs-backend`): suba o rqlite (`docker compose up -d`
em `docker/`), rode as migrations (`npm run migrate`) e o servidor
(`npm run dev`, porta 3000). Para apontar o frontend direto para outro
backend, copie `.env.example` para `.env` e defina `VITE_CUBS_API_URL`.

### Rotas de auth consumidas (backend)

- `POST /auth/register` `{ name?, email, password }` → `201 { user, tokens }`
- `POST /auth/login` `{ email, password }` → `200 { accessToken, refreshToken }`
- `POST /auth/refresh` `{ refreshToken }` → `200 { accessToken, refreshToken }`
- `GET /users` (Bearer) → `[user]` — o próprio usuário, escopado ao token

O par de tokens é guardado em `localStorage` ([tokenStore](src/services/tokenStore.ts));
o [ApiService](src/services/ApiService.ts) anexa o access token em toda chamada
e, num 401, tenta renovar via `/auth/refresh` uma vez antes de refazer a
requisição. O refresh é *single-flight*: N requisições com 401 simultâneos
aguardam a mesma chamada de refresh (o token não é rotacionado N vezes).

## Formulários (react-hook-form)

- Os campos se registram sozinhos via contexto: envolva o form em
  `<FormProvider {...form}>` e use `TextField`, `Checkbox`, `Select`, `Switch`
  ou `DatePicker` (de [cubs-components](src/shared/cubs-components)) com `name` —
  estado, validação e mensagem de erro vêm do próprio campo, sem `useState`
  manual. Use `noValidate` no `<form>` (a validação é do RHF). Nenhum
  `<input>`/`<select>` avulso: os componentes existem para isso.
- **Máscaras** ([masks.ts](src/shared/cubs-components/lib/masks.ts)):
  `phone-br`, `cpf`,
  `cep`, `date` e `currency` (BRL por enquanto; `currency-<codigo>` quando
  houver outras moedas — os dígitos são tratados como centavos e formatados
  via `Intl.NumberFormat`; `unmaskCurrencyCents` faz o caminho de volta).
  Passe `mask="cpf"` no TextField; o valor é re-formatado a cada tecla,
  antes do RHF ler o evento.
- **Datas** ([DatePicker.tsx](src/shared/cubs-components/DatePicker.tsx)):
  aceita máscara `dd/mm/aaaa` e seleção no calendário, com hora e intervalo
  opcionais. O valor entregue ao RHF já é o wire da API (`ISO` ou
  `startISO@endISO`); sem hora, sai em UTC à meia-noite
  (`T00:00:00.000Z`), sem depender do fuso do browser.
- **Validators** ([src/lib/validators.ts](src/lib/validators.ts)): `required`,
  `email`, `minLength(n)`, `phoneBr`, `cpf` (com dígito verificador) — as
  mensagens de erro já vêm definidas (chaves `validation.*` do i18n).
  Combine com `combineRules(validators.required(), validators.cpf())`.
- Exemplo vivo em `/app` ([FormExampleSection](src/pages/app/sections/FormExampleSection.tsx)):
  máscaras, validação e prévia ao vivo com `watch()`.

## Conexões (API × Socket)

**A API HTTP e o socket.io são o MESMO servidor** — o socket.io pega carona
no `http.Server` do express (mesma origem/porta); só muda o protocolo da
conversa: a API fala HTTP puro, e o socket começa em HTTP e sofre upgrade
para WebSocket no path `/socket.io` (por isso a URL do socket usa
`http://`, não `ws://` — o upgrade acontece por dentro).

A resolução é centralizada em [connection.ts](src/lib/connection.ts):

1. `VITE_CUBS_SOCKET_URL` — só se o socket um dia morar em outro servidor;
2. `VITE_CUBS_API_URL` — origem do backend; o socket **herda** daqui;
3. sem env nenhuma — proxy do Vite em dev (`/api` e `/socket.io` → `:3000`).

## Socket.io

- [SocketService](src/services/SocketService.ts): somente conexão autenticada,
  reconexão e ciclo de vida por consumidores. O handshake envia o access token;
  em "Não autorizado", renova via `/auth/refresh` e reconecta uma vez.
- [PageRealtimeChannel](src/services/PageRealtimeChannel.ts): join/leave da
  room `page-database:{pageId}`, filtro, listeners v1, cleanup e resize
  efêmero. `usePageRealtime` é apenas sua adaptação ao React; views não abrem
  sockets próprios.
- [useSocket](src/hooks/useSocket.ts): conecta enquanto o componente estiver
  montado (acquire/release) e expõe status + mensagem de erro ao vivo.
- `presence:count` e `echo:send` → `echo:reply` continuam no `SystemChannel`
  como compatibilidade/diagnóstico v1 e têm testes no backend. O contrato gerado é
  [realtime-contract-v1.ts](src/services/realtime-contract-v1.ts); a fonte
  canônica fica no backend. Rode lá `npm run realtime:contract:sync` após uma
  evolução e `npm run realtime:contract:check` no gate.

Escritas de domínio continuam 100% HTTP. Depois do commit, o backend propaga
célula, título de linha/página, coluna e snapshot para a room da página. O
autor recebe o próprio eco. Criações/exclusões estruturais e reconexões
coalescem um refetch autoritativo depois do ACK. A arquitetura completa está na
[ADR realtime v1](../cubs-backend/docs/adr/0001-realtime-v1.md).

### Identidade e configurações da página

O [PageShell](src/components/PageShell.tsx) busca os vínculos da página e
compõe o usuário autenticado com eles. [Avatar](src/components/Avatar.tsx)
renderiza a projeção criada por
[userVisualIdentity](src/lib/userVisualIdentity.ts), sem persistência adicional:
nome simples usa uma inicial, nome composto usa a primeira e a última, e três
caracteres aparecem somente para resolver colisões. As cores são distribuídas
de modo determinístico e não se repetem enquanto houver opções livres na
paleta. A pilha do cabeçalho destaca o usuário atual, mostra até três
identidades e resume o restante com `+N`.

O trigger abre [PageSettingsModal](src/components/PageSettingsModal.tsx), que
segue o padrão de navegação lateral das configurações globais. O fragmento
`#collaborators` é um deep link real: abre diretamente a aba, acompanha
back/forward e é removido ao fechar sem apagar hashes de outras interfaces.
Owner não é fabricado pela rota de colaboradores; o shell adiciona o usuário
da sessão e deduplica os vínculos.

O mesmo shell mantém o título, o horário relativo derivado de `pages.updated_at`
e o seletor do conteúdo. `files` monta a `CubsDatabase` atual; `document` e
`workflow` possuem placeholders próprios para receber, respectivamente, o
editor de blocos e o canvas de nós sem duplicar o cabeçalho, colaboradores ou
a assinatura realtime da página.

### Filtros e agrupamentos da view

`DataViewType.filters` é um `ViewFiltersV2` atômico: `clauses` e `groupBy`
guardam ULIDs canônicos, `passthrough` preserva extensões e `updatedAt` é
carimbado exclusivamente pela API. Strings v1 continuam sendo lidas e são
reconciliadas de forma idempotente, sem migration de tabela.

A toolbar da `CubsDatabase` oferece select pesquisável com checkbox e drag de
prioridade, popover “Onde coluna condição valor” dirigido por `mappedFilters`
e chips removíveis. Na tabela, grupos viram faixas roxas recolhíveis e linhas
indentadas; o drag de linha fica desativado enquanto há agrupamento.

O estado copiável usa somente keys legíveis, por exemplo
`?view=docentes&fv=2&group=area&f.nome.contains=Ana`; ULIDs de view, coluna e
option não vazam para a URL. Aliases mantêm links antigos e são
canonicalizados com `replace`. A URL é soberana para a visualização. Quando
diverge de filtros/grupos salvos, a confirmação decide se ela também vira o
novo padrão; “Não” preserva o banco.

Filtros e grupos persistem juntos por
`PUT /pages/:id/views/:viewId/filters`, com debounce trailing de 250 ms e no
máximo uma request em voo mais a versão final pendente. Um `view-updated`
remoto não interrompe a análise atual: a toolbar mostra “Filtros alterados ·
Atualizar”. Não há polling.

### Como testar a conexão socket

1. **Pela UI**: logado, abra uma página. Na aba Network → WS, confirme o
   handshake, `join-page-database` e o ACK `joined-page-database`.
2. **Pelo console do browser (F12)**: os logs padronizados `[cubs:socket]`
   contam a história — falha com causa e dica, renovação de token e
   reconexão. Na aba Network → filtro WS dá para ver o frame de upgrade e as
   mensagens trafegando.
3. **Teste automatizado real**: no backend,
   `npm test -- src/core/socket/socket-server.integration.test.ts` sobe porta
   efêmera e conecta owner, collaborator e usuário sem acesso.
4. **Sem browser** (o handshake engine.io responde por HTTP puro):
   `curl "http://localhost:3000/socket.io/?EIO=4&transport=polling"` —
   HTTP 200 com um JSON `{"sid":...}` prova que o servidor socket está de pé.
5. **Falhas comuns**: backend fora do ar → "websocket error" (o socket.io
   re-tenta sozinho); token expirado → "Não autorizado" (o client renova e
   reconecta); porta/env errada → confira `VITE_CUBS_API_URL` no `.env`.

## Tratamento de erros

Toda falha de serviço vira um [AppError](src/lib/errors.ts) com `scope`
(`api`/`socket`/`auth`) e é logada num formato único:

```
[cubs:api] POST /auth/login → 401: Credenciais inválidas
[cubs:socket] Falha ao conectar em http://localhost:3000: Não autorizado. Verifique...
```

O `ApiService` rejeita sempre `AppError` (com `status` HTTP normalizado) —
consumidores tratam `error.status`, nunca o erro cru do axios.

## Tema (light/dark)

Preferência persistida em `localStorage` (`cubs.theme`), aplicada como classe
`.dark` no `<html>`. Um script inline no [index.html](index.html) aplica o
tema salvo antes do React montar (sem flash); sem preferência salva, vale o
`prefers-color-scheme` do sistema. Toggle: [ThemeToggle](src/components/ThemeToggle.tsx)
(no `AppLayout` e flutuante nas páginas públicas), estado via
[useTheme](src/hooks/useTheme.ts) e lógica em [theme.ts](src/lib/theme.ts).

## Workspaces

O cadastro comum cria junto uma workspace individual chamada `Area de Trabalho
do <primeiro nome>` e entra diretamente nela. A landing também oferece
`/$lang/create-workspaces`: um multiform público recebe uma chave `create`,
preenche nome/e-mail emitidos para revisão e cria conta + primeira workspace em
um único submit. A chave fica apenas em memória e nunca entra na URL ou no
`localStorage`.

Depois do login, o usuário escolhe uma workspace real em `/$lang/workspaces`
ou usa `/$lang/workspaces/new?tab=create|join`. Nessa tela autenticada, as duas
operações exigem uma chave single-use emitida pelo backend e vinculada ao
nome/e-mail da conta. A criação pede também o nome da área; a entrada cria uma
membership `member`.

Cada membership carrega `role` (`superadmin`/`member`) e `pageRootId`. A root do
criador conserva o id da workspace; cada membro posterior recebe uma página
ULID própria e de sua propriedade. A relação organização → workspaces é 1:N,
enquanto `organizationId` nulo identifica uma área independente.

`superadmin` configura nome/ícone e roles em rotas full-screen sob
`/$lang/workspaces/$workspaceId/settings`; `member` pode abrir somente a sua
root e é encaminhado a `/$lang/access-denied` ao tentar acessar o painel. CASL
espelha essa experiência no cliente, mas a API repete a autorização e responde
403 `{ message: "Acesso não permitido" }`.

A preferência “abrir direto” usa `clientStorage` (`cubs.preferredWorkspace`)
com `{ userId, workspaceId }`. Ela não atravessa contas e só é usada enquanto
a workspace continuar na listagem autorizada; `?choose=true` força a seleção.
Este módulo é HTTP-only e não participa das salas/eventos de realtime.

## Rotas

O idioma vem como slug na URL (`/pt-br/...`). A raiz `/` redireciona para o
idioma padrão.

| Rota | Acesso | Página |
| --- | --- | --- |
| `/$lang/` | pública | Rota inicial (`HomePage`) |
| `/$lang/sign-in` | pública (deslogado) | `SignInPage` |
| `/$lang/sign-up` | pública (deslogado) | `SignUpPage` |
| `/$lang/create-workspaces` | pública (deslogado) | chave → conta → primeira workspace |
| `/$lang/workspaces` | privada | seletor de workspaces |
| `/$lang/workspaces/new` | privada | tabs de criar/entrar (`?tab=create|join`) |
| `/$lang/workspaces/$workspaceId/settings/general` | privada (`superadmin`) | nome e IconPicker |
| `/$lang/workspaces/$workspaceId/settings/members` | privada (`superadmin`) | usuários e roles |
| `/$lang/access-denied` | privada | acesso não permitido |
| `/$lang/myworkspace/$workspaceId` | privada + `AppLayout` | root da membership |
| `/$lang/page/$pageId` | privada + `AppLayout` | página pelo id |
| `/$lang/colaborando` | privada + `AppLayout` | páginas compartilhadas |

Guards:

- `_public` (sign-in/sign-up): usuário autenticado segue para
  `/$lang/workspaces`.
- `_private`: sem sessão, redireciona para `/$lang/sign-in`.
- o painel de workspace acrescenta o gate de role e a API repete a checagem.

### Anatomia (file-based routing, convenção de diretórios)

A árvore de pastas em `src/routes/` espelha a URL — cada arquivo vira uma
rota, gerada pelo plugin do TanStack Router:

```
src/routes/
├── __root.tsx          → casca de TODAS as rotas (Outlet + devtools)
├── index.tsx           → "/"            (redireciona p/ idioma padrão)
└── $lang/              → "/$lang"       ($ = segmento dinâmico)
    ├── route.tsx       →   layout do segmento: valida idioma, ativa i18n
    ├── index.tsx       → "/$lang/"      (HomePage)
    ├── _public/        →   grupo SEM url (_ = pathless layout): guard de deslogado
    │   ├── route.tsx
    │   ├── sign-in.tsx          → "/$lang/sign-in"
    │   ├── sign-up.tsx          → "/$lang/sign-up"
    │   └── create-workspaces.tsx → "/$lang/create-workspaces"
    └── _private/       →   grupo SEM url: guard de autenticado
        ├── route.tsx
        ├── access-denied.tsx
        ├── _app/       →   grupo SEM url: AppLayout + WorkspaceProvider
        │   ├── route.tsx
        │   ├── myworkspace/$workspaceId.tsx
        │   ├── page/$pageId.tsx
        │   └── colaborando.tsx
        └── workspaces/
            ├── index.tsx
            ├── new.tsx
            └── $workspaceId/settings/
                ├── route.tsx
                ├── general.tsx
                └── members.tsx
```

Regras de nome:

- `route.tsx` — o layout/guard do diretório e o `<Outlet />` dos filhos;
- `index.tsx` — a rota exata do segmento;
- `$param/` — segmento dinâmico (vira `useParams()`);
- `_nome/` — agrupa filhos sob um layout **sem** aparecer na URL;
- prefixo `-` (arquivo ou pasta) — ignorado pelo router (helpers, componentes);
- `src/routeTree.gen.ts` — **gerado** pelo plugin (dev server ou build);
  nunca editar na mão.

As visualizações ficam em `src/pages/<pagina>/NomePage.tsx`; os arquivos de
rota são só a ligação (guard + `component`).

### Como criar uma rota

Página pública `/pt-br/sobre`:

1. View: `src/pages/sobre/SobrePage.tsx` (textos via `i18n()` +
   chaves novas no `pt-br.json`).
2. Rota: `src/routes/$lang/sobre.tsx`:

   ```tsx
   import { createFileRoute } from '@tanstack/react-router'
   import { SobrePage } from '@/pages/sobre/SobrePage'

   export const Route = createFileRoute('/$lang/sobre')({
     component: SobrePage,
   })
   ```

3. Com o `npm run dev` rodando, o plugin regenera a árvore sozinho (e conserta
   o path do `createFileRoute` se você errar). Navegue com
   `<Link to="/$lang/sobre" params={{ lang }}>`.

Página privada com chrome: mesmo processo, mas o arquivo vai dentro de
`src/routes/$lang/_private/_app/`; ela herda o guard de auth, `AppLayout` e
`WorkspaceProvider`. Uma tela privada full-screen (como seleção/configuração de
workspace) vai diretamente sob `_private`, fora de `_app`.

Sub-área nova com guard próprio (ex.: `/admin`): crie `src/routes/$lang/admin/route.tsx`
com o `beforeLoad` do guard + component com `<Outlet />`, e os filhos como
arquivos dentro de `admin/`.

## i18n

- Todo conteúdo estático de tela passa por `i18n('chave')` — **nada de string
  solta em componente**.
- Chaves hierárquicas: página / seção / componente. Ex.:
  `i18n('pages.sign-in.entre-seja-bem-vindo')` → `"Entre Seja Bem-Vindo!"`.
- Traduções em `src/locales/<slug>.json` (chave-valor), ex.: `pt-br.json`.

### Como adicionar um novo idioma

1. Crie `src/locales/<slug>.json` (ex.: `en-us.json`) copiando a estrutura de
   chaves de `pt-br.json`.
2. Registre-o em `LANGUAGES` no `src/lib/i18n.ts` (slug da URL, locale BCP-47,
   label e o JSON importado).
3. Pronto: `/en-us/...` passa a funcionar e `i18n()` resolve no idioma novo.

O passo a passo também está comentado no topo de `src/lib/i18n.ts`.

## Tema e paleta

- [index.css](src/index.css) implementa **só a base** — nada de token
  por-componente:
  - `background` (`light-100` / `dark-900`), `contrast`
    (`light-200` / `dark-800`), `divider` (`light-300` / `dark-700`) e
    `foreground` (`dark-700` / `light-300`);
  - os valores vêm da escala histórica do **Cub's**, registrada como
    `light-100..900` e `dark-100..900`; neutros genéricos do Tailwind não são
    usados como fonte do tema;
  - `rounded` (sem sufixo) é o raio padrão do projeto e vale `rounded-xl`;
  - dark mode por classe `.dark` na raiz; borda sem cor explícita usa o
    `divider` por padrão (`@layer base`).
  Componentes compõem a partir disso: `bg-contrast`, `border-divider`,
  `rounded`, ...
- [theme.ts](src/lib/theme.ts) — os mesmos tokens como classes utilitárias
  prontas + a persistência do tema (localStorage).
- [palette.ts](src/shared/cubs-components/lib/palette.ts) — cores de destaque com chaves semânticas
  mapeando hues do Tailwind: `red → rose`, `blue → blue`, `purple → violet`,
  `green → emerald`. Regra de tema: tom `-300` no light e `-500` no dark
  (texto sobre fundo colorido usa `light-100`; texto NA cor usa
  `-600`/`-400` para leitura). Classes literais (Tailwind não compila classe
  montada em runtime) e helpers `paletteBgText` / `paletteBorderText`.
- [Button.tsx](src/shared/cubs-components/Button.tsx) — variantes `filled`, `outlined` e
  `text` (só a cor no texto em repouso; fundo aparece no hover). Cor padrão
  `purple`; `color` aceita qualquer cor da paleta ou `from-theme`, que usa os
  tokens neutros do tema (`foreground` no texto, `active` no fundo) em vez de
  um hue.
- [Typography.tsx](src/components/Typography.tsx) — texto padronizado com
  variants (`h1`, `h2`, `h3`, `subtitle`, `body`, `caption`) e prop `as`
  para trocar a tag mantendo o estilo. Todo texto de página passa por ele
  (o conteúdo continua vindo do i18n).
- **Fonte**: **Noto Sans** (variável, 100–900), auto-hospedada via
  `@fontsource-variable/noto-sans` (sem requisição externa). Importada em
  [main.tsx](src/main.tsx) e apontada em `--font-sans` no `@theme` do
  [index.css](src/index.css) — o preflight do Tailwind faz todo o app herdar.
  Para trocar a fonte: instale outro pacote `@fontsource*`, ajuste o import e
  a família em `--font-sans`.

> Nota: não há tokens de cor por-componente — só a base acima. Um elemento
> tipo painel é só composição de utilitários, ex.:
> `rounded border border-divider bg-contrast p-6`. Se um dia rodar
> `npx shadcn add`, o componente virá esperando tokens que aqui não existem
> (`--primary`, `--muted`, ...); adapte as classes dele para esta base.

## Lib autoral: cubs-database

O componente `<CubsDatabase />` (visualização da base de dados simulada da
arquitetura PageTree) é desenvolvido como uma **lib npm autoral** dentro deste
repo — detalhes no [README da lib](packages/cubs-database/README.md).

- **Fonte da verdade: [src/shared/cubs-database](src/shared/cubs-database)** —
  edite direto aí, com HMR. O alias `cubs-database` (vite/tsconfig) aponta para
  a fonte, então o app importa como pacote:
  `import { CubsDatabase, mockableData } from 'cubs-database'`.
- **[packages/cubs-database](packages/cubs-database)** é só a casca de
  publicação (nome, versão, exports, scripts). Não tem código-fonte; o `dist/`
  (JS ESM + `.d.ts`) é gerado no build e não vai para o git.
- No `package.json` do app a lib fica listada como dependência local:
  `"cubs-database": "file:packages/cubs-database"` (vira link no
  `node_modules`).

### Scripts

```bash
npm run cubs-database:bump    # versão +0.1 (0.9.0 → 1.0.0) e carimba version.ts na fonte
npm run cubs-database:build   # compila a fonte → packages/cubs-database/dist
npm run cubs-database:pack    # gera o tarball instalável (builda sozinho via prepack)
```

### Instalando em outro projeto React

```bash
# 1. aqui no cubs-frontend — gera packages/cubs-database/cubs-database-<versao>.tgz
npm run cubs-database:pack

# 2. no outro projeto
npm install ../cubs-frontend/packages/cubs-database/cubs-database-<versao>.tgz
```

O pacote entra no `node_modules` do outro projeto **só com o JS buildado** e
os tipos — `import { CubsDatabase } from 'cubs-database'` funciona sem
Vite/TS especial. Publicar num registro npm no futuro usa o mesmo `dist`
(basta remover o `"private": true` da lib e `npm publish`).

> Pendência antes da v1.0: o componente usa classes Tailwind com tokens do
> tema do Cub's (`bg-contrast`, `border-divider`, ...). Num projeto sem esses
> tokens ele renderiza sem estilo — a lib ainda vai embutir CSS próprio.

## Convenções

- Rotas: nomes padrão em kebab-case (`sign-in`, `sign-up`, ...).
- Funções utilitárias: `camelCase`.
- Sections, ClassServices e Components: `PascalCase` (`ApiService`,
  `SignUpPage`, ...).
- Dependências sempre com versão exata (`npm install --save-exact`).
- Composição de classes com o util `cn` (`clsx` + `tailwind-merge`) de
  `cubs-components`.
