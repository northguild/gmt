---
name: format-relative-time
description: >
  Produce human-friendly relative time strings ("yesterday", "in 2 hours", "3
  days ago") for any gmt value type. Use formatRelativeDate, formatRelativeTime,
  formatRelativeDateTime for plain values; formatRelativeZoned for IANA zoned
  values; formatRelativeUnix for epoch ms/seconds; formatRelativeUtc for UTC ISO
  strings. All accept a reference anchor and Intl.RelativeTimeFormat options
  (numeric, style).
sources:
  - 'northguild/gmt:packages/gmt/src/plain/format/formatRelativeDate.ts'
  - 'northguild/gmt:packages/gmt/src/plain/format/formatRelativeTime.ts'
  - 'northguild/gmt:packages/gmt/src/plain/format/formatRelativeDateTime.ts'
  - 'northguild/gmt:packages/gmt/src/zoned/format/formatRelativeZoned.ts'
  - 'northguild/gmt:packages/gmt/src/unix/format/formatRelativeUnix.ts'
  - 'northguild/gmt:packages/gmt/src/utc/format/formatRelativeUtc.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.14.1'
---

# Format Relative Time

Use this skill when you need a human-friendly relative time label — "yesterday", "in 5 minutes", "2 weeks ago" — instead of an absolute timestamp. There is one relative formatter per value type; pick the one matching the input.

## Picking the right formatter

| Input shape | Formatter | Module |
|---|---|---|
| ISO date `"2024-03-15"` | `formatRelativeDate` | `@northguild/gmt` |
| ISO time `"14:30:45"` | `formatRelativeTime` | `@northguild/gmt` |
| ISO datetime `"2024-03-15T14:30:45"` | `formatRelativeDateTime` | `@northguild/gmt` |
| Zoned `"2024-03-15T14:30:45-05:00[America/New_York]"` | `formatRelativeZoned` | `@northguild/gmt/zoned` |
| Unix epoch (ms or seconds) | `formatRelativeUnix` | `@northguild/gmt/unix` |
| UTC ISO `"2024-03-15T14:30:45Z"` | `formatRelativeUtc` | `@northguild/gmt/utc` |

## Core Patterns

### Plain date relative

```ts
import { formatRelativeDate } from "@northguild/gmt";

const ref = "2024-03-15";
formatRelativeDate("2024-03-14", "en-US", { reference: ref }); // "yesterday"
formatRelativeDate("2024-03-16", "en-US", { reference: ref }); // "tomorrow"
formatRelativeDate("2024-03-12", "en-US", { reference: ref }); // "3 days ago"
formatRelativeDate("2024-02-23", "en-US", {
  reference: ref,
  largestUnit: "week",
  numeric: "always",
}); // "3 weeks ago"
```

### Plain time relative

```ts
import { formatRelativeTime } from "@northguild/gmt";

const ref = "12:00:00";
formatRelativeTime("11:30:00", "en-US", { reference: ref }); // "30 minutes ago"
formatRelativeTime("12:00:30", "en-US", { reference: ref }); // "in 30 seconds"
```

### Plain datetime relative

```ts
import { formatRelativeDateTime } from "@northguild/gmt";

const ref = "2024-03-15T12:00:00";
formatRelativeDateTime("2024-03-15T10:00:00", "en-US", { reference: ref });
// "2 hours ago"
```

### Zoned relative (DST-safe)

```ts
import { formatRelativeZoned } from "@northguild/gmt/zoned";

const ref = "2024-03-15T12:00:00-04:00[America/New_York]";
formatRelativeZoned(
  "2024-03-15T10:00:00-04:00[America/New_York]",
  "en-US",
  { reference: ref },
); // "2 hours ago"
```

Zoned arithmetic uses `Temporal.ZonedDateTime`, so spans that cross DST transitions ("fall back" / "spring forward") are still wall-clock-correct.

### Unix relative

```ts
import { formatRelativeUnix } from "@northguild/gmt/unix";

// Default epoch unit is milliseconds.
formatRelativeUnix(1710507600000, "en-US", { reference: 1710511200000 });
// "1 hour ago"

// Switch to seconds via epochUnit.
formatRelativeUnix(1710507600, "en-US", {
  reference: 1710511200,
  epochUnit: "seconds",
}); // "1 hour ago"
```

### UTC relative

```ts
import { formatRelativeUtc } from "@northguild/gmt/utc";

formatRelativeUtc("2024-03-15T11:00:00Z", "en-US", {
  reference: "2024-03-15T12:00:00Z",
}); // "1 hour ago"
```

## Shared options

All relative formatters accept the same option shape (besides their type-specific `reference`):

- `reference` — **required** anchor of the same input shape (e.g. an ISO date for `formatRelativeDate`).
- `numeric: "auto" | "always"` — default `"auto"`.
  - `"auto"` produces phrases like `"yesterday"`, `"tomorrow"`, `"last week"`.
  - `"always"` forces numeric form: `"1 day ago"`, `"in 1 day"`.
- `style: "long" | "short" | "narrow"` — default `"long"`.
  - `"long"`: `"3 minutes ago"`
  - `"short"`: `"3 min. ago"`
  - `"narrow"`: `"3m ago"`
- `largestUnit` — pick a specific bucket (`"second" | "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year"`). Useful when you want `"3 weeks ago"` even though the difference would auto-bucket to `"last month"`.
- `roundingMethod: "floor" | "ceil" | "round"` — default `"round"`. Controls how the fractional distance rounds to the display unit; `"floor"`/`"ceil"` apply directly to the signed value (not its absolute value), so they respect whether the distance is past or future.

## Runtime ICU data

These formatters delegate locale rendering to the host runtime's `Intl.RelativeTimeFormat`. Output therefore depends on the ICU data shipped with the running Node (or browser):

- **Full ICU** runtimes (official Node binaries from nodejs.org, all modern browsers) return fully localized strings — e.g. `formatRelativeDate("2023-03-15", "sv-SE", { reference: "2024-03-15" })` returns `"i fjol"`.
- **Small/partial ICU** runtimes (some Node builds compiled with `--with-intl=small-icu` or repackaged distributions) fall back to a longer/different form — the same call may return `"förra året"`. Some locales (e.g. he-IL) also tack on a fallback numeric suffix like `"לפני שעתיים (2)"` instead of the full-ICU dual form `"לפני שעתיים"`.

This is a property of the runtime, not gmt. For consistent non-English output, deploy on a full-ICU Node build or polyfill `Intl` with a package that bundles locale data.

## Common Mistakes

### HIGH Forgetting `reference`

Wrong:

```ts
formatRelativeDate("2024-03-12"); // "" — no anchor to diff against
```

Correct:

```ts
formatRelativeDate("2024-03-12", "en-US", { reference: "2024-03-15" });
// "3 days ago"
```

Source: `packages/gmt/src/plain/format/formatRelativeDate.ts` — `reference` is required.

### HIGH Mismatched input shape between value and reference

Wrong:

```ts
formatRelativeDate("2024-03-15T10:00:00", "en-US", {
  reference: "2024-03-15", // datetime as value, date as reference
}); // ""
```

Correct: match shapes — use `formatRelativeDateTime` for datetimes, `formatRelativeDate` for dates, etc.

Source: each relative formatter validates its input shape and returns `""` on mismatch.

### HIGH Hand-rolling diff math with `Date`

Wrong:

```ts
const diffMs = new Date(value).getTime() - new Date(ref).getTime();
const label = `${Math.round(diffMs / 60000)} minutes ago`; // ignores locale, DST
```

Correct:

```ts
import { formatRelativeDateTime } from "@northguild/gmt";

formatRelativeDateTime(value, locale, { reference: ref });
```

Source: AGENTS.md — Never use JavaScript Date APIs.

### MEDIUM Picking the wrong formatter for a Unix value

Wrong:

```ts
import { formatRelativeUtc } from "@northguild/gmt/utc";

formatRelativeUtc(1710507600000, "en-US", { reference: 1710511200000 });
// "" — formatRelativeUtc expects ISO strings, not numbers
```

Correct:

```ts
import { formatRelativeUnix } from "@northguild/gmt/unix";

formatRelativeUnix(1710507600000, "en-US", { reference: 1710511200000 });
// "1 hour ago"
```

Source: `packages/gmt/src/unix/format/formatRelativeUnix.ts`.

### LOW Relying on `"auto"` numeric for tomorrow/yesterday wording

`numeric: "auto"` produces the locale's natural words ("yesterday", "ayer", "gestern") only when the diff is exactly ±1 of the largest unit. Past that boundary it falls back to numeric ("2 days ago"). If you need a consistent word-form output, pair `numeric: "auto"` with `largestUnit` to force a specific bucket.

## References

- [Intl.RelativeTimeFormat documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat)
- [Format Date/Time skill](../format-date-time/SKILL.md) — for absolute formatting
- [Zoned date operations skill](../zoned-date-ops/SKILL.md) — for timezone-aware operations
