# Arquitetura Realtime para o CubsDatabase (page-tree / Cub's)

> **STATUS (2026-07-21) — o que saiu do papel.** Implementado nos dois repos:
> sala por página (`page-database:{pageId}`) com join autorizado, `RealtimeService`
> com emits pós-commit (`cell-updated`, `column-updated`, `view-updated`,
> `row-created`/`row-deleted`, `page-presence`), escrita 100% via HTTP,
> `canAccessPage` (dono ou membro, herdado pela árvore) e as guardas de
> `updatedAt`/`originUserId` num redutor puro. Ver a seção "Colaboração e
> realtime" do CLAUDE.md.
>
> **Divergência consciente do §6:** o cache é UM `ParsedDatabase` por página, e
> não chaves por célula. O redutor puro isola a regra de merge, então a
> migração é mecânica quando a escala pedir.
>
> **Segue em aberto:** rollback visual de escrita que falha; soft × hard delete
> (§10); adapter de Redis para escala horizontal (§8).

> Resumo técnico de uma discussão sobre como levar o componente `CubsDatabase` — hoje somente leitura, alimentado por um SQL raw com JOIN entre 3-4 tabelas — para edição multiusuário em tempo real via Socket.io, mantendo a escrita sempre consistente através do backend Node/rqlite (Raft).

---

## 1. Contexto do projeto

- **Cub's**: protótipo validado dentro da Software Factory do IFC, parte do TCC sobre AMTA (Arquitetura Multi-Tenant Acadêmica), com Raft + rqlite como base de consistência distribuída.
- **Backend**: Node.js/TypeScript/Express 5, arquitetura em camadas (`BaseRouter<T>`, `Model<T>`, `SQLBuilder<T>`, `JwtService`, `AuthenticateMiddleware`), SQL confinado a `src/core/db/`.
- **Estrutura de dados da database (page-tree)**:
  - `page_edges` → relação parent/child de páginas (breadcrumbs, inode/dentry analogy)
  - `page_columns` → colunas, atreladas somente à **page-parent**
  - `page_column_values` → EAV, o laço entre **page-child** e **page-column** (envelope `{"value": <T>}`)
- **Estado atual**: rotas fetch já implementadas e funcionando; view é **somente leitura**. Falta implementar os inputs de escrita (`criar`, `atualizar`, `apagar`) e, a partir disso, o realtime via Socket.io para usuários vinculados à mesma página.

---

## 2. O problema central

Múltiplos usuários podem abrir a mesma view de `CubsDatabase`. O gatilho de edição de célula é `onBlur`. A pergunta: qual arquitetura de state + broadcast escala sem forçar re-render da tabela inteira a cada edição de qualquer usuário?

Três hipóteses foram colocadas na mesa:

1. Memoizar componentes com `key` chaveando alguma prop, assumindo que isso já basta para "perceber" a mudança em tempo real.
2. Um listener por célula (cada célula escuta o broadcast da room e filtra por `cellId === próprio id`).
3. Um listening único e mais "encorpado" por tabela, com o set global e a renderização avulsa resolvida pelo primeiro fator (memoização).

### Conclusão: a opção 3 é o caminho certo, com dois ajustes importantes

**a) `key` não é mecanismo de detecção de mudança.**
`key` serve para a reconciliação do React ter uma identidade estável na lista (`key={cell.id}` no `.map()`). Se algo que muda a cada update entrar na `key`, isso força **remount** da célula inteira — o oposto de performance. Memoização (`React.memo`) por si só também não resolve nada sozinha: o componente só deixa de re-renderizar se a prop que ele recebe realmente não mudar.

**b) Um listener por célula não escala.**
- Socket.io não tem como mirar broadcast numa célula específica sem o servidor abrir uma room por célula (inviável em escala — milhares de rooms numa tabela grande).
- Na prática, se toda célula escuta o mesmo evento da room da tabela e filtra internamente, isso é **O(N) execuções de callback por update**, mesmo que só uma célula precise re-renderizar.
- Com virtualização (TanStack Virtual, necessário eventualmente para tabelas grandes), células fora da viewport nem estão montadas — perdem updates e não têm como saber que perderam algo ao remontar.
- `addEventListener`/`removeEventListener` por célula em cada mount/unmount é fonte clássica de leak se o cleanup do `useEffect` não for exato.

---

## 3. Arquitetura recomendada

**Um único listener por página/tabela**, que não faz `setState` no componente pai (senão re-renderiza a tabela inteira). Em vez disso, escreve num **store externo normalizado por `cellId`** — reaproveitando o próprio cache do TanStack Query, já usado no projeto, sem precisar adicionar Zustand/Jotai.

```ts
// chamado uma vez, no nível da CubsDatabase
function useCubsTableRealtime(pageId: string) {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    socket.emit("join-page-database", { pageId });

    const handler = (event: CellUpdateEvent) => {
      queryClient.setQueryData(["cell", event.cellId], (old?: CellData) => {
        if (old && old.updatedAt >= event.updatedAt) return old; // ignora broadcast mais antigo
        return { value: event.value, updatedAt: event.updatedAt };
      });
    };

    socket.on("cell-updated", handler);
    return () => {
      socket.off("cell-updated", handler);
      socket.emit("leave-page-database", { pageId });
    };
  }, [pageId]);
}
```

```tsx
const Cell = React.memo(function Cell({ cellId }: { cellId: string }) {
  const { data } = useQuery({
    queryKey: ["cell", cellId],
    queryFn: () => fetchCellInitial(cellId), // só roda no fetch inicial
    staleTime: Infinity, // dali em diante quem atualiza é o socket via setQueryData
  });

  return <input defaultValue={data?.value} onBlur={handleBlur} />;
});
```

Cada `Cell` só re-renderiza quando o próprio `["cell", cellId]` muda no cache — o resto da tabela nem sabe que aconteceu update.

### Detalhes que mordem na prática

- **Eco do próprio usuário**: se o servidor faz `io.to(room).emit(...)`, quem editou recebe o próprio broadcast de volta. Usar `socket.broadcast.to(room).emit(...)` no servidor (exclui o emissor), ou carimbar o evento com `originClientId` e ignorar no client se bater com o próprio `socket.id`.
- **Staleness / ordem de chegada**: carimbar cada update com `updatedAt` (ou versão incremental) e só aplicar o broadcast se for mais recente que o que já está no cache. Evita que um evento atrasado sobrescreva uma edição local mais nova.

---

## 4. Nomenclatura de eventos e a classe `RealtimeService`

Separar **comando** (o que o client pede) de **evento** (o que o servidor confirma/propaga), no mesmo espírito imperativo/particípio de event sourcing:

- Client emite `join-page-database` (comando, `{ pageId }`)
- Server confirma pro próprio socket com `joined-page-database`
- Server pode propagar pra sala um `user-joined-page-database` (presença — útil no futuro para mostrar quem está vendo/editando a página)

A **room** é um identificador técnico separado do nome do evento: `page-database:{pageId}`.

### Escrita sempre via HTTP, socket só para broadcast pós-commit

Dado que a base é Raft/rqlite, **o socket não é o caminho de escrita**. Quem grava é sempre o HTTP (`BaseRouter` → `Model` → `SQLBuilder`, indo pro líder). Isso evita escrita duplicada ou fora de ordem, e um client escrevendo direto num nó que não é líder.

```
PATCH /pages/:pageId/cells/:cellId
  → Model.update() (via SQLBuilder, rqlite)
  → sucesso → RealtimeService.emitCellUpdated(pageId, payload)
  → io.to(`page-database:${pageId}`).emit("cell-updated", payload)
```

### Esqueleto da classe (static class pattern, consistente com `JwtService`/`Migrator`)

```ts
class RealtimeService {
  private static io: SocketIOServer;

  static initialize(io: SocketIOServer) {
    this.io = io;
    io.on("connection", (socket) => {
      socket.on("join-page-database", async ({ pageId }) => {
        const hasAccess = await AuthorizationService.canAccessPage(socket.data.userId, pageId);
        if (!hasAccess) return; // não deixa entrar na sala silenciosamente
        socket.join(RealtimeService.roomFor(pageId));
        socket.emit("joined-page-database", { pageId });
      });
    });
  }

  private static roomFor(pageId: string) {
    return `page-database:${pageId}`;
  }

  static emitCellUpdated(pageId: string, payload: CellUpdatedPayload) {
    this.io.to(this.roomFor(pageId)).emit("cell-updated", payload);
  }
  static emitColumnRenamed(pageId: string, payload: ColumnRenamedPayload) {
    this.io.to(this.roomFor(pageId)).emit("column-renamed", payload);
  }
  static emitPageMetaUpdated(pageId: string, payload: PageMetaUpdatedPayload) {
    this.io.to(this.roomFor(pageId)).emit("page-meta-updated", payload);
  }
}
```

**Importante**: `AuthorizationService.canAccessPage` no join não é opcional. Sem essa checagem, qualquer usuário autenticado poderia entrar em `page-database:{pageId}` de uma página de outro tenant e escutar edições alheias — o mesmo isolamento multi-tenant do AMTA precisa valer no realtime. Vale ligar isso no `AuthenticateMiddleware` já existente no REST.

### Mapeando os quatro triggers

| Trigger | Ação | Evento emitido |
|---|---|---|
| **visualizar** | GET + join na sala | — (todo mundo que abre a página entra) |
| **criar** (linha/coluna) | POST | `row-created` / `column-created` |
| **atualizar** (valor de célula) | PATCH | `cell-updated` |
| **apagar** | DELETE | `row-deleted` / `column-deleted` |

**Questão em aberto**: `apagar` é soft ou hard delete? Isso muda se o evento remove a linha da estrutura do client ou só marca como inativa — relevante para o EAV em `page_column_values`, que provavelmente precisa de cascade.

---

## 5. Fetch inicial vs. sincronização realtime

Fetch assíncrono puro **não é suficiente sozinho**, mas também não precisa ser sequencial com o join da room.

### Fetch e join em paralelo, não em sequência

Se o join esperar o fetch terminar, existe uma janela onde um evento de outro usuário pode chegar **entre** o fetch e o join, e ser perdido. A saída é disparar os dois em paralelo e reaproveitar o **mesmo guard de timestamp** já usado no merge de célula: tanto o evento de socket quanto o dado vindo do fetch inicial passam pelo mesmo `setQueryData` com `if (old.updatedAt >= incoming.updatedAt) return old`. A ordem de chegada deixa de importar — quem tem o timestamp mais recente vence.

### Granularidade do cache é o que faz isso funcionar

Isso só funciona se a query cache for por célula/bucket, **não a tabela inteira num blob só** — senão o fetch, ao resolver, sobrescreve a query inteira e apaga qualquer update mais novo que chegou via socket enquanto o fetch ainda estava em voo.

### Reconexão

Se o socket cair e reconectar, não há garantia de que eventos perdidos nesse intervalo serão reenviados. O mais simples e seguro: no handler de `connect` do client (que também dispara em reconexão), invalidar a query raiz (o JOIN completo) e rodar o seed de novo. Mais barato que tentar reconstruir um replay de eventos perdidos.

---

## 6. As três granularidades reais de edição

A partir do schema real (`page_column_values`, `page_columns`, `page` parent), ficou claro que "célula" não é a única unidade de mudança — existem três blast radius diferentes:

| Dado | Pertence a | Frequência | Blast radius |
|---|---|---|---|
| `page_column_values.value` | célula individual | alta | 1 célula |
| `page_columns.name` | parent (coluna) | baixa | header + todas as células da coluna (só o rótulo, não o valor) |
| dados da `page` parent (título, ícone) | parent | baixíssima | topo da página |

### Três buckets de query key, todos escopados por `pageId`

```ts
["page-meta", pageId]      // dados da página parent
["page-columns", pageId]   // array de colunas (id, name, type...)
["cell", cellId]           // valor individual de page_column_values
```

O fetch inicial (o JOIN raw SQL já existente) continua sendo a única fonte de verdade — ao resolver, é "espalhado" (seed) nos três formatos:

```ts
function seedCubsDatabaseCache(queryClient: QueryClient, pageId: string, raw: RawJoinResponse) {
  queryClient.setQueryData(["page-meta", pageId], raw.pageMeta);
  queryClient.setQueryData(["page-columns", pageId], raw.columns);
  raw.rows.forEach((row) => {
    row.cells.forEach((cell) => {
      queryClient.setQueryData(["cell", cell.id], { value: cell.value, updatedAt: cell.updatedAt });
    });
  });
}
```

Componentes downstream nunca tocam o blob bruto — só as chaves granulares.

### Client escutando os três eventos

```ts
socket.on("cell-updated", (e) => {
  queryClient.setQueryData(["cell", e.cellId], (old?: CellData) =>
    old && old.updatedAt >= e.updatedAt ? old : { value: e.value, updatedAt: e.updatedAt }
  );
});

socket.on("column-renamed", (e) => {
  queryClient.setQueryData(["page-columns", pageId], (old: Column[] = []) =>
    old.map((c) => (c.id === e.columnId ? { ...c, name: e.name } : c))
  );
});

socket.on("page-meta-updated", (e) => {
  queryClient.setQueryData(["page-meta", pageId], (old) => ({ ...old, ...e.patch }));
});
```

O guard de `updatedAt` vale para os três — column rename e page meta também deveriam carregar timestamp/versão.

---

## 7. Conexão vs. room membership (a questão de várias databases/usuários)

Distinção chave para responder "tempo real sob demanda com várias databases por diferentes usuários": **conexão de socket** e **membership de room** não deveriam ter o mesmo ciclo de vida.

- **Conexão**: única por sessão de app, estabelecida uma vez (provider no root layout do TanStack Router, ou no momento de autenticação), reaproveitada durante toda a navegação. Websocket é barato de manter aberto — o custo real está em quantas rooms/tráfego ele recebe, não na conexão em si.
- **Room membership**: sim, "sob demanda" — escopada ao ciclo de vida do componente `CubsDatabase`, entra quando a página abre, sai quando fecha ou troca de `pageId`.

Se a conexão for aberta/fechada a cada `CubsDatabase` montado/desmontado, paga-se handshake + auth a cada navegação na page-tree — ruim justamente no padrão de uso esperado (clicar entre páginas-child o tempo todo).

O hook `useCubsTableRealtime` já resolve isso sozinho, porque o efeito depende de `[pageId]`: trocar de página dispara leave da room antiga e join na nova automaticamente, sem derrubar a conexão.

**Resultado prático**: o servidor não mantém sync ativo para nenhuma database sem alguém de fato olhando para ela. Rooms sem membros não emitem nem custam nada, e o Socket.io limpa rooms vazias sozinho — não precisa de cleanup manual no `RealtimeService`.

---

## 8. Escala horizontal (nota para o futuro / possível trabalho futuro do TCC)

Com o adapter em memória padrão do Socket.io, tudo funciona bem contanto que seja **um processo Node só**. Se em algum momento o backend escalar horizontalmente (múltiplas instâncias), a room membership fica isolada por instância — um usuário conectado na instância A editando não notifica quem está na instância B. Seria necessário um adapter compartilhado (ex: `@socket.io/redis-adapter`) para propagar broadcast entre instâncias.

Para a validação do protótipo na Software Factory isso provavelmente não é urgente (single node resolve), mas é literalmente o mesmo tipo de problema de consistência distribuída que o AMTA já resolve para o dado via Raft/rqlite — só que agora na camada de notificação em tempo real. Pode ser uma nota interessante na seção de trabalhos futuros da thesis.

---

## 9. Ordem de trabalho sugerida

A boa notícia: a separação por query key torna a priorização de views/CRUD antes do realtime **literalmente independente**.

1. **Construir os componentes de escrita primeiro**, funcionando 100% sem nenhum socket: `onBlur` → `useMutation` → PATCH, com update otimista local via `queryClient.setQueryData` no `onSuccess` da mutation.
2. **`RealtimeService` entra depois**, só passa a alimentar as mesmas chaves de cache (`["cell", cellId]`, `["page-columns", pageId]`, `["page-meta", pageId]`) — nenhum componente precisa mudar.

---

## 10. Decisões em aberto (para revisitar)

- [ ] `apagar` (linha/coluna): soft delete ou hard delete? Impacta o payload do evento e o cascade em `page_column_values`.
- [ ] Timeline de escala horizontal do backend — define se o Redis adapter é preocupação imediata ou nota de trabalho futuro.
- [ ] Definir tipos concretos de payload (`CellUpdatedPayload`, `ColumnRenamedPayload`, `PageMetaUpdatedPayload`, `RowCreatedPayload`, `RowDeletedPayload`) com base no `CLAUDE.md` e no código atual do `CubsDatabase`.
- [ ] Fechar o contrato de `AuthorizationService.canAccessPage` e sua integração com `AuthenticateMiddleware`.

---

## 11. Próximos passos

Quando o `CLAUDE.md` e o estado atual do `CubsDatabase`/rotas forem compartilhados, os próximos passos naturais são:
- Fechar os tipos de payload de cada evento.
- Ver como o envelope EAV (`{"value": <T>}`) de `page_column_values` se encaixa exatamente no `CellData` do cache.
- Implementar de fato os inputs de escrita (criar/atualizar/apagar) sobre as rotas fetch já existentes, seguindo o gate de aprovação antes de criação de arquivo já estabelecido no projeto.
