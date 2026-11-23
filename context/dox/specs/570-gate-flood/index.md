---
story: none
issue: 570
status: draft
dox: gates
---

# #570 · The weekly gate flood: 202 new failures in one run

Weekly run 45024464400 (624f0df6) filed nothing: 202 new findings in 185 groups tripped the flood
guard (`FLOOD_LIMIT` 10, `gates/issue-plan.mjs`). It was the first weekly run with `--deadline 80`,
`sound-check`, `slides-check` and `plate-fit`, and the first Firefox and WebKit run of all three (PR
CI gates run in Chromium only). Run 43712950098 before it had two FLAKY rows. Dox only: no
`packages/gmt` change, so no library pipeline and no changeset.

Binding: [tier-2-gates](../../built/tier-2-gates.md), [tier-6-ops](../../built/tier-6-ops.md#the-weekly-gate-sweep), [tier-6-runbooks](../../built/tier-6-runbooks.md#run-the-gates),
[tier-3-sound](../../built/tier-3-sound.md#gates), [Reuse, never reinvent](../../built/index.md#reuse-never-reinvent).

## Causes and tally (185 groups; every group fits one cause)

| Cause | Groups | Evidence |
| --- | ---: | --- |
| A. The deadline stop is recorded as page crashes | 157 | chromium-2 `a11y-axe` passed every dark cell, then failed every light page from `/reference/unix/parse/parseTimeFromUnix/` on with "browser.newContext: Target page, context or browser has been closed"; the leg's rows sum to 79.9 min |
| B. Legs run past 80 min | 6 | the `out-of-time` groups of chromium-1, -2, -3, -6, firefox-1 and webkit-1 |
| C. readout-still rows name parts the widgets do not draw | 4 | "the row names parts the widget does not draw: drawn:hold, text:verdict", in all three engines |
| D. Table cells overflow at 390 in WebKit and Firefox | 4 | for example: content 322px wide in a 308px cell on expiry-calculator, reproduced on this Mac in WebKit; Chromium passes |
| E. sound-check fails in Firefox and WebKit | 10 | "opted in: the context is not running after the first press"; its first run in those engines |
| Singletons | 4 | one finding each, see fix 6 |

A by gate: `a11y-axe` 60 (chromium-2), `a11y-media` 90 (chromium-6), `a11y-tab-walk` 6, `slides-check` 1.
**A, the harness** (not the runner image, not the site). At the deadline, `gates.mjs` `run()`
sends SIGTERM. Playwright 1.63's default `handleSIGTERM` (`gracefullyCloseAll()`) closes the
browsers but does not exit. The gate runs on, records `check-crashed` (`lib/a11y-sweep.mjs`) for
every page left, and `invoke()` → `readReport()` reads all of it. The row already says "stopped
at the 80m deadline", and `ranOutOfTime` files that alone. A retry the deadline cuts short also
replaces the first attempt, which dropped slides-check's real finding.

**B, the budget.** Minutes per engine: Chromium at least 461 (legs of 68 to 80), Firefox 239,
WebKit 262. `shardOf` (`gates/contract.mjs`) deals round-robin from index 0, so every one-page
gate lands on shard 1, and `slides-check` (25 to 27 min) joins readout-still (23 to 33) on
chromium-1, firefox-1 and webkit-1. Moving it alone fails: every leg already carries
readout-still (about 33) and grow-measure (about 10), and Firefox legs 2 to 4 take 50 to 57 min
without it.

**C, registry drift.** #551 (f8e8b173) added `"hold"` to `drawn` and `"verdict"` to `textBoxes`
in the rows for `gnss-week-decoder`, `satellite-clock-converter`, `gnss-rollover-checker` and
`elapsed-vs-clock-difference` (`scripts/readout-still.mjs`). At the first preset none of the four
draws a `data-gate="hold"` child or a `data-gate="verdict"` part. `verdictBadge`
(`widgets/families/gnss/fuse-status.ts`) has `data-verdict` but no gate attribute. PR CI runs
readout-still only on pages a change touches, so these rows never ran.

**D, real overflows, not false positives.** The cell's own `scrollWidth` exceeds its
`clientWidth`, and what overflows is the live value or its `hold()` ghost, which is the widest
value the cell can show: the plate-fit rule (`plate-sample-overflows`). Chromium breaks after a
hyphen before a digit; WebKit and Firefox do not (UAX #14).
- expiry-calculator: the ghost `"+275760-09-13T00:00:00Z"` (`expiry-calculator.ts`, about line
  427) fails `instant()`'s `^\d{4}-` regex (`widgets/builders/instant.ts`), so it is one word.
- id-timestamp-decoder: the live `fromUlid("017F22E2-79B0-…")` has no break in its quoted string
  (`lib/call-args.ts`). It is 297px in a 274px cell, reproduced here in WebKit.
- Linux fonts only (pass on this Mac): terrestrial-time-stack's ghost `8888-88-88T88:88:88.888888888 TCG`
  sets on one line (350px in 308/328px cells); x12-time-reader's `"2024-06-15T14:30:00-04:00"` scrolls 2px at 1440.

**E, a real bug plus the runner.** On macOS WebKit (`/`) `unlock` passes but `click` fails ("reduced, opted in: a
saved unmute plays 0 voice(s)") and `control-keys` fails (macOS WebKit's Tab skips buttons: local
only). CI's `unlock` failure ("context is not running") fits a runner with no audio sink.

## Fix, in order

1. **Runner** (`scripts/gates.mjs`). At the deadline, record the report file's byte length, send
   SIGTERM, and SIGKILL after a 10 s grace. `readReport(report, { upTo })` drops lines past that
   offset. A retry the deadline stops keeps the first attempt's status and findings, plus the
   out-of-time note. No retry starts with less time left than the first attempt took. Pass
   `handleSIGTERM: false` in `lib/browser-launch.mjs` `launchBrowser()`, after checking that no
   gate script relies on the default.
2. **Leg budget** (owner: 8 Chromium / 5 Firefox / 5 WebKit; about 20 min of headroom per leg). Change the matrix, the report job's `LEGS` list and the header
   comment in `.github/workflows/dox-gates-weekly.yml`, and `gates/ci-legs.test.ts`. Add
   `shardOf(list, shard, costs, offset = 0)`: a one-page gate's round-robin starts at its
   `registry.mjs` index (passed in by `gates.mjs`), so one-page gates spread; costed dealing stays.
3. **readout-still rows.** Where a widget draws a verdict, add `gateAttr("verdict")` to the
   element that holds its text (for `verdictBadge`, the `<p>`, so its `span` matches). Otherwise
   drop `"verdict"`. Drop `"hold"` where the widget has no `hold()` at its first preset; keep the
   GNSS block's comment true.
4. **Cells break where the kit says**, with no CSS or markup in a widget. Widen `instant()`'s
   first group to `[+-]?\d{4,6}-\d{2}-\d{2}`, with a unit test. In the shared call-args seam
   (`lib/call-args.ts`, `codeString` or `renderValue`), put a `<wbr>` after each `-` and `:` in a
   quoted string. Check terrestrial's ghost class (`styles.mono`) and x12's instant for
   `white-space: nowrap` or a missing `instant()`. The second-instance test: a new tool with an
   extended year or a hyphenated ID gets both fixes for free.
5. **sound-check** (owner: fix first, then scope). Fix the WebKit `click` bug in the site: a saved
   unmute under reduced motion plays no voice (`src/lib/sound/engine.ts, `live()``), with a unit test. Then
   the rules that need running audio (`unlock`, `click`, `link`, `link-hold`, `chrome-cue`,
   `control-pop`, `control-still`) run on Chromium only in CI (`scripts/sound-check.mjs`), each
   with a comment: CI's Linux engines have no audio sink. Mute and no-autoplay stay on every
   engine. The local WebKit run (DoD 5) stands in for Safari; never weaken a rule it fails.
6. **Singletons** (DoD 6): the expiry-calculator disabled border at 1.00:1 (`contrast-measure`),
   its `forced-colors-boundary` (`a11y-media`), `readout-moved` on holiday-rule-builder, and
   `data-credits-check` on `/` (WebKit). A singleton that fails on any re-run is fixed in the site.
   One that passes both re-runs is flake, recorded with both runs in the close-out. None stays open.

## Reuse

Used: `gates.mjs` `run()`/`invoke()`/`readReport()`, `contract.mjs` `shardOf`, `ranOutOfTime`, `launchBrowser`,
`widgets/builders/{instant,hold,gate}.ts`, `lib/call-args.ts`. No new shared pieces; `readReport(path,
{ upTo? })` and `shardOf`'s `offset` widen. Every change is shared (runner, kit, rows); no widget gains markup.

## Traps

- This Mac: Firefox does not launch (CI only); `pnpm exec`, not `npx`; no `fnm`; `gates` is silent
  until it ends; kill only your own pids; check `uptime` before calling a timeout a regression; the
  Cloudflare beacon is unreachable, so `validate`'s Chromium `dox-tables` time out locally.
- Never run `file-issues.mjs` without `--print` or `--offline`.
- Runner tests that spawn a child use a fake clock or `AbortSignal` and kill it in `afterEach`.

## Definition of done (dox-tester runs each line)

1. `pnpm --filter dox exec vitest run scripts/gates src/widgets/builders src/lib/call-args src/lib/sound`
   is green, with new tests for the offset cut, a deadline-stopped retry keeping attempt 1, no
   retry when time is short, `shardOf`'s offset, `ci-legs` at 8 + 5 + 5, `instant()`, call-args
   and the `click` fix.
2. `pnpm --filter dox gates --only a11y-axe --browsers chromium --deadline 1 --no-build`, unscoped,
   shows "stopped at the 1m deadline" and no `check-crashed` finding.
3. `pnpm --filter dox gates --only table-fit --pages /tools/expiry-calculator/,/tools/id-timestamp-decoder/,/tools/terrestrial-time-stack/,/tools/x12-time-reader/ --browsers webkit,chromium`
   passes. Before the fix, it fails on the first two pages in WebKit.
4. `pnpm --filter dox gates --only readout-still --pages /tools/gnss-week-decoder/,/tools/satellite-clock-converter/,/tools/gnss-rollover-checker/,/tools/elapsed-vs-clock-difference/ --browsers chromium,webkit`
   passes.
5. Local WebKit (Safari's stand-in): `pnpm --filter dox gates --only sound-check --pages /,/tools/zoned-earth/ --browsers webkit`
   passes every rule, `click` included (it fails before the fix). The one exception is
   `control-keys`: macOS WebKit's Tab skips buttons. Record that exception in tier-3-sound Traps.
   `--plan --browsers firefox,webkit` lists none of the seven audio rules for CI.
6. Twice each, `--no-build`, after any fix: `gates --only contrast-measure,a11y-media --pages
   /tools/expiry-calculator/ --browsers chromium`; `gates --only readout-still --pages
   /tools/holiday-rule-builder/ --browsers chromium`; `gates --only data-credits-check --pages /
   --browsers webkit`. All four pass both times. The close-out names each as fixed or as flake.
7. `pnpm --filter dox gates --plan --all --tier weekly --browsers chromium --shard i/8`, for i = 1
   to 8, shows slides-check and the other one-page gates on different legs.
8. Duplication: `git diff --stat` within rule 10; no new `275760` copy in `apps/dox/src`; no widget gains `<wbr>`/`white-space`.
9. `pnpm run validate` green bar the beacon-bound Chromium tests (Traps); CI judges. Status stays draft until approved.
10. Close-out, present tense: tier-2-gates (The runner: deadline cut, retry rule), tier-6-ops (The
    weekly gate sweep: legs, measured minutes, one-page spread), tier-3-sound (Gates: engines per
    rule). After merge the owner runs the weekly workflow once; every leg ends inside 80 min.

## Files (`apps/dox/` unless rooted)

`scripts/gates.mjs`, `scripts/gates/{contract.mjs,contract.test.ts,ci-legs.test.ts}` plus a runner
test, `scripts/lib/browser-launch.mjs`, `.github/workflows/dox-gates-weekly.yml`,
`scripts/readout-still.mjs`, `src/widgets/families/gnss/fuse-status.ts`,
`src/widgets/builders/instant.ts` and its test, `src/lib/call-args.ts` and its test, the
terrestrial and x12 ghost and instant sources (if fix 4 finds `nowrap`), `src/lib/sound/engine.ts`
and its test, `scripts/sound-check.mjs`, the singleton fixes (expiry-calculator styles, if a
singleton reproduces), and `context/dox/built/tier-{2-gates,6-ops,3-sound}.md`.
