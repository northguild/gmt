---
story: CORE-92
status: draft
---

# Phase 1 — gate fixes (M)

Each fix below removes a false positive or a duplicate. None of them hides a real defect.
Pure logic goes into tested modules. The browser scripts only measure.

## G1–G3: `readout-still` (S, S, S–M)

- **New `apps/dox/scripts/lib/readout-diff.mjs`, with its test.** Move into it, unchanged, the
  pure code from `readout-still.mjs`: `rounded`, `diffCells`, `diffSnapshots`, the local
  `dragProblem` and the grouping in `recordDragFindings`. Rename the local `dragProblem` to
  `dragKey`, because `gate-checks.mjs` already exports a different `dragProblem`. Then change
  the following.
- **G1, the step in the key.** `dragKey` removes `^drag (out|back) \d+/\d+: ` from the key and
  from the target. `recordDragFindings` records one finding per page, browser, width, selector
  and key. Its message keeps the step range it saw, such as `drag out 3–20, back 1–20`.
- **G2, rounding.**
  - `diffSnapshots` compares raw values with `|Δ| > 0.5`, as `diffCells` does, in both the
    keyboard pass and the pointer pass. It prints values to 2 decimals.
  - Remove `rounded` if nothing else uses it.
  - The old compare could miss a real change: 10.6 → 11.4 is 0.8 px, yet both round to 11. So
    this makes the gate stricter, not looser.
- **G2, the pointer baseline.**
  - In `readout-still.mjs` (~1062–1112), after `scrollIntoView({ block: "center" })` and before
    `mouse.down()`, wait for two animation frames and take `pointerBase = snapshot()`.
  - Diff `pointerBase` against the keyboard `base` first. Every change over 0.5 px is reported as
    `scroll moved <element>`, so a page that moves on scroll still fails.
  - The drag steps then compare against `pointerBase`.
- **G3, cascades.** Add `explainStep(changes)`. It takes one step's changed elements, each with
  its before and after box.
  - A **resized** element is one whose width or height changed by more than 0.5 px.
  - Report the **innermost** resized element: no other resized element's box lies inside its own.
  - Fold into its message the resized elements around it (`+N grew around it`) and the
    moved-only elements whose before box starts at or below its top (`+M below moved`).
  - A moved-only element with no resized element above it is still reported on its own.
  - The key is the reported element. G1 then merges it across steps.

**Unit tests, `scripts/lib/readout-diff.test.ts`:**

- 40 drag messages for one element make one finding, with the range `out 1–20, back 1–20`.
- A rect of 10.49 → 10.51 is not a change. 10.6 → 11.4 is a change.
- The GNSS cascade is one finding: chip 5 is 46 → 64, the list 262 → 280, the frame
  1315 → 1333, and 12 elements below move +18. Its message ends `+2 grew around it, +12 below
  moved`.
- A lone move with nothing resized above it is reported.
- `scroll moved` fires on a 1 px drift between the two baselines.

**Red-first:**

```bash
pnpm --filter dox gates --only readout-still --browsers firefox --pages /tools/eta-drift/
```

Before the fix, this fails with 160 ±1 px findings. After the fix it passes, unless a raw delta
of 0.5 px or more is real. A real one is a product defect: add it to Phase 2 and fix it there.
Re-run the same command for `/tools/free-time-ledger/` and `/tools/gnss-week-decoder/`.

## G5: `a11y-media` contrast in Firefox (S, confirm first)

The token reads 18 % even though `matchMedia('(prefers-contrast: more)')` matches. Confirm the
cause before choosing a fix.

1. **Probe sheet.** Before `emulateMedia({ contrast: "more" })`, add
   `@media (prefers-contrast: more) { :root { --gate-probe: 1 } }` with `page.addStyleTag`.
   After emulation, wait with `waitForFrames` until `--gate-probe` reads `1` or the wait ends.
   This replaces `matchMedia` as the proof that emulation applied.
2. **Probe applies, token stays at 18 %.** This is a product defect in
   `src/styles/gmt-a11y.css:85`. Fix the rule. The finding stays real.
3. **Probe does not apply mid-page.** Open a fresh context with
   `browser.newContext({ contrast: "more" })`, a Playwright 1.63 context option.
   Load the same page there and run the same probe and token checks. Close the context in a
   `finally`. Chromium and WebKit keep the mid-page path, and it still runs first in Firefox.
4. **Neither applies.** Report `emulation-not-applied`, which is not a product finding. Bring it
   to the owner (question 1 in the [index](./index.md#owner-decisions-questions-for-the-main-session-to-ask)).

`gate-checks.mjs`: `contrastApplied` and `emulationNotAppliedProblem` take `probe` in place of
`matches`. Update the tests in `gate-checks.test.ts`: probe on with the token at 18 % gives
`contrast-border-token`, and probe off gives `emulation-not-applied`.

**Red-first and confirm (through the Phase 0 route):**

```bash
pnpm --filter dox gates --only a11y-media --browsers firefox --themes dark,light --pages /
```

Record which branch, 2, 3 or 4, the run takes.

## G6: `grow-measure` reports one jump once (S)

- `grow-measure` passes the frame index of each maximum. In `jumpProblems`, add `maxFrame` and
  `mainMaxFrame`.
  - When the root and `<main>` both pass the limit in the same frame, it returns one problem:
    `max jump N px > limit (page and <main>)`, where N is the larger of the two.
  - Jumps in different frames stay two problems.
- `grow-measure.mjs:359` still maps `/max jump/` to `jump-over-limit`.
- Tests in `gate-checks.test.ts`: the same frame gives one problem, and different frames give two.

## G4: `file-issues` and the flood (S–M)

- **`scripts/gates/issue-plan.mjs`:**
  - Export `BODY_LIMIT = 65_536` and `BODY_BUDGET = 60_000`.
  - Export `fit(text)`. Within the budget, it returns the text as is. Over it, it cuts at the last
    line break under the budget and adds `… N more lines; full list in the run's artifacts.`
  - Every `open` body and every `comment` passes through `fit`.
  - The flood body and the flood comment are grouped by `gate:rule:page`. Each row gives the
    count, the browsers, the widths and up to 3 example targets, taken from each entry's places.
    Rows sort by count, largest first.
  - There are at most `TABLE_ROWS` rows. Export `TABLE_ROWS`. Over that, the body adds
    `N more groups`.
  - The body ends with the run URL and the artifact names `dox-gates-<leg>-<runId>`, kept for
    14 days.
  - Add `runId` to the context type.
  - Replace "Triage the cause first; the next run files whichever still fail." with "Each run
    comments here until ten or fewer remain; then each is filed on its own." The behaviour does
    not change.
  - The flood action carries `groups: <count>`.
- **`scripts/gates/file-issues.mjs`:**
  - Read `GITHUB_RUN_ID` into `runId`.
  - Before any `gh` call, refuse a body or comment over `BODY_LIMIT`: exit 1, naming the key and
    the length.
  - Add `--offline`. It makes no `gh` call, treats the open-issue list as empty, and implies
    `--print`.
  - `--print` lines show `body <n> chars`, and for a flood, `<g> groups`.
  - Update the usage text.
- **`scripts/gates.mjs:644`.** In `--all` shard mode, the skip line reads
  `not selected (no pages in this shard)`. Otherwise it keeps `no <gate> page changed`.

**Tests:**

- `issue-plan.test.ts`:
  - 2,000 synthetic findings across 40 pages make one flood action. Its body and its comment are
    each under `BODY_LIMIT`.
  - The group count and the rows are correct: counts, the browser and width sets, and 3 targets
    at most.
  - 45 groups show `TABLE_ROWS` rows and `5 more groups`.
  - A single 100,000-character message is cut by `fit` on a line boundary.
  - The existing flood tests still pass, with the new wording.
- `file-issues.test.ts`:
  - `--offline` calls no `gh`.
  - An oversized body exits 1 before any `gh` call.
  - `--print` shows the length and the group count.

**Red-first.** Run the file-issues line in the [definition of done](./index.md#definition-of-done)
before the change, but without `--offline`, using `--print` and a stubbed `gh` on `PATH` that
lists no open issues. It prints one flood with a body over 65,536 characters.
