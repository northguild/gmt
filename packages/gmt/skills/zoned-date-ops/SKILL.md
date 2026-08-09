---
name: zoned-date-ops
description: >
  Work with timezone-aware dates and times using IANA timezone identifiers. Use
  getZonedNow, formatZonedDateTime, formatZonedRange, formatRelativeZoned,
  getSystemTimeZone, getTimeZones for the basics. Use
  convertPlainDateTimeToZoned, addZoned, subtractZoned, startOfZoned,
  endOfZoned, startOfQuarterForZoned, endOfQuarterForZoned, mapZonedHoursInDay,
  getLocaleZonedStartOfWeek, getLocaleZonedEndOfWeek, and their unix/
  counterparts (startOfUnix, endOfUnix, startOfQuarterForUnix,
  endOfQuarterForUnix) for DST-aware construction, arithmetic, and
  boundary/quarter/hour/locale-week computations — most accept a disambiguation
  option ("compatible" | "earlier" | "later" | "reject") for gap/overlap
  resolution, and the boundary family (including the locale-week functions) also
  accepts offset ("prefer" | "use" | "ignore" | "reject", default "ignore",
  which must stay default for disambiguation to work).
sources:
  - 'burglekitt/gmt:packages/gmt/src/zoned/get/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/format/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/addZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/subtractZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/startOfZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/endOfZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/startOfQuarterForZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/endOfQuarterForZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/getLocaleZonedStartOfWeek.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/getLocaleZonedEndOfWeek.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/map/mapZonedHoursInDay.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/startOfUnix.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/endOfUnix.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/startOfQuarterForUnix.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/endOfQuarterForUnix.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.7.0'
---

# Zoned Date Operations

Use this skill when you need timezone-aware date/time operations.

## Setup

```ts
import { getZonedNow, getZonedToday } from "@burglekitt/gmt/zoned";
import { getSystemTimeZone, getTimeZones } from "@burglekitt/gmt/zoned";
import { formatZonedDateTime } from "@burglekitt/gmt/zoned";
import { isValidTimeZone } from "@burglekitt/gmt/zoned";
```

## Core Patterns

### Get the system timezone

```ts
import { getSystemTimeZone } from "@burglekitt/gmt/zoned";

const tz = getSystemTimeZone(); // "America/New_York"
```

### Get all available IANA timezones

```ts
import { getTimeZones } from "@burglekitt/gmt/zoned";

const timeZones = getTimeZones(); // ["America/New_York", "Europe/London", ...]
timeZones.length; // ~422 (varies by runtime/ICU)
```

### Get current time in timezone

```ts
import { getZonedNow } from "@burglekitt/gmt/zoned";

const now = getZonedNow("America/New_York"); // "2024-03-15T10:30:45"
```

### Get current date in timezone

```ts
import { getZonedToday } from "@burglekitt/gmt/zoned";

const today = getZonedToday("America/New_York"); // "2024-03-15"
```

### Get current time in UTC

```ts
import { getZonedNow } from "@burglekitt/gmt/zoned";

const utcNow = getZonedNow("UTC"); // "2024-03-15T14:30:45"
```

### Get current time in Europe/London

```ts
import { getZonedNow } from "@burglekitt/gmt/zoned";

const londonNow = getZonedNow("Europe/London"); // "2024-03-15T14:30:45"
```

### Format zoned datetime

```ts
import { formatZonedDateTime } from "@burglekitt/gmt/zoned";

const formatted = formatZonedDateTime("2024-03-15T14:30:45[America/New_York]", "en-US");
// "3/15/2024, 10:30:45 AM"
```

### Format zoned range

```ts
import { formatZonedRange } from "@burglekitt/gmt/zoned";

const from = "2024-02-29T10:00:00-05:00[America/New_York]";
const to = "2024-02-29T12:00:00-05:00[America/New_York]";
formatZonedRange(from, to, "en-US", { dateStyle: "long", timeStyle: "short" });
// "February 29, 2024, 10:00 AM – 12:00 PM"
```

> Both endpoints must share the same IANA timezone. Mismatched zones return `""`.

### Format relative zoned datetime (DST-safe)

```ts
import { formatRelativeZoned } from "@burglekitt/gmt/zoned";

const value = "2024-03-15T10:00:00-05:00[America/New_York]";
const reference = "2024-03-15T12:00:00-05:00[America/New_York]";
formatRelativeZoned(value, "en-US", { reference }); // "2 hours ago"
```

`formatRelativeZoned` computes the diff via `Temporal.ZonedDateTime` arithmetic, so it correctly handles DST transitions and spans that cross "fall back" / "spring forward" days.

### Validate timezone

```ts
import { isValidTimeZone } from "@burglekitt/gmt/zoned";

const valid = isValidTimeZone("America/New_York"); // true
const invalid = isValidTimeZone("Invalid/Zone"); // false
```

### Parse timezone from zoned string

```ts
import { parseTimezoneFromZoned } from "@burglekitt/gmt/zoned";

const tz = parseTimezoneFromZoned("2024-03-15T14:30:45[America/New_York]"); // "America/New_York"
```

### Get zoned date components

```ts
import { getYear, getMonth, getDay } from "@burglekitt/gmt/zoned";

const zoned = "2024-03-15T14:30:45[America/New_York]";
getYear(zoned); // 2024
getMonth(zoned); // 3
getDay(zoned); // 15
```

### Attach a timezone to a plain datetime (with DST disambiguation)

```ts
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt/zoned";

convertPlainDateTimeToZoned("2024-03-15T14:30:45", "America/New_York");
// "2024-03-15T14:30:45.000-04:00[America/New_York]"
```

Twice a year, the local time you pass in doesn't map 1:1 to a real instant:

- **Spring-forward gap**: clocks skip an hour, so a wall-clock time never happens (e.g. `2024-03-10T02:30:00` doesn't exist in `America/New_York`).
- **Fall-back overlap**: clocks repeat an hour, so a wall-clock time happens twice (e.g. `2024-11-03T01:30:00` occurs twice in `America/New_York`).

Pass `disambiguation` to control how that's resolved instead of silently guessing:

```ts
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt/zoned";

// Gap: 2024-03-10T02:30:00 doesn't exist in America/New_York.
convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York");
// "2024-03-10T03:30:00.000-04:00[America/New_York]" (default "compatible" == "later" for gaps)

convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "earlier",
});
// "2024-03-10T01:30:00.000-05:00[America/New_York]"

convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "reject",
});
// "" — no such local time exists

// Overlap: 2024-11-03T01:30:00 happens twice in America/New_York.
convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York");
// "2024-11-03T01:30:00.000-04:00[America/New_York]" (default "compatible" == "earlier" for overlaps)

convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York", {
  disambiguation: "later",
});
// "2024-11-03T01:30:00.000-05:00[America/New_York]"
```

`disambiguation` accepts `"compatible"` (default), `"earlier"`, `"later"`, or `"reject"`. See [DST Disambiguation](../../../../docs/dst-disambiguation.md) for the full explanation of gaps vs. overlaps.

### Add/subtract a duration from a zoned datetime (with partial DST disambiguation)

```ts
import { addZoned, subtractZoned } from "@burglekitt/gmt/zoned";

addZoned("2024-03-15T14:30:45[America/New_York]", { days: 1 });
// "2024-03-16T14:30:45-04:00[America/New_York]"

subtractZoned("2024-03-15T14:30:45[America/New_York]", { hours: 2 });
// "2024-03-15T12:30:45-04:00[America/New_York]"
```

Both accept the same `disambiguation` option as `convertPlainDateTimeToZoned`, but it only controls the result when the arithmetic **lands on a fall-back (DST-end) overlap** — it has **no effect** on a spring-forward (DST-start) gap landing, because Temporal's arithmetic already resolves gap landings internally before `disambiguation` is ever evaluated:

```ts
import { addZoned } from "@burglekitt/gmt/zoned";

// Fall-back overlap: adding 1 day lands on 2024-11-03T01:30:00, ambiguous in America/New_York.
addZoned("2024-11-02T01:30:00-04:00[America/New_York]", { days: 1 });
// "2024-11-03T01:30:00-04:00[America/New_York]" (default "compatible")

addZoned("2024-11-02T01:30:00-04:00[America/New_York]", { days: 1 }, {
  disambiguation: "later",
});
// "2024-11-03T01:30:00-05:00[America/New_York]" — the other occurrence

addZoned("2024-11-02T01:30:00-04:00[America/New_York]", { days: 1 }, {
  disambiguation: "reject",
});
// "" — ambiguous result rejected

// Spring-forward gap: adding 1 day lands on a wall-clock time that never happened.
// disambiguation has NO effect here — all four values return the same result.
addZoned("2024-03-09T02:30:00-05:00[America/New_York]", { days: 1 }, {
  disambiguation: "reject",
});
// "2024-03-10T03:30:00-04:00[America/New_York]" — does NOT throw/return ""
```

See [Which function do I actually need?](../../../../docs/dst-disambiguation.md#which-function-do-i-actually-need) for guidance on choosing between `convertPlainDateTimeToZoned` and `addZoned`/`subtractZoned`, and why the gap limitation exists.

### Jump to a boundary (start/end of unit, quarter, or hours-in-day — with full DST disambiguation)

```ts
import { startOfZoned, endOfZoned } from "@burglekitt/gmt/zoned";

startOfZoned("2024-03-15T14:30:45[America/New_York]", "month");
// "2024-03-01T00:00:00-05:00[America/New_York]"

endOfZoned("2024-03-15T14:30:45[America/New_York]", "hour");
// "2024-03-15T14:59:59.999999999-04:00[America/New_York]"
```

`startOfZoned`, `endOfZoned`, `startOfQuarterForZoned`, `endOfQuarterForZoned`, `mapZonedHoursInDay`, and the `unix/` counterparts `startOfUnix`, `endOfUnix`, `startOfQuarterForUnix`, `endOfQuarterForUnix` all accept `disambiguation`, same as `convertPlainDateTimeToZoned` — full control over both gaps and overlaps, unlike `addZoned`/`subtractZoned`. But they also accept a second option, `offset` (`"prefer" | "use" | "ignore" | "reject"`, defaulting to `"ignore"`), that `disambiguation` alone doesn't fully control without:

```ts
import { startOfZoned } from "@burglekitt/gmt/zoned";

// 2024-11-03T01:45:00-05:00 is the SECOND, repeated 1am of the fall-back overlap.
const source = "2024-11-03T01:45:00-05:00[America/New_York]";

startOfZoned(source, "hour", { disambiguation: "reject" });
// "" — offset defaults to "ignore", so disambiguation actually fires

startOfZoned(source, "hour", { disambiguation: "reject", offset: "prefer" });
// "2024-11-03T01:00:00-05:00[America/New_York]" — offset:"prefer" keeps the
// source's still-valid offset, so disambiguation is never consulted
```

Leave `offset` at its default unless you deliberately need Temporal's raw `.with()` semantics. See [The offset parameter](../../../../docs/dst-disambiguation.md#the-offset-parameter) for the full mechanism.

### Get locale-aware week boundaries (with full DST disambiguation)

```ts
import { getLocaleZonedStartOfWeek, getLocaleZonedEndOfWeek } from "@burglekitt/gmt/zoned";

getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "en-US");
// "2024-02-25T00:00:00+00:00[UTC]" (Sunday, en-US weeks start Sunday)

getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "fr-FR");
// "2024-02-26T00:00:00+00:00[UTC]" (Monday, fr-FR weeks start Monday)

getLocaleZonedEndOfWeek("2024-02-29T12:00:00+00:00[UTC]", "en-US");
// "2024-03-02T23:59:59+00:00[UTC]" (Saturday)
```

Like `startOfZoned`/`endOfZoned`, these derive the week's first day from the locale (via `Intl.Locale.prototype.weekInfo`, same as the plain `getLocaleStartOfWeek`/`getLocaleEndOfWeek` in the `calculate-dates` skill) instead of taking an explicit `weekStartsOn` option, and accept the same `disambiguation`/`offset` options as the rest of the boundary family — `offset` must stay at its default `"ignore"` for `disambiguation` to actually take effect on the week-boundary time-of-day reset. Both return `""` for invalid `value` or an unresolvable `locale`.

## Timezone List

Common IANA timezone identifiers:

| Region | Example |
|--------|---------|
| US | America/New_York, America/Los_Angeles, America/Chicago |
| Europe | Europe/London, Europe/Paris, Europe/Berlin |
| Asia | Asia/Tokyo, Asia/Shanghai, Asia/Singapore |
| Pacific | Pacific/Auckland, Pacific/Honolulu |
| UTC | UTC |

## Runtime ICU data

Zoned formatters delegate locale and timezone-name rendering to the host runtime's `Intl.DateTimeFormat`. Output therefore depends on the ICU data shipped with the running Node (or browser):

- **Full ICU** runtimes (official Node binaries from nodejs.org, all modern browsers) return fully localized strings — e.g. `formatZonedDateTime(value, "ko-KR", { dateStyle: "full", timeStyle: "full" })` includes `"오후"` and the long Korean timezone name `"대한민국 표준시"`.
- **Small/partial ICU** runtimes (some Node builds compiled with `--with-intl=small-icu` or repackaged distributions) fall back to English day periods and shorter timezone names — the same call may return `"PM"`, `"한국 표준시"`, or offset strings like `"GMT+9"`/`"GMT+03:00"` in place of long zone names.

This is a property of the runtime, not gmt. For consistent non-English output, deploy on a full-ICU Node build or polyfill `Intl` with a package that bundles locale data.

## Common Mistakes

### HIGH Using offset instead of IANA timezone

Wrong:

```ts
const zoned = "2024-03-15T14:30:45-05:00"; // offset, not timezone
```

Correct:

```ts
import { isValidTimeZone } from "@burglekitt/gmt/zoned";

const zoned = "2024-03-15T14:30:45[America/New_York]"; // IANA timezone
```

Source: Temporal spec — requires IANA timezone identifier

### HIGH Not validating timezone before use

Wrong:

```ts
const time = getZonedNow("Invalid/Zone"); // may return ""
```

Correct:

```ts
import { getZonedNow, isValidTimeZone } from "@burglekitt/gmt/zoned";

const tz = "America/New_York";
if (!isValidTimeZone(tz)) {
  throw new Error("Invalid timezone");
}
const time = getZonedNow(tz);
```

Source: packages/gmt/src/zoned/validate/isValidTimeZone.ts — Validate first

### MEDIUM DST not handled

Wrong:

```ts
// Assume same behavior year-round
const time = getZonedNow("America/New_York"); // different in summer vs winter
```

Correct:

```ts
// Temporal handles DST automatically
import { getZonedNow } from "@burglekitt/gmt/zoned";

const time = getZonedNow("America/New_York");
// Returns correct time regardless of DST
```

Source: Temporal.ZonedDateTime — handles DST transitions

### MEDIUM Ignoring DST gap/overlap ambiguity when converting a plain datetime

Wrong:

```ts
// Silently accepts whatever Temporal's default ("compatible") resolves to,
// even for a local time that's ambiguous (fall-back) or doesn't exist (spring-forward).
const zoned = convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York");
```

Correct:

```ts
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt/zoned";

// Be explicit about which occurrence you mean, or reject ambiguous input outright.
const zoned = convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York", {
  disambiguation: "reject", // "" if this local time is ambiguous or nonexistent
});
```

Source: packages/gmt/src/zoned/convert/convertPlainDateTimeToZoned.ts — `disambiguation` option

### MEDIUM Assuming `addZoned`/`subtractZoned`'s `disambiguation: "reject"` catches DST gaps

Wrong:

```ts
// Assumes "reject" will throw/return "" if the arithmetic result lands in a
// spring-forward gap — it won't. Only fall-back overlaps are rejectable here.
const zoned = addZoned("2024-03-09T02:30:00-05:00[America/New_York]", { days: 1 }, {
  disambiguation: "reject",
});
// Silently returns a valid result, not ""
```

Correct:

```ts
import { addZoned } from "@burglekitt/gmt/zoned";

// If you need gap-rejection too, validate the result separately —
// convertPlainDateTimeToZoned's "reject" does see gaps.
const added = addZoned(value, { days: 1 });
// ...then re-validate `added`'s local time through convertPlainDateTimeToZoned
// with { disambiguation: "reject" } if gap-safety matters for your domain.
```

Source: packages/gmt/src/zoned/calculate/addZoned.ts — `disambiguation` has no effect on spring-forward gaps; see [DST Disambiguation](../../../../docs/dst-disambiguation.md)

### MEDIUM Passing `offset: "prefer"` and expecting `disambiguation` to still fire

Wrong:

```ts
// Expects "reject" to throw on this fall-back overlap, but offset:"prefer"
// keeps the source's still-valid offset before disambiguation is ever consulted.
const start = startOfZoned("2024-11-03T01:45:00-05:00[America/New_York]", "hour", {
  disambiguation: "reject",
  offset: "prefer",
});
// "2024-11-03T01:00:00-05:00[America/New_York]" — does NOT throw/return ""
```

Correct:

```ts
import { startOfZoned } from "@burglekitt/gmt/zoned";

// Leave offset at its default ("ignore") so disambiguation actually takes effect.
const start = startOfZoned("2024-11-03T01:45:00-05:00[America/New_York]", "hour", {
  disambiguation: "reject",
});
// "" — ambiguous, correctly rejected
```

Source: packages/gmt/src/zoned/calculate/startOfZoned.ts — `offset` defaults to `"ignore"` specifically so `disambiguation` works; see [The offset parameter](../../../../docs/dst-disambiguation.md#the-offset-parameter)

## References

- [Full zoned API](references/zoned-api.md)
- [IANA timezone database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
- [Temporal.ZonedDateTime](https://tc39.es/proposal-temporal/docs/zoneddatetime.html)