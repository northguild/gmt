# CORE-8 — Core: Final standards review of the whole API

**Scope:** One standards and consistency pass over the entire public surface before 1.16.0 ships, run with the `gmt-reviewer` agent. Finds what a per-story review structurally cannot: defects that exist only in the relation between namespaces.

## Gap

Seven stories closed in quick succession, and 1.16.0 carries all of them at once — five new namespaces (`calendar/`, `instant/`, `interval/`, `precision/`, `span/`), the business calendar engine, the foreign epoch bridges, and eight behaviour fixes. Each was reviewed against its own spec. None was reviewed against the others.

That leaves a class of defect nothing in the pipeline is positioned to catch. **An inconsistency is a relation between namespaces, not a property of one.** `parseMillisecondFromUnix` ships implemented, documented and unit-tested, and is reachable from nowhere, because `unix/parse/index.ts` omits the export line — and nothing inside `unix/` is wrong. The file compiles, the tests pass, the JSDoc is complete. The defect exists only relative to `utc/parse` and `zoned/parse`, which both export their equivalents. A reviewer holding one namespace cannot see it, and neither `tester` nor `gmt-reviewer` on a story diff was ever asked to look.

The second gap is sharper, because the repo has already found it four times by hand and fixed it four times as an instance. **Documented behaviour is never executed.** Every public function carries JSDoc with `@example` — 574 of 574, and 2,396 of 2,398 example tags are in the mandated one-line `fn(args) // result` form. `apps/dox/scripts/build-reference.ts` parses all of them to build the published reference and to seed the playground's default inputs. Nothing runs them. So a wrong example is published as demonstrated behaviour and stays wrong until somebody reads that line closely:

- 1.15.0 — `intervalDifferenceZoned` and `intervalXorZoned` documented interior boundaries the functions do not compute, and claimed full containment returns one interval when it returns two.
- 1.16.0 pending — `quiet-bounds-align` corrects the documentation of the positional interval functions across four namespaces; `regex-jsdoc-examples` corrects a wrong `fractionalSecond` example; `roll-convention-provenance` corrects three wrong roll-convention examples.

Four discoveries, all by eye, none by a check. Core Rule 12 does not permit fixing the fourth instance and waiting for the fifth: the class goes with it.

## Scope

- **Write the checks, not just the findings.** `scripts/api-surface.mjs` (`check` / `show`), wired into `validate` after `stats.mjs`. It derives the public surface from the reference corpus and fails the build on two classes: a source file under a public namespace that no subpath reaches (re-export it, or move it to `internal/`), and a documented `@example` whose result is not what the built package returns. Examples run under `TZ=UTC`; the three skip reasons — clock-dependent, elided, prose — are listed by `show`, never silent.
- **Cross-family completeness, sentinel conformance and `throw` reachability stay with the review units** (D2, D3), not the gate: each needs the compiler walk rather than a pattern, and a pattern-based gate at the precision measured below would fail builds on noise.
- **Sixteen review units**, registered below, each run by `gmt-reviewer` (read-only) with findings routed to `tdd-dev`.
- **Fix what the sweep finds**, under the triage rule in Design notes: behaviour and documentation corrections as `patch`, missing public names as additive `minor`. A fix that changes documented, intended behaviour ships here too, as `minor` with a **Breaking changes** migration section: the owner ruled on 2026-09-17 that there is no 2.0.0 (internal users only), so phase 2 of this story also delivers the two parked breaking changes: half-open positional intervals and RFC 9557 calendar strings.
- Out of scope: new capability. An absent function that no shipped artifact depends on is a gap for the owner's list, not a defect for this story.

## Review units

**This is a review of the whole library, not of what the epic just built.** Of the 549 exported
functions, **499 (90.9%) predate `CORE-1` entirely** — `plain/` 223, `zoned/` 119, `utc/` 74,
`unix/` 71 and `duration/` 12 — and they carry 2,042 of the 2,394 documented examples (85.3%).
The five namespaces the epic added contribute 50 functions between them. Nothing here is scoped
to recently-changed files, and no unit may narrow itself to the 1.16.0 diff: the oldest functions
have had the longest to drift, have been reviewed against the fewest of the standards the
reviewer now applies, and were written before the sentinel table, the probe zones and the
disambiguation vocabulary existed in their current form.

The 549 exported functions partition exactly. The cross-family quad (`plain/` 223, `zoned/` 119, `utc/` 74, `unix/` 71 — 487 functions) is reviewed by dimension, because that is the only axis on which a cross-namespace relation is visible. The singleton tail (`calendar/` 15, `precision/` 18, `duration/` 12, `interval/` 9, `instant/` 4, `span/` 4 — 62, plus 25 regex patterns) is reviewed by namespace, because it has nothing to be inconsistent with and depth against its governing standard is the only yield.

| Unit | Charter |
| --- | --- |
| D1 | **Reachability and placement** — every implemented, tested, documented function is reachable from its public subpath; every non-exported shared helper lives in `internal/` |
| D2 | **Family completeness** — for each stem, which of plain/zoned/utc/unix carry it, and whether each absence is justified by type rather than forgotten |
| D3 | **Sentinel and return-type contract** — declared type, sentinel table, `@returns` prose and the invalid-input test row all agree; no `throw` escapes a public export |
| D4 | **Signature and vocabulary shape** — argument order, options-bag key names, defaults, and which unit vocabulary applies across each clone family |
| D5 | **Parse/format round-trip** — `parse(format(x))` returns `x` on the canonical form, and the JSDoc names what is lossy |
| D6 | **Annotation and grammar acceptance** — `[u-ca=x]`, `[!u-ca=x]`, `[foo=bar]`, `[!foo=bar]`, `[!Europe/Paris]`, and the guard and the `try` body agree on every one |
| D7 | **Boundaries and zone-invariance** — `start <= input < next start` on all eight probe zones; no output moves with ambient `TZ` |
| D8 | **Direction, clamping and stepping** — calendar-unit asymmetry, Jan 31 to Feb 28/29 both ways, anchor-based stepping never compounded |
| D9 | **Range limits and numeric edges** — the Temporal and IEEE 754 limits, one step beyond each, in a non-UTC zone; no `Number(bigint)` before the range test |
| D10 | **Locale, ICU and leap seconds** — the 17-locale matrix, the `-u-ca-`/`-u-nu-`/`-u-hc-` extensions, and `23:59:60` |
| D11 | **Documented contract versus code** — every JSDoc convention claim is true and pinned by a test; adjudicates the example executor's diffs |
| N1 | `precision/` + `span/` — the IEEE 754 edge, the `0n` versus `null` sentinel split, and each foreign epoch bridge against its issuing body's own text |
| N2 | `calendar/` — ISO 8601 week and ordinal dates, the NRF 4-5-4 rule, roll conventions against ISDA, and the reference-data contract |
| N3 | `interval/` + `instant/` — half-open membership against its sources, and local-time resolution against the disambiguation vocabulary |
| N4 | `duration/` — which units are accepted, what `relativeTo` resolves them against, and mixed signs |
| N5 | `regex/` — each pattern is the grammar of the clause it names, and no looser |

Units run in waves against a frozen tree, fixes landing between waves. D1 goes first and alone: it changes what the public surface *is*, so every other unit reviews a set whose membership D1 alters.

## Closed questions

These are settled. A unit that raises one is producing noise, and noise is what makes a review get skimmed. Reopening one needs a primary source not previously considered — a fresh reading of a source already cited in the decision is not a new source.

- **Boundary functions take no `disambiguation` or `offset`, deliberately.** Boundaries are always real instants, matching TC39 `startOfDay()`. The twenty-two ignored `@deprecated` option members were removed outright in phase 2 (1.16.0), not kept for compatibility. D7's whole charter is boundary behaviour; do not reintroduce them.
- **`roundZoned` and `roundUnix` pass TC39 `ZonedDateTime.prototype.round` through**, transitions included. Callers wanting a floor use `floorToZone`. D7 and D8 will both find them.
- **`getHoursInZonedDay` and `startOfZoned` diverge at `America/Goose_Bay` 2010-11-07.** Documented, pinned, and deliberate on both sides. Do not fix one to match the other.
- **Cross-family clones are intentional.** D2 reports asymmetries *within* a clone set. The existence of the set is not a finding.
- The rest of the checklist's "Intentional — do not flag" list, the seven calendar and zone decisions in coding-standards, the three scoped manual-parsing exceptions, and every `## Corrections` section in the closed Core stories.

## Design notes

- **The pre-passes are the instrument, not the warm-up.** `apps/dox/src/generated/reference/gmt-corpus.json` already indexes the whole public surface — 637 entries with signature, source path and parsed examples — and `build-reference.ts` builds it by resolving the `exports` map through the barrels with the TypeScript compiler API, after its author found that walking source files naively published twenty private helpers. Membership in that corpus *is* public reachability. Diffing it against the filesystem reproduces both known findings exactly: six hits, no false positives, no misses.
- **Do not write regex pre-passes for types, signatures or exports.** Measured on this tree: a naive regex for the return-type check produced 23 hits of which roughly 22 were artefacts of multi-line type annotations, and a naive family-stem matcher produced 12 partial families most of which were plural-suffix artefacts. A list at four per cent precision, handed to sixteen reviewers, is the fastest way to make this review worthless. Reuse the compiler walk. Grep is fine only for what grep can answer.
- **The triage boundary, stated once.** *Wrong under the standard is a `patch` at any blast radius. Different from what a reviewer would have chosen is breaking at any blast radius.* The deciding question is never how many callers change behaviour; it is whether a primary source, at a named rung of the precedence ladder, says the current output is wrong. `steady-zones-floor`, `round-date-half-even` and `exact-range-edges` all changed shipped output as patches. Half-open positional intervals and RFC 9557 calendar strings are breaking because the old behaviour was *intended*; both ship in 1.16.0 with migration notes.
- **Whether a name was ever importable is checkable, not a judgement.** `"./<namespace>/*"` resolves to `./dist/<namespace>/*/index.js`, the module barrel, so a subpath reaches only a directory that has a barrel — never an individual file. A function absent from its barrel was therefore never reachable by any path: adding it is purely additive, and moving an unexported helper into `internal/` changes nothing public. The eleven `"./<namespace>/*/*": null` entries play no part: Node's `PACKAGE_IMPORTS_EXPORTS_RESOLVE` only treats a key with a single `*` as a pattern, so a two-star key matches nothing but its own literal text. Check the map, and resolve the specifier to confirm; never assume.
- **A finding supported only by "the other three namespaces do it differently" is not a defect.** It is an inconsistency. Without that line D2 alone manufactures dozens of breaking-change stories, which is the opposite of what this story is for.
- **An absence is a defect only when it makes a shipped thing wrong or unreachable.** The orphaned `unix/parse` pair qualifies: the file, the tests and the JSDoc all ship, and only the export line is missing. An absence that is merely a missing capability is a gap for the owner's list. Without this distinction Rule 12's class-completion duty turns the review into "now build sixty new functions" and the story never closes.
- **The oracle cannot adjudicate GMT's own grammars.** The native-Temporal twin scan has nothing to say about the calendar-annotated grammar, the pattern parsers, RFC 2822 or HTTP-date. For those units the specification text is the answer, not a check on one — and the temptation to settle for GMT itself or a reference implementation written for the story must be named up front, because both are explicitly never oracles.
- **An unverifiable claim is not the same as an unverified one.** A claim counts as unverifiable only after the full escalation: documentation tooling, then the issuing body's own text, then search. Short of that it stays in the unit's open list and never enters the findings ledger. Across 549 functions the alternative is dozens of entries that record a transient fetch failure as a defect.

## What gmt provides (do not re-implement)

- `apps/dox/src/generated/reference/gmt-corpus.json` — the generated public-surface index every pre-pass queries. Read it; never hand-edit it.
- `apps/dox/scripts/build-reference.ts` — the TypeScript compiler walk that resolves the `exports` map through the barrels, and the parser that splits each `@example` into its call and its expected result. Both are reused, not forked.
- `scripts/stats.mjs` — the `check` / `sync` / `show` gate shape, and the precedent for wiring a derived-figure check into `validate`.
- `scripts/temporal-compat.mjs` — `compat` for the workaround probes and `compat:oracle` for the native-Temporal twin scan, the only external oracle available to this story.
- `packages/gmt/src/test/` — `battleTestTimeZones` and `MustTestDstTimeZones` for zone coverage, `MustTestLocales` and `icuVariants.ts` for the locale matrix, `mocks` for error paths, and `runtimeWeekInfo.ts` for reading the runtime's own `Intl` data without importing GMT.

## Verification

- `node scripts/api-surface.mjs check` passes, and fails when an export line is removed in a scratch edit — the gate bites rather than merely running
- The same check fails when a documented `@example` result is altered in a scratch edit; its skipped examples are counted in `check` and listed by `show`
- `parseMillisecondFromUnix` and `parseMinuteFromUnix` are importable from the `unix` subpath and from the package root
- The shared `startOrEndOf*` helpers and `resolveUnixIntervalPair` have moved to `internal/`, and no public subpath resolved to them before or after
- `pnpm compat` and `pnpm compat:oracle` both exit 0, with every mismatch tag-listed against its test262 file
- The suite stays green under `TZ=Pacific/Chatham`, `TZ=Pacific/Apia` and `TZ=Australia/Lord_Howe`
- `pnpm exec changeset status --since=origin/main` covers every changed package
- Every finding sits in exactly one triage bucket, and the breaking bucket is listed explicitly, each entry with its migration note, so the owner can see every breaking change 1.16.0 ships
- Zero known bugs: `node scripts/test-markers.mjs check` passes and no defect is carried
- `pnpm run validate` stays green

## Findings — wave 0 (reachability and executed examples)

Environment: Node 24.21.0, ICU 78.3, tzdata 2026c, `TZ=UTC`. Every finding is fixed in this story; none is carried.

| Class | What was wrong | Resolution | Bucket |
| --- | --- | --- | --- |
| Unreachable functions | `parseMillisecondFromUnix`, `parseMinuteFromUnix` implemented, documented and tested, but never re-exported by `unix/parse` | Exported | additive `minor` |
| Misplaced helpers | `startOrEndOfUnix`, `startOrEndOfUtc`, `startOrEndOfZoned`, `resolveUnixIntervalPair` beside public files; the `exports` map never let any path import them | Moved to `internal/` | none |
| Documented results | 72 `@example` results disagreed with the function: singular unit names where Temporal's duration units are plural, sentinels documented for the well-formed tag `"not-a-locale"`, millisecond digits documented as microseconds and nanoseconds, `unix/parse` values written in a local zone, stale CLDR wording, arithmetic errors, two examples naming an undefined variable | Corrected; `scripts/api-surface.mjs` now executes every example in `validate` | `patch` |
| `endOf*` precision | `endOfTime`, `endOfDateTime`, `endOfUtc`, `endOfZoned`, `endOfQuarterForZoned` printed a moment earlier than the end | Nanosecond default; `fractionalSecondDigits` restores the old string | `patch`, with compatibility path |
| `…ToParts` defaults | `formatDateTimeToParts`, `formatZonedToParts` dropped the time with no field options, against ECMA-402 `GetDateTimeFormat` as amended by Temporal | Date and time defaults; `{ year, month, day }` restores the old parts | `patch`, with compatibility path |
| Locale week-year | `getLocaleWeekYear`, `getWeeksInLocaleWeekYear` read `minimalDays` from the runtime, which ECMA-402 no longer exposes (tc39/proposal-intl-locale-info#86), so one input had different answers on Node 22 and Node 24; the tests shared the fallback | ISO default of 4 on every runtime; new `minimalDays` option (CLDR 48: world default 1) | `patch`, plus additive `minor` option |
| Clock-dependent example gate | `api-surface` classed a `get/` accessor as clock-dependent only with one argument or fewer, so `getZonedNowUnit("America/New_York", "hour") // "07"` passed for one hour a day; its `microsecond` and `nanosecond` rows claimed 0–999999 and 0–999999999, where Temporal's fields are 0–999 | An accessor whose source reads `Temporal.Now` is also clock-dependent, except for an invalid-input `""` or `null` example, which is still checked; the ranges now say 0–999 | none |

**Breaking bucket: empty.** Every behaviour correction keeps a documented way back to the previous output. Half-open positional intervals and RFC 9557 calendar strings were still parked at this point; phase 2 delivers them in 1.16.0.

`pnpm compat` exits 0 (0 of 10 workarounds removable). `pnpm compat:oracle` exits 0: 409,552 comparisons against Chromium 153 native Temporal, 0 mismatches.

## Findings — wave 1 (D1, reachability and placement)

Resolved as a consumer resolves: Node's ESM resolver and a TypeScript `nodenext` program over `dist`, plus a compiler walk of every type named in a public signature.

| Class | What was wrong | Resolution | Bucket |
| --- | --- | --- | --- |
| Documented imports that do not exist | `packages/gmt/README.md` imported twelve namespace objects from the root, which exports flat names only; dox `install`, guide and mistakes pages imported names never exported (`addDays`, `addMonths`, `addYears`, `getNowZoned`, `getUtcToday`, `getUnixTimeMs`, `convertUtcToUnixMs`, …) or from the wrong subpath (`convertUtcToUnix` from `/unix`), and linked reference routes that do not exist | Rewritten against the corpus, every documented result executed; `scripts/api-surface.mjs` now fails on an unresolvable documented import or reference link | `patch` (docs) |
| Types named by a signature, exported nowhere | `StartOfTimeUnit`, `EndOfTimeUnit`, `IsValidDateRangeProps` | Exported from `plain` and the root | additive `minor` |
| Duplicated helper outside `internal/` | the unix epoch-argument grammar copied into `formatUnix`, `formatCalendarUnix`, `formatRelativeUnix` | One copy, `internal/unixEpochInstant.ts`, behaviour unchanged | none |
| Design note | this story claimed the `./<namespace>/*/*` nulls block file imports; they are inert | Corrected above | none |

**For the owner (not defects, no change made):**

- Four nested subpaths are importable though undeclared — `@northguild/gmt/{plain,utc,unix,zoned}/interval/validate` — because `interval/validate/` has its own barrel. Closing them removes importable paths; declaring them commits to them.
- `plain/chop` re-exports `chopUtc` from `utc/chop` without the explanatory comment `calendar/business` carries for its re-exports; the docs list it only under `utc`.
- `Temporal`, `Intl` and `toTemporalInstant` are re-exported from the root, `/plain` and `/zoned`, not from the other eight namespace subpaths.
- `UnixUnit`, used by `utc` and `zoned` signatures, is importable from `/unix` and the root but not from `/types`, unlike the other 31 shared signature types.
- `"./regex/*"` maps to `dist/regex/*/index.js`, which cannot exist; it resolves nothing.
- One latent runtime import cycle through `internal/index.ts` → `businessCalendar` → `plain/validate` → `isValidCalendarDate` → `internal/index.ts` (17 modules). Every subpath and internal module loads cleanly in a fresh process today.
- Gaps: no `typesVersions` (TypeScript `moduleResolution: node10` cannot resolve subpaths) and no `sideEffects` field.
- Carried to wave 2 (D3, D4): `unix/` accepts epoch arguments under two grammars — the format functions take any finite number and only digit strings; `parseUnixEpochValue` takes only safe integers and coerces strings with `Number()`.

## Findings — waves 2 to 5 (D2–D11, N1–N5)

Every unit's full report, with sources, deciding rungs, oracles and reproduced failures, was merged and de-duplicated before fixing. Every behaviour row below was reproduced against `dist` before it was fixed, fixed test-first (a red run against the pre-fix code, then green), and every correction to valid-input output ships a documented compatibility path — an option or an equivalent call — as a JSDoc bullet with an executable `@example`. Classes, not instances.

| Class | Units | What was wrong | Resolution | Bucket |
| --- | --- | --- | --- | --- |
| Throws on invalid input | D3 | 62 functions threw a `TypeError` or `RangeError` on nullish or wrong-typed arguments (`add*`/`subtract*` nullish duration, `round*` missing options, `min*`/`max*`/`sort*` non-array, `formatRelative*`/`formatCalendar*` `null` options, `isValid*Range` nullish); the `cycle*` family read `null`, `""`, `[]`, `true` as a step of 0; `minUnix`/`maxUnix` overflowed the stack on 200,000 values | Sentinels; `src/test/noThrow.test.ts` feeds garbage to every export in every argument position | `patch` |
| Unbounded output | D3, D9 | 14 list-building functions and `bucketRange` could exhaust the heap or run for a minute; `splitIntervalByUnitTime` looped forever across midnight on valid input; non-ISO calendar month arithmetic aborted the process past a few million months (polyfill steps one month at a time) | `maxPieces` option (default 1,000,000, owner decision); span pre-counts; `internal/temporalCompat/largeMonthSpan.ts` jumps whole years from Temporal's own calendar reads, dormant below 1,200 months, with a `pnpm compat` canary | `patch` + additive `minor` |
| RFC and HTTP date grammars | D5, N5 | `parseRfc2822` rejected RFC 5322 §3.3 receiver syntax and the §4 obsolete syntax a receiver MUST accept; `parseHttp` rejected rfc850-date and asctime-date (RFC 9110 §5.6.7 MUST); neither checked the weekday; formatters emitted out-of-grammar years and sub-minute offsets; comment folding was quadratic | Grammar-exact parsers; mismatched weekday → `""`; out-of-grammar output → `""` with Temporal compatibility paths; linear comment scan checked against an ABNF oracle over 12 million strings | `patch` |
| Leap seconds, zone names, annotations | D6, N5, N3 | `23:59:60` in `t`/space/basic spellings was clamped to `:59` by every zoned function; `timeZoneLike` rejected 42 IANA names (`Japan`, `Zulu`, `EST5EDT`) and `formatUtc` rendered UTC for them; `relativeTo` calendar strings changed meaning with spelling; guards accepted calendar ids the bodies rejected; `isLeapYear`/`getWeekNumber` parsed without validating; `-000000` years and `+99:99` offsets matched regexes | Every spelling rejected; Temporal `TimeZoneIANAName` grammar; guards and bodies agree on GMT `CalendarSystem` ids; validate-then-parse | `patch` |
| DST arithmetic and zoned differences | D8, D7 | `addZoned`/`subtractZoned`/`intervalFromDurationZoned` re-resolved an exact-time result (adding 10 minutes could land 50 minutes back); `diffZoned`/`diffZonedAsDuration`/`intervalLengthZoned` measured calendar units in UTC; `intervalOverlappingDays{Zoned,Unix}` miscounted fall-backs that re-enter the previous date and deleted days | Temporal §6.5.5 AddZonedDateTime and §6.5.6 DifferenceZonedDateTime; distinct local dates touched; calendar units across two zones → sentinel | `patch` |
| Range edges | D7, D8, D9 | `bucketRange`, `splitIntervalByUnit*`, `mapDatesInRange`, `roundDate`/`roundDateTime`, and five week functions returned sentinels for representable answers at the Temporal limits; `intervalCount*` returned `null` at the minimum | Boundaries built only when needed; arithmetic in place of out-of-range anchors | `patch` |
| Exactness | D9, N4 | `intervalDivideEqually*` computed boundaries in floating point (unequal pieces, up to 66 µs over the range); `formatDuration` rounded sub-second parts to three digits and past 2^53 | Exact `bigint` division; exact decimal seconds | `patch` |
| Formatting against the Temporal Intl spec | D2, D4, D10 | Text formatters inherited the polyfill's `resolvedOptions` rebuild (ja-JP japanese long month → `R6/2`, chinese year dropped, style widths lost); `era` alone dropped the time; `timeZoneName` on plain values returned `""`; a style for the wrong type rendered; `…ToParts` leaked a zone name for plain values; `formatZonedToParts` honoured a `timeZone` option | GetDateTimeFormat / AdjustDateTimeStyleFormat over native `Intl`; text equals parts joined; oracle of 55,080 comparisons | `patch` |
| Signatures, options and validation | D2, D4, D3 | `round*` rejected plural units (Temporal §13.17); `startOfDate(…, "day")` returned `""`; an invalid `roundingMode` silently floored; `epochUnit` was unvalidated in 14 `unix/` functions; blank epoch strings read as 1970; `areUtcEqualBy`/`areDateTimesEqualBy` called different buckets equal under `fractionalSecondDigits`; `getLocaleZonedEndOfWeek` kept the second-precision default | Spec option handling; sentinels; nanosecond default with compatibility option | `patch` |
| Foreign epochs and citations | N1, N2 | `fromFileTime`/`toFileTime` decoded values ≥ 2^63 that Windows rejects; `businessDaysBetween` returned `-0`; `modifiedPreceding` was cited to ISDA 2006 §4.12(a), which does not define it; CORE-5's fiscal-year figures were swapped | Microsoft `FileTimeToSystemTime` range; FpML `MODPRECEDING`; corrected story text | `patch` |
| Documented contract | all units | Parity claims, option tables and ranges that did not match the code; wrong standard section numbers; impossible `@example` results in clock-skipped examples; docs pages with wrong results and links | Corrected; `scripts/api-surface.mjs` now also executes documented results on docs pages and checks site links, and clock skips apply only where the function reads `Temporal.Now` without a pinned `reference` | `patch` (docs) |

**Breaking bucket: still empty** after round five. Every output change for valid input is a correction under a primary source and keeps a documented way back. Phase 2 (owner direction, 2026-09-17: no 2.0.0) then delivers half-open positional intervals, RFC 9557 calendar strings and the plan's breaking fixes in 1.16.0, each as `minor` with a **Breaking changes** migration note.

**Owner decisions** — inconsistencies, intentional behaviour a reviewer questioned, and gaps — were collected separately and put to the owner at close. None blocks the release.

**Oracle:** `pnpm compat:oracle` against Chromium 153 native Temporal — 409,552 comparisons, 0 mismatches, before the fixes, after waves 2 and 4, and after wave 3.

## Phase 2 — no 2.0.0: breaking fixes in 1.16.0

Owner direction, 2026-09-17: there is no 2.0.0, and GMT's users are internal, so every fix, every inconsistency and both parked 2.0.0 changes (half-open positional intervals, RFC 9557 calendar strings) ship in 1.16.0. Behaviour follows the governing standard, removed options are removed outright (no deprecation shims), and each breaking change is a `minor` changeset with a **Breaking changes** migration section. Every change was test-first, and the three re-review units (R1 intervals, R2 strings, R3 options, unix and packaging) ran over everything phase 2 touched before the fixes below closed.

| Class | What changed | Authority | Changeset |
| --- | --- | --- | --- |
| Positional intervals | Half-open `[start, end)` in `plain/`, `utc/`, `zoned/` and `unix/`; the ±1-unit steps are gone; a zero-length interval counts 0 and `intervalOverlappingDays*` counts 0 for an empty intersection; a split with an invalid unit on an empty interval returns `[]` | SQL:2011 PERIOD, RFC 5545 §3.6.1, EWD831 | `half-open-positional-intervals` |
| Calendar strings | ISO digits plus RFC 9557 `[u-ca=<id>]`, BCP 47 / Temporal calendar ids as strings and arguments, `;era=` removed, critical flag accepted, no converter for old strings | RFC 9557 §3.3/§4.1, Temporal `TemporalDateToString` | `rfc9557-calendar-strings` |
| `unix/` unification | UTC default zone; one epoch grammar; `{ epochUnit }` options everywhere, including the converters and `getUnixNow`; `epochUnit`/`timeZone` on interval length, count and split; unknown zones in formatters → `""`; 3-digit nanosecond fields; no `"quarter"` in `startOfUnix`/`endOfUnix` | owner, POSIX, Temporal | `unix-unified` |
| Options objects | A non-object `options` (including `null`) returns the sentinel in 125 functions (GetOptionsObject), while the 12 `Intl.DateTimeFormat` formatters keep CoerceOptionsToObject; `undefined` is the same as omitted; singular and plural units everywhere; `setZoned`/`setUnix`/`cycleZoned` `offset` defaults to `"prefer"`; `disambiguation` applies to a date step into a gap; the 17 required-locale functions reject `[]`; an invalid `reference` or `weekStartsOn` returns the sentinel; `formatRelative*` auto units run to year | Temporal §13.x GetOptionsObject, `ZonedDateTime#with`, §6.5.5; ECMA-402 | `options-follow-temporal`, `zoned-arithmetic-across-dst` |
| Options that did nothing | Removed: boundary `disambiguation`/`offset` (22 members), `offset` on `addZoned`/`subtractZoned`/`intervalFromDurationZoned`/`convertPlainDateTimeToZoned`, `offset` and `disambiguation` on `setUtc`, `overflow` on `addTime`/`subtractTime`/`intervalFromDurationTime`/`cycleTime`, four `FormatCalendarUnixOptions` members, `fractionalSecondDigits` on `areUtcEqualBy`/`areDateTimesEqualBy` — each confirmed inert against native Temporal | owner: no shims | `options-follow-temporal`, `steady-zones-floor`, `unix-validation-and-rounding-options` |
| Difference records | Unlisted amounts fold into the next smaller listed unit, including weeks below months or years (checked against native Temporal over 5,500 random rounding cases, 0 mismatches); `units = []` → `null`; `diffUnix` keys are plural; Sunday-mode week numbering follows UTS #35 | Temporal, UTS #35 Part 4 | `diff-records-and-parsing` |
| String grammars | Elective annotations accepted and ignored, unknown critical ones rejected; only the extended ISO 8601 shape (a leading `T` on a time is rejected); offset zone ids valid; SQL literals need seconds and years 0001–9999; `isLeapSecond` detects every second-60 spelling Temporal parses while every validator still rejects it; `parseUnitFrom*` reads microseconds and nanoseconds | RFC 9557 §3.3, SQL-92 §5.3, Temporal | `string-grammars-follow-temporal`, `diff-records-and-parsing` |
| Packaging | Undeclared nested subpaths closed; dead `./regex/*` removed; `Temporal`/`Intl`/`toTemporalInstant` re-exported from every namespace subpath; `UnixUnit` from `/types`; `chopUtc` only from `utc`; `typesVersions` and `sideEffects: false`; `engines` `>=22.16.0` (CI runs Node 22, 24 and 26) | packaging | `package-exports-and-engines` |
| Lint plugins | Messages named `convertUtcDateTimeToUnix`, which does not exist, and the positional `getUnixNow("seconds")` | contract | `lint-messages-name-real-functions` |
| Docs site | Positional converter calls in two widgets; the reference corpus dropped `\| null` and truncated long signatures (the generator ran without `strictNullChecks`); importing the generator in a test regenerated the pages another test read; the zoned-input repairer passed a basic `+0900` offset through | contract | none (site) |

**Breaking bucket:** every row above except the docs site. Each entry carries its old → new migration in the named changeset.

**Oracle:** `pnpm compat:oracle` after phase 2 — 409,552 comparisons against Chromium 153 native Temporal, 0 mismatches. `pnpm compat` exits 0.

### Half-open intervals: decisions of record

The rules live in [coding-standards § 8](../../coding-standards.md#8-intervals-are-half-open-start-end). What is recorded here is why, and how it was checked.

- **Why it broke.** Before 1.16.0, 65 positional files (`intervalsOverlap*`, `intervalContains*`, `intervalEngulfs*`, `intervalIntersection*`, `intervalUnion*`, `mergeIntervals*`, `intervalDifference*`, `intervalXor*`, `intervalXorAll*`, `intervalAbuts*`, and `intervalOverlappingDays*`) read intervals as closed, with ±1-unit steps, while `intervalCount*` was already half-open and CORE-6's `interval/` was half-open. A caller composing the two got answers that disagreed at every boundary. The closed behaviour was intended and documented, so the change is breaking, not a correction.
- **Unix steps were epoch units.** The removed `unix/` step was one `epochUnit`, not a nanosecond.
- **Delegation is checked, not assumed.** `utc/interval/intervalAlgebraUtc.test.ts` compares every delegated `Utc` family with `interval/` for every pair over a 1 ns boundary pool. Every UTC string is also a valid `interval/` instant string, so no sentinel moved; re-serialising `interval/`'s echoed strings through `Temporal.Instant` keeps spelling tie-breaks from surfacing.
- **Re-serialised outputs** keep byte-identical strings for every row whose value did not change: the positional functions take bare values, not caller-owned `Interval` records (CORE-6 spec §1.2, D3), and have always returned their type's canonical spelling.
- **CORE-6's range-edge regression rows were kept** through the rewrite, restated for half-open where the expected value changed: the `PlainTime` midnight wrap in `intervalAbutsTime` and `intervalXorAllTime`, maximum-value overflow in `intervalAbuts*` and `intervalXorAll*`, the zone-transition lookup at the maximum instant, `endOf*("month")` at the minimum month, and Unix safe-integer validation ([range-edge-correctness-audit.md](../research/range-edge-correctness-audit.md)).
- **Old → new outputs** for every family are the migration table in `.changeset/half-open-positional-intervals.md`.

### RFC 9557 calendar strings: decisions of record

The rules live in [coding-standards § Calendar-annotated strings are RFC 9557](../../coding-standards.md#calendar-annotated-strings-are-rfc-9557-e1-e7); the decision to adopt the standard form is [calendar-standards-decisions.md](../research/calendar-standards-decisions.md) Q1. "Native" below is Chromium 153.0.8010.12's Temporal, run through the Playwright Chromium that `pnpm compat:oracle` uses.

- **Why it broke.** No standard defines a machine-readable date with calendar-native digits: Temporal's `TemporalDateToString` writes ISO fields then `FormatCalendarAnnotation`, RFC 9557 §3.3 makes `u-ca` a presentation preference, and CLDR / UTS 35 define only localized display patterns. The old strings were ambiguous with the standard (`5785-01-01[u-ca=hebrew]` is also ISO year 5785), `;era=` is outside the suffix value grammar `1*alphanum *("-" 1*alphanum)`, and `[u-ca=…][timeZone]` reversed RFC 9557 §4.1. The old order was once "not re-openable" because the RFC order let `Temporal.ZonedDateTime.from` read a Hebrew year as ISO; with ISO digits that hazard is gone.
- **Grammar.** `DateYear` is four digits or a sign and six, `-000000` rejected; native rejects `-000000-01-01` and `279517-10-11[u-ca=hebrew]`, accepts `+002024-10-03`, and rejects the old zoned order ("Invalid annotation key leading character") and an upper-case key (`[U-CA=hebrew]`). `ParseISODateTime` takes the first `u-ca` and throws only when a second one exists and either is critical, so a single `[!u-ca=…]` is accepted; native agrees (`2024-10-03[!u-ca=hebrew]` → `2024-10-03[u-ca=hebrew]`).
- **Where GMT follows the spec text over native.** Native rejects one-character annotation keys and values (`[x=y]`, `[a=c-d]`) and an elective key starting with `_` (`[_k=v]`); the spec grammar (`AKeyLeadingChar` is `LowercaseAlpha` or `_`; `AnnotationValueComponent`) allows them, and polyfill 0.5.1 accepts them. GMT follows the spec.
- **Where GMT is stricter than Temporal.** The part before the first `[` must be GMT's written shape, so basic format, a space or lower-case `t` separator and a UTC offset on a plain calendar date are rejected although native `Temporal.PlainDate.from` reads them; a leap second is rejected although Temporal clamps it.
- **Output.** `FormatCalendarAnnotation(id, auto)` (proposal-temporal `spec/calendar.html`) is empty only for `iso8601`. The zoned offset is written by `FormatDateTimeUTCOffsetRounded`, so a local-mean-time `-04:56:02` is written `-04:56`; native agrees. Property-tested for every calendar at 19 ISO dates against `Temporal.PlainDate.from(iso).withCalendar(id).toString()`, and for every calendar in every battle-test zone against `ZonedDateTime#withCalendar(id).toString()`; the test262 `intl402/Temporal/PlainDate/from/extreme-dates.js` rows round-trip at both range limits.
- **Calendar ids.** Verified against CLDR `common/bcp47/calendar.xml` (`gregory` alias `gregorian`, `roc`, `islamic-tbla`, `ethioaa` alias `ethiopic-amete-alem`, `islamicc` deprecated for `islamic-civil`) and the Intl Era and Month Code proposal's `table-calendar-types`, which has no `islamic` or `islamic-rgsa` row. The old `gregorian` wrote bare ISO, so its replacement is `iso8601`; `gregory` is a distinct Temporal calendar that writes an annotation. test262 `extreme-dates.js` confirms the constant year offsets behind computing `ethiopic` (−5500) and `coptic` (−5776) in `ethioaa`.
- **Mixed calendars.** TC39 `DifferenceTemporalPlainDate` / `DifferenceTemporalZonedDateTime` throw when `CalendarEquals` is false, for every `largestUnit`. Native throws "Mismatched calendars." for `until` and `since` in day, week, month and year (PlainDate) and nanosecond, hour, day and month (ZonedDateTime), including `iso8601` against `gregory` and `ethiopic` against `ethioaa`; two spellings of one canonical id do not throw. `compare` has no calendar check (native agrees). The `duration/` functions take one `relativeTo`, so nothing changed there.
- **No converter, owner-confirmed.** Nobody depends on the old strings (internal users only), and there is no final 1.x minor to carry one. The old shapes the new grammar rejects are `;era=`, an unsigned 5–6 digit year, a negative year without six digits and the calendar-before-zone order; every other old string reads, silently, as the ISO date its digits spell. The changeset carries the migration note.
- **Compat.** Fields→ISO construction left the parse path, so `internal/ethiopicFamilyCalendar.ts` and `internal/formatCalendarYear.ts` were deleted; the `calendarDateFromFields` fallback may become removable before the polyfill release, so check `pnpm compat` and the compat README's removal steps.
