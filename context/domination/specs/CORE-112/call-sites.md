# CORE-112 slice 4 — call sites and the source rule

Read with [index.md](./index.md). With slice 1's hook in `formatterCache.construct`, every
formatter built through `cachedFormatter("DateTimeFormat", …)` is guarded, cached or not. This
slice makes that the only way library code builds one, and fixes the range call.

## Every parts and range call in `packages/gmt/src` (tests excluded)

| Site | Call | Can hold `Y`? | Change |
| --- | --- | --- | --- |
| `plain/format/formatDateToParts.ts:94` | `formatToParts` | yes, caller options | none: guarded through the cache |
| `plain/format/formatDateTimeToParts.ts:100` | `formatToParts` | yes | none |
| `zoned/format/formatZonedToParts.ts:97` | `formatToParts` | yes | none |
| `internal/joinDateTimeConnector.ts:63`, `:77` | `formatToParts`, `dateStyle: "full"` (+ `timeStyle`) | **yes: aborts today** (`formatCalendar`, gl-u-ca-hebrew / buddhist / roc) | none: guarded; synthesis path B (dateStyle) |
| `internal/plainFormatOptions.ts:104` (`dateStyleWidths`) | `formatToParts`, `dateStyle`, gregory, latn | yes (dateStyle) | none: guarded |
| `internal/localeNames.ts:70` (`eraNamesFor`) | `formatToParts`, era only | year by defaults | none: guarded (0 of 1,986 flagged) |
| `internal/localeNames.ts:96` (`meridiemsFor`) | `formatToParts`, hour | no (step 0) | none |
| `internal/localeMonthNames.ts:63` | `formatToParts`, month + day | no (step 0) | none |
| `zoned/format/formatTimeZoneName.ts:108` | `formatToParts`, hour + zone | no (step 0) | none |
| `internal/temporalCompat/islamicEra.ts:28`, `:42` | own `new Intl.DateTimeFormat("en-u-ca-…", { era, year, month, day })` + `formatToParts` | not in `en` today | **build through `cachedFormatter`** so the guard covers it; keep the per-calendar `Map` only if `cachedFormatter`'s cap could evict it on a hot path (measure; else delete the `Map`) |
| `zoned/format/formatZonedRange.ts:34–40` | `formatToParts` ×4, `formatRangeToParts` | **yes: aborts today** (my-u-ca-buddhist) | D16 → [range.md](./range.md) 3a; D17 branch unchanged (3b) |
| `plain/format/formatDateRange.ts:66`, `formatDateTimeRange.ts:69`, `zoned/format/formatZonedRange.ts:150` | `formatRange` | wrong year, never aborts | `formatRangeChecked` (`internal/weekYearRange.ts`): `formatRange` text only, the year repair (3c) |
| `internal/temporalCompat/probeRepros.ts:748–794` | D16/D17 probes, `"en"`, no year | no | none; listed in the source rule's allow list |
| `internal/resolveLocale.ts:37` | `new Intl.DateTimeFormat()` for `resolvedOptions().locale` | no format call | none; allow list |
| `internal/plainFormatOptions.ts:331` | JSDoc "V8 before 15.5 traps" | — | reword: "V8 without commit `0426b0d1045d` aborts (defect D23)"; the version number is unverified and the canary owns it |

`format` calls on cached formatters need no change: a guarded formatter's `format` repairs the
year; a dormant one is the native formatter.

## Source rule (new test)

`packages/gmt/src/internal/temporalCompat/weekYearSource.test.ts`, reading every non-test `.ts`
file under `packages/gmt/src`:

1. `new Intl.DateTimeFormat(` appears only in `internal/formatterCache.ts`,
   `internal/weekYearGuard.ts` (twin and reference), `internal/resolveLocale.ts` and
   `internal/temporalCompat/probeRepros.ts`.
2. `formatRangeToParts(` appears only in `internal/temporalCompat/probeRepros.ts` and in the D17
   branch of `zoned/format/formatZonedRange.ts` (one occurrence there).
3. `weekYearGuard` is imported only by `internal/formatterCache.ts` and `weekYearSynth`
   (isolation: retiring D23 deletes two files and one line).

Each rule names the file and line it found in its failure message. Comments and JSDoc are skipped
(strip `//…` and `/* … */` before matching).

## Edge cases for tests

- `formatCalendar("2026-07-01T10:00:00", "gl-u-ca-hebrew", { reference: "2026-07-01T09:00:00" })`
  returns a string in a child process on Node 26.12.1 (today: exit 133).
- `formatDateToParts("2024-12-30", "gd", { year: "numeric", month: "short" })` returns
  `[{ type: "month", value: "Dùbh" }, { type: "literal", value: " " }, { type: "year", value: "2024" }]`.
- `formatYearMonth` with `{ dateStyle: "full" }` in gl (the `dateStyleWidths` path) returns a
  string, no abort.
- The islamicEra reads keep their values on every engine (existing D18 rows pass unchanged).
