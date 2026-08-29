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
  `<FormProvider {...form}>` e use `TextField`, `Checkbox`, `Select` ou
  `Switch` (de [cubs-components](src/shared/cubs-components)) com `name` —
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

- [SocketService](src/services/SocketService.ts): conexão tipada
  (`ServerToClientEvents`/`ClientToServerEvents`) e autenticada — o handshake
  envia o access token, que o backend valida com o mesmo JWT das rotas HTTP.
  Se o handshake tomar "Não autorizado" (access token expirado), o client
  renova o par via `/auth/refresh` e reconecta sozinho.
- [useSocket](src/hooks/useSocket.ts): conecta enquanto o componente estiver
  montado (acquire/release) e expõe status + mensagem de erro ao vivo.
- Exemplo vivo em `/app` ([SocketExampleSection](src/pages/app/sections/SocketExampleSection.tsx)):
  status da conexão, presença (`presence:count`) e echo de ida e volta
  (`echo:send` → `echo:reply`). O contrato de eventos é espelhado em
  `cubs-backend/src/core/socket/socket-server.ts` — ao criar um evento novo,
  atualize os dois lados.

### Como testar a conexão socket

1. **Pela UI**: logado, abra `/pt-br/app` — o painel "Socket.io" mostra o
   status ao vivo. "Conectado" + "Conexões ativas: N" = handshake autenticado
   ok. Digite algo e clique "Enviar echo": a resposta volta carimbada com o
   seu userId (extraído do JWT no servidor).
2. **Pelo console do browser (F12)**: os logs padronizados `[cubs:socket]`
   contam a história — falha com causa e dica, renovação de token e
   reconexão. Na aba Network → filtro WS dá para ver o frame de upgrade e as
   mensagens trafegando.
3. **Sem browser** (o handshake engine.io responde por HTTP puro):
   `curl "http://localhost:5000/socket.io/?EIO=4&transport=polling"` —
   HTTP 200 com um JSON `{"sid":...}` prova que o servidor socket está de pé.
4. **Falhas comuns**: backend fora do ar → "websocket error" (o socket.io
   re-tenta sozinho); token expirado → "Não autorizado" (o client renova e
   reconecta); porta/env errada → confira `VITE_CUBS_API_URL` no `.env`.

## Tratamento de erros

Toda falha de serviço vira um [AppError](src/lib/errors.ts) com `scope`
(`api`/`socket`/`auth`) e é logada num formato único:

```
[cubs:api] POST /auth/login → 401: Credenciais inválidas
[cubs:socket] Falha ao conectar em http://localhost:5000: Não autorizado. Verifique...
```

O `ApiService` rejeita sempre `AppError` (com `status` HTTP normalizado) —
consumidores tratam `error.status`, nunca o erro cru do axios.

## Tema (light/dark)

Preferência persistida em `localStorage` (`cubs.theme`), aplicada como classe
`.dark` no `<html>`. Um script inline no [index.html](index.html) aplica o
tema salvo antes do React montar (sem flash); sem preferência salva, vale o
`prefers-color-scheme` do sistema. Toggle: [ThemeToggle](src/components/ThemeToggle.tsx)
(no header do `/app` e flutuante nas páginas públicas), estado via
[useTheme](src/hooks/useTheme.ts) e lógica em [theme.ts](src/lib/theme.ts).

## Rotas

O idioma vem como slug na URL (`/pt-br/...`). A raiz `/` redireciona para o
idioma padrão.

| Rota | Acesso | Página |
| --- | --- | --- |
| `/$lang/` | pública | Rota inicial (`HomePage`) |
| `/$lang/sign-in` | pública (deslogado) | `SignInPage` |
| `/$lang/sign-up` | pública (deslogado) | `SignUpPage` |
| `/$lang/app` | privada | `AppLayout` com `<Outlet />` para as rotas internas |

Guards (em `beforeLoad`):

- `_public` (sign-in/sign-up): usuário autenticado é redirecionado para `/$lang/app`.
- `app`: sem sessão, redireciona para `/$lang/sign-in`.

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
    │   ├── sign-in.tsx → "/$lang/sign-in"
    │   └── sign-up.tsx → "/$lang/sign-up"
    └── app/            → "/$lang/app"   (privada)
        ├── route.tsx   →   guard de auth + AppLayout (<Outlet />)
        └── index.tsx   → "/$lang/app/"  (AppHomePage)
```

Regras de nome:

- `route.tsx` — o layout/guard do diretório (roda `beforeLoad` e rende o
  `<Outlet />` dos filhos);
- `index.tsx` — a rota exata do segmento (`/$lang/app/`);
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

Página privada `/pt-br/app/config`: mesmo processo, mas o arquivo vai DENTRO
de `app/` — `src/routes/$lang/app/config.tsx` com
`createFileRoute('/$lang/app/config')`. Ela herda o guard de auth e o layout
do `app/route.tsx` automaticamente e renderiza no `<Outlet />` dele.

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
