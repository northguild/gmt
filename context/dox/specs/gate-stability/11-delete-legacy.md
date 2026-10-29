# Slice 11 — delete the legacy layer, and verify the whole site

Every widget and the chat rail now render from the kit. This slice deletes what is left of the
old styling, ends every legacy lint list, and runs the gates on every page.

## Current state (verified before 8c; re-count with `rg` when you start)

- `nth-*`: 50 hits. After 8c–10g, the ones left are in global sheets and one script:

  | File | Hits | Replacement |
  |---|---|---|
  | `gmt-reveal.css` | 16 | `scroll-reveal.ts` sets `--gmt-reveal-i: <n>` on each child of a `[data-reveal-group]` once, when it observes the group; the sheet reads `transition-delay: calc(var(--gmt-reveal-i) * var(--gmt-motion-stagger))` |
  | `scroll-reveal.ts` | 1 | its header comment (`:5`), rewritten |
  | `gmt-content.css` | 6 | `:332`, `:347` (compare tables) and `:468-603` (reference tables' stacked labels) become `[data-col]` selectors, below |
  | `dox.css` | 2 | `:248` home card tone and `:345` the odd last card, below |
  | `gmt-widget.css` | 3 | the sheet is deleted |

- `!important`: none after 8b. `rg` proves it again here.
- Global sheets that style one component, not the site: `gmt-upstream.css` (160),
  `gmt-migrate.css` (128), `gmt-playground.css` (143, the Mistake component) and
  `gmt-data-credits.css` (148). Their headers say they are global only because an Astro scoped
  style (`:where(.astro-hash)`) could not beat `gmt-content.css`. With 8b's layers, unlayered
  component styles beat every layer, so that reason is gone.
- Shared widget sheets: `gmt-widget.css` (430) and `gmt-form-controls.css` (724).
- `--gmt-widget-card-bg` is defined in `gmt-tokens.css` and used at `gmt-widget.css:135`.
- Legacy lists: the test-file list (slice 7), the `dox-src` list (8b) and the Stylelint list (8b).

## Files and changes

- **Content tables.** `LibraryCompare.astro:48-50` already writes `data-col` from the column
  header. Add the same to markdown tables in `src/lib/rehype-table-scroll.ts`: each `th` and `td`
  gets `data-col` with its column's header text. Then:
  - the compare rules select `[data-col="<header>"]`;
  - the reference tables' stacked labels use
    `td[data-col]::before { content: attr(data-col); content: attr(data-col) / ""; }`, so no
    column name is typed in CSS. Check that the visible label text is the same as today's
    ("Type", "Default").
  - Add a rehype unit test for a two-column and a three-column table.
- **Home cards** (`dox.css:248`, `:345`). Starlight colours cards by position in its own layer;
  that is third-party CSS and stays. Our two rules go:
  - the sixth card's tone comes from a `tone` prop on a small `HomeCard.astro` wrapper, which
    sets `--sl-card-border` and `--sl-card-bg` inline from tokens;
  - the pointer card carries `data-span="full"` in the page source, and the container query
    selects that attribute.
- **Component sheets.** Move `gmt-upstream.css`, `gmt-migrate.css` and `gmt-playground.css`
  into their components' `<style>` blocks, and `gmt-data-credits.css` into a `dataCredits` kit
  builder (its markup comes from `src/lib/data-credits.ts`, shared by Astro shells and mounts).
  Delete the four sheets and their `customCss` lines.
- **Delete** `gmt-widget.css`, `gmt-form-controls.css`, every per-tool sheet still on disk,
  `--gmt-widget-card-bg`, and the dead exports of `widget-ui.ts` (`rangeFieldHtml`,
  `syncRange`, `renderWidgetOutput`, the escape helpers that moved to `html.ts`; check each with
  `rg`). Delete `widget-ui.ts` if nothing is left.
- **What stays global** is only what styles the site, each in its `gmt.*` layer: tokens,
  theme and light, primitives, glass, shell, content, controls, reveal, view transitions,
  `dox.css`, the a11y sheet (site rules only), the chat sheets, and, in `gmt.thirdparty`, the
  sheets for DOM we do not render (`gmt-charts.css`, the map tooltip shell, Pagefind and
  Starlight overrides). Record that list in `built.md`
  § Component kit.
- **Lint.** Delete all three legacy lists and the guard tests that check them. Stylelint runs
  over every `.css`, `.module.css` and `.astro` file in `apps/dox/src`.
- **Docs.** `rg -n '<deleted sheet name>' context/dox .agents` for each deleted sheet, and
  update every hit in present tense: `built.md`, `reference/design-system.md`,
  `reference/style-guide.md`, `ui-audit.md`.

## Traps

- `data-col` on every markdown table changes the HTML of every content page. `html-diff`
  samples pages, so add one reference page and one guide page with a table to its list.
- `attr()` in `content` reads the header text as written. A header with markup (a code span)
  gives its text only. Check the reference tables' headers are plain text.
- Reveal stagger: the script must set `--gmt-reveal-i` before it adds `.gmt-reveal-in`, or the
  first frame has no delay. With reduced motion the script does not run and nothing is hidden.

## Definition of done

1. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` pass. `pnpm lint` runs Stylelint
   over the whole `apps/dox/src` tree with no legacy list, and both oxlint override lists are
   gone.
2. `rg -n 'nth-(of-type|child)|!important' apps/dox/src` returns nothing.
3. `rg -n 'widget-card-bg|gmt-form-controls|gmt-widget\.css' apps/dox/src` returns nothing, and
   `rg -n 'z-index:' apps/dox/src` shows only `var(--gmt-z-*)` values.
4. **Chromium, every page.** From `apps/dox`, after one build:
   `pnpm gates --no-build --all --browsers chromium --themes dark,light --retries 0`, at the
   gates' widths (390 and 1440). Use `--shard <i>/<n>` to split the run if it is long. Every gate
   passes on every page. Quote `.gates/summary.json`.
5. **Firefox and WebKit, once, before handover** (owner decision). Install the engines if they
   are missing (`pnpm --filter dox exec playwright install firefox webkit`), then run on the
   #429 page list from the [index](./index.md#definition-of-done):
   `pnpm --filter dox gates --no-build --pages <list> --browsers firefox,webkit --themes dark,light`.
   Every gate passes. This proves causes 2, 3 and 9b locally:
   - **Cause 2** is in the gate (slice 5 waits for emulation), and the CSS needs no change:
     no `contrast-border-token`, `contrast-text-shadow` or `emulation-not-applied` finding.
   - **Cause 3:** no `focus-obscured` on `/dox/` (10g).
   - **Cause 9b:** no `jump-over-limit` or `grew` on the five pages (8b, 9a, 9c, 10e, 10f).
   - Cause 5 is Linux-only; the first weekly run after merge checks it.
6. `html-diff` across the full list: every `✗` is named, then the baseline is captured again.
7. No card, callout, row or result block has a left-border-only accent:
   `rg -n 'border-(left|inline-start)' apps/dox/src` lists none that is the only accent.
8. Close-out: `built.md` (§ Component kit, § Widget tests) and
   `reference/verification-and-risks.md` describe what is built, in present tense.
9. `node scripts/verdict.mjs validate` passes.
10. No code or context file cites this spec or a slice. The `data-gate` hooks table in
    `03-locators.md` moves into `built.md` (the section that now links it), and
    `rg -n 'gate-stability|\bslice [0-9]|Slice [0-9]' apps/dox .agents context --glob '!context/dox/specs/**'`
    shows only the `#396` test headers that predate this work.
