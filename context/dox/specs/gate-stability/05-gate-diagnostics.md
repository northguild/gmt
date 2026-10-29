# Slice 5 — gate-side diagnostics for causes 2, 3, 5 and 9b

These causes show only in Firefox or on Linux. This slice changes the gates so that each run
names the cause beyond doubt. The product fixes are in later slices of this story: cause 3 in
10g, cause 5 in 8b, cause 9b in 8b, 9a, 9c, 10e and 10f. Cause 2 is the gate's own fault, so
this slice fixes it. Every new condition is a **gate failure** under its own rule; none passes
silently. Unit-test each pure check in
`gate-checks.test.ts` or the gate's own test file.

## 2 · `contrast-border-token`, `contrast-text-shadow` (Firefox)

`gmt-a11y.css:84-106` overrides `--gmt-border` under `prefers-contrast: more` and drops
`text-shadow`. Firefox reports `--gmt-border` unchanged even though `matchMedia` already matches.

Change `checkContrast` in `a11y-media.mjs`:

- After `emulateMedia({ contrast: "more" })`, check once per animation frame, for up to 2 s. Stop
  when `--gmt-border` on `:root` equals `--gmt-border-strong` **and** every element the gate
  samples for `text-shadow` reads `none`.
- If the time runs out, record rule `emulation-not-applied` with `target: "root"`. The message
  holds the frames waited, `matchMedia('(prefers-contrast: more)').matches`, and both token
  values. Fail the cell, and record neither product rule for it.
- If the wait succeeds, measure as today.

The weekly run then shows one of two things: a late style recalc, which now passes, or
emulation that never applies (`emulation-not-applied`). The owner decides the second case when
it appears.

## 3 · `focus-obscured` ×12 on `/dox/` (Firefox)

The artifacts are **not** enough to fix the product. Firefox at 390 reports starters "covered by
footer.gmt-hive-licence". On a fresh build in Chromium at 390, that footer has
`display: none` (`gmt-hive.css:1579-1583`, `max-width: 60rem`), and `.gmt-hive-examples-body`
reaches the viewport bottom (570–844). At 1440 the scroller ends at 850 and the licence starts
at 866, so they do not overlap. The 1440 "covered by a" case names no element at all. The same
selectors carry `aside#_r1R_0_`, a React `useId`, which slice 1 removes from keys.

Change `a11y-tab-walk.mjs` (`obscuredByProblem` in `gate-checks.mjs:293` and its caller). The
`focus-obscured` message gives, in full and never cut:

- the covering element's identity key, its rect, and its computed `display`, `position`
  and `z-index`;
- the focused control's rect;
- its nearest scroll container's identity key, rect, `scrollTop` and `scroll-padding-block`;
- the viewport size, and `matchMedia('(max-width: 60rem)').matches`.

Keep the 300 ms re-check. The facts written are the ones from the second look.

## 5 · `contrast-below-7` on the footer `time` (Linux, dark, 1440)

This passes on a fresh HEAD build on macOS Chromium. So do the other `contrast-below-7` pages
of #429. `contrast-measure` collects the glyph rects once (`collect`), then takes four
screenshots (`shoot` ×2, `contrast-measure.mjs:497-552`). If anything above the footer changes
height in between, the rects are stale. The sample then lands on a widget card's teal surface
(#082c34).

Add the guard:

- After the second `shoot`, collect again.
- If any measured rect moved by more than 0.5 px, record rule `layout-moved-during-measure`.
  Use the target of the moved element's key. The message gives the largest shift and the key of
  the first element above it whose height changed.
- Fail the cell, and drop its contrast findings, because they were measured on stale geometry.

Slice 8b gives the footer an opaque surface and a metric-matched fallback font. If the first
weekly run on Linux shows the guard firing, the late growth is a product jump, fixed before #429
closes. If it shows `contrast-below-7` with the guard quiet, the surface fix did not take, and
it is fixed the same way.

## 9b · Firefox load jumps

The findings:

- moving-feasts, 119 px at 1440;
- holiday-rule-builder, 58 px at 1440;
- morocco, 56 px at 390;
- id-timestamp-decoder `main`, reported as "48 px > 48";
- zoned-earth, globe root `grew` 25 px at 1440 and 390.

Change `grow-measure.mjs`. A `jump-over-limit` or `grew` finding's message names:

- the frame index and time since navigation;
- the identity key of the deepest element whose block size changed in that frame, with its
  before and after sizes;
- `document.fonts.status`, and the families that loaded since the frame before. This tells a
  font swap from a late sizer.

Reuse what `--frames` and `lib/grow-frames.mjs` already compute. Do not save frame images in
the default run.

Print every measured and limit value to 0.1 px. "48 px > 48" is a rounding artefact in the
message. The comparison stays exactly as it is: no looser limit.

## Done

- `pnpm test` passes, with new tests for:
  - the emulation wait timing out;
  - the stale-rect comparison;
  - the full covered-by message;
  - the frame-diagnostic message builder;
  - 0.1 px formatting.
- On macOS Chromium the four gates still pass on their #429 pages. They prove they fire through
  unit tests that feed recorded inputs. Do not force a failure in the product.
