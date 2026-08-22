---
name: zoned-date-ops
description: >
  Work with timezone-aware dates and times using IANA timezone identifiers. Use
  getZonedNow, formatZonedDateTime, formatZonedRange, formatRelativeZoned,
  getSystemTimeZone, getTimeZones for basics. Use convertPlainDateTimeToZoned,
  addZoned, subtractZoned, startOfZoned, endOfZoned, startOfQuarterForZoned,
  endOfQuarterForZoned, mapZonedHoursInDay, getLocaleZonedStartOfWeek,
  getLocaleZonedEndOfWeek, clampZoned, closestZonedTo, getHoursInZonedDay,
  setZoned, setUnix, setUtc for DST-aware construction, arithmetic, boundaries,
  locale-week computations, day-length queries, and single-call field setting.
  Most accept disambiguation ("compatible" | "earlier" | "later" | "reject") for
  gap/overlap resolution; boundary and set* functions also accept offset
  ("prefer" | "use" | "ignore" | "reject", default "ignore"). Use
  getZonedOffset, getZonedOffsetAs, getTimeZoneOffset, formatTimeZoneName,
  isInDaylightSaving for reading a zoned value's UTC offset and DST status.
sources:
  - 'burglekitt/gmt:packages/gmt/src/zoned/get/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/format/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/validate/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/parse/getZonedOffset.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/parse/getZonedOffsetAs.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/compare/isInDaylightSaving.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/convert/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/addZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/subtractZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/startOfZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/endOfZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/startOfQuarterForZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/endOfQuarterForZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/getLocaleZonedStartOfWeek.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/getLocaleZonedEndOfWeek.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/clampZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/closestZonedTo.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/getHoursInZonedDay.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/map/mapZonedHoursInDay.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/startOfUnix.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/endOfUnix.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/startOfQuarterForUnix.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/endOfQuarterForUnix.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/setZoned.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/setUnix.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/calculate/setUtc.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.13.0'
---

# Zoned Date Operations

Use this skill when you need timezone-aware date/time operations.

## Setup

```ts
import {
  getZonedNow, getZonedToday, getSystemTimeZone, getTimeZones,
  isValidTimeZone, formatZonedDateTime, formatZonedRange, formatRelativeZoned,
  convertPlainDateTimeToZoned, addZoned, subtractZoned,
  startOfZoned, endOfZoned, startOfQuarterForZoned, endOfQuarterForZoned,
  getLocaleZonedStartOfWeek, getLocaleZonedEndOfWeek,
  clampZoned, closestZonedTo, mapZonedHoursInDay, getHoursInZonedDay,
  setZoned, getZonedOffset, getZonedOffsetAs, getTimeZoneOffset,
  formatTimeZoneName, isInDaylightSaving
} from "@burglekitt/gmt/zoned";
```

## Core Patterns

### Get current time in a timezone

```ts
const now = getZonedNow("America/New_York"); // "2024-03-15T10:30:45"
const today = getZonedToday("America/New_York"); // "2024-03-15"
```

### Format zoned datetime

```ts
formatZonedDateTime("2024-03-15T14:30:45[America/New_York]", "en-US");
// "3/15/2024, 10:30:45 AM"
```

### Format zoned range

```ts
const from = "2024-02-29T10:00:00-05:00[America/New_York]";
const to = "2024-02-29T12:00:00-05:00[America/New_York]";
formatZonedRange(from, to, "en-US", { dateStyle: "long", timeStyle: "short" });
// "February 29, 2024, 10:00 AM – 12:00 PM"
```

> Both endpoints must share the same IANA timezone. Mismatched zones return `""`.

### Format relative zoned datetime (DST-safe)

```ts
const value = "2024-03-15T10:00:00-05:00[America/New_York]";
const reference = "2024-03-15T12:00:00-05:00[America/New_York]";
formatRelativeZoned(value, "en-US", { reference }); // "2 hours ago"
```

`formatRelativeZoned` computes the diff via `Temporal.ZonedDateTime` arithmetic, so it correctly handles DST transitions.

### Validate and parse timezone

```ts
isValidTimeZone("America/New_York"); // true
parseTimezoneFromZoned("2024-03-15T14:30:45[America/New_York]"); // "America/New_York"
```

### Get zoned date components

```ts
const zoned = "2024-03-15T14:30:45[America/New_York]";
getYear(zoned); // 2024
getMonth(zoned); // 3
getDay(zoned); // 15
```

### Convert plain datetime to zoned (with DST disambiguation)

```ts
convertPlainDateTimeToZoned("2024-03-15T14:30:45", "America/New_York");
// "2024-03-15T14:30:45.000-04:00[America/New_York]"
```

Pass `disambiguation` to control gap/overlap resolution: `"compatible"` (default), `"earlier"`, `"later"`, or `"reject"`. See [DST Disambiguation](../../../../docs/dst-disambiguation.md).

### Add/subtract duration from zoned datetime

```ts
addZoned("2024-03-15T14:30:45[America/New_York]", { days: 1 });
// "2024-03-16T14:30:45-04:00[America/New_York]"
```

Same `disambiguation` option, but it only affects fall-back overlaps — it has **no effect** on spring-forward gaps. See [DST Disambiguation](../../../../docs/dst-disambiguation.md#which-function-do-i-actually-need).

### Jump to boundary (start/end of unit, quarter, hours-in-day)

```ts
startOfZoned("2024-03-15T14:30:45[America/New_York]", "month");
// "2024-03-01T00:00:00-05:00[America/New_York]"

endOfZoned("2024-03-15T14:30:45[America/New_York]", "hour");
// "2024-03-15T14:59:59.999999999-04:00[America/New_York]"
```

These accept `disambiguation` (full gap/overlap control) and `offset` (`"prefer" | "use" | "ignore" | "reject"`, default `"ignore"`). Leave `offset` at default unless you deliberately need Temporal's raw `.with()` semantics. See [The offset parameter](../../../../docs/dst-disambiguation.md#the-offset-parameter).

### Set one or more fields directly

```ts
setZoned("2024-03-15T14:30:45[America/New_York]", { hour: 9 });
// "2024-03-15T09:30:45-04:00[America/New_York]"

setZoned(
  "2024-11-03T01:45:00-05:00[America/New_York]",
  { minute: 0 },
  { disambiguation: "reject" },
);
// "" — offset defaults to "ignore" so disambiguation actually fires on this fall-back overlap
```

`setZoned`/`setUnix`/`setUtc` wrap `Temporal.ZonedDateTime.prototype.with()`, resolving every supplied field in a single atomic overflow pass — the safe alternative to composing `addZoned()`/`addUnix()`/`addUtc()` calls field-by-field, and the only construction path that can reproduce `startOfZoned`'s disambiguation-plus-offset handling (`addZoned()` has no `offset` control equivalent, because `ZonedDateTime.prototype.add()` doesn't accept `disambiguation`/`offset` at all). They accept `disambiguation`, `offset` (default `"ignore"`, same rule as the `startOfZoned` family), and `overflow` (real effect here, since fields are caller-supplied rather than fixed literals). `setUtc`'s `disambiguation`/`offset` are accepted for signature consistency but are permanently inert — `"UTC"` has no DST transitions.

### Get the number of hours in a zoned calendar day

```ts
getHoursInZonedDay("2024-03-10T12:00:00-04:00[America/New_York]");
// 23 — spring-forward day "loses" an hour

getHoursInZonedDay("2024-11-03T12:00:00-05:00[America/New_York]");
// 25 — fall-back day "gains" an hour

getHoursInZonedDay("2024-02-29T12:00:00+00:00[UTC]");
// 24 — normal day
```

Returns `23`, `24`, or `25` depending on whether the local calendar day contains a DST transition — or a fractional value for zones whose DST shift isn't a whole hour (e.g. `Australia/Lord_Howe`'s 30-minute shift returns `23.5`/`24.5`). Returns `null` for invalid input. This is zoned-only — timezone-free days are always 24 hours.

### Locale-aware week boundaries

```ts
getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "en-US");
// "2024-02-25T00:00:00+00:00[UTC]" (Sunday)

getLocaleZonedStartOfWeek("2024-02-29T12:00:00+00:00[UTC]", "fr-FR");
// "2024-02-26T00:00:00+00:00[UTC]" (Monday)
```

Derives the week's first day from the locale (same as plain `getLocaleStartOfWeek`/`getLocaleEndOfWeek`). Accepts `disambiguation`/`offset` options; `offset` must stay at `"ignore"` for `disambiguation` to take effect.

### Clamp a zoned datetime to a range

```ts
clampZoned(
  "2024-03-15T12:00:00[America/New_York]",
  "2024-03-01T00:00:00[America/New_York]",
  "2024-03-31T23:59:59[America/New_York]",
);
// "2024-03-15T12:00:00-04:00[America/New_York]"
```

### Find nearest zoned datetime to a target

```ts
closestZonedTo(
  "2024-03-15T12:00:00[America/New_York]",
  ["2024-03-01T00:00:00[America/New_York]", "2024-03-20T00:00:00[America/New_York]"],
);
// "2024-03-18T00:00:00-04:00[America/New_York]"
```

Returns `null` for empty candidates or invalid target.

### Read a zoned value's UTC offset

```ts
getZonedOffset("2024-07-15T12:00:00-04:00[America/New_York]"); // "-04:00"
getZonedOffsetAs("2024-07-15T12:00:00-04:00[America/New_York]", "minutes"); // -240
getTimeZoneOffset("America/New_York", "2024-07-15T12:00:00Z"); // "-04:00"
```

`getZonedOffset`/`getZonedOffsetAs` read the offset off an existing zoned value. `getTimeZoneOffset` looks one up for a bare timezone + instant, without needing a zoned value in hand.

### Format a timezone's display name

```ts
formatTimeZoneName("America/New_York", "en-US", { style: "shortGeneric" }); // "ET"
formatTimeZoneName("America/New_York", "en-US", { style: "long" }); // "Eastern Standard Time" or "Eastern Daylight Time", depending on today's date
```

`style` covers all six `Intl.DateTimeFormatOptions` `timeZoneName` values. `"shortGeneric"`/`"longGeneric"` are season-independent (`"ET"`, `"Eastern Time"`); `"short"`/`"long"`/`"shortOffset"`/`"longOffset"` name the zone's *current* offset and flip between standard/daylight forms depending on when this is called — there's no instant parameter to pin it to.

### Check whether an instant is in daylight saving time

```ts
isInDaylightSaving("2024-07-15T12:00:00-04:00[America/New_York]"); // true
isInDaylightSaving("2024-01-15T12:00:00-05:00[America/New_York]"); // false
```

See the Common Mistakes entry below for how this differs from `hasDaylightSaving` and `getDstTransitions`.

## Timezone Reference

See [references/timezones.md](references/timezones.md) for common IANA timezone identifiers.

## Runtime ICU Data

Zoned formatters delegate locale and timezone-name rendering to the host runtime's `Intl.DateTimeFormat`. Output depends on ICU data shipped with the running Node or browser. For consistent non-English output, deploy on a full-ICU Node build or polyfill `Intl`.

## Common Mistakes

### Using offset instead of IANA timezone

Wrong: `"2024-03-15T14:30:45-05:00"`
Correct: `"2024-03-15T14:30:45[America/New_York]"`

### Not validating timezone before use

Wrong: `getZonedNow("Invalid/Zone")` — may return `""`
Correct: validate with `isValidTimeZone()` first.

### Assuming `addZoned`/`subtractZoned` rejects DST gaps

`disambiguation: "reject"` only catches fall-back overlaps, not spring-forward gaps. Use `convertPlainDateTimeToZoned` with `disambiguation: "reject"` if you need gap-safety.

### Passing `offset: "prefer"` with `disambiguation`

`offset: "prefer"` keeps the source's offset before disambiguation is consulted, so `disambiguation` never fires. Leave `offset` at its default `"ignore"`.

### "I passed `disambiguation: 'reject'` to `setZoned` and it didn't throw"

This is the C3 silent-no-op trap, and `setZoned`/`setUnix` hit it head-on because they're `.with()`-based. `offset` defaults to `"ignore"` specifically so `disambiguation` takes effect — but if you've also passed `offset: "prefer"` (or anything other than `"ignore"`), the source's still-valid offset gets kept and `disambiguation` is silently never consulted:

```ts
const source = "2024-11-03T01:45:00-05:00[America/New_York]"; // second, repeated 1am of the fall-back overlap

setZoned(source, { minute: 0 }, { disambiguation: "reject" });
// "" — offset defaults to "ignore", so disambiguation actually fires and "reject" throws

setZoned(source, { minute: 0 }, { disambiguation: "reject", offset: "prefer" });
// "2024-11-03T01:00:00-05:00[America/New_York]" — offset:"prefer" keeps the source's
// still-valid -05:00 offset, so disambiguation is never consulted and "reject" never fires
```

Leave `offset` at its default unless you deliberately need Temporal's raw `.with()` semantics. See [The offset parameter](../../../../docs/dst-disambiguation.md#the-offset-parameter).

### Confusing `hasDaylightSaving`, `getDstTransitions`, and `isInDaylightSaving`

The names are close enough to be misread. Four different DST-related questions, four different functions:

| Question | Function | Scope |
| --- | --- | --- |
| Does this zone observe DST at all? | `hasDaylightSaving(timeZone)` | Zone-level, no instant |
| Where do this zone's transitions fall? | `getDstTransitions(timeZone, year)` | Enumerates instants |
| Is *this particular instant* currently in DST? | `isInDaylightSaving(value)` | A single zoned value |
| What happens when construction lands on an ambiguous/nonexistent instant? | `disambiguation` / `offset` | Orthogonal — a construction-time choice, not a query |

Picking the wrong one is a common mistake: `hasDaylightSaving("America/New_York")` is `true` year-round (the zone observes DST), which tells you nothing about whether a *specific* March 15th value is currently in it — that's `isInDaylightSaving`'s job.

## References

- [Common IANA timezones](references/timezones.md)
- [DST Disambiguation](../../../../docs/dst-disambiguation.md)
- [Temporal.ZonedDateTime](https://tc39.es/proposal-temporal/docs/zoneddatetime.html)
