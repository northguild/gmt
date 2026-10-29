---
story: gate-stability
status: draft
---

# Gate stability: stable finding identity, #429's causes, a weekly sweep, the component kit

The gate sweep (run 40750381495, commit `d693527b`) filed #429: 59 findings on 21 pages, and all
12 legs were red. #430 tracks the fix. This story is one PR, and it does four things:

- It keys each finding on an element identity that a sibling insert, a React `useId` change or
  a class rename cannot move.
- It fixes every cause of #429 in the product, or in the gate where the fault is the gate's.
- It makes the gates name each cause beyond doubt.
- It moves every widget onto one component kit (custom elements, builders, CSS Modules, a
  layered cascade) with tests that query by role, so the #429 class of fault cannot come back.

Nothing is deferred, excluded, waived or given a looser threshold. A gate changes only where the
fault lies in the gate, and the gate then reports that condition as a gate failure. It never
passes silently.

**Local checks are Chromium on macOS** day to day (owner decision). Before handover, Firefox
and WebKit run once, locally, on the #429 pages in both themes at 390 and 1440 (slice 11). No
Docker and no local Linux. Cause 5 shows only on Linux, so it is the one cause left to the
first weekly run after merge, which Claude dispatches and triages.

**Hard limits.** No `packages/gmt` edit. No changeset. Never stage, commit, branch or push. Do
not build the library: the owner's `pnpm dox:dev` serves `packages/gmt/dist`.

## Slices, in order

| # | Slice | Engine |
|---|---|---|
| 1 | [Element identity and the `target` field](./01-identity.md) | jsdom + Chromium |
| 2 | [Widget roots: `data-widget`, a named region, `data-starter`](./02-widget-roots.md) | Chromium |
| 3 | [Gate locators by role and name](./03-locators.md) | Chromium |
| 4 | [Product fixes for causes 1, 4 and 9a](./04-product-fixes.md) | Chromium |
| 5 | [Gate diagnostics for causes 2, 3, 5 and 9b](./05-gate-diagnostics.md) | unit tests + Chromium |
| 6 | [Weekly sweep, `dox-gate` label, close-out](./06-weekly-sweep.md) | none |
| 7 | [Test kit and test-file lint](./07-test-kit.md) | jsdom |
| 8a | [Component kit: elements, builders, CSS Modules](./08a-component-kit.md) | jsdom + Chromium |
| 8b | [Layered cascade, `!important`, Stylelint, jsx-a11y, footer and font](./08b-cascade-and-lint.md) | Chromium |
| 8c | [Written rules, and the GNSS Week Decoder pilot](./08c-rules-and-pilot.md) | jsdom + Chromium |
| 9a | [Kit additions, recipe, GNSS / ID / column bridge](./09a-gnss-ids-bridge.md) | jsdom + Chromium |
| 9b | [Handles and tables](./09b-handles-and-tables.md) | jsdom + Chromium |
| 9c | [Elapsed, feasts, holiday rules, Playground form](./09c-feasts-elapsed-playground.md) | jsdom + Chromium |
| 10a | [Cutoff family](./10a-cutoff-family.md) | jsdom + Chromium |
| 10b | [Punctuality and transport](./10b-punctuality-transport.md) | jsdom + Chromium |
| 10c | [EDI and ledger](./10c-edi-ledger.md) | jsdom + Chromium |
| 10d | [Timescale, holidays, cron, converter bench](./10d-timescale-holiday.md) | jsdom + Chromium |
| 10e | [Clock-change checkers: Canada, Morocco](./10e-clock-change-checkers.md) | jsdom + Chromium |
| 10f | [Globe, Zone Planner, zone controls](./10f-globe-and-zones.md) | jsdom + Chromium |
| 10g | [Chat rail and `/dox/`](./10g-chat-rail.md) | jsdom + Chromium |
| 11 | [Delete the legacy layer, verify every page](./11-delete-legacy.md) | Chromium, then Firefox + WebKit once |

Run slices 1–3 first. They change how findings are named, not what fails, so every later finding
carries its key. Slice 6 depends on slice 1's `target`. 7, 8a and 8b build the test kit, the
component kit and the cascade. All 42 `src/lib/*-mount.ts` files are covered (`widget-mount.ts`
is the shared contract, not a widget).

**Migration runs in parallel lanes** (owner decision), in one working tree:

1. **Before the wave:** the 8c doc rules, the 8c pilot and 9a § 1 (kit additions) run side by
   side. The pilot's pattern becomes every lane's brief.
2. **Wave 1:** one lane per family hub. It builds the family pieces, then migrates two widgets.
   The lanes that own no family (9b, 9c's Playground form, 10e, 10f, 10g) also start here.
3. **Wave 2:** the widgets that borrow a family's pieces start once that family's lane is done.
4. **Lane checks** are the touched tests, `pnpm lint` and the gates' `--resolve-only`. No lane
   runs a browser gate or a build. The main session alone edits the shared lists: the
   `gmt.css` imports, `customCss`, `LEGACY_FILES` and the two `lint/legacy-*.mjs` lists.
5. **Slice 11 runs before the last check**, so one combined run covers Chromium on every page,
   then Firefox and WebKit on the #429 pages.

## Causes

| # | Findings | In this story | Slice |
|---|---|---|---|
| 1 | `readout-moved` ×4 (gnss-week-decoder, gnss-rollover-checker, satellite-clock-converter) | **Fixed.** Confirmed: CSS specificity | 4 |
| 2 | `contrast-border-token` ×6 and `contrast-text-shadow` ×2, Firefox | **Fixed in the gate.** It waits for emulation; a timeout is `emulation-not-applied`. The CSS needs no change. Firefox run in 11 | 5, 11 |
| 3 | `focus-obscured` ×12 on `/dox/`, Firefox | **Fixed.** The message gives the cover, scroller and viewport facts (5); `scroll-padding-block` on the `/dox/` scrollers (10g) | 5, 10g |
| 4 | `canada-clock-still` and `canada-stored-still` scroll sideways at 375 | **Fixed.** Confirmed on a fresh HEAD build | 4 |
| 5 | `contrast-below-7` on the footer `time`, dark, 1440, Linux | **Fixed.** Stale-rect guard `layout-moved-during-measure` (5); an opaque footer surface (8b). Linux confirms in the first weekly run | 5, 8b |
| 9a | connection-checker `jump-over-limit`, 77–80 px | **Fixed.** Confirmed: the asides sit outside a grow slot | 4 |
| 9b | Firefox load jumps (moving-feasts, holiday-rule-builder, morocco, id-timestamp-decoder, zoned-earth) | **Fixed.** The message gives the frame, the deepest resized element and the font state (5); a metric-matched fallback font (8b); reserved sizes and `<gmt-grow>` per widget | 5, 8b, 9a, 9c, 10e, 10f |
| 6 | `contrast-below-7` at 5.7–6.7:1 on stacked tints | **Fixed.** One opaque `--gmt-surface-widget` on every card and section | 8a, 9a |
| 7 | `contrast-below-7` at 2.7–5.3:1 on hero captions | **Fixed.** The `hero` builder owns its caption ink; the leaked `.gmt-punct-hero` rule is deleted | 8a, 9a, 10b |
| 8 | `contrast-below-7` at 1.1–4.0:1 on solid cyan | **Fixed.** `<gmt-chips>` owns its selected ink | 8a, 9a |

Causes 2, 3 and 9b are proved in the local Firefox and WebKit run (slice 11). Cause 5 is proved
by the first weekly run after merge.

## Where the docs were wrong

See [docs-drift.md](./docs-drift.md).

## Builds

`pnpm gates` without `--no-build` builds `apps/dox` only. It builds the library only when
`packages/gmt/dist` is missing, and that folder exists. It writes Vite's cache to
`.gates/vite-cache`, so the owner's dev server keeps working
([built.md § Runbooks, the build trap](../../built.md#runbooks)). Build once per iteration, then
use `--no-build`.

## Definition of done

1. From `apps/dox`, these pass: `pnpm test`, `pnpm check` and `pnpm lint`. Then run
   `pnpm --filter @gmt/dox build`.
2. From the repo root, `node scripts/verdict.mjs validate` passes. If it lists a `packages/gmt`
   build step, stop and ask the owner before running it.
3. Each converted gate runs `--resolve-only` (slice 3) on **every** page it lists, in Chromium,
   and every locator resolves. This takes about 5–10 min.
4. The #429 pages pass every gate in Chromium, in both themes, at the gates' own widths (390 and
   1440). Run from `apps/dox`:
   ```sh
   pnpm gates --no-build --browsers chromium --themes dark,light --retries 0 --pages \
   /,/why-gmt/,/dox/,/check/canada-2026-clock-change/,/check/morocco-2026-clock-change/,\
   /mistakes/intermodal/,/tools/column-timestamp-bridge/,/tools/connection-checker/,\
   /tools/dst-inspector/,/tools/duration-parser-bench/,/tools/dwell-ledger/,\
   /tools/elapsed-vs-clock-difference/,/tools/gnss-rollover-checker/,/tools/gnss-week-decoder/,\
   /tools/holiday-rule-builder/,/tools/id-timestamp-decoder/,/tools/interval-visualizer/,\
   /tools/moving-feasts/,/tools/satellite-clock-converter/,/tools/stored-time-audit/,\
   /tools/zoned-earth/,/tools/timetable-reader/
   ```
   - The list is the 21 #429 pages plus timetable-reader, which has the latent cause-1 table.
   - Expect **about 30–40 min**. readout-still takes 5–8 min a page, and contrast-measure took
     6m53s for 8 pages in both themes.
   - While iterating, use `--only <gate>` on one page (1–4 min). Run the full command once, at the
     end.
   - dox-tester quotes `.gates/summary.json` and the per-gate `.ndjson`, with no finding lines.
5. Every `.ndjson` finding line has a non-null `target` in the identity grammar (slice 1). Paste
   one example for each gate.
6. Slice 6 is done: `--tier weekly`, the renamed workflow, and the `dox-gate` label with no
   `bug`. `grep -rn nightly apps/dox/scripts .github context/dox` hits only this folder.
7. Close-out: `context/dox/built.md` and `context/dox/reference/verification-and-risks.md`
   describe what is built ([slice 6, close-out](./06-weekly-sweep.md#close-out)).
8. No card touched has a left-border-only accent. Readouts hold still under drag, which slice 4's
   bounding-box check proves.
9. Slices 7–11 each meet their own definition of done. Slice 11's runs are the last ones:
   Chromium on every page, then Firefox and WebKit on the list in item 4.

**After merge, for the main session.**

- Run `gh workflow disable dox-gates-weekly.yml` straight away. The renamed file registers as a
  new workflow, which starts enabled. If the merge lands on a Sunday, do it before 04:41 UTC.
- The owner says when to enable it. Then Claude dispatches the first weekly run and triages
  its findings. Cause 5 (Linux) is checked there; any finding is fixed before #429 closes.
- Close #429 only on the owner's word, with a pointer to the fix.

## Decided

1. **CSS target: Baseline 2024.** `cssTarget` is `["chrome130","edge130","firefox132","safari18.2"]`,
   because the site already depends on relative colour and `@property` (slice 8b).
2. **Global sheets only for DOM we do not render:** Starlight, Pagefind, and chart and map
   library output. They sit in the named `gmt.thirdparty` layer, and Stylelint applies to them,
   `declaration-no-important` included. Every element we render is styled by a CSS Module.
3. **Accessibility tests use axe-core directly**, not a wrapper (slices 7 and 8a).
4. **The map tooltip changes.** The owner approves before-and-after screenshots, in both themes,
   before slice 9a starts (slice 8b, done line 10).
