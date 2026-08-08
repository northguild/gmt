---
name: format-date-time
description: >
  Format plain date/time values for display with locale and Intl.DateTimeFormat
  options. Use formatDate, formatTime, formatDateTime for absolute formatting;
  use formatRelativeDate, formatRelativeTime, formatRelativeDateTime for
  human-friendly relative output ("yesterday", "in 2 hours").
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/format/index.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.6.0'
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

## References

- [Full format API](references/format-api.md)
- [Intl.DateTimeFormat documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)