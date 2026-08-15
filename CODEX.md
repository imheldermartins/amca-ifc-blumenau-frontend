# CODEX.md — Cub's Database

Handoff operacional para mudanças que atravessam `cubs-frontend` e o backend
irmão `../cubs-backend`. As convenções gerais continuam nos `AGENTS.md` de
cada repositório; este arquivo concentra os contratos que mais afetam edição,
rollback e diagnóstico da `CubsDatabase`.

## Fontes prioritárias

1. Código e testes atuais.
2. [AGENTS.md](AGENTS.md) e
   [`../cubs-backend/AGENTS.md`](../cubs-backend/AGENTS.md).
3. [`../cubs-backend/docs/INTEGRACAO.md`](../cubs-backend/docs/INTEGRACAO.md)
   para modelo, rotas e invariantes do snapshot.
4. [`docs/demanda-backend.md`](docs/demanda-backend.md) como histórico de demanda;
   confirme qualquer pendência no código atual.
5. [`CLAUDE.md`](CLAUDE.md) para contexto arquitetural detalhado.

Código e testes prevalecem sobre tabelas de status antigas. Use
`docs/cubs-database-realtime-arquitetura.md` como registro de decisões, não
como fotografia garantida da implementação atual.

## Comandos

Frontend (`cubs-frontend`):

- `npm run dev` — Vite em `:5173`.
- `npm test` — testes Vitest.
- `npm run build` — typecheck + build.
- `npm run lint` — oxlint.

Backend (`../cubs-backend`):

- `docker compose -f docker/docker-compose.dev.yml up -d` — rqlite em `:8000`.
- `npm run dev` — Express + socket.io em `:3000`.
- `npm test` e `npx tsc --noEmit` — verificação.
- Migrations são append-only; nunca edite uma já aplicada.

## Identidades e fronteiras

- `pageId`: página parent aberta, tabela atual e sala
  `page-database:{pageId}`.
- `rowId`: página filha que representa a linha. É o `:id` nas rotas de valor.
- `columnId`: ULID da coluna real. `page_title` é uma coluna sintética e
  representa `pages.title` da linha.
- `workspaceId`: resolve somente o ponto de entrada; não substitui `pageId` nem
  `rowId` no fluxo de edição.
- O frontend nunca fala diretamente com rqlite. Toda escrita passa por HTTP;
  socket.io apenas transmite o fato depois do commit.
- `/api` é prefixo real do HTTP. `/socket.io` fica fora dele.

Não troque o `pageId` da tabela pelo `rowId` da célula. No backend, o evento de
célula resolve a parent a partir da linha para publicar na sala correta.

## Fluxo canônico de uma edição

`TableCell` → `CellChange` → `usePageDatabase` → `PageWriteService` →
`ApiService` → `page-route` → controller → `VALUE_CODECS` → rqlite → eco do
`RealtimeService`.

`CellChange` carrega `{ rowId, columnId, value, previousValue }`. O body HTTP
de uma célula real é `{ value }`; o envelope persistido `{"value": ...}` é
responsabilidade exclusiva do backend.

| Caso | Método e rota |
|---|---|
| Título sintético | `PUT /pages/:rowId` |
| Célula EAV ausente | `POST /pages/:rowId/column/:columnId/value` |
| Célula EAV existente | `PUT /pages/:rowId/column/:columnId/value` |
| Limpar célula EAV | `DELETE /pages/:rowId/column/:columnId/value` |

Existência é estrutural: presença de `row.cells[columnId]`, não truthiness do
valor. `false`, `0` e `""` são valores existentes. Se `previousValue` for a
sentinela, somente `undefined` significa ausência; `null` pode ser um registro
legado existente e não deve escolher `POST`. No valor novo, `null`/`undefined`
significa limpar. Se essa distinção voltar a ficar ambígua, transporte um
`hadValue` explícito.

`POST` em célula existente responde 409. `PUT` ou `DELETE` em célula ausente
responde 404. Esses status normalmente apontam para seleção incorreta do
método ou para ids errados, não para falha do realtime.

## Escrita otimista, rollback e eco

- `onMutate` aplica a mudança local e limpa a marca de erro anterior.
- Só uma rejeição HTTP real da revisão mais nova daquela célula executa o
  rollback, restaura `previousValue`, marca a célula e mostra o toaster. Uma
  falha antiga não pode desfazer uma edição posterior ainda em voo.
- Um 404/409 da revisão atual dispara reload depois do rollback: isso corrige o
  snapshot estrutural quando outra sessão criou ou removeu a célula.
- O servidor publica somente depois do commit. O autor recebe o próprio eco;
  ele confirma o valor e traz o `updatedAt` autoritativo.
- Owner e collaborator autorizados entram na mesma sala
  `page-database:{pageId}` e recebem a mesma audiência; não crie canais por
  role. A autorização do join é `canAccessPage` (dono ou colaboração herdada).
- Se um evento muda uma célula em edição, o receiver tem prioridade: text e
  numeric descartam o draft, adotam o valor recebido e desfocam com o blur
  neutralizado; select fecha o popover. `onCellEditConflict` marca a célula em
  vermelho e dispara feedback com coluna e valor formatado (select usa label,
  não ULID). Nunca preserve esse draft para um segundo blur — ele reemitiria um
  valor anterior sobre o commit remoto.
- O caminho otimista não inventa timestamp. Eventos mais antigos que o relógio
  conhecido são descartados.
- Reconexão relê a base somente após o ACK `joined-page-database`; respostas de
  reload antigas não podem substituir o snapshot mais novo. Criação/remoção de
  linha também relê a base.

Um `ECONNABORTED` do proxy WebSocket descreve a conexão do socket. Ele não
explica sozinho um 404 HTTP e não deve ser classificado como “registro não
encontrado”. Analise a request HTTP e o socket separadamente.

## Armadilha do retorno do rqlite

No rqlite, `last_insert_id` é metadado de `INSERT`; sucesso de `UPDATE` e
`DELETE` é indicado por `rows_affected`. Nunca use a truthiness de
`last_insert_id` como resultado genérico de escrita.

O falso negativo observado seguia esta sequência:

1. o SQL de `UPDATE` era executado e persistia a alteração;
2. rqlite devolvia `{ rows_affected: 1, rows: null }`, sem `last_insert_id`;
3. `core/db/shared.ts` exigia também `last_insert_id`, descartava o resultado e
   devolvia `undefined`;
4. `Model.update()` e o controller interpretavam isso como falha;
5. a rota respondia 404, então o frontend revertia uma edição já gravada.

Para `Model.update()`/`delete()`, a fonte de sucesso é
`rows_affected > 0`. Preserve a resposta estruturada do execute até a camada
que conhece a operação; `last_insert_id` só pode ser usado quando o caller
realmente precisa do id de um `INSERT`.

Diagnóstico de falha pós-SQL: a mesma request mostra SQL sem erro e
`rows_affected > 0`, mas a API devolve 404/resultado falso; recarregar pode
revelar que o banco mudou mesmo assim. Isso é diferente de registro realmente
ausente.

## Token stale versus falha pós-SQL

Depois de `npm run seed`, um access/refresh antigo pode continuar assinado mas
apontar para um usuário que não existe mais. O sintoma clássico é a mesma rota
funcionar com token novo e falhar no browser, frequentemente no `page_root`.
Faça logout, remova o cookie de refresh em dev se necessário e autentique de
novo antes de concluir que rota, proxy ou ids estão errados.

Distinção rápida:

- resposta muda quando troca o token → investigue sessão/usuário stale;
- SQL executa, `rows_affected > 0`, mas o controller reporta falha → investigue
  a interpretação da resposta do rqlite;
- SQL não encontra linha e `rows_affected === 0` → valide `rowId`, `columnId`,
  acesso herdado e escolha entre POST/PUT/DELETE.

## Outros contratos que não podem regredir

- Páginas formam árvore recursiva; não existe tipo especial de página raiz.
- Colunas pertencem à parent; valores ligam página filha + coluna.
- `pages.data` contém snapshots completos por view. `PUT /pages/:id` substitui
  `data` inteiro, então a gravação é read-modify-write com todas as views.
- Select persiste o ULID da option, não o label.
- `VALUE_CODECS` é a única fronteira do envelope de valores.
- Evento novo exige atualizar backend `realtime-service.ts` e frontend
  `SocketService.ts`.
- SQL cru fica em `core/db`; input vira bind parametrizado.

## Checklist de diagnóstico e entrega

1. Capture no Network método, URL, body, status e resposta da edição.
2. Confirme `pageId`, `rowId` e `columnId` em cada fronteira.
3. Confira no backend o statement, erros SQL e `rows_affected` antes de mudar o
   rollback.
4. Reproduza com token novo para excluir sessão stale.
5. Cubra criação, atualização, limpeza e valores falsy (`false`, `0`, `""`) em
   testes.
6. Rode testes, build e lint do frontend; rode testes e typecheck do backend.
