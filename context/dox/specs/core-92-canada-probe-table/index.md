---
story: CORE-92
status: draft
---

# Clock-check probe table and stored hint fit a 300 px card

`canada-layout-check --browsers webkit` fails at 300 px: "a probe table does not fit its card
(… 69 px of scroll)". It fails on clean `main` too, and the weekly sweep of 2026-11-01 (run
41302098223) failed the same gate in WebKit (63 px) and Firefox (42 px). PR CI runs Chromium only,
so no PR caught it. The cause is not the date: the probe instants and column heads are constants.

## Root cause

DOX-G1 (4ce90269) moved the clock-check styles into `families/clockcheck/probe-card.module.css`
and lost three things that [built.md § The table in a narrow card](../../built.md) still describes:

1. **`code:not(.zoneid)` became `code`.** `.probe table code { white-space: nowrap }` (0,1,2)
   now beats `.zoneid` and the kit's `.cell code`. WebKit and Firefox do not break at a `<wbr>`
   inside `nowrap`; Chromium does. So in WebKit `America/Vancouver` stays one 143 px line, the
   Place column is 153 px, and three columns need 289 px in a 220 px wrap (280 px viewport after
   the 20 px scrollbar): 69 px of scroll.
2. **The stacked rows under 21rem were dropped.** Only the tighter padding stayed. With the zone
   id wrapping again, three columns still need about 263 px: WebKit overflows 1–11 px (Canada,
   Morocco, NO SIGNAL), and Chromium fits only because the kit cell's `overflow-wrap: anywhere`
   breaks city names mid-word ("Vancouve|r", "Edmonto|n") and, at desktop width, the "Correct"
   head.
3. **The explicit ARIA roles were dropped.** The kit `table()` writes none, so a stacked
   `display` would remove the table semantics.

Morocco uses the same `probeCard`, so it has the same bug. It has a second one in the same class
(content wider than its card at 300 px): the stored-times hint "Paste values like
2026-11-16T09:00:00+01:00[Africa/Casablanca]. …" holds one 274 px token that cannot break (`+01`
gives no break; Canada's `-08` does). The `field()` grid's implicit `auto` track grows to it in a
222 px field. WebKit scrolls the page sideways by 23 px at 300 px and 3 px at 320 px. In Chromium
the label, textarea and hint spill past the card. No gate checks Morocco.

Simulated on a clean-main static build (Chromium, WebKit; 300–1024 px; both pages; live, NO
SIGNAL and ✗ cells), the fix leaves 0 scroll, 0 overfull cells and 0 split words.

## Phase A — probe table (both pages, through `probeCard`)

- **`families/clockcheck/probe-card.module.css`:**
  - Replace `& table code { white-space: nowrap }` with
    `& table .zoneid { white-space: normal; overflow-wrap: normal; }`. Its comment says the `<wbr>`
    after each `/` is the only break, and that this rule beats the kit's `.cell code`.
  - Drop `overflow-wrap: anywhere` from `.zoneid`.
  - Add `& table :is(th, td) { overflow-wrap: normal; }`, so no word in a probe cell or head
    breaks mid-word at any width.
  - Restore the stack inside the existing `@container (inline-size < 21rem)` block:
    - `table`, `thead` and `tbody` are `display: block`.
    - Each `tr` is a grid, `repeat(2, minmax(0, 1fr))`, with a bottom hairline. The `thead tr`
      gets the strong border. There is no left border anywhere.
    - `th` and `td` are `display: block; inline-size: auto; min-inline-size: 0`, with no bottom
      border. The selector must beat `th:not(:first-child) { inline-size: 1% }` (0,2,2);
      `:nth-child(n)` does it. Without that, each head is 1 % wide and stands one letter a line.
    - `tbody th` spans `1 / -1` and has no block-end padding.
    - The Place head (`thead th:first-child`) is visually hidden: absolute, 1 px, `clip-path:
      inset(50%)`. Each place names itself.
  - Keep the narrow padding; the comment gives the reason (three columns need ~263 px in WebKit).
- **Kit addition: `builders/table.ts` `roles?: boolean`** writes `table`, `rowgroup`, `row`,
  `columnheader`, `rowheader` (the `rowHeader` column) and `cell`. JSDoc: use it when a consumer
  changes a table part's `display`, which drops native semantics ([APG Table pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/);
  `families/stored/audit-table.ts` is the hand-written precedent).
- **`probe-card.ts`.** Pass `roles: true` (no `labelCells`: the stacked head row labels the offsets).

## Phase B — the Morocco stored-times hint (kit)

- **`builders/layout.module.css`.** Give `.field` the track `grid-template-columns: minmax(0, 1fr)`,
  so an unbreakable child cannot widen a field past its card.
- **`builders/layout.ts`.** `hint(id, text: string | SafeHtml)`.
  Edit only that function (about line 84); the owner's main checkout has uncommitted `field()` edits.
- **New kit builder `builders/zoned-value.ts`.**
  - Move the private `storedHtml` out of `families/stored/audit-table.ts` and export it as
    `zonedValue(value): SafeHtml`.
  - It writes no-wrap pieces joined by `<wbr>`, breaking after `T`, before the offset and
    before `[`.
  - Export it from `builders/index.ts`; `audit-table.ts` imports it. (`instant()` is not enough:
    its time-and-zone piece is 260 px in WebKit.)
- **`families/clockcheck/stored-section.ts`.** Build the hint with
  ``html`Paste values like ${zonedValue(example.saved)}. Up to …` ``. The text content does not
  change, so the assertion at `src/lib/canada-stored-times-mount.test.ts:168` still holds.

## Phase C — the gate (`scripts/canada-layout-check.mjs`)

- **Both pages.** `applyPageContract({ pages: [canada, morocco] })`, looped, the path in each
  finding's WORD; `--pages` replaces `--path`; update the header usage text.
- **Widths.** Default `1440,1024,420,375,300`; 420 px is just above the WebKit stack threshold.
- **Probe-table check.**
  - The overfull-cell test skips a visually hidden cell (computed `clip-path` other than `none`).
  - A new check fails any word in a visible probe cell or head that spans two line boxes. Walk
    each text node, take a `Range` for each `\S+`, and count distinct rect tops.
- **Verdict states.** Measure the probe table as loaded, then forced `ok`, `bad` and `unreadable`
  at 300 and 420 px. A `page.addInitScript` wraps `Intl.DateTimeFormat` for the probe zones with
  `timeZoneName: "longOffset"` only: `ok` returns each zone's expected offset (added to `REGIONS`
  in `scripts/lib/clock-check-harness.mjs`, imported from `canada-clock-change.ts` and
  `morocco-clock-change.ts`, never typed in), `bad` returns `GMT+14:00`, `unreadable` throws
  `RangeError`. Wait with `waitForState` for the forced verdict `data-state`, then run the probe
  checks.
- **Spill check.** Fail any visible descendant of a `[data-gate]` card whose border box passes
  the card's by more than 1 px. Skip scroll containers' contents, `clip-path` hidden elements and
  absolutely positioned elements.
- **Lifetimes.** Close every context in a `finally`; the verdict wait replaces the 3 s sleep.

## Tests (Vitest; each closes what it opens)

- `builders/table.test.ts`: with `roles: true`, every part carries its role. Without it, none do.
- `builders/layout.test.ts`: `hint()` takes `SafeHtml` and does not escape it.
- New `builders/zoned-value.test.ts`: `<wbr>` at the three points, and text content unchanged.
- `families/clockcheck/probe-card.test.ts`: roles in the markup, the place cell is `rowheader`.
- `families/clockcheck/stored-section.test.ts`: the hint holds `<wbr>`, and its text is unchanged.
- `scripts/lib/clock-check-harness.test.ts`: each region's expected offsets equal the page config.

## Close-out

- **`built.md`, present tense, no history:**
  - The narrow-table entry names `probe-card.module.css`, the `roles` option and
    `overflow-wrap: normal`.
  - The kit section lists `table` `roles`, `hint` taking `SafeHtml`, `zonedValue`, and the `.field`
    track.
  - The gate entry covers both pages, the widths, the forced verdict states, and the word and
    spill checks.
  - Add a Trap: Chromium breaks at a `<wbr>` inside `white-space: nowrap`, while WebKit and
    Firefox do not. So a nowrap rule over `<wbr>` text passes PR CI (Chromium only) and fails the
    weekly sweep. Run layout gates with `--browsers webkit` too.

## Definition of done

Serve a static build (`pnpm --filter dox build`, then `node scripts/lib/static-server.mjs dist
<port>`). Never use `astro preview` or the owner's dev server.

```bash
pnpm --filter dox gates --only canada-layout-check --browsers chromium,webkit,firefox \
  --pages /check/canada-2026-clock-change/,/check/morocco-2026-clock-change/
pnpm --filter dox gates --only a11y-axe --pages /check/canada-2026-clock-change/,/check/morocco-2026-clock-change/
pnpm --filter dox gates --only canada-clock-still,canada-stored-still --browsers chromium,webkit
pnpm --filter dox exec vitest run src/widgets/builders/table.test.ts src/widgets/builders/layout.test.ts \
  src/widgets/builders/zoned-value.test.ts src/widgets/families/clockcheck/probe-card.test.ts \
  src/widgets/families/clockcheck/stored-section.test.ts src/widgets/families/stored/audit-table.test.ts \
  scripts/lib/clock-check-harness.test.ts
pnpm run validate
```

- `canada-layout-check` passes in all three engines, in dark and light, at every default width,
  and in every verdict state.
- Proof that the gate catches the bug: revert only the `.zoneid` rule, and WebKit at 300 px fails
  with scroll. Revert only `overflow-wrap: normal`, and Chromium at 300 px fails the word check.
- Screenshots of the browser card at 300 px (WebKit) for both pages: the stacked rows have a
  hairline under each, there is no left-border accent, and the hint wraps inside its card.
- If Firefox cannot launch in the sandbox ("Could not find profile folder"), report it as not run.
