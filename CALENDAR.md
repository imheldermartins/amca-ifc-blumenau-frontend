# Calendar — mockup e próxima integração

Branch: `feat/heatmap-calendar`. Heatmap aguarda referências; não faz parte desta entrega. Este documento fica na raiz porque `docs/` está excluído pelo Git local deste checkout.

## Revisão visual

Execute `npm run dev` e abra `/calendar-preview.html`. Esse entrypoint existe apenas no servidor de desenvolvimento e não entra no build de produção. Ele apresenta `/schedule` e a grade da database com fixtures, controles de tema e largura. Não depende de login, não consulta a API e não grava localStorage.

No app autenticado, `/$lang/schedule` usa pins reais por workspace/usuário; somente o preview conserva fixtures locais. O Calendar da database projeta as linhas recebidas, usando a primeira coluna de data e a primeira coluna `select` por padrão. `dateColumnId`, `colorColumnId` e `calendarPropertyIds` pertencem ao snapshot de cada view. A última lista combina visibilidade e ordem das propriedades exibidas como `coluna: valor`.

A lateral mostra apenas cards de páginas fixadas, com um único controle de recolher. O botão pin fica dentro de cada card; desafixar exige confirmação e remove somente o pin, preservando a página. A modal de detalhes lista as propriedades `select` e usa seus ULIDs para escolher a origem da cor. A primeira `select` é o padrão; sem uma cor resolvível, usa roxo. Não há lista separada de próximos itens nem checkboxes.

## Contrato dos packages

- `cubs-components/calendar`: entrada isolada com `Calendar`, `CalendarItemContent`, tipos `CalendarItem<M>`, `CalendarRenderers<M>`, `CalendarProps<M>`, `mappedItemsTypes` e utilitários de períodos. Também disponíveis na entrada principal do package.
- `cubs-database`: `CalendarView` e a projeção pura `databaseCalendarItems`. A visualização `calendar` renderiza mês/ano e navegação próprios sobre a grade mensal, sem duplicar os tabs mês/semana/dia exclusivos de `/schedule`.
- `Calendar` é controlado por `date` e `mode`; fornece `onDateChange` e `onItemClick`. Funciona sem providers, API, autenticação, rotas, tipos da database ou i18n do app. A aplicação injeta rótulos, dados livres e renderizadores; as dependências técnicas do componente ficam declaradas no package.
- Um item contém `id`, `title`, `start`, `end?`, `allDay?`, `color?`, `type`, `data` e `children?`. IDs são únicos na árvore. O mapa associa cada `type` ao seu payload e renderer; filhos são projetados recursivamente. Tipos externos podem ser adicionados estendendo o mapa, como o chart das fixtures.
- Intervalos seguem `[start, end)`: `end` é exclusivo. Sem fim, um item de dia inteiro dura um dia; um item com horário dura 30 minutos. Intervalos inválidos/invertidos não entram na grade.
- Datas do mockup são datas de exibição em UTC, sem deslocamento pelo fuso do navegador. O adapter preserva os horários do codec atual. Ranges date-only inclusivos `startISO@endISO` são convertidos para fim exclusivo. O codec existente não distingue horário 00:00 explícito de dia inteiro; essa definição precisa ser resolvida antes da integração funcional.
- Month: um segmento por item/semana, sem borda lateral, overflow acessível por `+N itens`. Week/day: horários verticais com duração e lanes para sobreposições; dia inteiro e ranges que atravessam dias ficam na faixa superior. Semana começa no domingo por padrão (`weekStartsOn` configurável); cabeçalho pt-BR usa D S T Q Q S S.
- Mês: wheel/swipe navega um mês por gesto; PageUp/PageDown também navegam com a grade focada. Semana/dia: wheel rola as horas. A seleção do dia permanece ao mudar de modo.
- O ano usa lista virtualizada de 1 a 9999, com setas, PageUp/PageDown, Home/End e Enter. Redução de movimento desativa as transições do Calendar e das tabs.

```tsx
import { Calendar, type mappedItemsTypes } from 'cubs-components/calendar'

interface MyItems extends mappedItemsTypes {
  chart: { values: number[] }
}

// renderers deve cobrir page, item e chart, com payload tipado por entrada.
<Calendar<MyItems>
  date={date}
  mode="month"
  items={items}
  renderers={renderers}
  onDateChange={setDate}
  onItemClick={openDetails}
/>
```

Datas: Day.js; animações: Motion. O package usa os tokens de tema e utilitários Tailwind do Cub's, como os componentes existentes. Referências: [Day.js UTC](https://day.js.org/docs/en/plugin/utc), [Motion AnimatePresence](https://motion.dev/docs/react-animate-presence).

## Backend e integração após aprovar o design

1. **Pins individuais:** adicionar `PinnedPage.schema.ts` (modelo `pinnedPages`), migration append-only e geração pelo CLI rqlite. Relação mínima entre usuário autenticado, página e a propriedade temporal selecionada; configuração de propriedades visíveis, propriedade `select` para cor (`colorColumnId`, opcional, referenciada pelo ULID) e ordenação pertence ao pin. A primeira `select` é o padrão e roxo é o fallback. Desafixar exclui apenas essa relação, nunca a página. Guardar referências, sem duplicar páginas ou valores. Garantir unicidade por usuário/página.
2. **Camadas:** repository resolve pins e valores, controller compõe a projeção, router aplica autenticação e valida entradas. `user_id` vem do token. Escritas exigem acesso atual à página; a listagem só projeta páginas que continuam legíveis e não foram excluídas.
3. **HTTP proposto:** `/api/v1/schedule/pinned-pages` para listar/fixar; `/:pinId` para editar apresentação/desafixar; `/api/v1/schedule/items?from=…&to=…` para buscar as páginas fixadas cujo intervalo se sobrepõe ao intervalo solicitado. Responder somente dados; os renderizadores React continuam no frontend. Paginação/limites seguem o padrão da API quando o volume e o contrato funcional forem definidos.
4. **Database:** `dateColumnId`, `colorColumnId` e `calendarPropertyIds` são salvos no snapshot da view pelo patch atômico existente. No drawer, visibilidade e ordem usam uma lista sortable local, consolidada num único PATCH ao perder foco ou após o debounce. O adapter aceita a coluna de cor explicitamente; sem ela, usa a primeira coluna `select` e só cai em roxo se a option não tiver cor. Consumir páginas/valores reais sem criar cópias.
5. **Atualizações:** HTTP continua como canal de escrita. Reutilizar eventos de páginas/valores e rooms existentes para invalidar/reprojetar itens acessíveis; definir evento pessoal de pins apenas se sincronização entre sessões fizer parte do contrato aprovado.
6. **Decisões da fase funcional:** timezone e meia-noite vs. dia inteiro, criação, arraste/resize, múltiplas datas por página e escopo de workspace. Não há migrações, endpoints, eventos novos ou conectores externos implementados no mockup.

## Validação

`npm run build`, `npm run cubs-database:build` (inclui cubs-components), `npm run lint` e testes focados de Calendar/layout, projeção da database e SchedulePage. Verificar visualmente mês/semana/dia, scroll mensal, anos distantes, pins, detalhes, overflow, ambos os temas e largura estreita. Testes de layout cobrem semana/mês/ano, bissexto, fim exclusivo, intervalos sobrepostos e filhos recursivos.
