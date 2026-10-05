# Form view — implementação incremental

Documento único de continuidade para a implementação cross-repo da visualização
`form` no Cub's. Não criar outro plano ou handoff para esta feature.

## Estado geral

- Frontend: `C:\Projects\cubs-frontend`
- Backend: `C:\Projects\cubs-backend`
- Branch frontend: `feat/heatmap-calendar`
- Branch backend: `feat/rqlite-orm-schema-migrations`
- Última atualização: 2026-10-03

## Decisões de contrato

1. `form` é um `DataViewKind` persistido no snapshot de `pages.data`.
2. A configuração pertence à view:

   ```ts
   form: {
     version: 1
     flowColumnId: string
     hiddenFieldIds?: string[]
     submitButton: {
       label: string
       icon: string | null
     }
   }
   ```

3. Só é possível criar, converter ou duplicar uma view `form` quando o banco
   possui uma coluna ativa de `type === "flow"`. O backend é a autoridade final.
4. Cada formulário vincula exatamente uma coluna Flow. Quando há uma única
   coluna Flow, o frontend a seleciona por padrão; com várias, o usuário escolhe.
5. O builder usa todas as colunas não-Flow como campos e respeita
   `orderedHeaderCols`. `hiddenFieldIds` oculta campos somente do preenchimento
   daquela view; as colunas continuam na base e disponíveis no review. A coluna
   sintética de título continua sendo `title`.
6. Preview executa um envio real. O cliente envia um payload único; o backend
   cria a row, grava todas as células e executa o Flow de forma atômica.
7. A `urlKey` legível da view nunca é credencial. Publicação usa capabilities
   aleatórias distintas para preenchimento e review, armazenadas somente como
   hash. A chave vai no fragmento da URL e o frontend a envia em header.
8. O bloco do editor guarda somente `formViewId`; label e ícone são resolvidos
   da configuração viva da view.
9. A remoção/troca de tipo da coluna Flow vinculada é impedida enquanto houver
   uma view `form` dependente.
10. O editor de blocos persiste seu JSON em `page_documents`, separado do
    snapshot da database. Falha de leitura não monta um documento vazio e
    falha de escrita preserva o conteúdo local para nova tentativa.
11. Flows novos usam o contrato recursivo v2. Cada condição guarda
    `columnId`, operador, literal tipado, `whenTrue` e `whenFalse`; os ramos
    sempre reencontram a sequência comum. Flows v1 continuam executáveis e só
    são convertidos em memória quando abertos para edição.

## Fatias

### 0. PageShell e rota fina — concluída

- [x] `PageShell` componentizado.
- [x] TanStack route limitada a ler parâmetros/estado e compor `Page`.
- [x] Testes, typecheck, build e lint executados.
- [x] Commit frontend `b0d8078` — `refactor(frontend): componentize page shell`.

### 1. Contrato, criação e builder/preview — concluída, sem commit

- [x] Adicionar `form` ao contrato frontend e ao parser tolerante.
- [x] Adicionar `form` ao contrato/backend de snapshot e patch.
- [x] Validar coluna Flow em create, convert e duplicate.
- [x] Impedir remoção/troca da coluna Flow referenciada.
- [x] Persistir `flowColumnId`, label e ícone por view.
- [x] Criar renderer SOLID com modos builder e preview.
- [x] Ordenar campos pelo builder e persistir em `orderedHeaderCols`.
- [x] Gerar payload único com inputs próprios, sem commits individuais de célula.
- [x] Generalizar o IconPicker em `cubs-components` sem quebrar workspaces.
- [x] Cobrir a fatia com testes focados, suites completas, typecheck, lint e build.

### 2. Publicação, submissão atômica e review — concluída, sem commit

- [x] Migration append-only para publicações e submissões.
- [x] Repository/controller/routes para publicar, rotacionar e revogar.
- [x] Endpoint público condensado de definição.
- [x] Endpoint público idempotente de envio.
- [x] Criação da row + values + execução do Flow na mesma transação rqlite.
- [x] Preview autenticado usa publication draft revogada; não publica links por efeito colateral.
- [x] Endpoint paginado de review com capability distinta.
- [x] Rate limit específico e política segura para e-mail controlado por resposta.
- [x] `row-created` publicado após commit novo, sem eco em replay idempotente.

### 3. Rotas públicas frontend — concluída, sem commit

- [x] Serviço de Form separado de PageWrite/FlowService.
- [x] Página pública de preenchimento.
- [x] Página pública de review.
- [x] Chave lida do fragmento e enviada em header; nunca persistida/logada.
- [x] Troca de fragmento força refetch sem incluir o segredo na query key.
- [x] Estados de loading, erro, sucesso e idempotência por tentativa.
- [x] Select envia public key; o ULID da option permanece interno ao backend.

### 4. Bloco “Enviar formulário” — concluída, sem commit

- [x] Persistência do documento implementada em tabela/rota próprias.
- [x] Node atômico `form-submit` com apenas `formViewId`.
- [x] Catálogo condicionado à existência de uma view `form`.
- [x] Label/ícone resolvidos da view e fallback para view removida.
- [x] Preview em modal, drag, i18n e testes.

### 5. Fechamento — concluída, sem commit

- [x] Testes focados dos dois repositórios.
- [x] Suítes completas, typecheck, lint e builds.
- [x] Rotas públicas incluídas no route tree e no build de produção.
- [x] Migrations aplicadas no ambiente development e verificadas sem pendências.
- [x] Contrato final consolidado neste documento único de continuidade.
- [ ] Commit da feature: depende de autorização explícita do usuário.

### 6. Refinamento visual e campos ocultos — concluída, sem commit

- [x] Remover a borda/container externo do formulário autenticado e público.
- [x] Unificar builder, preview e página pública em controles `react-hook-form`.
- [x] Reutilizar no formulário o mesmo `DatePicker` das células, inclusive o
  trigger completo e o wire ISO/range.
- [x] Renderizar no builder os inputs reais desabilitados, em blocos com
  drag-handle à esquerda.
- [x] Persistir `hiddenFieldIds` por view e omitir esses campos somente do
  preenchimento; payloads manipulados não podem preenchê-los.
- [x] Projetar “Criar formulário” e “Visualizar formulário” no header da view
  por portal, com ícone de visualização.

### 7. Flow estruturado com condições aninháveis — concluída, sem commit

- [x] Adicionar `FlowDefinitionV2` recursivo sem `nextNodeId`, preservando a
  leitura e execução do v1.
- [x] Validar IDs globais, limite de 100 steps, colunas, opções e operadores em
  todos os níveis.
- [x] Executar somente o ramo escolhido e retornar à sequência comum, mantendo
  no contexto valores atualizados por ações anteriores.
- [x] Usar valores canônicos nas condições, inclusive ID estável de `select`,
  sem interpretar o literal comparado como macro.
- [x] Substituir campos livres por controles tipados e pelo `DatePicker`
  compartilhado.
- [x] Renderizar “Se sim” e “Se não” empilhados, recolhíveis, com contador,
  guia, ações próprias e indicação “Depois da condição”.
- [x] Permitir condições em qualquer ramo e drag entre ramos/sequência comum;
  mover uma condição preserva toda a subárvore.
- [x] Exigir confirmação ao remover condição preenchida e bloquear save quando
  coluna ou opção referenciada deixou de existir.
- [x] Preservar atomicidade e restrições de segurança das submissões públicas.
- [x] Não criar migration SQL: o contrato continua persistido no JSON da
  coluna Flow.

### 8. Drag do Flow pelo card — concluída, sem commit

- [x] Remover o drag-handle dos cards de ação/condição.
- [x] Tornar a superfície não interativa de todo o card o ativador do sortable,
  preservando inputs, selects e botões.
- [x] Renderizar `DragOverlay` próprio com borda, ring e sombra purple no padrão
  visual do sistema.
- [x] Manter ramos vazios como destinos droppables sem exibir a label artificial
  “Solte uma ação aqui”.
- [x] Preservar drag por teclado e movimentação de condições com a subárvore.

### 9. Geometria e ordenação do drag do Flow — concluída, sem commit

- [x] Corrigir a reordenação dentro da mesma sequência para usar o índice final
  do sortable tanto ao subir quanto ao descer.
- [x] Separar a colisão de cards e containers de ramo, priorizando a menor
  superfície sob o ponteiro e a sequência correta em estruturas aninhadas.
- [x] Renderizar o overlay em portal no `document.body`, fora do modal com
  `transform` e `overflow`, evitando recorte e mudança do sistema de coordenadas.
- [x] Centralizar o overlay compacto sob mouse/toque e remover a animação de
  retorno que produzia deslocamento visual.

### 10. Alinhamento do checkbox na Table View — concluída, sem commit

- [x] Manter o mesmo checkbox, tamanho e comportamento da célula.
- [x] Fazer o wrapper ocupar a largura disponível e centralizar o controle nos
  modos de leitura e edição.
- [x] Aplicar a regra também no container real `role="cell"` e largura explícita
  no conteúdo, sem depender apenas do crescimento implícito do wrapper.

## Evidências

### Fatia 1 — 2026-10-02

- Frontend `npx tsc -b --pretty false`: passou.
- Frontend `npm test -- --run`: 101 arquivos, 464 testes, todos passaram.
- Frontend `npm run build`: passou; apenas aviso existente de chunks grandes.
- Frontend `npm run lint`: passou com 4 avisos preexistentes de Fast Refresh em
  telas de acesso.
- Backend `npx tsc --noEmit`: passou.
- Backend `npm test -- --run`: 59 arquivos passaram, 1 skipped; 307 testes
  passaram, 7 skipped.
- Backend não possui script `lint`; `npm run lint` confirmou a ausência.
- Nenhum smoke de browser foi executado nesta fatia.

### Fatias 2–5 — 2026-10-02

- Backend `npm test`: 61 arquivos passaram, 1 skipped; 313 testes passaram,
  7 skipped.
- Backend `npm run build`: passou, incluindo `rqlite check`, TypeScript,
  aliases, templates e `rqlite prepare`.
- Frontend `npm test -- --run --maxWorkers=1`: 101 arquivos e 466 testes,
  todos passaram.
- Frontend `npm run build`: passou; apenas o aviso conhecido de chunks grandes.
- Frontend `npm run lint`: passou com 4 avisos preexistentes de Fast Refresh
  nas telas de acesso.
- Migrations aplicadas em development:
  - `20261002205813488_79c27e84_add_form_publications_and_submissions`
  - `20261002211726828_d11f844f_add_page_documents`
- `npx rqlite migrate status --environment development --env-file
  .env.development`: `pending: []`; head em `add_page_documents`.
- Não houve smoke manual de browser com publicação real: isso exigiria uma
  página/Flow e credenciais descartáveis. Rotas, DTOs, segurança, idempotência,
  realtime e route tree foram cobertos por testes e build.

### Fatia 6 — 2026-10-02

- Frontend `npm test -- --run --maxWorkers=1`: 101 arquivos e 470 testes,
  todos passaram.
- Frontend `npm run build`: passou; apenas o aviso conhecido de chunks grandes.
- Frontend `npm run lint`: passou com os 4 avisos preexistentes de Fast Refresh
  nas telas de acesso.
- Backend `npm test -- --run --maxWorkers=1`: 61 arquivos passaram, 1 skipped;
  314 testes passaram, 7 skipped.
- Backend `npm run build`: passou, incluindo `rqlite check`, TypeScript,
  aliases, templates e `rqlite prepare`.
- `npx rqlite migrate status --environment development --env-file
  .env.development`: `pending: []`; head em `add_page_documents`. Esta fatia
  alterou apenas o JSON da configuração da view e não exigiu nova migration.

### Fatia 7 — 2026-10-03

- Backend `npm test`: 61 arquivos passaram, 1 skipped; 320 testes passaram,
  7 skipped.
- Backend `npm run build`: passou, incluindo `rqlite check`, TypeScript,
  aliases, templates e `rqlite prepare`.
- Frontend `npm test`: 102 arquivos e 477 testes passaram.
- Frontend `npm run build`: passou; apenas o aviso conhecido de chunks grandes.
- Frontend `npm run lint`: passou com os 4 avisos preexistentes de Fast Refresh
  nas telas de acesso.
- Typecheck dos dois repositórios e `git diff --check`: passaram.
- Não houve migration nova nesta fatia. As duas migrations da Form View já
  haviam sido aplicadas e verificadas com `pending: []`; a nova consulta de
  status não pôde acessar o rqlite porque o Docker Desktop estava desligado.

### Fatia 8 — 2026-10-03

- Frontend `npm test`: 102 arquivos e 478 testes passaram.
- Frontend `npm run build`: passou; apenas o aviso conhecido de chunks grandes.
- Frontend `npm run lint`: passou com os 4 avisos preexistentes de Fast Refresh
  nas telas de acesso.
- Teste dedicado confirma card inteiro como ativador, ausência do handle e do
  placeholder, overlay purple e movimentação da subárvore entre ramos.
- Alteração exclusivamente frontend; sem migration SQL.

### Fatia 9 — 2026-10-03

- Frontend `npm test -- --run --maxWorkers=1`: 102 arquivos e 479 testes
  passaram.
- Frontend `npm run build`: passou; apenas o aviso conhecido de chunks grandes.
- Frontend `npm run lint`: passou com os 4 avisos preexistentes de Fast Refresh
  nas telas de acesso.
- Frontend `npx tsc -b --pretty false`: passou.
- Teste dedicado cobre a reordenação no mesmo ramo nos dois sentidos e preserva
  a movimentação de subárvores entre ramos.
- Alteração exclusivamente frontend; sem migration SQL e sem commit.

### Fatia 10 — 2026-10-03

- Teste focado da `TableCell` checkbox: passou.
- Frontend `npx tsc -b --pretty false`: passou.
- Frontend `npm run build`: passou; apenas o aviso conhecido de chunks grandes.
- Frontend `npm run lint`: passou com os 4 avisos preexistentes de Fast Refresh
  nas telas de acesso.
- Alteração exclusivamente frontend; sem migration SQL e sem commit.

## Estado de entrega

A feature está implementada e validada nos dois repositórios. As alterações
permanecem sem stage e sem commit; o commit é a única ação de entrega ainda
dependente de autorização explícita.
