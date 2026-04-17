---
name: format-date-time
description: >
  Format date/time values for display with locale support.
  Use formatDate, formatTime, formatDateTime with locale option.
type: core
library: '@burglekitt/gmt'
library_version: '1.2.0'
sources:
  - 'burglekitt/gmt:packages/gmt/src/plain/format/index.ts'
---

# Format Date/Time

Use this skill when you need to format date or time values for display to users.

## Setup

```ts
import { formatDate, formatTime, formatDateTime } from "@burglekitt/gmt";
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