---
name: format-date-time
description: >
  Format plain date/time values for display with locale and Intl.DateTimeFormat
  options. Use formatDate, formatTime, formatDateTime for absolute formatting;
  formatDateRange, formatDateTimeRange for a locale-elided range between two
  plain values; formatDateToParts, formatDateTimeToParts, formatZonedToParts for
  locale-ordered { type, value } parts; formatRelativeDate, formatRelativeTime,
  formatRelativeDateTime for human-friendly relative output ("yesterday", "in 2
  hours"); formatCalendar, formatCalendarZoned, formatCalendarUnix,
  formatCalendarUtc for a relative day label + time-of-day ("tomorrow at 2:30
  PM") — distinct from the elapsed-time formatRelative* phrasing. Also
  getLocaleEraNames, getLocaleMonthNames, getLocaleWeekdayNames,
  getLocaleMeridiems for standalone locale calendar-name lookups (Luxon Info
  equivalent). Also formatRfc2822, formatHttp, formatSql, formatRfc3339 for
  fixed, non-locale interchange grammars (email/HTTP headers, SQL, RFC 3339) —
  no locale argument.
sources:
  - 'northguild/gmt:packages/gmt/src/plain/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/format/formatDateRange.ts'
  - 'northguild/gmt:packages/gmt/src/plain/format/formatDateTimeRange.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/format/formatZonedRange.ts'
  - 'northguild/gmt:packages/gmt/src/plain/format/formatDateToParts.ts'
  - 'northguild/gmt:packages/gmt/src/plain/format/formatDateTimeToParts.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/format/formatZonedToParts.ts'
  - 'northguild/gmt:packages/gmt/src/plain/locale/index.ts'
  - 'northguild/gmt:packages/gmt/src/plain/locale/getLocaleEraNames.ts'
  - 'northguild/gmt:packages/gmt/src/plain/locale/getLocaleMonthNames.ts'
  - 'northguild/gmt:packages/gmt/src/plain/locale/getLocaleWeekdayNames.ts'
  - 'northguild/gmt:packages/gmt/src/plain/locale/getLocaleMeridiems.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/format/formatRfc2822.ts'
  - 'northguild/gmt:packages/gmt/src/utc/format/formatHttp.ts'
  - 'northguild/gmt:packages/gmt/src/plain/format/formatSql.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/format/formatRfc3339.ts'
  - 'northguild/gmt:packages/gmt/src/plain/format/formatCalendar.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/format/formatCalendarZoned.ts'
  - 'northguild/gmt:packages/gmt/src/unix/format/formatCalendarUnix.ts'
  - 'northguild/gmt:packages/gmt/src/utc/format/formatCalendarUtc.ts'
  - 'northguild/gmt:packages/gmt/src/internal/joinDateTimeConnector.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.14.2'
---

# Format Date/Time

Use this skill when you need to format date or time values for display to users.

## Setup

```ts
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeDate,
  formatRelativeTime,
  formatRelativeDateTime,
} from "@northguild/gmt";
```

## Core Patterns

### Format date with default locale

```ts
const formatted = formatDate("2024-03-15"); // "3/15/2024" (US format)
```

### Format date with specific locale

```ts
const usDate = formatDate("2024-03-15", "en-US"); // "3/15/2024"
const ukDate = formatDate("2024-03-15", "en-GB"); // "15/03/2024"
const deDate = formatDate("2024-03-15", "de-DE"); // "15.3.2024"
```

### Format time with locale

```ts
const time = formatTime("14:30:45"); // "2:30:45 PM"
const timeUk = formatTime("14:30:45", "en-GB"); // "14:30:45"
```

### Format datetime with locale

```ts
const formatted = formatDateTime("2024-03-15T14:30:45"); // "3/15/2024, 2:30:45 PM"
const formattedUk = formatDateTime("2024-03-15T14:30:45", "en-GB"); // "15/03/2024, 14:30:45"
```

### Format with options

```ts
import { formatDate } from "@northguild/gmt";

const formatted = formatDate("2024-03-15", "en-US", {
  year: "numeric",
  month: "long",
  day: "numeric"
}); // "March 15, 2024"
```

### Format a plain date/datetime range

```ts
import { formatDateRange, formatDateTimeRange } from "@northguild/gmt";

formatDateRange("2024-02-03", "2024-02-05", "en-US", { dateStyle: "long" });
// "February 3 – 5, 2024" — Intl elides the shared month/year automatically

formatDateRange("2024-11-03", "2025-02-10", "en-US", { dateStyle: "long" });
// "November 3, 2024 – February 10, 2025" — no elision once the year differs

formatDateTimeRange(
  "2024-02-03T09:00:00",
  "2024-02-03T17:00:00",
  "en-US",
  { dateStyle: "long", timeStyle: "short" },
);
// "February 3, 2024, 9:00 AM – 5:00 PM" — same day collapses to one date
```

These are the plain (timezone-free) counterparts of `formatZonedRange` (zoned
namespace) — same parameter order (`start, end, locale?, options?`) and
option shape, wrapping `Intl.DateTimeFormat.prototype.formatRange` directly
instead of joining two separately-formatted strings by hand. Do not swap
`start`/`end` before calling — a reversed range still formats (it does not
throw or auto-correct), so validate ordering yourself if that matters to the
caller.

### Get locale-ordered parts instead of a finished string

```ts
import { formatDateToParts, formatDateTimeToParts } from "@northguild/gmt";
import { formatZonedToParts } from "@northguild/gmt";

formatDateToParts("2024-03-15", "en-US");
// [{ type: "month", value: "3" }, { type: "literal", value: "/" },
//  { type: "day", value: "15" }, { type: "literal", value: "/" },
//  { type: "year", value: "2024" }]

formatDateToParts("2024-03-15", "fr-FR");
// day comes before month — same locale-order guarantee formatDate gives you,
// but as parts you can restyle instead of a finished string.
// [{ type: "day", value: "15" }, { type: "literal", value: "/" },
//  { type: "month", value: "3" }, { type: "literal", value: "/" },
//  { type: "year", value: "2024" }]

formatZonedToParts(
  "2024-03-15T14:30:00-04:00[America/New_York]",
  "en-US",
  { timeZoneName: "longOffset" },
);
// includes { type: "timeZoneName", value: "GMT-4" }
```

Iterate the returned array in order — do not pick out `.find(p => p.type === "month")` and reassemble parts into a fixed order, since that reintroduces the exact locale-ordering bug `formatToParts` exists to avoid (see Common Mistakes below).

### Format relative date

```ts
import { formatRelativeDate } from "@northguild/gmt";

const ref = "2024-03-15";
formatRelativeDate("2024-03-12", "en-US", { reference: ref }); // "3 days ago"
formatRelativeDate("2024-03-18", "en-US", { reference: ref }); // "in 3 days"
formatRelativeDate("2024-03-14", "en-US", { reference: ref }); // "yesterday"
formatRelativeDate("2023-03-15", "en-US", { reference: ref }); // "last year"
```

### Format relative time / datetime

```ts
import { formatRelativeTime, formatRelativeDateTime } from "@northguild/gmt";

formatRelativeTime("11:30:00", "en-US", { reference: "12:00:00" });
// "30 minutes ago"

formatRelativeDateTime("2024-03-15T10:00:00", "en-US", {
  reference: "2024-03-15T12:00:00",
}); // "2 hours ago"
```

### Relative format options

- `reference: string` — required anchor (the same shape as `value`)
- `numeric: "auto" | "always"` — default `"auto"`. `"auto"` produces "yesterday"/"tomorrow"; `"always"` forces "1 day ago"/"in 1 day"
- `style: "long" | "short" | "narrow"` — default `"long"`
- `largestUnit` — override the auto-picked unit (e.g. `"week"` to force "3 weeks ago" instead of "last month")

### Format a relative day label + time-of-day (Moment's `.calendar()`)

```ts
import { formatCalendar, formatCalendarZoned } from "@northguild/gmt";

const ref = "2026-03-15T09:00:00";
formatCalendar("2026-03-16T14:30:00", "en-US", { reference: ref });
// "tomorrow at 2:30 PM"

formatCalendar("2026-03-15T14:30:00", "en-US", { reference: ref });
// "today at 2:30 PM"

formatCalendar("2026-03-08T14:30:00", "en-US", { reference: ref });
// "March 8, 2026 at 2:30 PM" — 7 days out, beyond the ±6-day threshold,
// falls back to an absolute date + time with no relative wording

formatCalendarZoned(
  "2026-03-16T14:30:00-04:00[America/New_York]",
  "de-DE",
  { reference: "2026-03-15T09:00:00-04:00[America/New_York]" },
);
// "morgen um 14:30" — the connector ("um") is the locale's own, read from
// Intl's combined date+time pattern, never a hardcoded "at"
```

Unlike `formatRelativeDate`/`formatRelativeDateTime` (which auto-pick a unit
and always render an elapsed-time phrase — "in 1 day"), `formatCalendar*`
always renders a day-granularity label plus the time-of-day, and switches to
an absolute date beyond a fixed ±6-day threshold instead of degrading to
"in 9 days". Options: `reference` (default "now"), `timeStyle` ("short"
default, "medium", plus "full" on the zoned/unix/utc variants — not on plain
`formatCalendar`, since a plain value has no real timezone for "full"'s
`timeZoneName` to name; see its JSDoc).

### Standalone locale calendar names (no date value needed)

These return locale-formatted calendar names directly — the GMT equivalent of Luxon's `Info` class — without requiring a date value:

```ts
import {
  getLocaleEraNames,
  getLocaleMonthNames,
  getLocaleWeekdayNames,
  getLocaleMeridiems,
} from "@northguild/gmt";

getLocaleEraNames("en-US");
// ["Before Christ", "Anno Domini"]

getLocaleEraNames("ja-JP", "short");
// ["紀元前", "西暦"]

getLocaleMonthNames("en-US");
// ["January", "February", ... "December"]

getLocaleMonthNames("de-DE", "short");
// ["Jan", "Feb", "Mär", ... "Dez"]

getLocaleWeekdayNames("en-US");
// ["Sunday", "Monday", ... "Saturday"] (locale-first-day order)

getLocaleWeekdayNames("fr-FR");
// ["lundi", "mardi", ... "dimanche"]

getLocaleMeridiems("en-US");
// ["AM", "PM"]

getLocaleMeridiems("zh-CN");
// ["上午", "下午"]
```

Options:

- `getLocaleEraNames(locale, style?)` — 2-element `[BCE-label, CE-label]` Gregorian era names. `style: "long" | "short" | "narrow"` (default `"long"`).
- `getLocaleMonthNames(locale, style?)` — 12 Gregorian month names in calendar order. `style: "long" | "short" | "narrow"` (default `"long"`).
- `getLocaleWeekdayNames(locale, style?)` — 7 weekday names in the locale's **first-day order** (Sunday-first for en-US, Monday-first for fr-FR). This matches `getLocaleDayOfWeek`, where index 0 is the locale's first day of the week.
- `getLocaleMeridiems(locale)` — `[AM-label, PM-label]`; labels are locale-varying (e.g. `en-GB` → `["am","pm"]`, `sv-SE` → `["fm","em"]`, `zh-CN` → `["上午","下午"]`).

All four return `[]` for an invalid BCP 47 locale tag. If a locale has no distinct BCE/CE era names, `getLocaleEraNames` returns both elements as the same string — the sentinel is reserved for invalid input only.

### Named machine formats (email, HTTP, SQL, RFC 3339)

These are **fixed, non-locale-adaptive grammars** — RFC 5322/RFC 7231 mandate
English weekday/month abbreviations regardless of caller locale, by
specification. This does not contradict the token-formatter exclusion above
(Decision 1): there is no locale-appropriate alternative field order to lose,
because the grammar is a constant, not a display choice. None of these four
take a `locale` argument.

```ts
import { formatRfc2822, formatHttp, formatSql, formatRfc3339 } from "@northguild/gmt";

// Email `Date:` headers (RFC 5322 / RFC 2822) — zoned namespace.
formatRfc2822("2024-03-15T14:30:00-04:00[America/New_York]");
// "Fri, 15 Mar 2024 14:30:00 -0400"

// HTTP headers (RFC 7231 IMF-fixdate) — utc namespace, always GMT.
formatHttp("2024-03-15T14:30:00Z");
// "Fri, 15 Mar 2024 14:30:00 GMT"

// ANSI SQL / ODBC datetime literal — plain namespace, no time zone.
formatSql("2024-03-15T14:30:00");
// "2024-03-15 14:30:00"

// Strict RFC 3339 — zoned namespace; strips the bracketed IANA zone
// GMT's own zoned strings carry, which RFC 3339 does not permit.
formatRfc3339("2024-03-15T14:30:00-04:00[America/New_York]");
// "2024-03-15T14:30:00-04:00"
```

Each has a `parse*` counterpart in the `parse-date-time` skill.

## Locale Matrix and Runtime ICU data

See [Full format API](references/format-api.md) for the supported-locale
formatting matrix and how host ICU data (full vs. small-icu Node builds)
affects locale output.

## Common Mistakes

### HIGH Using Intl.DateTimeFormat directly

Wrong:

```ts
const formatted = new Intl.DateTimeFormat("en-US").format(new Date("2024-03-15"));
```

Correct:

```ts
import { formatDate } from "@northguild/gmt";

const formatted = formatDate("2024-03-15", "en-US");
```

Source: AGENTS.md — Never use JavaScript Date APIs

### MEDIUM Not handling empty string on invalid input

Wrong:

```ts
const formatted = formatDate("invalid-date");
// Assume formatted is always valid string
display(formatted);
```

Correct:

```ts
import { formatDate, isValidDate } from "@northguild/gmt";

const input = "invalid-date";
if (!isValidDate(input)) {
  display("Invalid date");
} else {
  display(formatDate(input));
}
```

Source: packages/gmt/src/plain/format/formatDate.ts — Returns "" on invalid input

### MEDIUM Assuming getLocale* throws or returns English for an invalid locale

Wrong:

```ts
const names = getLocaleMonthNames("not-a-locale");
// Assume names is non-empty or throws
render(names);
```

Correct:

```ts
import { getLocaleEraNames, getLocaleMonthNames } from "@northguild/gmt";

const names = getLocaleMonthNames("en-US");
const eras = getLocaleEraNames("en-US");
if (names.length === 0 || eras.length === 0) {
  // invalid BCP 47 tag — fall back or surface an error
}
```

Source: packages/gmt/src/plain/locale/getLocaleMonthNames.ts — Returns [] for an invalid locale

### MEDIUM Looking for a token-pattern formatter (there isn't one, deliberately)

GMT has `parseDateWithPattern`/`parseDateTimeWithPattern`/`parseTimeWithPattern`
for *decoding* a string against a caller-supplied token pattern (e.g.
`"MM/dd/yyyy"`), but deliberately has no inverse token *formatter* for
producing output. This is not a gap to work around — it's roadmap Decision 1
(`context/roadmap/issues/J.md`): a hard-coded token pattern like
`"MM/dd/yyyy"` bakes in US field ordering (month before day) and ships it to
every locale, which is exactly the kind of locale bug GMT exists to prevent.
Parsing a *known, fixed* producer format is fine because there's no ambiguity
about what the input shape is; formatting *for output* by a fixed pattern
would impose that same fixed shape on every locale's display.

Wrong:

```ts
// There is no formatDateWithPattern — don't go looking for one, and don't
// hand-roll one by string-splitting/concatenating a formatted value into a
// fixed field order.
```

Correct:

```ts
import { formatDate } from "@northguild/gmt";

// Let Intl.DateTimeFormat pick field order per locale instead of a fixed
// pattern string.
formatDate("2024-03-15", "en-US"); // "3/15/2024"
formatDate("2024-03-15", "de-DE"); // "15.3.2024"
```

`formatDate`/`formatTime`/`formatDateTime` (locale-ordered strings) are the
current answer for display. For field-level output control (a custom layout
that still needs per-locale field order), use `formatDateToParts` /
`formatDateTimeToParts` / `formatZonedToParts` — GMT's substitute for a
token formatter (Story J12).

Source: context/roadmap/issues/J.md — Decision 1 (token formatter deliberately excluded); packages/gmt/src/plain/parse/parseDateWithPattern.ts — the parsing-only counterpart

### MEDIUM Reassembling `formatToParts` output in a fixed order

Wrong:

```ts
import { formatDateToParts } from "@northguild/gmt";

const parts = formatDateToParts("2024-03-15", locale);
const month = parts.find((p) => p.type === "month")?.value;
const day = parts.find((p) => p.type === "day")?.value;
const year = parts.find((p) => p.type === "year")?.value;
// Hard-codes US field order onto every locale — exactly the bug
// formatToParts exists to avoid.
const display = `${month}/${day}/${year}`;
```

Correct:

```ts
import { formatDateToParts } from "@northguild/gmt";

const parts = formatDateToParts("2024-03-15", locale);
const display = parts.map((p) => p.value).join("");
// Iterate as returned — the locale already ordered the parts. Restyle
// individual part values (e.g. wrap { type: "literal" } parts differently)
// without changing their relative order.
```

Source: context/roadmap/issues/J12 — "iterate the array as returned; reassembling parts in a fixed order reintroduces exactly the bug formatToParts exists to avoid"

### MEDIUM Confusing formatCalendar with formatRelativeDateTime

They answer different questions and are not interchangeable:

- `formatCalendar` (and its `formatCalendarZoned`/`formatCalendarUnix`/
  `formatCalendarUtc` siblings) — "what should I show on a schedule/agenda
  item?" → `"Tomorrow at 2:30 PM"`. Always includes the clock time; switches
  to an absolute date beyond ±6 days.
- `formatRelativeDateTime` (and its `formatRelative*` siblings) — "how long
  ago/from now was this?" → `"in 1 day"`. Never includes a clock time;
  auto-picks the coarsest sensible unit (seconds through years) with no
  distance threshold.

Wrong:

```ts
import { formatRelativeDateTime } from "@northguild/gmt";

// Building a meeting-list row and reaching for the relative formatter —
// it has no time-of-day in its output at all.
const row = formatRelativeDateTime(meeting.startsAt); // "in 1 day"
```

Correct:

```ts
import { formatCalendar } from "@northguild/gmt";

const row = formatCalendar(meeting.startsAt); // "tomorrow at 2:30 PM"
```

Source: context/roadmap/issues/J.md — J15's Common Mistakes requirement; packages/gmt/src/plain/format/formatCalendar.ts

## References

- [Full format API](references/format-api.md)
- [Intl.DateTimeFormat documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)