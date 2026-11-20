# Phase 1 — D33 gate: refuse Chinese and Dangi date formats on every host

Read with [index.md](index.md). Probes: [probes.md](probes.md). Tests: [tests.md](tests.md).

## The defect, as it stands

`@js-temporal/polyfill` 0.5.1 reads Chinese and Dangi fields from `Intl.DateTimeFormat`. ICU 78
prints `Mo12` and `Mo6bis`, and the polyfill throws `RangeError: Unexpected leap month suffix`.
GMT's field paths never reach that throw: `chinese` and `dangi` have been outside `CalendarSystem`
since v1.16.0, so `canonicalCalendarSystem` returns `null` and every field function returns its
sentinel by design (measured on Node 22.23.5, 24.22.3, 26.13.1).

The live defect is **formatting**. A format with `-u-ca-chinese`, `-u-ca-dangi` or
`calendar: "chinese" | "dangi"` prints the host's own Chinese date, and hosts disagree:

| Call | Node 22/24/26, Chromium 153 (ICU4C 78.3) | WebKit 26.6 | Right (HKO, native Temporal) |
| --- | --- | --- | --- |
| `formatDate("2027-02-06","en",{calendar:"chinese"})` | `12/30/2026` | `1/1/2027` | M01 1 of 2027 |
| same, `2030-02-02` | `1/1/2030` | `12/30/2029` | M12 30 of 2029 |
| `formatDateTimeToParts("2027-02-06T10:00","zh-u-ca-chinese")` | relatedYear 2026, 腊月 30 | relatedYear 2027, 正月 1 | 2027 M01 1 |

An older ICU (before 78) prints `12`, not `Mo12`; there the polyfill parses and returns ICU4C's
date with no throw. Not observed on a host in hand; the weekly WebKit legs cover it.

## Design

New file `packages/gmt/src/internal/lunisolarRefusal.ts`:

```ts
export const LUNISOLAR_CALENDARS = ["chinese", "dangi"] as const;
/**
 * Refuse a formatter that would print a Chinese or Dangi date (compat D33).
 * Throws RangeError when `resolvedOptions().calendar` is chinese or dangi and the resolved
 * options carry `dateStyle`, `era`, `year`, `month` or `day`. Returns the formatter otherwise.
 */
export function refuseLunisolarDate(formatter: Intl.DateTimeFormat): Intl.DateTimeFormat;
```

- Read `resolvedOptions()` once. Resolved options, not caller options: a locale subtag and a
  `calendar` option both land in `calendar`, and `dateStyle` expands nothing into `year` etc. in
  `resolvedOptions`, so test `dateStyle` separately.
- The error message is free text; tests never assert it (they assert the sentinel).
- No `is…CompatNeeded()` gate and no cache entry: the refusal is unconditional, and a refused
  construction is never cached by `cachedFormatter` (it throws).

Wire it in `construct()` (`internal/formatterCache.ts`), case `"DateTimeFormat"`, on the result of
`guardedDateTimeFormat` and before the repairs:

```ts
const guarded = refuseLunisolarDate(guardedDateTimeFormat(built, builtOptions));
return repairIslamicEpochEra(repairCopticEra(repairYearPrinting(guarded, builtOptions,
  (twin) => cachedFormatter("DateTimeFormat", built, twin)), builtOptions), builtOptions);
```

Both `cachedFormatter` and `checkFormatterArguments` call `construct`, so every public format
function reaches the refusal and turns the throw into its own sentinel (`""`, or `[]` for the
`…ToParts` functions).

**Allowed:** time-only (`formatTime("10:00","zh-u-ca-chinese")` → `"10:00:00"`) and weekday-only
(`{weekday:"long", calendar:"chinese"}` → `"Saturday"`). See the authority row in index.md.

## Path audit (every route from an ISO value to Chinese or Dangi text or fields)

| Path | Today | After |
| --- | --- | --- |
| `canonicalCalendarSystem` callers: `convertDateToCalendar`, `convertZonedToCalendar`, `calendarValueOfDate`, `calendarValueOfZoned`, `calendarDateString` (`calendarDateOf`: add/subtract/diff/interval/week functions), `calendarZonedString`, `holidayRules` | sentinel (CalendarSystem exclusion) | unchanged |
| `isValidCalendarDate`, `isValidHolidayRule`, `holidayDates`, `isLeapYear`, `isValidMonthDay`, `parseMonthDayFromDate`, `parseYearMonthFromDate` | sentinel | unchanged |
| plain/format: `formatCalendar`, `formatDate`, `formatDateRange`, `formatDateTime`, `formatDateTimeRange`, `formatDateTimeToParts`, `formatDateToParts`, `formatRelativeDate`, `formatRelativeDateTime`, `formatSqlDateTime` | ICU4C date | sentinel (D33) |
| plain/format: `formatTime`, `formatRelativeTime` | time text | unchanged (time-only) |
| plain/format: `formatMonthDay`, `formatYearMonth` | Gregorian or `""` (a non-gregory calendar is already refused) | unchanged |
| zoned/format: `formatCalendarZoned`, `formatZonedDateTime`, `formatZonedRange`, `formatZonedToParts` | ICU4C date | sentinel (D33) |
| zoned/format: `formatTimeZoneName` | zone name | unchanged |
| unix/utc: `formatUnix`, `formatUtc`, `formatCalendarUnix`, `formatCalendarUtc` (via `instantFormatOptions`, `formatCalendarDays`) | ICU4C date | sentinel (D33) |
| `getLocaleMonthNames`, `getLocaleEraNames`, `patternToken` (via `localeNames`, `localeMonthNames`, which force `calendar: "gregory"`) | Gregorian names | unchanged |
| Internal `new Intl.DateTimeFormat` sites: `weekYearRange`, `weekYearText`, `weekYearSynth`, `weekYearGuard`, `rangeFieldValues`, `rangeFallback`, `rangeFields`, `rangeDetector`, `copticEra`, `islamicEpochEra`, `japaneseNumerals`, `yearPrinting`, `ownFormatter` in `formatZonedRange` | run after `construct` built the caller's formatter | unreachable for chinese/dangi (construct throws first); `"und"` formatters carry no calendar |
| `resolveLocale` (`new Intl.DateTimeFormat` to read the resolved locale), `temporalCompat/islamicEra.ts` (`guardedDateTimeFormat` on an islamic id) | no date text for a caller | unchanged |

`tdd-dev` re-runs `grep -rn "new Intl.DateTimeFormat\|cachedFormatter(\"DateTimeFormat\"" packages/gmt/src`
and confirms no site formats a caller value without passing `construct` first. Any new site found
gets a row here and a sentinel test.

**Kept, dormant while D33 holds** (needed again when D33 retires; their internal tests keep
running and their repros keep reporting): D28 (`widenRelatedYear`), the chinese/dangi parts of
D29, `RELATED` in `weekYearRange.ts:33`, `cyclic` in `rangeDetector.ts:670`, the chinese branch
of `weekYearGuard.ts:328`.

## README (`packages/gmt/src/internal/temporalCompat/README.md`)

**Rule 2** — append: "D33 is the exception. Hosts print different Chinese and Dangi dates and GMT
owns no data to compute the proposal's, so D33 refuses on every host with no probe. Its repros are
canary-only and decide only when it can be retired. D26 (an Islamic date before the Hijra) is
unconditional for the same reason."

**Rule 3** — replace the last sentence: "Two exceptions. D29: … (unchanged). D33: removing it turns
sentinels into dates, so its retirement is a feature (a minor changeset), not a cleanup."

**Workarounds row D33** (after D32):

> | **D33** | Chinese and Dangi dates differ by host. The Intl era/monthCode proposal (§1.1 Table 1) bases `chinese` on Purple Mountain Observatory data and `dangi` on KASI data. ICU4C 78.3 (V8, Node, Chromium) puts the Chinese New Year 2027 on 7 February (HKO: 6 February) and 2030 on 2 February (HKO: 3 February); WebKit 26.6 and native Temporal (ICU4X) give HKO's dates. `@js-temporal/polyfill` 0.5.1 reads these calendars from `Intl` and throws on ICU 78's `Mo12` month names (js-temporal/temporal-polyfill#360, fixed on `main` in #361, which would still read ICU4C); `temporal-polyfill` 1.0.8 also reads the host's `Intl` (fullcalendar/temporal-polyfill#128, PR #132). GMT owns no calendar data, so no host-independent date exists. | `internal/lunisolarRefusal.ts` (`refuseLunisolarDate`), called in `construct` (`internal/formatterCache.ts`); `calendarSystemIds.ts` keeps `chinese` and `dangi` out of `CalendarSystem`. No probe: unconditional (rule 2 exception) | Every host. A formatter whose calendar resolves to `chinese` or `dangi` and that prints a year, month, day or era is refused, and the format function returns `""` or `[]`. Time-only and weekday-only formats are unchanged. D28, the chinese parts of D29 and the chinese branches of the week-year guards stay, unreachable, for retirement |

**Removal-trigger row D33**:

> | D33 | Every engine's compat check passes every `D33` repro: `pnpm compat` (Node 24 oracle) and the chromium, firefox, webkit and webkit-macos legs, so the answer comes from neither ICU4C nor the host's `Temporal`; or the weekly swap check reports `D33 REMOVABLE` on all its legs for a `temporal-polyfill` release. One failing probe on one engine keeps it. js-temporal #361 alone cannot pass: it still reads ICU4C. Expected values: HKO and KASI tables, cross-checked with ICU4X. Upstream: js-temporal #360, fullcalendar #128 and PR #132 |

**Removal step 33** (insert after step 32; "After every step" is renumbered once, after phase 3: see [zone-ids.md](zone-ids.md) § Compat rows). In the README it is list item `33.`, as the other steps are:

> Step 33 — **D33:** a minor changeset. Add `chinese` and `dangi` to `calendarSystems` (`internal/calendarSystemIds.ts`) and `CalendarSystem` (`types/calendar-system.ts`) with the D33 repro values as public test rows; delete `internal/lunisolarRefusal.ts` and its call in `construct`; turn the D33 sentinel rows of `lunisolarRefused.test.ts` into value rows (the D28 and D29 rows moved to internal tests go back to the public functions); delete the `D33` repros and `"D33"`, the D33 entry in `scripts/lib/workarounds.mjs`, the `D33_CHECK` and Chinese/Dangi sweep split in `scripts/polyfill-swap.mjs`, `WHAT_BREAKS.D33`, and the D33 row of `temporal-compat.json`. Update `calendar-systems.mdx`.

## JSDoc and doc text

- `plain/format/formatDateToParts.ts:20`, `formatDateTimeToParts.ts:20`, `zoned/format/formatZonedToParts.ts:18`:
  they describe `relatedYear` and `yearName` for `zh-u-ca-chinese` and `ko-u-ca-dangi`. Replace with:
  "A `chinese` or `dangi` calendar returns `[]` for any format with a year, month, day or era:
  hosts print different dates for them (compat D33)." Add `@example formatDateToParts("2027-02-06", "zh-u-ca-chinese") // []`.
- Every other public format function whose JSDoc lists calendars: add one bullet, same wording
  with `""`. `tdd-dev` greps `@param locale` in `plain/format`, `zoned/format`, `unix/format`,
  `utc/format`.
- `internal/calendarSystemIds.ts`, `types/calendar-system.ts`, `internal/calendarDateString.ts:37`:
  name D33 as the reason chinese and dangi are excluded.
