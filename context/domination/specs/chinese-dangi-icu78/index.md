---
story: chinese-dangi-icu78
issue: none
status: draft
dox: none
---

# chinese-dangi-icu78 — one answer on every host

Branch `fix/chinese-dangi-icu78`. No issue number: the folder is named after the branch slug. It
ships as one patch PR from this branch, never on #552. Four phases, built in order; each phase's
slices stand alone.

**The rule behind every phase (owner).** The same call returns the same value on Node 22, 24 and
26, Chromium, Firefox and Safari, with or without native Temporal, on any ICU. A host-to-host
difference is a defect. Where no host-independent correct answer exists without GMT owning data,
every host returns the same sentinel.

## Scope

| Phase | What changes | Compat id |
| --- | --- | --- |
| 1 | Chinese and Dangi: every format that prints a year, month, day or era returns the sentinel on every host. Field paths already do (CalendarSystem has excluded both since v1.16.0). Retirement signals for a js-temporal release and for the `temporal-polyfill` swap. | **D33** (new, unconditional) |
| 2 | WebKit prints the Coptic era as `Anno Martyrum` for the first hours of 1 Tout AM 1, and ranges across that day print an extra `AM`. GMT repairs it to the text every other host prints. | **D34** (new, WebKit only) |
| 3 | Three host differences made identical: nine zone names hosts disagree on (`CST6CDT`, `EST5EDT`, `MST7MDT`, `PST8PDT`, `CET`, `EET`, `MET`, `WET`, `Factory`) are refused everywhere; an Islamic date before the Hijra is `""` everywhere; two zone names are one zone only when the names match. | **D35** (new, unconditional); D26 unconditional; D19 deleted |
| 3b | Locale week data: the first day for regions CN, JO and DZ and the weekend for DZ and BD are refused on every host unless the tag gives `-u-fw-`; deprecated region codes read their successor's data. | **D36** (new, unconditional) |
| 4 | Upstream-filing data, the D13 trigger wording, `WHAT_BREAKS`, the Dox calendar guide, the changeset, the snapshot. | — |

Out of scope: CLDR wording that differs by host (`Jan 2, 2024, 10:00 PM` against `Jan 2, 2024 at
10:00 PM`) and tzdata-version differences; see Open questions 7. The deck branch, PR #552 and the
`gmtUnguarded` rows (deck branch only) are not touched. `HANDOFF.md` is deleted before staging.

## Signatures

```ts
// Phase 1 — internal/lunisolarRefusal.ts (new)
export const LUNISOLAR_CALENDARS: readonly ["chinese", "dangi"];
/** Throws RangeError when the formatter's calendar is chinese or dangi and it prints a date field. */
export function refuseLunisolarDate(formatter: Intl.DateTimeFormat): Intl.DateTimeFormat;
// internal/temporalCompat/repros.ts
export type CanaryDefectId = /* D23 … D32 */ | "D33" | "D34" | "D35";
// internal/temporalCompat/probeRepros.ts — now exported, unchanged body
export function readFields(iso: string, calendar: string): string; // "2027|M01|1"

// Phase 2 — internal/temporalCompat/capabilities.ts
export function isCopticEpochEraCompatNeeded(): boolean; // D34
// internal/copticEra.ts — same signature, wider activation; plus the field-reader twin
export function copticEpochTwin(ms: number, timeZone: string): { ms: number; year: number } | null;

// Phase 3 — internal/refusedZoneNames.ts (new)
export function isRefusedZoneName(id: string): boolean; // ASCII-case-insensitive, nine names
// internal/zoneNamesEqual.ts (new; replaces temporalCompat/timeZoneEquals.ts)
export function zoneNamesEqual(one: Temporal.ZonedDateTime, two: Temporal.ZonedDateTime): boolean;
```

Every public function keeps its signature and sentinel. No new export from the package.

## Files

| Phase | Files |
| --- | --- |
| 1 | `internal/lunisolarRefusal.ts` (new), `internal/formatterCache.ts`, `temporalCompat/repros.ts`, `temporalCompat/probeRepros.ts`, `temporalCompat/README.md`, `scripts/lib/workarounds.mjs`, `scripts/polyfill-swap.mjs`, `scripts/lib/canary-verdict.mjs`, `scripts/lib/canary-issues.mjs`, `scripts/lib/calendar-sweep.mjs`, `src/test/lunisolarRefused.test.ts` (new), moved rows in `yearPrinting.test.ts`, `rangeFields.test.ts`, `formatDate.test.ts`, `weekYearSingle.test.ts`, script tests in `apps/dox/scripts/canary/`, JSDoc in the three `…ToParts` files, `calendarSystemIds.ts`, `types/calendar-system.ts` |
| 2 | `internal/copticEra.ts`, `internal/rangeFieldValues.ts` (and whatever the bisect names), `temporalCompat/capabilities.ts`, `repros.ts`, README, `workarounds.mjs`, tests beside each |
| 3 | `internal/refusedZoneNames.ts` (new), `internal/inputChecks.ts`, `internal/zoneFrame.ts`, `internal/zonedWallClock.ts`, `internal/formatterCache.ts`, `zoned/get/getTimeZones.ts`, `repros.ts`, `src/test/timeZoneMatrix.ts`, `src/test/zoneArgument.test.ts`, `src/test/annotationPolicy.test.ts`, `scripts/lib/native-suite-tags.mjs`, `internal/yearPrinting.ts` and the D26 test files, `internal/zoneNamesEqual.ts` (new), `temporalCompat/timeZoneEquals.ts` (deleted), `temporalCompat/index.ts`, `capabilities.ts`, `probeRepros.ts`, `zonedWallClockDifference.ts`, `areZonedEqual.ts`, `areZonedEqualBy.ts`, `formatZonedRange.ts`, `mapZonedDatesInRange.ts`, `isValidTimeZone.ts`, `src/test/linkZones.ts` (deleted), `context/coding-standards/calendar-and-zones.md`, README, `workarounds.mjs` |
| 4 | `apps/dox/src/data/upstream-filings.json` (+ the guard schema files if Open question 8 says so), `upstream.mdx`, `polyfill-bugs/ac-ae.md`, `apps/dox/src/data/temporal-compat.ts`, `temporal-compat.json` (regenerated), `calendar-systems.mdx`, `.changeset/chinese-dangi-one-answer.md`, `context/domination/polyfill-bugs/status.md`, README D13 row, `workarounds.mjs` D13 entry |

## Authority

Precedence: Temporal / ECMA-262 > ECMA-402 and the Intl proposals > IANA tzdb > CLDR > test262 >
engines. Source documents: [Intl era/monthCode](https://tc39.es/proposal-intl-era-monthcode/),
[ECMA-402](https://tc39.es/ecma402/), [tzdb](https://github.com/eggert/tz).

| Rule | Source |
| --- | --- |
| Chinese dates follow Purple Mountain Observatory data 1900–2100; Dangi follows KASI 1900–2050 | Intl era/monthCode §1.1 Table 1 (calendar types `chinese`, `dangi`) |
| Chinese and Dangi have no era; leap months are `M01L`–`M12L` | Intl era/monthCode Table 1, Table 2 (no era row), Table 3 |
| Known answers (2027 New Year 6 Feb Chinese, 7 Feb Dangi; 2030 3 Feb; leap months) | HKO yearly tables `T<year>e.txt` (PMO data, GB/T 33661-2017); KASI `solc` service; cross-checked with native Temporal on Node 26.13.1 (ICU4X) |
| Hosts print different Chinese dates, so no host-independent answer exists without data | Measured: Node 22/24/26 and Chromium (ICU4C 78.3) against WebKit 26.6 and native Temporal — see [probes.md](probes.md) |
| Chinese and Dangi date formats return the sentinel on every host, unconditionally | **GMT rule.** Owner's rule above; GMT owns no calendar data, so the only identical answer is the sentinel. Departs from compat README rules 2 and 3 |
| Time-only and weekday-only formats on a chinese or dangi locale stay allowed | **GMT rule.** Every Table 1 calendar shares the seven-day week and the epoch-derived time of day (ECMA-402 ToLocalTime fields `[[Hour]]`…`[[Weekday]]`); the answer is host-independent, so refusing it would turn a correct value into a sentinel |
| Coptic has one era, `am`, and era year = year for every year | Intl era/monthCode Table 2 (`coptic`: `am`, −∞ to +∞) and §4.1.12; test262 `intl402/Temporal/PlainDate/from/non-positive-single-era-year.js` |
| An era belongs to the calendar date, so every instant of one local day prints one era | Intl era/monthCode §4.1.12 (CalendarDateEra reads the calendar date, which has no time); ECMA-402 ToLocalTime |
| Islamic calendars have two eras, `bh` and `ah` | Intl era/monthCode Table 2, §4.1.12; test262 `intl402/DateTimeFormat/prototype/formatToParts/era.js` |
| An Islamic date before the Hijra with a year or era returns `""` on every host | **GMT rule.** ICU prints no `bh` era (ICU-23327) and GMT owns no era names, so the only identical answer is the sentinel. WebKit's text is right but cannot be matched elsewhere |
| A Zone in tzdb is a primary identifier; a Link is non-primary and resolves to its Zone | ECMA-402 §6.5 (Use of the IANA Time Zone Database) |
| `EST5EDT`, `CST6CDT`, `MST7MDT`, `PST8PDT` are Zones in `backward`, "ahistorical", "present only for backward compatibility"; 2024b–2026c had them as Links; 2026d changed their pre-1967 data. `CET`, `EET`, `MET`, `WET` have been Links since 2024b | tzdb `backward` (Eggert 2026-07-24 comment; `Zone PST8PDT -8:00 USback P%sT`), tzdb NEWS 2024b and 2026d |
| `Factory` is a Zone whose meaning a distributor may change | tzdb `factory` |
| Every Zone and Link name is an available identifier, matched ignoring ASCII case | ECMA-402 §6.5.1 AvailableNamedTimeZoneIdentifiers, GetAvailableNamedTimeZoneIdentifier |
| Those nine names are refused on every host, in any ASCII case | **GMT rule.** Hosts accept or refuse them by engine and OS version (measured: [zone-ids.md](zone-ids.md)), and their data differs by tzdata version; mapping them is GMT owning zone data. Departs from §6.5.1 |
| `UTC` is primary; `Etc/UTC`, `Etc/GMT` and `GMT` resolve to it | ECMA-402 §6.5, first and second exceptions |
| Two zone names are one zone when they match ASCII-case-insensitively, or both are in the §6.5 UTC set | **GMT rule.** Temporal TimeZoneEquals compares primary identifiers, but no API exposes a Link's primary on every host (Time Zone Canonicalization proposal, Stage 3; WebKit already returns names as written) and GMT owns no link data |
| Upstream filings carry exactly one of `gmtGuard` and `gmtNote` | `apps/dox/src/data/upstream-filings.ts:53`, `scripts/upstream.mjs` `checkGuard` |

## Slices

| Phase | Slice | Holds |
| --- | --- | --- |
| 1 | [gate.md](gate.md) | The formatter refusal, the path audit, README D33 row, rules 2 and 3 wording, trigger and step 33, JSDoc |
| 1 | [probes.md](probes.md) | The D33 repros: inputs, expected values, sources |
| 1 | [canary.md](canary.md) | `workarounds.mjs`, `pnpm compat`, the swap check, verdict and canary issue text |
| 1 | [tests.md](tests.md) | Sentinel rows, moved D28/D29 rows, `lunisolarRefused.test.ts` |
| 2 | [coptic-epoch-era.md](coptic-epoch-era.md) | D34: probe, repro, repair, range bisect, compat rows, where the WebKit report draft goes |
| 3 | [zone-ids.md](zone-ids.md) | D35: the nine refused zone names, the choke points, matrix tests, repros, compat rows |
| 3 | [islamic-before-hijra.md](islamic-before-hijra.md) | D26 on every host: one condition, the tests that stop branching |
| 3 | [zone-equality.md](zone-equality.md) | `zoneNamesEqual`, the `until` rebind, D19 deleted |
| 3b | [week-data.md](week-data.md) | D36: the measured sweep, the refused regions, the `-u-fw-` override, canonical region, compat rows, tests |
| 4 | [filings-and-text.md](filings-and-text.md) | Filing data, the `gmtGuard` list, D13 wording, `WHAT_BREAKS`, Dox pages, bug docs, changeset, snapshot |

Gates once at the end: `pnpm test:gmt` on Node 22, 24 and 26, `pnpm test:gmt:browser` (WebKit
and Chromium), `pnpm test:markers`, lint and typecheck, then one build and
`node scripts/temporal-compat.mjs check` for the snapshot. Warn the owner before the build: his
`pnpm dox:dev` reads `packages/gmt/dist`.

## Owner's decisions

1. The swap gate exempts chinese and dangi while D33 holds, so a swap can land with D33 on.
2. Time-only and weekday-only formats stay allowed on a chinese or dangi locale.
3. Retiring D33 is a minor feature (chinese and dangi join CalendarSystem).
4. Refuse all nine names on every host, including `CET`, `EET`, `MET` and `WET` (only Linux WebKit rejects those four; refusing them changes Node, Chromium and macOS Safari).
5. An Islamic date before the Hijra is `""` on WebKit too.
6. Link pairs (`Asia/Calcutta`, `Asia/Kolkata`) are two zones on every host.
7. The rule covers values, validity and sentinels, not CLDR wording or a host's tzdata version.
8. tc39 #3327 names D1 and D6, so `gmtGuard` becomes a list (see [filings-and-text.md](filings-and-text.md)).
9. No Coptic report: WebKit/WebKit#81144 (bug 331724) already fixes the epoch-day case and tests it; see [coptic-epoch-era.md](coptic-epoch-era.md).
10. The owner posts a comment on WebKit 330688 naming the cause, `isValidTimeZoneNameFromICUTimeZone` in `Source/JavaScriptCore/runtime/IntlObject.cpp`, and the test262 test `intl402/Temporal/ZonedDateTime/iana-legacy-names.js`. The text is recorded in [filings-and-text.md](filings-and-text.md) § 6.
11. The standing policy is compat README rule 7: values identical on every host, text is the host's; repair a value when a standard gives one reachable answer, else refuse the disputed inputs everywhere; keep a standard caller override; never route by host; file only on a spec break with no public report.
12. Week data is D36 under rule 7 (see [week-data.md](week-data.md)). The macOS values for BD, CN, DZ and JO are Apple ICU data; ECMA-402 WeekInfoOfLocale is implementation-defined, so nothing is filed with WebKit or Apple. The owner posts the approved comment on WebKit bug 221878 (region aliases not replaced outside Apple-internal builds); its row in `upstream-filings.json` is added as a `contributor` row with `gmtGuard: "D36"` once the comment URL exists. The owner files the approved CLDR ticket for Bangladesh's Friday–Saturday weekend (sources: the national portal, Bangladesh Bank SDAD circular 05 of 2026, the 2027 public-holiday list); no earlier ticket exists (CLDR-10546 changed only firstDay). GMT's fix waits on none of these.
13. Host wording differences in test rows (macOS 27 WebKit, Chromium) are fixed in this PR: values exact, wording from the host's `Intl`.
