---
story: CORE-112
issue: 522
status: draft
dox: none
---

# CORE-112 — Week-year `Y` in ICU patterns: no V8 abort, the calendar year printed (D23, D24)

## Scope

Lands as a phase of PR #523 (DOX-G9, #522). `CORE-*` ids are for `packages/gmt` work and this is
a library fix; `CORE-112` is the next free one ([tracker](../../tracker.md)). No issue file or tracker
row exists yet: see owner question 1.

Some CLDR 48 patterns use `Y` (year of the week-of-year) where `y` (calendar year) is meant.
Two separate defects follow:

1. **Abort (engine).** V8 without commit `0426b0d1045d` hits a fatal check in
   `formatToParts` and `formatRangeToParts` on a `Y` field: SIGTRAP, exit 133, no exception
   (nodejs/node#67076). Every installed Node aborts (22.22.2, 24.19.0, 24.21.0, 26.8.2, 26.10.0,
   26.12.1, 26.13.0; CLDR 48.0); GMT cannot catch it. **Shipped GMT aborts Node today** (worktree
   `dist`, Node 26.12.1, exit 133):
   - `formatZonedRange("2026-07-01T09:30:00+06:30[Asia/Yangon]", "2026-07-04T09:30:00+06:30[Asia/Yangon]",
     "my-u-ca-buddhist", { hour: "numeric", minute: "numeric", timeZoneName: "long" })` — the D16
     carrier's `formatRangeToParts`;
   - `formatCalendar("2026-07-01T10:00:00", "gl-u-ca-hebrew", { reference: "2026-07-01T09:00:00" })`
     — `joinDateTimeConnector`'s `dateStyle: "full"` parts (also `-u-ca-buddhist`, `-u-ca-roc`).
2. **Wrong year (data).** Every engine with CLDR 48 data prints the week-year, in `format` and
   `formatRange` alike: gd `Dùbh 2025` for 2024-12-30, te-u-ca-buddhist `జులై 2026` for 2026-07-01
   (the Gregorian week-year all year), gl-u-ca-hebrew `1 de Tishri de 5786` for 5787. Fixed V8
   (Chromium 158) and WebKit 26.6 print the same wrong text; WebKit types the part `unknown`.
   Fixed text is the calendar year: gd `Dùbh 2024`, te `జులై 2569`, gl `5787`.

The fix: one isolated module decides per formatter, behaviourally and without ever calling a parts
method on a formatter that might hold `Y`, whether the year it prints can be wrong or crash; GMT
then prints the calendar year in the form ECMA-402 gives `numeric` and `2-digit`. Dormant on every
formatter that passes. No range parts call can reach V8: D16 repairs the range string, and D17's
parts merge stays only where its gate is on (SpiderMonkey). Retired by two canary groups: D23 (the V8 abort) and D24 (the CLDR data).

## Decisions (settled here)

- **Expected value** is the ECMA-402 one, never ICU's: the calendar year (Temporal `eraYear`
  when the pattern has an era, else `year`), `numeric` unpadded and ungrouped, `2-digit` the last
  two digits zero-padded, in the formatter's numbering system; the part type is `year`. ECMA-402
  outranks CLDR in [the precedence order](../../../../apps/dox/src/content/docs/guides/concepts/standards.mdx).
  So gl-u-ca-roc `dateStyle: "full"` prints `115`, not `0115`.
- **Only the year changes.** Every other CLDR choice stays, even a wrong one (de-CH prints
  `12.30.2025`, month and day swapped: GMT replaces the year only). GMT owns no CLDR data.
- **No engine sniffing in the library.** `process.versions.v8` is read only inside the canary.
- **Crash signal is exact and cheap.** V8's fix also keeps `year` in `resolvedOptions` for a `Y`
  pattern (commit message of `0426b0d1045d`), so on an unfixed V8 a component `year` request with
  `resolvedOptions().year === undefined` (calendar not `chinese`/`dangi`) is a `Y` pattern.
  Checked on Node 22.22.2, 24.21.0 and 26.13.0 (gd, my-u-ca-japanese, te-u-ca-buddhist).
- **No parts call can reach a `Y` range pattern, so none is made.** Range patterns are not visible
  through `resolvedOptions`, and some aborting range formatters never print a wrong year
  (kok and kok-Deva with coptic, ethiopic, roc: 0 wrong in a 120-year scan of 4,680 ranges
  each), so no text test can find them. D16 moves to string repair; D17 keeps parts because
  no aborting V8 ever turns its gate on ([range.md](./range.md)).

## Signatures and files

| File | Change |
| --- | --- |
| `packages/gmt/src/internal/weekYearGuard.ts` (new) | `guardDateTimeFormat(formatter, options): Intl.DateTimeFormat` — returns `formatter` itself when dormant, else a guarded formatter. Internal only |
| `packages/gmt/src/internal/weekYearSynth.ts` (new) | `synthesizeParts(formatter, options, ms): Intl.DateTimeFormatPart[]` for a formatter whose native parts may abort |
| `packages/gmt/src/internal/formatterCache.ts` | `construct` wraps every `DateTimeFormat` in `guardDateTimeFormat`; a verdict cache keyed by resolved locale, calendar, numbering system and the zone-free options |
| `packages/gmt/src/internal/repairRangeText.ts` (new) | `repairRangeText(text, carrierNames, wantedNames): string \| null` for D16 ([range.md](./range.md)); `repairRangeParts.ts` stays for D17 |
| `packages/gmt/src/zoned/format/formatZonedRange.ts` | D16 branch calls `formatRange` and `repairRangeText`; `formatRangeToParts` stays only in the D17 branch (SpiderMonkey) |
| `packages/gmt/src/internal/temporalCompat/islamicEra.ts` | Builds through `cachedFormatter` |
| `packages/gmt/src/internal/temporalCompat/repros.ts` | `CanaryDefectId = "D23" \| "D24"` and their repros |
| `scripts/upstream.mjs` | `nodejs/node` in `REPOS`; `knownGuards()` reads `CanaryDefectId` too |
| `scripts/lib/workarounds.mjs` | D23 (`engines: ["v8"]`) and D24 (every engine) |
| `scripts/canary/weekYear.mjs` (new) | Child-process crash check and in-process data sweep |

## Authority — what each rule rests on

| Rule | Source |
| --- | --- |
| `y` is the calendar year; `Y` is the year of week-of-year, which can differ near year ends | UTS #35 Part 4 (Dates) §8 Date Field Symbol Table, rows `y` and `Y` |
| The year field's value is the calendar's year of the date (era year in an era calendar) | ECMA-402 ToLocalTime, the `[[Year]]` field of the record it returns; Temporal `PlainDate.prototype.eraYear` / `year` (Temporal CalendarISOToDate, `[[EraYear]]` / `[[Year]]`) |
| `numeric` → no grouping, no padding; `2-digit` → last two digits, padded to two | ECMA-402 FormatDateTimePattern, the `year` steps (`nf` with `useGrouping: false`; `nf2` with `minimumIntegerDigits: 2`, then the last two characters) |
| Part type `year` for the year field | ECMA-402 FormatDateTimePattern: each part's `[[Type]]` is the field name |
| Digits in the formatter's numbering system | ECMA-402 Table "Numbering systems with simple digit mappings" (Intl.NumberFormat chapter) |
| Range parts come from the range pattern; each field is `startRange`, `endRange` or `shared` | ECMA-402 PartitionDateTimeRangePattern; UTS #35 Part 4 §2.6 Interval Formats (split at the first repeated field) |
| Expected values when CLDR is wrong | ECMA-402 outranks CLDR: [The Standards § When sources disagree](../../../../apps/dox/src/content/docs/guides/concepts/standards.mdx#when-sources-disagree) (ECMA-402 is 2, CLDR 4) |
| V8 aborts on `UDAT_YEAR_WOY_FIELD`; fixed in `0426b0d1045d` with `resolvedOptions` keeping `year` | V8 commit `0426b0d1045d` message (crbug 553923523); nodejs/node#67076 |
| Verdict boundaries, synthesis tie-breaks, string range repair | **GMT rule**, reasoning in each slice |

## Slices

| Slice | File | Covers |
| --- | --- | --- |
| 1 | [guard.md](./guard.md) | Crash signal, text verdict, proof sketch, verdict cache, `formatterCache` hook |
| 2 | [single-repair.md](./single-repair.md) | `format` text repair; `formatToParts` native-patch or synthesis |
| 3 | [range.md](./range.md) | D16/D17 on strings; `formatRange` year repair (3c, `internal/weekYearRange.ts`) |
| 4 | [call-sites.md](./call-sites.md) | Every internal parts call routed; the no-`formatRangeToParts` rule |
| 5 | [canary-and-docs.md](./canary-and-docs.md) | D23/D24 groups, weekly sweep, upstream row, READMEs, bug doc § AF, changeset, budget |
| 6 | [tests.md](./tests.md) | Test matrix and expected values |

Order: 3a first (it removes the `formatZonedRange` abort with no new detector), then 1 and 4
(which remove the `formatCalendar` abort), 2, 5, 6; 3c after its gate, which passed (owner question 5).

## Validation (Node 26.12.1, child processes, 662 locales)

| Check | Cases | Result |
| --- | --- | --- |
| Single-format aborts (`formatToParts`) | 317,760 (662 × 16 calendars × 30 option sets) | 105 abort |
| Crash signal (`resolvedOptions`) on component options | 233,024 | 81/81 aborts found, FP 0, FN 0, 0.077 ms with construction |
| Text verdict ([guard.md](./guard.md)) | 317,760 | flags exactly the 105: FN 0, FP 0, 0.18 ms each |
| Era-only Gregorian formatters (locale × era width) | 1,986 | 0 affected |
| Repaired parts vs WebKit 26.6 (`unknown` → `year`, year value per Decisions) | 2,520 points | 2,520/2,520 identical; Chromium 158: 312/312 where its trimmed data matches |
| Synthesis forced on unaffected formatters vs native parts | 7,014 points | 6,976 identical (99.46%) — never used there |
| D16 string repair vs today's parts merge | 379,200 ranges | 379,200 identical |
| Range aborts (`formatRangeToParts`) | single-format population × boundary ranges | 955 aborts on 217 formatters, 12 of them `{hour, minute}` (`my`, non-Gregorian) |
| Range year verdict prototype | 3,360-formatter sample incl. all 217 | FN 0 against aborts; FP 48 to 175 by variant: **not converged** |

## Open questions — owner

1. **Story id.** (a) `CORE-112` with issue file and tracker row, added in this PR (recommended);
   (b) record it under DOX-G9 only (breaks "CORE is gmt-only").
2. **CLDR ticket** for the `Y` patterns (gd, gl, ksh, my, sc, te, de-CH, ak, kok; de-CH's month/day
   swap separately). (a) Draft the text for approval, then file (recommended); (b) track only.
3. **Native parts where safe** (slice 2 path A). (a) Native parts with the year patched when the
   crash signal is off and options are component-based, synthesis otherwise (recommended: the
   engine's own split wherever it cannot abort); (b) synthesis for every flagged formatter.
4. **D17.** (a) Keep its parts merge, reachable only on SpiderMonkey (recommended: no aborting V8
   turns the gate on, checked on 7 Node builds); (b) string repair via AM/PM twins, validated in
   Firefox CI only.
5. **Range year (slice 3c).** Built with the rest of the phase, on the verdict that passed the
   gate in range.md (FN 0, FP 0): the verdict runs lazily on a formatter's first range call.
6. **Verdict cost**: ~0.18 ms once per year-printing formatter key, every engine (the data defect
   is everywhere). (a) Accept (recommended); (b) skip the text verdict and fix only the abort,
   leaving wrong years in place (a known defect, so not offered as equal).
7. **Bundle.** (a) Raise `entries.root.minified` by the measured growth in one reviewed edit
   (recommended); (b) none: a dynamic import would make sync functions async.
8. **D16 `null`** (zone name not attributable, 0 of 379,200): (a) `formatZonedRange` returns `""`
   (recommended: never the defect's own text); (b) return the carrier text unrepaired.
