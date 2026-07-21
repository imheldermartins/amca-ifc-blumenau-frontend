# cubs-components

Primitivas de UI do Cub's. Servem o app **e** a `cubs-database` — foi por isso
que viraram pacote: a lib não pode importar de `@components` (o build é `tsc`
puro e o specifier bare sairia literal no `dist`, sem resolver no consumidor).

**A FONTE é `src/shared/cubs-components` — edite lá.** `packages/cubs-components`
guarda só os scripts e o `dist` gerado. Em dev o app consome a fonte pelo alias
do Vite; o `dist` existe para o `npm pack` e para o build da `cubs-database`.

## O que tem

| Componente | Dual-mode | Notas |
|---|---|---|
| `TextField` | sim | máscaras, `size`, `surface` (incl. `plain`, sem chrome), adornos |
| `Checkbox` | sim | sobre Radix; suporta `indeterminate` (só modo state) |
| `Select` | sim | sobre Radix; `options` por prop |
| `Switch` | sim | — |
| `Button` | — | `variant` × `color` (paleta ou `from-theme`) |
| `ContextMenu` | — | painel `absolute`; posicionamento fica com o caller |
| `Popover` | — | sobre Radix; trigger `asChild` + conteúdo LIVRE, glass |

Mais `cn`, `PALETTE`/`paletteBgText`/`paletteBorderText` e
`applyMask`/`unmask`/`formatCurrency`.

**Dual-mode** = o mesmo componente serve react-hook-form (prop `name`, dentro
de um `<FormProvider>`) ou estado controlado (sem `name`). Ver a seção
"Componentes dual-mode" no `CLAUDE.md` da raiz.

## Contrato de tokens (obrigatório)

O pacote **não traz CSS**. Ele emite classes Tailwind que dependem de variáveis
que o consumidor precisa definir — sem elas os componentes renderizam sem cor.
O `src/index.css` do app é a referência:

| Token | Papel |
|---|---|
| `background` | fundo base |
| `contrast` | superfície elevada (painel, input em barra) |
| `active` | item ativo/hover |
| `divider` | borda neutra sobre `background` |
| `divider-contrast` | borda neutra sobre `contrast` |
| `foreground` | cor de texto |
| `glass` | fundo translúcido das superfícies flutuantes |
| `p-red`, `p-blue`, `p-purple`, `p-green` | destaque, tom cheio + escala 50–950 |
| `p-orange`, `p-yellow`, `p-grey` | cores de option de select (`cubs-database`), mesma forma |

Cada um entra em dois passos: valor em `:root` e `.dark`, depois
`--color-<nome>: var(--<nome>)` em `@theme inline`. O dark mode é a classe
`.dark` no `<html>` (`@custom-variant`).

## Dependências

`clsx` e `tailwind-merge` são deps normais (o `cn` é do pacote). Como peer:
`react` (>=19), `react-hook-form` (>=7.80), `@iconify/react` para quem usar
`ContextMenu`/`Checkbox`/`Select`, e os Radix por trás de cada primitiva
(`@radix-ui/react-checkbox`, `react-select`, `react-popover`).

`react-hook-form` é peer **obrigatório**, não opcional: o dual-mode importa
`useFormContext`/`useController` estaticamente. Quem consome só o modo state
ainda precisa dele instalado.

## Scripts

```
npm run cubs-components:build   # gera o dist a partir da fonte
npm run cubs-components:bump    # +0.1 na versão (0.9.0 → 1.0.0)
npm run cubs-components:pack    # tarball instalável
```

O build corrige as extensões dos imports relativos (`./x` → `./x.js`) de forma
**recursiva** — o pacote tem subpasta (`lib/`), e um walk plano deixaria os
arquivos dela quebrados fora de bundler.
