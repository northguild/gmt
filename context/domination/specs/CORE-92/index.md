---
story: CORE-92
issue: 386
status: approved
dox: none
---

# CORE-92 — Weekly check for a `temporal-polyfill` release GMT can swap to

## Scope

Story: [`issues/CORE-92.md`](../../issues/CORE-92.md) (#386). Evidence and swap conditions:
[`research/temporal-polyfill-swap.md`](../../research/temporal-polyfill-swap.md) §4, §6, §7.

The weekly Temporal oracle workflow gains a swap check. Four jobs, one per runtime (Node 26,
Playwright Chromium, Firefox and WebKit), run the whole `packages/gmt` suite twice, the way
the native suite runs its control pass: once on `@js-temporal/polyfill` (control) and once on
`temporal-polyfill/full/implementation` (swap). The Node job also runs the offset sweep. The
report job opens one `canary` issue when every leg ran, no test fails on the swap that passes on
the control in the same runtime, and the sweep finds no zone. A run that ran but is not
swap-ready files nothing. A swap leg or sweep that could not run joins the workflow's existing
could-not-run issue, like every other canary source. Nothing joins `ci.yml`; a failing
swap job never fails the workflow; CI never opens a pull request.

Two more parts ship with it:

- **`getNow.test.ts` accepts an equal reading.** It fails on every run against a polyfill whose
  clock has no sub-millisecond part, which would keep the swap check from ever passing.
- **The upstream tracker covers `fullcalendar/temporal-polyfill`.** GMT's reports there (#119,
  #120, #121, #125, #126) join `/upstream/` and `js-temporal-polyfill-bugs.md`. A closed filing
  stays listed, as credit.

No library change: no export, no `src/` behaviour, no changeset. `temporal-polyfill` is never
committed to any `package.json` or lockfile. It is installed only inside the swap job's checkout.

### Corrections to the issue's Scope wording (decided here)

1. **Alias, not an edit to the seam (Scope 1).** `internal/temporal.test.ts` › "names the
   polyfill itself" asserts that the seam names `@js-temporal/polyfill`, so an edited seam fails
   on every run and the issue could never open. A Vitest alias on the `@js-temporal/polyfill`
   specifier (the mechanism the native configs use) swaps the implementation behind an unchanged
   seam, and reaches every importer, because the seam is the only file naming the specifier.
2. **"Every test passes" is judged against the control pass (Scope 4).** The browser control
   passes fail tests for host reasons (`KNOWN_HOST_FAILURES` in
   `scripts/lib/native-suite-tags.mjs`). A leg passes when no test fails on the swap that passes
   on the control in the same runtime. A test failing on both does not block.
3. **One verdict per leg.** `temporal-polyfill-swap-<leg>`, as for `native-suite-<leg>`.

## Signatures

```text
node scripts/polyfill-swap.mjs <leg> --version=<x.y.z>   # exit 0 ran (pass or fail), 2 could not run
node scripts/polyfill-swap.mjs summary <leg>             # Markdown for $GITHUB_STEP_SUMMARY
node scripts/canary-report.mjs temporal-oracle [--force-swap-ready] …
```

```js
// scripts/lib/offset-sweep.mjs
export function parseLongOffset(text) // → seconds east of UTC | null
export function sweepOffsets({ zones, firstDay, lastDay, implOffset, intlOffset }) // → SweepResult
export function sweepSpan(today) // → { from, through, firstDay, lastDay } (Temporal.PlainDate in)
// scripts/lib/canary-verdict.mjs
export function polyfillSwapVerdict({ leg, version, entry, runtime, counts, failing, sweep })
// scripts/lib/canary-issues.mjs
export const SWAP_SOURCES   // the four temporal-polyfill-swap-<leg> sources, appended to WORKFLOW_SOURCES
export function swapReady(verdicts) // → { ready: true, version } | { ready: false, reason }
// apps/dox/src/data/upstream-filings.ts
export const TRACKED_REPOS  // the tracker's repositories, in page order; equal to REPOS in scripts/upstream.mjs
```

The verdict shape is in [swap-runner.md](swap-runner.md); the issue text in
[issue-and-summary.md](issue-and-summary.md); the tracker in [upstream-tracker.md](upstream-tracker.md).

## Files

| File | Slice |
| ---- | ----- |
| `packages/gmt/vitest.swap.config.ts` (new), `vitest.browser.config.ts`, `src/test/boundedChild.ts` (+ test) | swap-config |
| `packages/gmt/src/plain/get/getNow.test.ts` | swap-config |
| `scripts/lib/offset-sweep.mjs` (new), `apps/dox/scripts/canary/offset-sweep.test.ts` (new) | offset-sweep |
| `scripts/polyfill-swap.mjs` (new), `apps/dox/scripts/canary/polyfill-swap.test.ts` (new) | swap-runner |
| `scripts/native-suite.mjs` (a `swap` pass; export the rerun helpers) | swap-runner |
| `scripts/lib/canary-verdict.mjs`, `canary-verdict.test.ts` | swap-runner |
| `scripts/lib/canary-issues.mjs`, `scripts/canary-report.mjs`, `scripts/lib/canary-summary.mjs` and their tests | issue-and-summary |
| `.github/workflows/temporal-oracle.yml` | workflow-and-docs |
| `apps/dox/src/content/docs/upstream.mdx` ("Why this polyfill") | workflow-and-docs |
| `scripts/upstream.mjs`, `apps/dox/src/data/upstream-filings.{json,ts,test.ts}` | upstream-tracker |
| `apps/dox/src/data/temporal-compat.{ts,test.ts}` (`KNOWN_REPOS`), `components/UpstreamFilingRefs.astro`, `lib/mdx-jsx.ts` | upstream-tracker |
| `apps/dox/src/components/UpstreamTrackerLegend.astro`, `context/domination/js-temporal-polyfill-bugs.md` | upstream-tracker |

Script tests live in `apps/dox/scripts/canary/` and run under `apps/dox/vitest.config.ts`.

## Authority — what each rule rests on

| Rule | Source |
| ---- | ------ |
| Zones swept = the runtime's primary zone identifiers | ECMA-402 §8.3.2 `Intl.supportedValuesOf("timeZone")` → §6.5.3 AvailablePrimaryTimeZoneIdentifiers |
| Zone rules come from the IANA tz database | ECMA-402 §6.5 "Use of the IANA Time Zone Database" |
| Reference offset = `Intl.DateTimeFormat` `timeZoneName: "longOffset"` | ECMA-402 §11 DateTimeFormat components table (`timeZoneName` values) |
| The offset text's form is implementation- and locale-dependent, so the parser accepts `GMT`, `GMT±HH:MM` and `GMT±HH:MM:SS` and treats anything else as could-not-run | ECMA-402 FormatDateTimePattern ("an ILD String representing value"); CLDR UTS #35 Part 4 §Time Zone Format Terminology, localized GMT format (`gmtFormat`, `gmtZeroFormat`, `hourFormat`) |
| Swap offset = `Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(zone).offsetNanoseconds` | Temporal §8.2.3, §8.3.15, §6.3.29; §11.1.9 GetOffsetNanosecondsFor |
| Every swept instant is a valid Temporal instant | Temporal §8.5.1 IsValidEpochNanoseconds (±8.64 × 10^21 ns; the sweep's range sits far inside it) |
| `run date + 10 years` on 29 February → 28 February | Temporal `PlainDate.prototype.add`, `overflow: "constrain"` default (TC39 clamp, [§ Calendar & zone semantics](../../../coding-standards.md#calendar--zone-semantics)) |
| Import `/full/implementation`, never `/full` | `temporal-polyfill` 1.0.7 `full/index.js` returns the runtime's built-in `Temporal` where one exists; `full/implementation.js` always exports the polyfill (read from the published tarball). Research §7 |
| Start at 1970-01-01 | IANA tz database `theory.html` § Scope of the tz database: timezones are partitioned so that "clocks all agree about timestamps that occur after the POSIX Epoch (1970-01-01 00:00:00 UTC)" |
| One instant a day at 12:00 UTC, to ten years past the run date, Node only | **GMT rule**, issue Scope 2. On 1.0.6 the sweep found every zone in research §4.3, in about 80 s |
| Judge the swap against the same runtime's control pass | **GMT rule** (correction 2): a host failure is the runtime's, not the polyfill's |
| Type errors do not decide | **GMT rule**, issue Scope 3: research §5 lists the ~238 errors as swap cleanup |
| Swap issue on success only; comment on the open one; a run that ran but is not swap-ready files nothing | **GMT rule**, issue Scope 4 (the CORE-81 marker scheme) |
| A swap leg or sweep that could not run is listed in `temporal-oracle/could-not-run` | **GMT rule**, owner decision: a check that cannot run is a finding, never silence |
| Issue marker and body limit | Existing `canary-issues.mjs` rules (GFM HTML comment block; 65,536-character body) |
| `getNow()` may equal the frozen system time | Temporal §2.3.1 HostSystemUTCEpochNanoseconds: "the approximate current UTC date and time", and hosts may "reduce the precision of the result". No sub-millisecond part is required |
| The tracker follows `fullcalendar/temporal-polyfill`; it lists after the other two | **GMT rule**, owner decision 2026-11-04: GMT files there; GMT runs on `@js-temporal/polyfill`, so that repository leads |
| A closed filing stays listed, with an `outcome` saying why it closed | **GMT rule**, owner decision 2026-11-04 (credit); `OUTCOME_RULES` in `scripts/upstream.mjs` |
| Everything here ships in one pull request | **GMT rule**, owner decision 2026-11-04 |

## Slices

| Slice | File | Depends on |
| ----- | ---- | ---------- |
| 1 swap-config | [swap-config.md](swap-config.md) | — |
| 2 offset-sweep | [offset-sweep.md](offset-sweep.md) | — |
| 3 swap-runner | [swap-runner.md](swap-runner.md) | 1, 2 |
| 4 issue-and-summary | [issue-and-summary.md](issue-and-summary.md) | 3 (verdict shape) |
| 5 workflow-and-docs | [workflow-and-docs.md](workflow-and-docs.md) | 3, 4 |
| 6 upstream-tracker | [upstream-tracker.md](upstream-tracker.md) | — |

Slices 1, 2 and 6 can run in parallel. One worker per slice.

## Loop cost

The sweep is a script, not a library function: O(zones × days) by design, about 418 × 24,400 ≈
10.2 M comparisons, 7.7 µs each on Node 26.12.1, or about 80 s. It must not use the swap's own
transition search (`getTimeZoneTransition`), where §4.3's and #125's defects live; a brute force
is the only check independent of it. One `Intl.DateTimeFormat` per zone. No bench row.

## After #384 (Vitest 5)

Slices use only the JSON reporter, `--shard`, `--outputFile.json` and `--config`; swap and control
share one Vitest version. No test relies on mock state carried over; nothing calls `vitest list`.

## Verification before review

Run locally, each version installed in a scratch checkout (tz 2026e); explain any difference:

1. `node scripts/polyfill-swap.mjs node --version=1.0.7` — not swap-ready. Swap-only failures:
   the 12 tests of research §4.4 (#125), and nothing else once slice 1's `getNow` fix is in.
   "names the polyfill itself" must pass (correction 1). The sweep lists 0 zones.
2. `--version=1.0.6`, kept only to prove the sweep finds a real defect: it lists research §4.3's
   11 zones (`Africa/Casablanca` 178 days, `Europe/Chisinau` 42).
