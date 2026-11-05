---
story: CORE-92
status: draft
---

# Weekly sweep fixes: a local Firefox route, six gate defects, eight product defects

The first weekly Dox sweep (run 41302098223, 2026-11-01, commit 39bb202a) had 1756 findings
under 1545 issue keys. Nothing was filed: the single flood issue's body was over GitHub's
65,536-character limit. The findings come from **14 root causes**. Six are gate defects (G1–G6)
and eight are product defects (P1–P8). The Canada probe-table failure is the fifteenth, and
[core-92-canada-probe-table](../core-92-canada-probe-table/index.md) fixes it.

None of these were caught locally because Firefox has never run on this Mac, so Phase 0 comes
first.

## Phases, in order

| Phase | File | Size |
|---|---|---|
| 0. Firefox through Docker | [phase-0-firefox-route.md](./phase-0-firefox-route.md) | S |
| 1. Gate fixes G1–G6, file-issues, runner text | [phase-1-gates.md](./phase-1-gates.md) | M |
| 2. Product fixes P1–P5 (readouts, contrast) | [phase-2-product.md](./phase-2-product.md) | M |
| 3. Product fixes P6–P8 (load growth, jumps, table fit) | [phase-3-layout.md](./phase-3-layout.md) | M (P7 may split) |

Phase 1 lands before Phase 2. Each product repro then fails once per cause, not once per step.

Every product fix starts red: the named unit test or gate command fails before the change and
passes after it. A gate change may only remove a false positive. It must never hide a real
defect: a raw delta of 0.5 px or more, any real jump, any contrast miss.

## Start condition and overlaps with the Canada fix

Start only after the core-92-canada-probe-table builder has passed `dox-tester`. Build on its
changes and never revert them:

1. **`builders/layout.module.css` `.field` track `minmax(0, 1fr)`.** It applies to every
   `field()`, including the selects in P3 and P4. The sweep in the definition of done covers it.
2. **`builders/index.ts`.** Canada adds `zonedValue`. This spec adds `hold` (P1) and
   `selectOptions` (P4). Append the new exports and leave the existing lines as they are.
3. **`builders/layout.ts` `hint(id, string | SafeHtml)`.** P4 does not use it, and this spec
   leaves the function alone.
4. **Morocco's 80 px Firefox load jump at 390 (frame 3).** Canada Phase B may fix it. Measure it
   again in P7 before changing anything.
5. **`scripts/canada-layout-check.mjs`, `canada-clock-still.mjs` and `canada-stored-still.mjs`.**
   Phase 0 changes only their `launch` call. Leave Canada's page loop, widths and checks alone.
6. **`context/dox/built.md`.** Both specs edit it. Add to the entries Canada wrote and do not
   rewrite them.

## Owner rules that bind every phase

- Zero known bugs: every defect found here is fixed here, with no skip, todo or `it.fails`.
- Readout cards never move or resize their neighbours while the reader drags (P1, P2). Each one
  gets a bounding-box test.
- No left-border-only accent on any card, chip or row you touch. The accent edge is a bottom
  border, or the card has a full bevelled border.
- No business wording in code, comments, issue text or `built.md`.
- Tests own every asynchronous lifetime. Each browser, context, server and container started by a
  test or script is closed in a `finally`. Waits are awaited state changes, never sleeps.

## Close-out (`built.md`, present tense, no history)

- **Runbooks: add a Firefox route entry** ([phase 0](./phase-0-firefox-route.md#builtmd-entry)).
  Replace "Firefox does not launch on the author's machine; record it as blocked…" with a pointer
  to that entry.
- **Owed verification.** Remove the items the definition of done runs, each in the same edit as
  the run that proves it:
  - the Firefox legs of `grow-measure`, `readout-still`, `data-credits-check`,
    `canada-clock-still`, `canada-stored-still` and `canada-layout-check`;
  - the Firefox and WebKit legs of `a11y-axe`, `a11y-tab-walk` and `a11y-media`.
  The `force_finding` dispatch and per-leg times stay owed, because they need a GitHub run. If a
  leg comes back NOT RUN, its item stays.
- **Kit section:** `hold` (moved from `families/ids/`) and `selectOptions`.
- **Gate entries:**
  - `readout-still`: the step-free key, raw ≥ 0.5 px compare and fresh pointer baseline, and
    "+N below moved".
  - `grow-measure`: one finding per jump.
  - `a11y-media`: the probe sheet.
  - Weekly sweep: the grouped flood body, the body budget, and `file-issues --offline`.
- **Traps:**
  - Firefox reports scroll and layout positions as fractions, so a `Math.round` compare flips
    ±1 px. Compare raw values.
  - A late writer outside `grow()` is a jump, even when it is small.
- `tracker.md` needs no change: this work is part of CORE-92, so there is no new row.

## Owner decisions (decided)

1. **If neither a probe sheet nor a context-level `contrast: "more"` reaches Firefox's style,
   does Firefox leave the `a11y-media` contrast check, with the reason recorded in `built.md`?**
   **Decided: yes, only when proven.** Only an `emulation-not-applied` result proven by the probe
   counts. A probe that applies while the token stays at 18 % is a product defect and gets fixed.
2. **For P8 on `migrate/date-fns`, is the fix layout only, with the note text unchanged?**
   **Decided: yes.** Breaking `ZonedDateTime.prototype.equals` at a `.` is against the
   `code-break.ts` rule, so the triage's `.gmt-codebreak` idea is rejected.
3. **Is `hold` promoted from `families/ids/` to the kit?** **Decided: yes.** P1 is its fourth
   consumer outside `ids`, and the spec rule is that a widget does not hand-roll a missing kit
   piece.
4. **Does the owner dispatch the weekly workflow with `force_finding` after merge, to close the
   last owed item?** **Decided: Claude dispatches it after the owner merges, and watches the
   run.**

## Definition of done

Run all commands from `apps/dox` unless the line starts with `cd`. One build, then `--no-build`.
Run the Docker route lines only on a machine where native Firefox does not launch.

```bash
node scripts/firefox-server.mjs start && export GMT_PW_FIREFOX_WS=ws://127.0.0.1:3555/
pnpm --filter dox build
node scripts/firefox-server.mjs check   # prints "Firefox <version> (Linux) reached http://127.0.0.1:<port>/gmt/"
# Weekly tier, three engines, both themes, every affected page:
pnpm --filter dox gates --no-build --tier weekly --browsers chromium,firefox,webkit --themes dark,light \
  --pages /tools/eta-drift/,/tools/free-time-ledger/,/tools/gnss-rollover-checker/,/tools/gnss-week-decoder/,/tools/moving-feasts/,/tools/observance-comparator/,/tools/timetable-reader/,/tools/x12-time-reader/,/tools/dtm-decoder/,/tools/cron-in-a-zone/,/tools/connection-checker/,/tools/demurrage-clock/,/tools/elapsed-vs-clock-difference/,/tools/bl-date-stamp/,/tools/id-timestamp-decoder/,/tools/duration-parser-bench/,/tools/holiday-rule-builder/,/tools/cutoff-countdown/,/tools/leap-day-birthday/,/migrate/date-fns/,/check/canada-2026-clock-change/,/check/morocco-2026-clock-change/
# The six sample pages, for a11y-media, a11y-axe and a11y-tab-walk in every engine:
pnpm --filter dox gates --no-build --only a11y-media,a11y-axe,a11y-tab-walk --browsers chromium,firefox,webkit --themes dark,light
# The Canada probe-table Firefox lines, NOT RUN until now:
pnpm --filter dox gates --no-build --only canada-layout-check,a11y-axe,canada-clock-still,canada-stored-still \
  --browsers firefox --pages /check/canada-2026-clock-change/,/check/morocco-2026-clock-change/
# file-issues dry run on the saved weekly artifacts (offline; no gh call):
SP=/private/tmp/claude-501/-Users-craigcurtis-workbench-northguild-gmt/8d601eb5-0c4a-4d64-b38d-1be55c5ef690/scratchpad
D=$SP/fi && rm -rf $D && mkdir -p $D && for d in $SP/weekly-1101/dox-gates-*-41302098223; do \
  l=${d##*/dox-gates-}; l=${l%-41302098223}; mkdir -p $D/$l && cp $d/summary.json $D/$l/; done
node scripts/gates/file-issues.mjs --offline --print --legs chromium-1,chromium-2,chromium-3,chromium-4,chromium-5,chromium-6,webkit-1,webkit-2,webkit-3,firefox-1,firefox-2,firefox-3 $D/*/summary.json
pnpm --filter dox exec vitest run scripts/lib/browser-launch.test.ts scripts/firefox-server.test.ts \
  scripts/lib/readout-diff.test.ts scripts/gate-checks.test.ts scripts/gates/issue-plan.test.ts \
  scripts/gates/file-issues.test.ts src/widgets/builders/hold.test.ts src/widgets/builders/select.test.ts \
  src/widgets/builders/text-input.test.ts src/widgets/families/gnss/fuse-board.test.ts \
  src/widgets/families/holiday/signal-plates.test.ts src/widgets/families/holiday/month-grid.test.ts \
  src/widgets/families/holiday/compare-matrix.test.ts src/widgets/builders/layout.test.ts \
  src/lib/timetable-reader-mount.test.tsx src/lib/observance-comparator-mount.test.tsx
cd ../.. && node scripts/test-markers.mjs check && pnpm run validate
node apps/dox/scripts/firefox-server.mjs stop
```

- Every gate line exits 0. Each run prints `firefox` legs as run, not NOT RUN, and the Firefox
  version the route reports.
- **The file-issues line** prints exactly one action, a `dox-gate:flood` open. It reports
  `32 groups` and `body <n> chars` with n < 65,536, and every comment is under 65,536 too.
- **`readout-still` on `/tools/gnss-rollover-checker/`, Firefox at 300 px**, reports 0 findings.
  On the pre-fix tree it reported one finding per moved element per step. Record the before and
  after counts.
- **Red-first proof.** For each P item, record in the hand-back the command that failed before
  the fix and its first failing line.
- **Screenshots at 300 px**, chip list (P1) and plates (P2), in Firefox through the route: no
  left-border accent, and no chip or plate moves between the drag start and end.
- If a Firefox line cannot run, report it as NOT RUN and keep its Owed verification item. Never
  bypass the sandbox.
