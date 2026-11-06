# Slice 3 — Workaround removals

Starts after slice 2 (GMT on 1.0.8, every group still present). Authority row: index § Authority,
"A workaround group is removed only when its repros pass on every engine in its scope", resting on
[temporalCompat README § Rules](../../../../packages/gmt/src/internal/temporalCompat/README.md#rules)
2 and 3 (same answer after removal: no test row's expected value changes).

## Step 1 — verdicts on every engine, before any deletion

Build `packages/gmt/dist` **in this worktree** (`temporal-compat.mjs` loads `dist`), then collect a
verdict per group on each engine:

| Engine | How |
| ------ | --- |
| Node 26 | `node scripts/temporal-compat.mjs check` |
| Node at the `engines.node` floor (22.16.0) | the same, under that Node (`npx -y node@22.16.0 scripts/temporal-compat.mjs check`) — host-ICU halves (D3+D4, D16) are judged here too |
| Chromium, Firefox, WebKit | `runBrowserCompat` from `scripts/lib/native-suite-compat.mjs`, which needs slice 4's import-map change; do slice 4's compat-page part first, or run it through the slice-4 code on a scratch branch of this worktree |

Save the seven verdict outputs under the scratchpad and quote the counts in the review notes.

A group without `engines` is in scope everywhere: remove it only when **all five** engines report it
removable. A group with `engines` (D17 Firefox, D18 WebKit, D19 WebKit) is judged in its engines only.
CORE-108 findings record the Node 26 verdicts only; the browser verdicts on 1.0.8 have not been run.

## Step 2 — expected outcome (to be confirmed by Step 1)

| Group | Node 26 on 1.0.8 | Expected action |
| ----- | ---------------- | --------------- |
| D1, D2, D3+D4, D5, D6, D7, D8, D11, D12, D13, D14, D15, D20, D21, zoned.A, zoned.B, zoned.D, zoned.E | removable | remove if every engine agrees |
| D9 (old half: in-range months, `largeMonthSpan.ts`) | removable | remove; D9 itself stays, retargeted in slice 1 |
| D10 | GUARD (repros pass) | see below |
| D16 | still needed (ICU-20548) | keep; trigger unchanged (it names ICU, not a polyfill) |
| D22 | still needed (tc39/proposal-temporal#3336) | keep; retarget trigger |
| D17, D18, D19 | out of scope on Node | judge in Firefox / WebKit; keep or remove by that verdict |

Any group Step 1 shows still needed on some engine stays, its trigger retargeted.

**D10.** Its `guard` (`package: "@js-temporal/polyfill"`, `through: "0.5.1"`) exists because 0.5.1
predates tc39/proposal-temporal#3292, the change that exposes the bug. `temporal-polyfill` is a
separate implementation, so the guard's premise does not apply: its repros (`fieldsFarMonth13`,
`fieldsFarMonth12`, ethioaa year 18196) test the behaviour directly. If they pass on every engine,
remove D10 like any other group. Then the `guard` mechanism in `scripts/lib/workarounds.mjs`,
`scripts/temporal-compat.mjs` (`guard` state, `guardReason`, `guardLapsed`, `GUARD`) and
`scripts/lib/canary-*.mjs` has no user: delete it with its tests, so no dead code stays (fallow
fails on it otherwise). If a D10 repro fails on some engine, D10 stays with no guard.

## Step 3 — removal, one group per commit-sized step

For each removable group, in README § Removal steps order:

1. Follow its removal steps exactly (README § Removal steps and the `steps` in its `WORKAROUNDS` entry).
   Respect the ordered steps: README step 6 (delete `nonIsoArithmetic.ts` once D1, D2, D3–D5, D6, D7
   are all gone), the `fieldSearch.ts` step once no D2–D5 range guard remains, zoned.D before zoned.A
   (`rangeLimit.ts`).
2. Delete its repros (`probeRepros.ts` / `repros.ts`), its `WORKAROUNDS` entry, its rows in the README
   § Workarounds and § Removal triggers tables, and its § Removal steps paragraph.
3. Run the whole suite. **No expected value in any test may change** (README Rule 3). A row that
   would have to change means the group was wrong or the polyfill differs: stop and report it.
4. Remove only tests that test the deleted algorithm directly (`hebrewArithmetic.test.ts`, …).
   Public rows stay.

**Old D9 half.** Delete `largeMonthSpan.ts` and its calls in `readArithmeticModel.ts` and
`calendarDateArithmetic.ts` (README § Removal steps 9), plus the old D9 repros (`D9_INTL_READ_LIMIT`,
`D9_MONTHS`, the `formatToParts` counter). Keep slice 1's repro and guard. `largeMonthArithmetic.test.ts`
keeps every row: the in-range 3,000,000-month rows now run on the polyfill directly (≤ 7 ms each).
Rewrite README § Removal steps 9 for the guard: delete `monthRange.ts`, its calls and the D9 repro,
when a `temporal-polyfill` release throws for an out-of-range month amount in bounded time.

**Guard call sites.** Slice 1 put `assertMonthsInRange` in helpers such as `calendarDateAdd` and
`addWithCalendarCompat`. When a removal deletes or inlines such a helper, move the guard call to the
code that replaces it, and update the call-site table in `monthRange.ts`. The slice-1 timing rows
must still pass on Node and in the three browsers.

## Step 4 — retarget what stays

- `scripts/lib/workarounds.mjs`: every remaining `trigger` names a `temporal-polyfill` release (or
  ICU / an engine) and the observable it waits for, the way the current triggers do. No group says
  "js-temporal" unless its removal truly depends on that project.
- `polyfillEntry()` / `polyfillVersion()` read `temporal-polyfill`'s `package.json` and entry.
- `scripts/temporal-compat.mjs` `runtimeLine()` prints `temporal-polyfill <version>`; the
  `native-suite.mjs` `compatLine` text likewise.
- temporalCompat README: header, Rules, the § Workarounds table, § Canary and native oracle,
  § Removal triggers ("the release that becomes GMT's `temporal-polyfill` pin"), § Removal steps.
  Renumber nothing that other files cite by number without updating those citations
  (`grep -rn "Removal steps [0-9]"`).
- `src/internal/temporalCompat/index.ts` exports and `capabilities.ts` (`ARITHMETIC_DEFECTS`, probe
  sets) lose removed groups; run fallow and delete what it reports unused.
- `scripts/bundle-size.budgets.json` `absent` lists: slice 6.

## Step 5 — compat snapshot

`pnpm compat:snapshot` regenerates `apps/dox/src/data/temporal-compat.json` from the new `dist`, so
`ci.yml`'s `node scripts/temporal-compat.mjs snapshot --check` passes. The snapshot schema does not
change; the Dox pages that render it are the Dox spec's concern.

## Tests

- Every public test file passes with no expected value changed (diff the test tree: only deleted
  files, deleted rows of deleted-algorithm tests, and comments may differ).
- `scripts/lib/workarounds.mjs` tests and the canary script tests under `apps/dox/scripts/canary/`
  pass with the removed ids gone.
- `node scripts/temporal-compat.mjs check` lists only the kept groups, each "still needed" (or out of
  scope), none "removable".

## Done when

Step 1 verdicts recorded for all five engines; suite green on Node and three browsers; `temporal-compat
check` and `snapshot --check` pass; fallow clean.
