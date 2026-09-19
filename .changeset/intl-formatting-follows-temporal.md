---
"@northguild/gmt": patch
---

Format dates and times the way ECMA-402, as amended by Temporal, formats Temporal values (Story CORE-8).

The text formatters took their options through the polyfill's `toLocaleString`, which rebuilds them from `resolvedOptions()` and loses some on the way. They now apply Temporal's `GetDateTimeFormat` and `AdjustDateTimeStyleFormat` over the runtime's own `Intl.DateTimeFormat`, so each text result equals its `…ToParts` result joined. The affected functions are `formatDate`, `formatTime`, `formatDateTime`, `formatDateRange`, `formatDateTimeRange`, `formatUtc`, `formatUnix`, `formatZonedDateTime`, `formatZonedRange` and the three `…ToParts` functions. The implementation was checked against a native-Temporal browser in 55,080 comparisons.

**Requested widths are kept.** Some locales and calendars lost a width, so `ja-JP` with the Japanese calendar and `month: "long"` gave `"R6/2"`, and `zh-CN` gave `"2024/2"`. A `long` or `full` `timeStyle` also replaced a shorter `dateStyle`.

```typescript
import { formatDate, formatDateTime, formatTime } from "@northguild/gmt/plain";

formatDate("2024-02-03", "ja-JP-u-ca-japanese", { year: "numeric", month: "long" }); // "令和6年2月"
formatDate("2024-02-03", "ja-JP-u-ca-japanese", { year: "numeric", month: "numeric" }); // "R6/2"
```

**`era` and `timeZoneName` count as the fields they are.** Temporal treats neither as a date or time field, so it adds the value's default fields. `era` alone dropped the time from a date-time. `timeZoneName` alone returned `""`, and a plain value has no zone to name, so it is now left out.

```typescript
formatDateTime("2024-02-03T14:30:45", "en-US", { era: "long" }); // "2/3/2024 Anno Domini, 2:30:45 PM"
formatDate("2024-02-03", "en-US", { timeZoneName: "long" }); // "2/3/2024"
formatTime("14:30:45", "en-US", { era: "long" }); // "2:30:45 PM"
```

**A style the type cannot show returns the sentinel.** A `timeStyle` beside `dateStyle` on a `PlainDate` was ignored, as was a `dateStyle` on a `PlainTime`. `formatDateToParts` with time options leaked a UTC midnight and a `"UTC"` zone name, and a `long`/`full` `timeStyle` added a `"UTC"` zone name to `formatDateTimeToParts` and `formatCalendar`. Plain values now show no zone, and a style for fields the type does not have returns `""` or `[]`.

```typescript
formatDate("2024-02-03", "en-US", { dateStyle: "short", timeStyle: "short" }); // ""
formatDate("2024-02-03", "en-US", { dateStyle: "short" }); // "2/3/24"
formatTime("14:30:45", "en-US", { timeStyle: "short" }); // "2:30 PM"
```

**A zoned value is formatted in its own zone.** `formatZonedToParts` honoured a `timeZone` option and rendered the instant in that zone, and `formatZonedRange` silently overrode it. Both now return their sentinel for a `timeZone` option, as `formatZonedDateTime` does.

```typescript
import { formatUtc, formatZonedToParts } from "@northguild/gmt";

formatZonedToParts("2024-03-15T14:30:00.000-04:00[America/New_York]", "en-US", { timeZone: "Asia/Tokyo" }); // []
formatUtc("2024-02-03T19:30:45Z", "en-US", { timeZone: "Asia/Tokyo", includeTimeZoneName: true }); // "2/4/2024, 4:30:45 AM GMT+9"
```

Compatibility: each function's JSDoc names the call that keeps its earlier text. Pass the fields the old text showed, such as the numeric fields for `"R6/2"` or `dateStyle` alone for the styled date. To render an instant in another zone, use `formatUtc` with its `timeZone` option. For the parts a plain date used to leak, call `formatZonedToParts` on the value at midnight UTC.
