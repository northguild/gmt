# Phase 1 — D33 retirement signals: `pnpm compat` and the swap check

Read with [index.md](index.md) and [probes.md](probes.md). The owner asked for a signal for both ways
out: a `@js-temporal/polyfill` release, and the swap to `temporal-polyfill`. Neither signal may
retire D33 on a partial pass.

## Way out 1 — a js-temporal release (`pnpm compat`)

`scripts/temporal-compat.mjs` runs every repro in `repros.ts` and fails the run on a repro whose
defect has no workaround group (`reportedUnknownRepros`). So the `D33` entry in
`scripts/lib/workarounds.mjs` is required, not optional. Add it after D32:

```js
{
  defects: ["D33"],
  // Every engine: the defect is host disagreement, so one engine passing proves nothing.
  title:
    "D33 — Chinese and Dangi dates differ by host; GMT refuses them on every host (internal/lunisolarRefusal.ts)",
  trigger:
    "every engine's compat verdict (Node, chromium, firefox, webkit, webkit-macos) passes every D33 repro: the fields rows (the Temporal dependency's dates) and the text rows (the host's Intl.DateTimeFormat) give the Purple Mountain Observatory and KASI dates, so 2027-02-06 is the Chinese New Year and 2027-02-07 the Dangi one on every host (Intl era/monthCode §1.1 Table 1)",
  steps: [
    "A minor changeset, not a cleanup: add chinese and dangi to calendarSystems (internal/calendarSystemIds.ts) and CalendarSystem (types/calendar-system.ts), with the D33 repro values as public test rows.",
    "Delete internal/lunisolarRefusal.ts and its call in construct (formatterCache.ts), the D33 repros in repros.ts, D33_CHECK and the Chinese and Dangi sweep in scripts/polyfill-swap.mjs.",
    "Turn the sentinel rows of lunisolarRefused.test.ts into value rows, and move the D28 and chinese D29 rows back to the public functions.",
    `Full wording: ${COMPAT_README} § Removal steps 33.`,
  ],
},
```

- **No `engines` key.** D32 has `engines: ["webkit"]` because the defect is JavaScriptCore's; D33
  is every engine's, so every leg's verdict counts and none is out of scope.
- `pnpm compat` (Node 24, the local oracle) and the weekly `temporal-compat-*` browser legs load
  `repros.ts` from `dist`, so they pick up D33 with no new wiring. Node 22 and 26 need no source of
  their own: they ship the same ICU4C 78.3 as Node 24, and a native-Temporal answer never reaches
  GMT. Today every leg prints `D33 STILL NEEDED` (see probes.md, Expected states).
- `scripts/lib/workaround-paths` check: `apps/dox/scripts/canary/workaround-paths.test.ts` asserts
  each entry's file paths exist. `internal/lunisolarRefusal.ts` must exist before that test runs.

## Way out 2 — the swap to `temporal-polyfill` (`scripts/polyfill-swap.mjs`)

Today the Node swap leg's calendar sweep compares every `Intl` calendar's years with Node's
built-in Temporal, and `swapReady` (`scripts/lib/canary-issues.mjs:1271`) blocks on any differing
calendar. `temporal-polyfill` 1.0.8 reads Chinese and Dangi from the host's `Intl` (fullcalendar
#128), so on Node 26 it differs from the built-in Temporal (ICU4X), and the 6 versus 7 February
2027 difference is caught (first-day-of-year fact). That leaves two gaps:

1. The sweep blocks the swap on calendars GMT refuses anyway (Open question 1).
2. Nothing in the swap verdict says whether a swap would retire D33.

### Changes

**a. A D33 check test, `packages/gmt/src/test/lunisolarRefused.test.ts`** (also holds the public
sentinel rows, [tests.md](tests.md)). One test, titled by its outcome, like `swapEntry.test.ts`:

```ts
const failing = d33Repros().filter((r) => runRepro(r) !== r.expected).map((r) => r.name);
it(
  failing.length === 0
    ? "every D33 repro passes on this Temporal and this host"
    : "a D33 repro fails on this Temporal and this host",
  () => { /* asserts the D33 repros ran (count 32) and formatDate still returns "" */ },
);
```

- `d33Repros()` reads `repros.filter((r) => r.defect === "D33")`; `runRepro` returns
  `ERR <message>` on a throw, as the compat runner does (reuse the runner's helper if `repros.ts`
  exports one; otherwise a three-line local try/catch).
- The test passes in both titles. A ternary title, never `it.runIf` or `it.skip` (zero-skip rule).
- It runs in every pass; only the swap check reads its title.

**b. `D33_CHECK` in `scripts/polyfill-swap.mjs`**, next to `ENTRY_CHECK`:

```js
export const D33_CHECK = {
  file: "src/test/lunisolarRefused.test.ts",
  pass: "every D33 repro passes on this Temporal and this host",
  fail: "a D33 repro fails on this Temporal and this host",
};
/** "removable", "still needed" or "missing", from the swap pass's report. */
export function d33Check(report) { … }
```

- `d33Check` finds the file in the swap report and returns `"removable"` when the `pass` title
  passed, `"still needed"` when the `fail` title passed, `"missing"` otherwise.
- It never enters `failing`: both titles are passing tests. Do not add the synthetic `(vitest)`
  row on its account.

**c. Split the calendar sweep.** In the Node leg:

```js
const all = Intl.supportedValuesOf("calendar");
calendarSweepResult = d.calendarSweep(entry, all.filter((c) => !LUNISOLAR.includes(c)));
d33SweepResult = d.calendarSweep(entry, all.filter((c) => LUNISOLAR.includes(c)));
```

`LUNISOLAR` is `["chinese", "dangi"]`, declared in the script with a comment naming
`internal/lunisolarRefusal.ts`'s `LUNISOLAR_CALENDARS` (scripts never import from `src`). Both
sweeps are wrapped in their own try/catch, as now; a D33 sweep that cannot run records
`{status: "could-not-run", message}` and never stops the leg.

**d. Verdict.** `polyfillSwapVerdict` (`scripts/lib/canary-verdict.mjs:256`) gains
`d33: { check: "removable" | "still needed" | "missing", sweep: <calendarSweep shape> | null }`.
Browser legs carry `check` and `sweep: null`. `couldNotRunVerdict` keeps a D33 sweep that ran, as
it keeps the other sweeps. Update the typedefs at `canary-issues.mjs:200` and `:230`.

**e. Issue text.** `canary-issues.mjs`:

- `d33SwapState(verdicts)` → `"removable"` when every swap leg ran, every `d33.check` is
  `"removable"` and the Node `d33.sweep` ran with `differingCalendars === 0`; `"still needed"`
  otherwise. Fail closed: a missing field is `"still needed"`.
- `swapParagraphs` adds one line after the calendar line:
  - removable: "Chinese and Dangi: every leg passes the D33 repros and both calendars match the
    built-in Temporal from … to …. D33 can be retired with this swap (README § Removal steps 33)."
  - still needed: "Chinese and Dangi: D33 stays. N of M legs fail a D33 repro; the calendar sweep
    finds K of 2 calendars differ from the built-in Temporal. GMT refuses both calendars on every
    host, so this does not block the swap."
- `swapReady` is unchanged in logic; it never reads `d33`. Its calendar count no longer includes
  chinese and dangi because the sweep in (c) excludes them.
- The weekly summary (`summary` in `polyfill-swap.mjs:242`) prints the same D33 line.

**f. Header.** Replace the last paragraph of `scripts/lib/calendar-sweep.mjs`'s header: "Any
calendar that differs blocks, whatever the cause. The swap check sweeps chinese and dangi
separately while compat D33 holds: GMT refuses both on every host, so their sweep reports whether
the swap retires D33 and never blocks the swap."

## Expected verdict against `temporal-polyfill` 1.0.8 today

`d33.check: "still needed"` on every leg (its fields come from the host's ICU4C on Node and
Chromium), `d33.sweep.differingCalendars: 2` on Node 26 (both differ from ICU4X), issue line
"D33 stays". The swap is not blocked by D33.

## Script tests (`apps/dox/scripts/canary/`)

| File | New rows |
| --- | --- |
| `polyfill-swap.test.ts` | `d33Check` on a report with the pass title, the fail title, neither; the Node leg calls `calendarSweep` twice with the split lists (fake deps); a D33 sweep that throws records `could-not-run` and the leg still writes a verdict; `failing` never holds a D33 row |
| `canary-verdict.test.ts` | `polyfillSwapVerdict` carries `d33` unchanged; `couldNotRunVerdict` keeps a D33 sweep |
| `canary-issues.test.ts` | `d33SwapState`: all removable → `"removable"`; one leg `"still needed"` → still needed; one leg missing `d33` → still needed; Node sweep `differingCalendars: 1` → still needed. `swapParagraphs` prints each line exactly. `swapReady` ignores `d33` (ready stays true with `d33.check: "still needed"`) |
| `calendar-sweep.test.ts` | none (pure functions unchanged) |
| `workaround-state.test.ts`, `temporal-compat-cli.test.ts` | a D33 group with all repros failing prints `STILL NEEDED`; the `D33` group has no `engines` and is read on every leg |

No CNRY row: this is retirement wiring for a compat entry, not a new canary story.
