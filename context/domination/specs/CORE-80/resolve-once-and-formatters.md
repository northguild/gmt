# Slice 9 — Resolve once per call; cached formatters

Read with [index.md](./index.md). Story scope part 7 (calendars, zones and formatters).

## A. `internal/formatterCache.ts` (new)

```ts
type FormatterKind = "DateTimeFormat" | "NumberFormat" | "ListFormat" | "RelativeTimeFormat";
/** A shared, read-only formatter for these arguments; built on the first call with them. */
export function cachedFormatter<K extends FormatterKind>(kind: K, locale: string | string[] | undefined, options: Record<string, unknown>): InstanceType<(typeof Intl)[K]>;
/** Construct once to raise the error Intl raises for these arguments; a repeat is a no-op. */
export function checkFormatterArguments(kind: FormatterKind, locale: string | string[] | undefined, options: Record<string, unknown>): void;
```

**What may be cached** (GMT rule; index authority row "cache bounds and key"). A formatter's
output is fixed by its constructor arguments and the host's locale data, which is loaded once.
It also depends on two pieces of process state: the default locale and the default time zone.
`process.env.TZ` and test stubs can change either. So a formatter is cached only when:

- `locale` is a string or an array of strings, never `undefined`;
- the options carry a `timeZone` string (for `DateTimeFormat`; the other kinds read no zone);
- every option value is a string, number, boolean or `undefined`. A value that is an object would
  be coerced by Intl, running caller code, so it is constructed fresh every time.

Anything else is constructed exactly as today, uncached. The key is
`kind + JSON.stringify([locale, options])`, with options built by GMT code in a fixed key order.
Bound: 256 formatters per kind; clear that kind's map when an insert would pass it.
`checkFormatterArguments` keeps a `Set` of keys that constructed without error, under the same
rules and bound, except that it needs no `timeZone`: whether construction throws does not depend
on the default zone. It never caches a failure, so an invalid call throws every time, as today.

Formatters have no setters, and `format`, `formatToParts` and `formatRange` return new values,
so sharing one is safe. Test seam: `clearFormatterCache()`.

## B. Sites

Every `new Intl.DateTimeFormat | NumberFormat | ListFormat | RelativeTimeFormat` in shipped
`src` goes through the module, except `internal/resolveLocale.ts:35`, which reads the default
locale and must not be cached. Today (verified with `rg`):

| Pattern | Sites |
| ------- | ----- |
| Validate with the caller's options, then format with resolved ones | `plain/format/{formatDate:57/69, formatTime:54/63, formatDateTime:59/65, formatDateTimeRange:59/60, formatDateToParts:82/89, formatDateTimeToParts:88/93, formatDateRange:56/61}`, `internal/instantFormatOptions.ts:105/114/121` |
| Format only | `zoned/format/{formatZonedToParts:96, formatZonedRange:85, formatZonedDateTime:71, formatTimeZoneName:101}`, `plain/format/formatCalendar.ts:104/112`, `duration/format/formatDuration.ts:157/167/175`, `internal/{joinDateTimeConnector:58/73, formatRelativeDuration:117, formatCalendarDays:32/40}`, `plain/locale/{getLocaleEraNames:50, getLocaleMeridiems:29}` |
| One formatter per name | `plain/locale/getLocaleMonthNames.ts:60` (2024-MM-15, `calendar: "gregory"`) and `getLocaleWeekdayNames.ts:58` (2024-01-15 to 21) call `PlainDate#toLocaleString` 12 and 7 times: build one cached `DateTimeFormat` with the same fields plus `timeZone: "UTC"` and format each date's UTC-midnight epoch milliseconds |

The validation step becomes `checkFormatterArguments(...)`, the format step `cachedFormatter(...)`.
A site whose options lack `timeZone` keeps working, uncached; record in the handoff which sites
those are.

For the name lists, `PlainDate#toLocaleString` formats the date's own wall-clock fields
(TC39 Temporal `PlainDate.prototype.toLocaleString`, `CreateDateTimeFormat` with the `~date~`
defaults). The same date's UTC midnight formatted with `timeZone: "UTC"` shows the same fields,
so the names are equal. The existing locale-matrix rows in both test files are the proof; no new
expected value is needed.

`isValidTimeZone` (below) and the zone memo answer from the zone id; neither touches `Intl`
through this module.

## C. Zones validated once

`zoned/validate/isValidTimeZone.ts` builds a `ZonedDateTime` (`zonedDateTimeFrom`) and tests
`timeZoneLike` on every call. Keep a module-level `Set<string>` of ids that passed both. A hit
returns `true` without either. A failure is not stored, so hostile strings
cannot grow it. Bound: 1,024 ids; clear on overflow. Sound for the same reason as the zone memo:
whether an id names a zone is fixed by the host data loaded once.

It also calls `Temporal.ZonedDateTime.from` (from `internal/temporal`) in place of
`zonedDateTimeFrom`. The fixed 2020 bag is never near the range edge, so the wrapper's only
workaround never applies and the output is the same. That one import is what pulls
`internal/zonedWallClock.ts` and `internal/temporalCompat/` into every business-day entry (about
13.7 kB minified each). Add `internal/zonedWallClock.ts` and
`internal/temporalCompat/probeRepros.ts` to the `absent` lists of `addBusinessDays` and
`businessDaysBetween` in `scripts/bundle-size.budgets.json`.

## D. `cutoffSchedule` resolves once

Today each entry calls the public `cutoffAt`, which re-reads `options` and revalidates the zone
and the calendar. `cutoffAt` then calls the public `rollDate` with a date string, which parses the
calendar again. Then the result is parsed again (`instantFrom`) for the sort.

- In `transport/calculate/cutoffAt.ts`, split out `cutoffAtResolved(anchor: Temporal.Instant,
  duration: Temporal.Duration, atLocalTime: Temporal.PlainTime | null, shared: SharedCutoffOptions):
  { text: string; ns: bigint } | null`, where `SharedCutoffOptions` holds the zone and a
  `ResolvedBusinessCalendar` with the roll (from `parseBusinessCalendar`; `isValidBusinessCalendar`
  is exactly `parseBusinessCalendar(…) !== null`). It is not exported from any `index.ts`.
- Move `rollDate`'s core (`sameMonth`, `modifiedRoll`, `rollTo` over a `PlainDate` and a
  `ResolvedBusinessCalendar`) into `internal/rollBusinessDate.ts`; `rollDate` and
  `cutoffAtResolved` both call it, so no public function calls another.
- `cutoffAt` = read options once, then `cutoffAtResolved`. `cutoffSchedule` = read options once,
  validate the anchor once, then `cutoffAtResolved` per entry with that entry's `offset` and
  `atLocalTime`, and sort by `ns` (stable, as today, so ties keep input order).
- Reading `options` once instead of once per entry changes no answer for a plain object. A getter
  that answers differently on each read is hostile input; reading once is the house rule
  (`freeTimeLedger.ts` "every read of `options` happens here").

## Tests

All format, locale, cutoff and zone-validation rows stay green unchanged. Add:

| Row | Expected |
| --- | -------- |
| `formatDate("2024-07-04", "en-GB", { dateStyle: "long" })` twice, cache cleared first | the same string; the second call constructs no `DateTimeFormat` (spy on the constructor) |
| `formatDate` with `locale` omitted | constructs on every call (not cached) |
| an option value that is an object with a `toString` | constructs on every call; its `toString` runs each time, as today |
| `formatDate` with an invalid `timeZoneName` value, twice | `""` both times (the failure is never cached) |
| 257 distinct cacheable `formatDate` calls, then the first again | correct output after the clear |
| `isValidTimeZone("Europe/London")` twice | `true`; the second builds no `ZonedDateTime` (spy through the seam) |
| `isValidTimeZone("Not/AZone")` twice | `false` both times; the set stays empty |
| `cutoffSchedule` with two entries on the same instant | input order kept |
| `cutoffSchedule` with a rolling calendar, 50 entries | equals 50 `cutoffAt` calls, entry by entry; the calendar is parsed once (spy on `parseBusinessCalendar`) |

## Bench

`formatDate.bench.ts` rows from slice 1, before and after; add a `cutoffSchedule` 50-entry row.

## Done when

- `rg 'new Intl\.(DateTimeFormat|NumberFormat|ListFormat|RelativeTimeFormat)' packages/gmt/src
  --glob '!*.test.ts'` matches only `internal/formatterCache.ts` and `internal/resolveLocale.ts`.
- `cutoffAt` and `cutoffSchedule` call no other public function.
- `pnpm size --files addBusinessDays` lists nothing under `internal/temporalCompat/`.
- `pnpm run validate` green. (Slice 10 sets the final budgets.)
