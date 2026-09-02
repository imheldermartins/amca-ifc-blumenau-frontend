# cubs-database

Lib autoral do Cub's: visualização da base de dados simulada da arquitetura
PageTree. Exporta o componente `<CubsDatabase />`, `utils` e `mockableData`.

## Arquitetura

- **Fonte da verdade: `src/shared/cubs-database`** — edite direto lá, com HMR
  do app. O alias `cubs-database` (vite/tsconfig) aponta para a fonte, então o
  cubs-frontend consome o TS ao vivo.
- **Este diretório é só a "casca" de publicação**: `package.json` (nome +
  versão + exports) e scripts. O `dist/` (JS ESM + `.d.ts`) é GERADO no build
  a partir da fonte — não existe cópia de código aqui.
- No cubs-frontend a lib é listada como
  `"cubs-database": "file:packages/cubs-database"` (link em `node_modules`).

## Scripts (na raiz do app)

- `npm run cubs-database:bump` — incrementa a versão em +0.1
  (0.1.0 → 0.2.0 → ... → 0.9.0 → 1.0.0) e carimba `version.ts` na fonte.
- `npm run cubs-database:build` — compila a fonte para `dist/` (JS + d.ts).
- `npm run cubs-database:pack` — gera `cubs-database-x.y.z.tgz` (roda o build
  sozinho via `prepack`).

## Usando em outro projeto React

```bash
npm run cubs-database:pack               # aqui no cubs-frontend
npm install ../cubs-frontend/packages/cubs-database/cubs-database-0.4.0.tgz   # no outro projeto
```

O pacote entra no `node_modules` do outro projeto **só com JS buildado** e
tipos — `import { CubsDatabase, mockableData } from 'cubs-database'` direto.
Publicar num registro npm depois usa o mesmo dist (basta remover `"private"`).

**Atenção (pendência antes da v1.0):** o componente usa classes Tailwind com
tokens do tema do Cub's (`bg-contrast`, `border-divider`, ...). Em outro
projeto sem esses tokens, a tabela renderiza sem estilo. O plano é embutir CSS
próprio da lib (ou tokens com fallback) antes da versão externa de verdade.

## Estado atual (v0.9)

- `settings: Record<ulid, DataViewType>` — views salvas (`view`, `name`,
  `urlKey`, `filters: ViewFiltersV2`, `orderedHeaderCols`, `orderedRows?` e
  `columnWidths?`). O pacote trabalha com IDs canônicos; o host converte
  public keys/aliases na fronteira da URL.
- Toolbar com agrupamento prioritário pesquisável, filtros dirigidos por
  `mappedFilters`, chips e estado de sincronização; a tabela renderiza grupos
  em accordion com etiqueta roxa sobre uma faixa neutra.
- Topbar de views: tabs com scroll SÓ horizontal (vertical hidden);
  **ContextMenu abre com botão DIREITO** na tab (fundo glass
  `bg-glass backdrop-blur-md`); segurar/arrastar fica para o DnD futuro.
- View `table`: sem chrome em volta (só a view). Header com ícone do tipo,
  zebra striping contígua (background × contrast) com separadores verticais
  entre colunas. A PRIMEIRA célula é estática (posição zero, dentro da zebra)
  com drag-handle + checkbox + botão "Abrir ›" (`onOpenRow` recebe a row
  crua); controles aparecem no hover da linha.
- Tipos de coluna: `text | numeric | select | date | checkbox`
  (título sem type → 'text'). `board`/`calendar` são placeholder.
- A lógica pura do processo (PageTree) entra nas próximas versões.
