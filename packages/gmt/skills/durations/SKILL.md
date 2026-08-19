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
  roundingIncrement/roundingMode/relativeTo, and formatDuration to render a
  duration as a human-readable, locale-aware string (e.g. "1 day, 2 hours, and
  30 minutes").
sources:
  - 'burglekitt/gmt:packages/gmt/src/duration/index.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/calculate/diffDateAsDuration.ts'
  - 'burglekitt/gmt:packages/gmt/src/plain/calculate/diffDateTimeAsDuration.ts'
  - 'burglekitt/gmt:packages/gmt/src/zoned/calculate/diffZonedAsDuration.ts'
  - 'burglekitt/gmt:packages/gmt/src/unix/calculate/diffUnixAsDuration.ts'
  - 'burglekitt/gmt:packages/gmt/src/utc/calculate/diffUtcAsDuration.ts'
metadata:
  type: core
  library: '@burglekitt/gmt'
  library_version: '1.10.0'
---

# Durations

Use this skill when you need to parse, validate, re-normalize, or format ISO 8601 duration strings — distinct from date/time arithmetic, which takes a `{ unit: number }` object rather than a duration string. See the `calculate-dates` skill for `add*`/`subtract*`/`diff*`.

## Setup

```ts
import {
  addDuration,
  formatDuration,
  isValidDuration,
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

### MEDIUM Combining calendar-unit durations without relativeTo

Wrong:

```ts
import { addDuration } from "@burglekitt/gmt";

// years/months/weeks arithmetic needs a reference point Temporal.Duration
// doesn't have — this throws internally and returns "" rather than combining
const result = addDuration("P1Y", "P1M"); // ""
```

Correct: only combine day/time-unit durations (days, hours, minutes, seconds, ...) with `addDuration`/`subtractDuration`. For calendar-unit arithmetic relative to a specific date, use `addDate`/`subtractDate` with a unit object instead.

Source: packages/gmt/src/duration/calculate/addDuration.ts — `Temporal.Duration.prototype.add`/`.subtract` have no `relativeTo` option, so calendar-unit operands throw and result in `""`

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
