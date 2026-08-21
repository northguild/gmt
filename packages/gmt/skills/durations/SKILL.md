---
name: durations
description: >
  Parse, validate, combine, rebalance, and format ISO 8601 duration strings
  (e.g. "P1DT2H30M"). Use isValidDuration to check a duration string is
  well-formed, parseDuration to normalize one and optionally control its output
  precision/rounding via smallestUnit, fractionalSecondDigits, and roundingMode,
  addDuration / subtractDuration to combine two duration strings,
  normalizeDuration to roll small units into larger ones (e.g. 90 minutes into 1
  hour 30 minutes) via largestUnit/smallestUnit/
  roundingIncrement/roundingMode/relativeTo, getDurationUnit to read one stored
  component, durationAs to total a duration into a single unit, negateDuration /
  absDuration to flip or drop its sign, getDurationSign to test whether it is
  negative/zero/positive, compareDurations to order two durations by length, and
  formatDuration to render a duration as a human-readable, locale-aware string
  (e.g. "1 day, 2 hours, and 30 minutes").
sources:
  - 'burglekitt/gmt:packages/gmt/src/duration/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/duration/calculate/getDurationUnit.ts'
  - 'burglekitt/gmt:packages/gmt/src/duration/calculate/durationAs.ts'
  - 'burglekitt/gmt:packages/gmt/src/duration/calculate/negateDuration.ts'
  - 'burglekitt/gmt:packages/gmt/src/duration/calculate/absDuration.ts'
  - 'burglekitt/gmt:packages/gmt/src/duration/calculate/getDurationSign.ts'
  - 'burglekitt/gmt:packages/gmt/src/duration/compare/compareDurations.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/calculate/diffDateAsDuration.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/calculate/diffDateTimeAsDuration.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/diffZonedAsDuration.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/diffUnixAsDuration.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/calculate/diffUtcAsDuration.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.12.0'
---

# Durations

Use this skill when you need to parse, validate, re-normalize, or format ISO 8601 duration strings — distinct from date/time arithmetic, which takes a `{ unit: number }` object rather than a duration string. See the `calculate-dates` skill for `add*`/`subtract*`/`diff*`.

## Setup

```ts
import {
  absDuration,
  addDuration,
  compareDurations,
  durationAs,
  formatDuration,
  getDurationSign,
  getDurationUnit,
  isValidDuration,
  negateDuration,
  normalizeDuration,
  parseDuration,
  subtractDuration,
} from "@burglekitt/gmt";
```

## Core Patterns

### Validate an ISO 8601 duration string

```ts
const valid = isValidDuration("P1DT2H30M"); // true
const invalid = isValidDuration("not a duration"); // false
const empty = isValidDuration(""); // false
```

### Parse and re-normalize a duration string

```ts
const result = parseDuration("P1DT2H30M"); // "P1DT2H30M"
const invalid = parseDuration("not a duration"); // ""
```

### Round a duration's output precision

```ts
// smallestUnit rounds down to whole units of the given granularity
const rounded = parseDuration("PT1.5S", { smallestUnit: "second" }); // "PT1S"

// fractionalSecondDigits pads/truncates the fractional-seconds component
const padded = parseDuration("PT1.5S", { fractionalSecondDigits: 3 }); // "PT1.500S"

// roundingMode controls how rounding is performed (default halfExpand)
const truncated = parseDuration("PT1.9S", {
  smallestUnit: "second",
  roundingMode: "trunc",
}); // "PT1S"
```

### Combine two duration strings

```ts
const combined = addDuration("P1D", "PT2H"); // "P1DT2H"
const remainder = subtractDuration("P1D", "PT2H"); // "PT22H"
const negative = subtractDuration("PT1H", "PT2H"); // "-PT1H"
```

### Roll small units into larger ones

```ts
// largestUnit promotes into a bigger unit
const promoted = normalizeDuration("PT90M", { largestUnit: "hour" }); // "PT1H30M"

// smallestUnit rounds off sub-unit precision, no largestUnit required
const rounded = normalizeDuration("PT90M30S", { smallestUnit: "minute" }); // "PT91M"

// no options defaults to largestUnit: "auto" — reformats without promoting
const reformatted = normalizeDuration("PT90M"); // "PT90M" (unchanged)

// calendar units (year/month/week) need relativeTo as a reference point
const noRef = normalizeDuration("P45D", { largestUnit: "month" }); // ""
const withRef = normalizeDuration("P45D", {
  largestUnit: "month",
  relativeTo: "2024-01-01",
}); // "P1M14D"
```

### Read one component out of a duration

`getDurationUnit` returns the component **as stored**, not a converted total.

```ts
const hours = getDurationUnit("P1DT2H30M", "hours"); // 2
const minutes = getDurationUnit("P1DT2H30M", "minutes"); // 30

// "PT90M" stores 90 in its minutes field and nothing in its hours field
const noHours = getDurationUnit("PT90M", "hours"); // 0

// a negative duration stores every field as negative
const negative = getDurationUnit("-P1DT2H", "hours"); // -2

// reading a field is not a unit conversion, so calendar units need no relativeTo
const months = getDurationUnit("P1M", "months"); // 1

const invalid = getDurationUnit("not a duration", "hours"); // null
```

### Total a duration into a single unit

`durationAs` converts the whole duration and returns a fractional number.

```ts
const asHours = durationAs("P1DT2H30M", "hours"); // 26.5
const asMinutes = durationAs("P1DT2H30M", "minutes"); // 1590
const asDays = durationAs("PT36H", "days"); // 1.5 — fractional, not rounded

// calendar units need a relativeTo anchor, in either direction
const noAnchor = durationAs("P1M", "days"); // null
const feb = durationAs("P1M", "days", { relativeTo: "2024-02-01" }); // 29
const jan = durationAs("P1M", "days", { relativeTo: "2024-01-01" }); // 31

// a zoned anchor resolves real elapsed time across a DST transition
const springForward = durationAs("P1D", "hours", {
  relativeTo: "2024-03-10T00:00:00-05:00[America/New_York]",
}); // 23
```

### Flip, drop, or test a duration's sign

```ts
const negated = negateDuration("P1DT2H"); // "-P1DT2H"
const backAgain = negateDuration("-P1DT2H"); // "P1DT2H"
const positive = absDuration("-P1DT2H"); // "P1DT2H"

const sign = getDurationSign("-P1DT2H"); // -1
const zero = getDurationSign("PT0S"); // 0
const invalid = getDurationSign("not a duration"); // null

// all three are pure sign operations — calendar units work, no relativeTo needed
const negatedMonth = negateDuration("P1Y2M"); // "-P1Y2M"
```

### Compare two durations by length

```ts
const longer = compareDurations("PT1H", "PT30M"); // 1
const shorter = compareDurations("PT30M", "PT1H"); // -1

// equal by length, not by spelling
const equal = compareDurations("PT60M", "PT1H"); // 0

// unlike addDuration, Temporal.Duration.compare DOES take relativeTo, so
// calendar-unit durations are comparable — the anchor decides the answer
const noAnchor = compareDurations("P1M", "P30D"); // null
const fromJan = compareDurations("P1M", "P30D", { relativeTo: "2024-01-01" }); // 1
const fromFeb = compareDurations("P1M", "P30D", { relativeTo: "2024-02-01" }); // -1
```

### Render a duration as human-readable text

```ts
const long = formatDuration("P1DT2H30M", "en-US");
// "1 day, 2 hours, and 30 minutes"

const short = formatDuration("P1DT2H30M", "en-US", { style: "short" });
// "1 day, 2 hr, & 30 min"

const narrow = formatDuration("P1DT2H30M", "en-US", { style: "narrow" });
// "1d, 2h, & 30m"

// zero-valued components are omitted by default
const noZeros = formatDuration("P1DT0H30M", "en-US"); // "1 day and 30 minutes"
const withZeros = formatDuration("P1DT0H30M", "en-US", { zero: true });
// "0 years, 0 months, 0 weeks, 1 day, 0 hours, 30 minutes, and 0 seconds"

// a zero-length duration always renders "0 seconds"
const zero = formatDuration("PT0S", "en-US"); // "0 seconds"
```

### Bridge a diff into an ISO duration string

`diffDate`/`diffDateTime`/`diffZoned`/`diffUnix`/`diffUtc` return a single-unit number (or a `Record<Unit, number>` for an array of units). Their `*AsDuration` siblings return an ISO 8601 duration string instead — the same string shape every other function in this skill consumes/produces.

```ts
import { diffDateAsDuration, diffZonedAsDuration } from "@burglekitt/gmt";

const span = diffDateAsDuration("2024-03-10", "2024-04-05", "days"); // "P26D"

const negative = diffDateAsDuration("2024-04-05", "2024-03-10", "days"); // "-P26D"

const zoned = diffZonedAsDuration(
  "2024-03-09T12:00:00-05:00[America/New_York]",
  "2024-03-11T12:00:00-04:00[America/New_York]",
  "days",
); // "P1DT23H" — real elapsed time across a DST spring-forward transition
```

Feed the result straight into a `duration` namespace function, e.g. `formatDuration(diffDateAsDuration(a, b, "days"), "en-US")`.

## Common Mistakes

### HIGH Confusing duration strings with unit objects

Wrong:

```ts
import { addDate } from "@burglekitt/gmt";

// addDate takes a { unit: number } object, not an ISO duration string
const result = addDate("2024-03-15", "P5D");
```

Correct:

```ts
import { addDate } from "@burglekitt/gmt";

const result = addDate("2024-03-15", { days: 5 }); // "2024-03-20"
```

Source: packages/gmt/src/plain/calculate/addDate.ts — accepts `Partial<Record<DateDurationUnit, number>>`, not a duration string

### MEDIUM Not validating before parsing

Wrong:

```ts
const result = parseDuration(userInput);
// assume result is a valid duration string
useDuration(result);
```

Correct:

```ts
import { isValidDuration, parseDuration } from "@burglekitt/gmt";

if (!isValidDuration(userInput)) {
  throw new Error("Invalid duration");
}
const result = parseDuration(userInput);
```

Source: packages/gmt/src/duration/parse/parseDuration.ts — returns `""` on invalid input rather than throwing

### MEDIUM Expecting a best-effort answer for calendar units without relativeTo

`"P1M"` has no fixed length, so nothing in this namespace will guess one for you. Every function that has to *measure* a duration returns its sentinel (`""` for strings, `null` for numbers) when a year/month/week is involved and no `relativeTo` anchor was supplied — it does not fall back to a nominal 30-day month.

Wrong:

```ts
import { addDuration, compareDurations, durationAs } from "@burglekitt/gmt";

const combined = addDuration("P1Y", "P1M"); // ""
const asDays = durationAs("P1M", "days"); // null — not 30
const ordered = compareDurations("P1M", "P30D"); // null
```

Correct: supply `relativeTo` wherever the function accepts one. Note the three tiers, which differ by what Temporal itself allows:

```ts
import {
  absDuration,
  compareDurations,
  durationAs,
  getDurationSign,
  getDurationUnit,
  negateDuration,
  normalizeDuration,
} from "@burglekitt/gmt";

// 1. Takes relativeTo — pass it and calendar units work
durationAs("P1M", "days", { relativeTo: "2024-02-01" }); // 29
compareDurations("P1M", "P30D", { relativeTo: "2024-01-01" }); // 1
normalizeDuration("P45D", { largestUnit: "month", relativeTo: "2024-01-01" }); // "P1M14D"

// 2. Never needs relativeTo — reads a stored field or flips a sign, no measuring
getDurationUnit("P1M", "months"); // 1
getDurationSign("-P1Y"); // -1
negateDuration("P1Y2M"); // "-P1Y2M"
absDuration("-P1Y2M"); // "P1Y2M"

// 3. Has no relativeTo option at all — use addDate/subtractDate with a unit object
addDuration("P1Y", "P1M"); // "" — no way to make this work
```

`durationAs`'s rule cuts in both directions, and the requested-unit half bites even on day/time-only input:

```ts
durationAs("PT36H", "weeks"); // null — a week is a calendar quantity to Temporal
durationAs("P1M", "hours"); // null — the input's month component needs an anchor
```

The anchor decides the answer rather than merely unblocking it: `compareDurations("P1M", "P30D", { relativeTo: "2024-01-01" })` is `1` (January is 31 days) while the same call anchored to `"2024-02-01"` is `-1` (February 2024 is 29). It matters for non-calendar units too when the anchor names a zoned instant — `durationAs("P1D", "hours", { relativeTo: "2024-03-10T00:00:00-05:00[America/New_York]" })` is `23`, not `24`, because that day spans a DST spring-forward.

Source: packages/gmt/src/duration/calculate/addDuration.ts (`Temporal.Duration.prototype.add`/`.subtract` have no `relativeTo` option, so calendar-unit operands throw and result in `""`), packages/gmt/src/duration/calculate/durationAs.ts and packages/gmt/src/duration/compare/compareDurations.ts (`.total()` and `Temporal.Duration.compare` both accept `relativeTo` and require it for calendar units)

### HIGH Reading a component with getDurationUnit when you wanted a total

`getDurationUnit` reads the named field **as stored**; `durationAs` converts the whole duration. They disagree whenever the duration isn't already spelled in the unit you're asking for, and `getDurationUnit`'s wrong answer is a plausible-looking `0` rather than an error.

Wrong:

```ts
import { getDurationUnit } from "@burglekitt/gmt";

// "PT90M" holds 90 in its minutes field and nothing in its hours field
const hours = getDurationUnit("PT90M", "hours"); // 0, not 1.5
```

Correct:

```ts
import { durationAs, getDurationUnit } from "@burglekitt/gmt";

const total = durationAs("PT90M", "hours"); // 1.5 — the whole duration in hours
const stored = getDurationUnit("P1DT2H30M", "hours"); // 2 — the hours component itself
```

`durationAs` returns a fractional total and never rounds — `durationAs("P1DT2H30M", "days")` is `1.1041666666666667`. If you want a rebalanced duration *string* rather than a number, reach for `normalizeDuration("PT90M", { largestUnit: "hour" })` instead.

Source: packages/gmt/src/duration/calculate/getDurationUnit.ts (reads `Temporal.Duration`'s field directly) vs. packages/gmt/src/duration/calculate/durationAs.ts (wraps `Temporal.Duration.prototype.total`)

### MEDIUM Assuming `normalizeDuration`'s default is always `relativeTo`-free

Wrong:

```ts
import { normalizeDuration } from "@burglekitt/gmt";

// input already has a month component — the "auto" default does NOT
// exempt calendar-unit inputs, this still throws internally and returns ""
const result = normalizeDuration("P1M"); // ""
```

Correct: pass `relativeTo` whenever a calendar unit (year/month/week) is involved — either as an explicit `largestUnit`, or because the input duration itself already has a nonzero year/month/week component, even under the default `{ largestUnit: "auto" }`.

```ts
import { normalizeDuration } from "@burglekitt/gmt";

const result = normalizeDuration("P1M", {
  largestUnit: "day",
  relativeTo: "2024-01-01",
}); // "P31D"
```

Source: packages/gmt/src/duration/normalize/normalizeDuration.ts — `Temporal.Duration.prototype.round` requires `relativeTo` for any week-or-larger unit, whether requested via `largestUnit` or already present in the duration being rounded

### MEDIUM Expecting `formatDuration` to match native `Intl.DurationFormat` output exactly

`formatDuration` does not use `Intl.DurationFormat` — that constructor is absent entirely on Node 20/22 (only ships natively on Node 24+), and GMT does not carry a polyfill dependency for it. Instead, `formatDuration` builds its output from `Intl.NumberFormat({ style: "unit" })` per component plus `Intl.ListFormat` for joining — both universally available, so behavior is identical across all supported Node versions, but output is not guaranteed byte-for-byte identical to what native `Intl.DurationFormat` would produce (e.g. no `"digital"` `01:30:00`-style output is supported).

Source: packages/gmt/src/duration/format/formatDuration.ts

### MEDIUM Passing an array of units to a `*AsDuration` bridge function

Wrong:

```ts
import { diffDateAsDuration } from "@burglekitt/gmt";

// diffDate accepts unit | unit[], but diffDateAsDuration only accepts a
// single unit — an array here fails validation and returns ""
const result = diffDateAsDuration("2024-03-10", "2024-04-05", ["days"]); // ""
```

Correct: pass a single unit. It only sets the resulting duration's `largestUnit` — an ISO duration string already expresses a full multi-unit breakdown (e.g. `"P1DT23H"`) without needing an array of requested units the way `diffDate`'s `Record<Unit, number>` return shape does.

```ts
import { diffDateAsDuration } from "@burglekitt/gmt";

const result = diffDateAsDuration("2024-03-10", "2024-04-05", "days"); // "P26D"
```

Source: packages/gmt/src/plain/calculate/diffDateAsDuration.ts (and its `diffDateTimeAsDuration`/`diffZonedAsDuration`/`diffUnixAsDuration`/`diffUtcAsDuration` siblings) — signature takes `unit: DateDurationUnit`, not `unit: DateDurationUnit | DateDurationUnit[]` like their counterparts

## References

- [Temporal.Duration](https://tc39.es/proposal-temporal/docs/duration.html)
