# @burglekitt/gmt

Give Me Temporal.

`@burglekitt/gmt` is a Temporal-first date and time library with a simple rule set:

- ISO 8601 strings in
- ISO 8601 strings, numbers, booleans, or arrays out
- no `Date`
- plain and zoned operations kept separate

It wraps `@js-temporal/polyfill` behind a smaller, more opinionated API aimed at the cases application code actually hits: arithmetic, comparison, parsing, formatting, unix conversions, timezone conversion, and validation.

**Status:** pre-alpha. Expect API movement while the surface is still being filled out.

## Install

```bash
npm install @burglekitt/gmt
```

```bash
pnpm add @burglekitt/gmt
```

## Design Philosophy

GMT enforces a strict input/output contract to keep behavior predictable and auditable:

- **Explicit inputs only**: Public APIs accept clearly defined shapes — ISO 8601 date/time strings, IANA timezone identifiers, or numeric Unix epoch values (explicitly seconds or milliseconds). We do not attempt to parse arbitrary or ambiguous date formats.
- **Predictable outputs**: Helpers return normalized values (ISO strings, numbers, booleans, or arrays). Invalid input yields typed fallbacks (`""`, `null`, or `false`) instead of throwing.
- **No fuzzy parsing**: Avoid "throw everything at the wall" patterns found in permissive libraries. If you need permissive parsing, perform it outside of `@burglekitt/gmt` and then canonicalize to the strict shapes before calling into gmt.
- **Developer comfort with standards**: The library's goal is to make developers comfortable and deliberate with ISO 8601, IANA timezones, UTC instants, and Unix epochs by keeping APIs small and explicit.

## Core Rules

| Rule                    | Current behavior                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------- |
| String-first API        | Public helpers consume ISO strings and return normalized strings where appropriate |
| Temporal-only internals | `Temporal` does the parsing and timezone math                                      |
| Plain/zoned separation  | `plain/*` is timezone-free, `zoned/*` is timezone-aware                            |
| No-throw public helpers | Invalid input returns a typed fallback instead of throwing                         |

Invalid input fallbacks are consistent across the library:

- string-returning helpers return `""`
- number-returning helpers return `null`
- boolean-returning helpers return `false`
- array-returning helpers return `[]`

## Package Layout

The package exports seven top-level namespaces:

```typescript
import {
  Temporal,
  duration,
  plain,
  zoned,
  unix,
  utc,
  regex,
} from "@burglekitt/gmt";
```

- `Temporal`: re-exported from `@js-temporal/polyfill`
- `duration`: ISO 8601 duration string parsing, validation, and arithmetic
- `plain`: timezone-free helpers
- `zoned`: timezone-aware helpers
- `unix`: Unix epoch (seconds or milliseconds) helpers
- `utc`: UTC instant helpers
- `regex`: low-level regex building blocks

You can also import subpaths directly:

```typescript
import { addDate, getNow, formatRelativeZoned } from "@burglekitt/gmt";
```

## Quick Start

### Plain arithmetic and comparisons

```typescript
import {
  addDate,
  areDatesEqual,
  diffDateTime,
  isBeforeDateTime,
} from "@burglekitt/gmt";

addDate("2026-01-01", 90, "day");
// "2026-03-32" is impossible, so Temporal normalizes correctly -> "2026-04-01"

diffDateTime("2024-03-17T12:00:00", "2024-03-17T12:30:00", "minute");
// 30

areDatesEqual("2026-03-17", "2026-03-17T09:00:00");
// true

isBeforeDateTime("2026-03-17T09:00:00", "2026-03-17T10:00:00");
// true
```

`add*`/`subtract*` accept an optional `overflow` (`"constrain"` (default) | `"reject"`) to control out-of-range results (e.g. adding a month to Jan 31), and `diff*` accept optional `smallestUnit`/`roundingIncrement`/`roundingMode` to round the computed difference:

```typescript
import { addDate, diffDate } from "@burglekitt/gmt";

addDate("2024-01-31", { months: 1 }, { overflow: "reject" });
// "" — Feb 31 doesn't exist and overflow: "reject" refuses to clamp it

diffDate("2023-01-01", "2023-01-10", "week", {
  smallestUnit: "week",
  roundingMode: "halfExpand",
});
// 1
```

### Durations

```typescript
import {
  addDuration,
  diffDateAsDuration,
  formatDuration,
  isValidDuration,
  normalizeDuration,
  parseDuration,
  subtractDuration,
} from "@burglekitt/gmt";

isValidDuration("P1DT2H30M");
// true

parseDuration("P1DT2H30M");
// "P1DT2H30M"

parseDuration("PT1.5S", { smallestUnit: "second", roundingMode: "trunc" });
// "PT1S"

parseDuration("not a duration");
// ""

addDuration("P1D", "PT2H");
// "P1DT2H"

subtractDuration("P1D", "PT2H");
// "PT22H"

normalizeDuration("PT90M", { largestUnit: "hour" });
// "PT1H30M"

normalizeDuration("P45D", { largestUnit: "month", relativeTo: "2024-01-01" });
// "P1M14D"

formatDuration("P1DT2H30M", "en-US");
// "1 day, 2 hours, and 30 minutes"

formatDuration("P1DT2H30M", "en-US", { style: "short" });
// "1 day, 2 hr, & 30 min"

formatDuration("P1DT0H30M", "en-US");
// "1 day and 30 minutes"

diffDateAsDuration("2024-03-10", "2024-04-05", "days");
// "P26D" — bridges diffDate to an ISO duration string instead of a single-unit number
```

`diffDateAsDuration`/`diffDateTimeAsDuration`/`diffZonedAsDuration`/`diffUnixAsDuration`/`diffUtcAsDuration` are sibling functions to `diffDate`/`diffDateTime`/`diffZoned`/`diffUnix`/`diffUtc`, returning an ISO 8601 duration string (sentinel `""`) instead of a single-unit number (sentinel `null`). They take a single `unit` (not an array) to set the duration's `largestUnit`.

### Zoned operations

```typescript
import { addZoned, formatZonedDateTime } from "@burglekitt/gmt";

addZoned("2026-03-07T23:00:00-05:00[America/New_York]", 2, "hour");
// "2026-03-08T01:00:00-05:00[America/New_York]"

formatZonedDateTime("2024-03-17T14:30:45+00:00[UTC]", "en-US", {
  dateStyle: "full",
  timeStyle: "short",
});
// locale-dependent non-empty formatted string
```

Twice a year, DST creates local times that don't exist (spring-forward gap) or happen twice (fall-back overlap). Functions that attach a timezone to a plain/local value accept an optional `disambiguation` (`"compatible"` (default) | `"earlier"` | `"later"` | `"reject"`) to control how that's resolved instead of silently guessing:

```typescript
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt";

// 2024-03-10T02:30:00 doesn't exist in America/New_York (clocks jump 2am -> 3am).
convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "reject",
});
// "" — no such local time exists
```

The `startOfZoned`/`endOfZoned`/`startOfQuarterForZoned`/`endOfQuarterForZoned`/`mapZonedHoursInDay` family (and their `unix/` counterparts) also accept `disambiguation`, plus an `offset` option (`"prefer"` | `"use"` | `"ignore"` (default) | `"reject"`) that controls whether the source's existing UTC offset is kept when computing the new boundary. **`offset` must stay at its default (`"ignore"`) for `disambiguation` to take effect** — Temporal's own default (`"prefer"`) keeps the source offset whenever still valid, which silently makes `disambiguation` a no-op:

```typescript
import { startOfZoned } from "@burglekitt/gmt";

// 2024-11-03T01:45:00-05:00 is the SECOND, repeated 1am of the fall-back overlap in America/New_York.
const source = "2024-11-03T01:45:00-05:00[America/New_York]";

startOfZoned(source, "hour", { disambiguation: "reject" });
// "" — offset defaults to "ignore", so disambiguation actually fires and "reject" throws

startOfZoned(source, "hour", { disambiguation: "reject", offset: "prefer" });
// "2024-11-03T01:00:00-05:00[America/New_York]" — offset:"prefer" keeps the source's
// still-valid -05:00 offset, so disambiguation is never consulted and "reject" never fires
```

`convertPlainDateTimeToZoned` and `addZoned`/`subtractZoned` also accept `offset` for API consistency, but it's permanently inert on both — their construction path never has a stored offset for it to act on.

See [`docs/dst-disambiguation.md`](../../docs/dst-disambiguation.md) for the full explanation, including why `overflow` was deliberately left off the public API.

### Formatting

```typescript
import {
  formatDate,
  formatRelativeDate,
  formatTime,
  formatRelativeTime,
  formatDateTime,
  formatRelativeDateTime,
  formatZonedDateTime,
  formatZonedRange,
  formatRelativeZoned,
  formatUtc,
  formatRelativeUtc,
  formatUnix,
  formatRelativeUnix,
} from "@burglekitt/gmt";

// Relative to "now" — auto-picks the best unit.
formatRelativeDate("2026-01-15");
// e.g. "3 months ago"

formatRelativeTime("14:30:00", "en-US", { style: "short" });
// e.g. "2 hours ago"

formatRelativeDateTime("2026-03-17T09:00:00", "en-GB", {
  style: "long",
  numeric: "always",
});
// e.g. "17 March, 2026 at 09:00"

// Zoned relative formatting — reference can be a ZonedDateTime, UTC string, or unix epoch.
formatRelativeZoned("2026-03-08T01:00:00-05:00[America/New_York]", "en-US");
// e.g. "tomorrow"

formatRelativeUtc("2024-03-17T14:30:45+00:00[UTC]", "en-US");
// e.g. "2 years ago"

// Unix epoch relative formatting.
formatRelativeUnix(1710685845000, "en-US", { epochUnit: "milliseconds" });
// e.g. "3 years ago"
```

### Unix and UTC helpers

```typescript
import { getUnixNow, getUtcNow, convertUnixToPlainDate } from "@burglekitt/gmt";

getUnixNow("milliseconds");
// 1710685845000

getUtcNow();
// "2026-03-18T11:42:33.123Z"

convertUnixToPlainDate(1710685845);
// "2024-03-17"
```

## API Surface

For the complete API listing, see the namespace documentation on GitHub:

- [Duration API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/duration) — ISO 8601 duration parsing, validation, arithmetic, and formatting
- [Plain API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/plain) — timezone-free operations
- [Zoned API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/zoned) — IANA timezone-aware operations
- [Unix API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/unix) — Unix epoch utilities
- [UTC API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/utc) — UTC instant utilities
- [Regex API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/regex) — composable regex patterns

## License

MIT — See [LICENSE](../../LICENSE) for details.
