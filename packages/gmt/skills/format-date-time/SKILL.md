---
name: format-date-time
description: >
  Format plain date/time values for display with locale and Intl.DateTimeFormat
  options. Use formatDate, formatTime, formatDateTime for absolute formatting;
  use formatDateToParts, formatDateTimeToParts, formatZonedToParts for
  locale-ordered { type, value } parts (GMT's substitute for a token
  formatter); use formatRelativeDate, formatRelativeTime,
  formatRelativeDateTime for human-friendly relative output ("yesterday",
  "in 2 hours"). Also getLocaleEraNames, getLocaleMonthNames,
  getLocaleWeekdayNames, getLocaleMeridiems for standalone locale
  calendar-name lookups — the GMT equivalent of Luxon's Info.eras,
  Info.months, Info.weekdays, and Info.meridiems.
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/format/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/format/formatDateToParts.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/format/formatDateTimeToParts.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/format/formatZonedToParts.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/locale/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/locale/getLocaleEraNames.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/locale/getLocaleMonthNames.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/locale/getLocaleWeekdayNames.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/locale/getLocaleMeridiems.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.12.0'
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
} from "@burglekitt/gmt";
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
import { formatDate } from "@burglekitt/gmt";

const formatted = formatDate("2024-03-15", "en-US", {
  year: "numeric",
  month: "long",
  day: "numeric"
}); // "March 15, 2024"
```

### Get locale-ordered parts instead of a finished string

```ts
import { formatDateToParts, formatDateTimeToParts } from "@burglekitt/gmt";
import { formatZonedToParts } from "@burglekitt/gmt";

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
import { formatRelativeDate } from "@burglekitt/gmt";

const ref = "2024-03-15";
formatRelativeDate("2024-03-12", "en-US", { reference: ref }); // "3 days ago"
formatRelativeDate("2024-03-18", "en-US", { reference: ref }); // "in 3 days"
formatRelativeDate("2024-03-14", "en-US", { reference: ref }); // "yesterday"
formatRelativeDate("2023-03-15", "en-US", { reference: ref }); // "last year"
```

### Format relative time / datetime

```ts
import { formatRelativeTime, formatRelativeDateTime } from "@burglekitt/gmt";

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

### Standalone locale calendar names (no date value needed)

These return locale-formatted calendar names directly — the GMT equivalent of Luxon's `Info` class — without requiring a date value:

```ts
import {
  getLocaleEraNames,
  getLocaleMonthNames,
  getLocaleWeekdayNames,
  getLocaleMeridiems,
} from "@burglekitt/gmt";

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

## Locale Matrix

Supported locales for formatting:

| Locale | Date Format | Time Format |
|--------|------------|-------------|
| en-US | 3/15/2024 | 2:30:45 PM |
| en-GB | 15/03/2024 | 14:30:45 |
| de-DE | 15.3.2024 | 14:30:45 |
| fr-FR | 15/03/2024 | 14:30:45 |
| es-ES | 15/3/2024 | 14:30:45 |
| it-IT | 15/03/2024 | 14:30:45 |
| pt-PT | 15/03/2024 | 14:30:45 |
| sv-SE | 2024-03-15 | 14:30:45 |
| is-IS | 15.3.2024 | 14:30:45 |
| zh-CN | 2024/3/15 | 下午2:30:45 |
| zh-TW | 2024/3/15 | 下午2:30:45 |
| ja-JP | 2024/3/15 | 14:30:45 |
| ko-KR | 2024. 3. 15. | 오후 2:30:45 |
| ar-SA | ١٥‏/٣‏/٢٠٢٤ | ٢:٣٠:٤٥ م |
| he-IL | 15/03/2024 | 14:30:45 |
| ru-RU | 15.03.2024 | 14:30:45 |
| tr-TR | 15.03.2024 | 14:30:45 |

## Runtime ICU data

These formatters delegate locale rendering to the host runtime's `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`. Output therefore depends on the ICU data shipped with the running Node (or browser):

- **Full ICU** runtimes (official Node binaries from nodejs.org, all modern browsers) return fully localized strings — e.g. `formatTime("14:30:00", "ko-KR", { timeStyle: "short" })` returns `"오후 2:30"`.
- **Small/partial ICU** runtimes (some Node builds compiled with `--with-intl=small-icu` or repackaged distributions) fall back to English day periods and other locale data — the same call may return `"PM 2:30"`.

This is a property of the runtime, not gmt. For consistent non-English output, deploy on a full-ICU Node build or polyfill `Intl` with a package that bundles locale data.

## Common Mistakes

### HIGH Using Intl.DateTimeFormat directly

Wrong:

```ts
const formatted = new Intl.DateTimeFormat("en-US").format(new Date("2024-03-15"));
```

Correct:

```ts
import { formatDate } from "@burglekitt/gmt";

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
import { formatDate, isValidDate } from "@burglekitt/gmt";

const input = "invalid-date";
if (!isValidDate(input)) {
  display("Invalid date");
} else {
  display(formatDate(input));
}
```

Source: packages/gmt/src/plain/format/formatDate.ts — Returns "" on invalid input

### MEDIUM Locale not supported

Wrong:

```ts
const formatted = formatDate("2024-03-15", "xx-XX"); // May produce unexpected output
```

Correct:

```ts
// Use supported locale from matrix
const formatted = formatDate("2024-03-15", "en-US");
```

Source: Intl.DateTimeFormat — Throws on unsupported locale

### MEDIUM Assuming getLocale* throws or returns English for an invalid locale

Wrong:

```ts
const names = getLocaleMonthNames("not-a-locale");
// Assume names is non-empty or throws
render(names);
```

Correct:

```ts
import { getLocaleEraNames, getLocaleMonthNames } from "@burglekitt/gmt";

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
import { formatDate } from "@burglekitt/gmt";

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
import { formatDateToParts } from "@burglekitt/gmt";

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
import { formatDateToParts } from "@burglekitt/gmt";

const parts = formatDateToParts("2024-03-15", locale);
const display = parts.map((p) => p.value).join("");
// Iterate as returned — the locale already ordered the parts. Restyle
// individual part values (e.g. wrap { type: "literal" } parts differently)
// without changing their relative order.
```

Source: context/roadmap/issues/J12 — "iterate the array as returned; reassembling parts in a fixed order reintroduces exactly the bug formatToParts exists to avoid"

## References

- [Full format API](references/format-api.md)
- [Intl.DateTimeFormat documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)