# Slice 6 · Guide tables

[Index](./index.md) · Binding rules: [built.md § Tiers 0–1](../../built.md#tiers-01--site-generator-ai-surface-brand-guides)
(generator, reference tables, `rehype-table-scroll`),
[design-system.md](../../reference/design-system.md), [visual-design.md](../../reference/visual-design.md).

## Goal

Guide and reference tables are hard to read: every row looks the same, the header competes with
the body, and long first columns repeat (`conversion/databases.mdx` repeats "PostgreSQL" six
times). Restyle them in the tools' look: a compact, bevelled panel with a quiet header strip,
clear rows and a strong first column.

The model is the kit's `table` builder (`src/widgets/builders/table.module.css`): a
`--gmt-surface-widget` panel, a full hairline border, tight cells, tabular figures. Widget tables
keep their own sheet; this slice touches `gmt-content-tables.css` and `rehype-table-scroll.ts`
only.

## Row tables

In `gmt-content-tables.css`, for `.sl-markdown-content table` and `.gmt-ref-table`:

- **Panel.** `background: var(--gmt-surface-widget)`; full 1 px `--gmt-hairline` border;
  `corner-shape: bevel` with `--gmt-radius-md`. No left-border accent.
- **Header strip.** `thead` is an opaque `--gmt-surface` band (replace the thead glass from
  `gmt-glass.css` for content tables) with a 1 px `--gmt-border-strong` bottom border. `th`:
  Michroma .75rem, weight 600, `letter-spacing: .04em`, colour `--gmt-ice-dim`. The header
  reads as a label row, not a headline.
- **Cells.** Padding `.625rem .875rem`; `line-height: 1.5`; colour `--gmt-ice`; bottom hairline;
  `vertical-align: top`; `font-variant-numeric: tabular-nums` on the whole table.
- **Zebra.** `tbody tr:nth-child(even)` takes `--gmt-fill-subtle`. Hover and `:has(:focus-visible)`
  keep `--gmt-accent-wash` on top of it.
- **First column.** The row label: `--gmt-ice`, weight 600. Code in it keeps today's
  `white-space` rules.
- **Groups.** Runs of rows whose first cell has the same text form a group (below). The first row
  of a group gets a 1 px `--gmt-border-strong` top border instead of the hairline. Later rows of
  the group show their first cell dimmed, `font-weight: 400`; entry cards never group or zebra. The text stays in
  the DOM and in the accessibility tree, so a screen reader still hears it on every row.
- **Light theme.** The same tokens resolve to their light values; no extra rules.
- **Forced colours.** Borders `CanvasText`, no zebra, no dimming (dimmed text must read at full
  contrast there).

## Groups in `rehype-table-scroll`

Add to `src/lib/rehype-table-scroll.ts`: for each `tbody`, walk the rows. A row whose first cell's
text (trimmed, whitespace collapsed) equals the previous row's gets `data-group="continue"`. A row
that starts a run of two or more gets `data-group="start"`. A row alone gets nothing. The plugin
works on the HTML tree it already walks; it does not re-parse MDX. It runs for content and
generated reference tables alike, since both pass through it.

## Entries layout

`.gmt-ref-table:is([data-kind="options"], [data-layout="entries"])` renders each row as a tool-
like card instead of a hairline-separated strip:

- `tbody` becomes a flex column with an 8 px gap; the table panel background and border go away
  (each entry carries its own).
- Each `tr`: `--gmt-surface-widget` background, full 1 px `--gmt-hairline` border,
  `corner-shape: bevel`, `--gmt-radius-md`. No left-border accent.
- The first cell is a title strip across the top of the card: `--gmt-surface` background, a
  1 px `--gmt-border-strong` bottom border, padding `.5rem .875rem`, ice weight 600.
- The other cells keep today's `data-col` labels (`::before`), set in `--gmt-ice-dim` Michroma
  .6875rem caps on their own line above the value.
- Group rules from above do not apply to entries; each card shows its full title.
- The 34rem container query that turns Members and Parameters into entries stays.

## Constraints

- Every rule stays in `gmt-content-tables.css`, scoped to content and reference tables. Widget
  tables, the playground and `/dox` are untouched (`visual-diff` proves it on
  `/tools/zone-planner/` and `/dox/`).
- `table-fit` stays green: the new padding must not push any table past its box at 320 px. If a
  table overflows, the scroll region (`rehype-table-scroll`'s wrapper) handles it, as today.
- `font-floor.test.ts`: the smallest new size is .6875rem; check it against the floor and raise
  the size if it fails. Do not lower the floor.
- `table-cell-label.test.ts` stays green; extend it for `data-group`.
- Text contrast: a dimmed group label, code chip included, holds 7:1 in both themes on plain and
  zebra rows, measured as drawn; dim by a colour tier, not opacity, if opacity cannot reach it.

## Tests

- `rehype-table-scroll.test.ts`: a run of three equal first cells gives `start`, `continue`,
  `continue`; whitespace differences still match; a single row gets nothing; two runs back to
  back each get their own `start`; `thead` rows are never marked.
- `table-cell-label.test.ts`: the dimmed cell keeps its text content.

## Definition of done

- [ ] Index gates pass. `table-fit` on every guide and reference page, both themes.
- [ ] `html-diff`: only `data-group` is added, and the generator's tables lose the duplicate inner box; nothing else.
- [ ] `visual-diff`: content and reference tables change; no widget table changes.
- [ ] `a11y:axe` and `contrast:measure` on `/guides/conversion/databases/`,
      `/guides/industries/intermodal-edi-timestamps/`,
      `/guides/industries/gnss-system-time-and-week-rollover/`,
      `/guides/core-date-operations/leap-seconds-and-tai/`, `/guides/integration/skills/`,
      `/guides/intervals/interval-basics/` and one reference page with an Options table, in both
      themes.
- [ ] `built.md` Tier 1 (reference tables and `rehype-table-scroll`) describes the panel, header
      strip, zebra, groups and entry cards in present tense; `design-system.md` names the content
      table style beside the kit `table`.
- [ ] Close-out from the [index](./index.md#close-out) is done, because this is the last slice.
