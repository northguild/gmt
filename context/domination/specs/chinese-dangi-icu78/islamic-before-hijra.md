# Phase 3.2 — D26 on every host: an Islamic date before the Hijra is the empty value

Read with [index.md](index.md). Small slice: one condition changes, and the tests that branch on
the probe stop branching.

## Today

`repairYearPrinting` (`internal/yearPrinting.ts:168–171`) turns an `islamic*` date before the
Hijra into `""` (`[]` for parts) only while `isIslamicEraCompatNeeded()` is true:

| Call | Node 22/24/26, Chromium 153 (probe fails) | WebKit 26.6 (probe passes) |
| --- | --- | --- |
| `formatDate("0600-07-10", "en", { calendar: "islamic-civil", era: "short", year: "numeric" })` | `""` | `23 Before Hijra` |
| `formatDateToParts("0622-07-17", "en-u-ca-islamic", { era: "short", year: "numeric", month: "short", day: "numeric" })` | `[]` | parts with era `Before Hijra`, year `1` |
| `formatDateRange("0600-07-10", "2025-07-10", "en-u-ca-islamic-civil", …)` | `""` | a range text |

WebKit's text is the proposal's answer (Intl era/monthCode Table 2, era `bh`, era year
1 − year, §4.1.12). ICU4C has no `bh` era (ICU-23327), and the only way to print one on Node and
Chromium is for GMT to carry era names: GMT owns no calendar data. So `""` is the one answer every
host can give (owner's rule; Open question 5).

## Change

```ts
const islamic = calendar.startsWith("islamic") && showsEraOrYear(callerOptions);
```

`isIslamicEraCompatNeeded()` leaves this line. It stays in `capabilities.ts`, and the `D26` repro
stays in `repros.ts`: they now decide only when D26 can be retired (rule 2 exception, as D33 and
D35). Update its JSDoc: "Canary and retirement signal only; `repairYearPrinting` refuses a date
before the Hijra on every host (D26)." `yearPrinting.ts` is its only shipped caller (verified).
`weekYearRange.ts:1156` (`earlierEraProbes` skips Islamic dates before 1 AH) already skips on
every host with no probe, and stays.

Unchanged: the `beforeHijra` test inside the branch (Temporal's era `bh` or year ≤ 0),
`guardedDateTimeFormat` and its use in `temporalCompat/islamicEra.ts` (D18 reads the engine's own
era parts and is not a caller value). D32 is unchanged too: the moved date that falls before the
Hijra was already returned as `""`, and now it is `""` on WebKit as well, where D32 is active.

## JSDoc

`repairYearPrinting` and the module header: the Islamic branch no longer depends on the probe.
Every public format function whose JSDoc says "where the engine cannot name the era" or
similar for D26 drops that clause (`tdd-dev` greps `Hijra` and `D26` in `plain/format`,
`zoned/format`, `unix/format` and `utc/format`).

## Tests: every host expects the empty value

| File | Change |
| --- | --- |
| `internal/yearPrinting.test.ts:391` `expectBeforeHijraRange` | body becomes `expect(actual).toBe("")`; keep the helper name and every caller |
| `internal/yearPrinting.test.ts:401–419` `expectBeforeHijra` | body becomes `expect(actual).toEqual(typeof actual === "string" ? "" : [])`; the `eraYear` argument goes, and so do `BH_YEAR_OF_ISO_MINUS_1` and `BH_YEAR_OF_ISO_600` if nothing else reads them. Rewrite its JSDoc: the empty value on every host (D26) |
| `internal/yearPrinting.test.ts:947` | title becomes `"D26 option, before gives the empty value"` |
| `internal/islamicCalendarResolution.test.ts:55–64` | one assertion, `expect(text).toBe("")`; comment names D26 on every host |
| `internal/islamicEpochEra.test.ts:70–84` `expectLastDay` | `expect(parts).toEqual([])`; drop the `locale` and `day` parameters if no caller needs them; JSDoc rewritten |
| `internal/yearPrintingDormant.test.ts:39–40` and `:60` | the two D26 rows leave both "dormant" tables. Add one test: with `probes.needed = false`, `formatDate("0600-07-10", "en-u-ca-islamic-civil", era)` is `""` and `formatDate("2025-07-10", …)` is the engine's own text (oracle: `new Intl.DateTimeFormat(locale, era).format(…)`) |
| `internal/weekYearRange.test.ts:279` | comment: "GMT prints no date before the Hijra on any host (D26)" |

Every row that called `isIslamicEraCompatNeeded()` to choose its expected value stops importing
it. After the edit, `grep -rn "isIslamicEraCompatNeeded" packages/gmt/src --include='*.test.ts'`
returns only `capabilities.test.ts` and `yearPrintingProbes.test.ts`.

Check the native-suite tags: any tag matching a D26 test title that changed is renamed or deleted
with it (`pnpm test:markers` and the tag tests).

## Compat rows (`temporalCompat/README.md`)

- Workarounds row **D26** (line 69): "gated by `isIslamicEraCompatNeeded()`" becomes "on every
  host, no probe (rule 2 exception); `isIslamicEraCompatNeeded()` is the retirement signal". The
  "when active" column: "Every host. A date (or a range endpoint) that Temporal places before the
  Hijra … gives the function's empty value." Add one sentence to the defect column: "WebKit names
  the era `Before Hijra`, which is right, but no other engine can match it without GMT owning era
  names."
- Rule 2 exception (gate.md wording): already names D26.
- Trigger row D26 (line 215): unchanged in substance. Add: "Every engine, not one: a WebKit pass
  alone keeps D26."
- Removal step 26 (line 369): first clause becomes "delete the Hijra branch of
  `repairYearPrinting` (`beforeHijra` and the `islamic` flag) and the `islamic*` skip in
  `earlierEraProbes`"; add "Turn the empty-value rows of `yearPrinting.test.ts`,
  `islamicCalendarResolution.test.ts` and `islamicEpochEra.test.ts` into the era text the fixed
  engines print (`bh`, era year 1 − year)."
- `scripts/lib/workarounds.mjs` D26 entry: trigger says every engine; no `engines` key (it has
  none today).
- `WHAT_BREAKS.D26`: [filings-and-text.md](filings-and-text.md).

## Authority

| Rule | Source |
| --- | --- |
| Islamic calendars have eras `bh` and `ah`; `bh` era year is 1 − year | Intl era/monthCode Table 2, §4.1.12; test262 `intl402/DateTimeFormat/prototype/formatToParts/era.js` |
| ICU4C prints a negative year in the one era | ICU-23327; measured on Node 26.12.1 (`-22 AH` for ISO 0600-07-10) |
| `""` on every host | **GMT rule** (owner's rule, index.md): no host-independent text exists without GMT owning era names |
