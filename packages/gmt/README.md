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

| Rule | Current behavior |
|---|---|
| String-first API | Public helpers consume ISO strings and return normalized strings where appropriate |
| Temporal-only internals | `Temporal` does the parsing and timezone math |
| Plain/zoned separation | `plain/*` is timezone-free, `zoned/*` is timezone-aware |
| No-throw public helpers | Invalid input returns a typed fallback instead of throwing |

Invalid input fallbacks are consistent across the library:

- string-returning helpers return `""`
- number-returning helpers return `null`
- boolean-returning helpers return `false`
- array-returning helpers return `[]`

## Package Layout

The package exports four top-level namespaces:

```typescript
import { Temporal, plain, zoned, regex } from "@burglekitt/gmt";
```

- `Temporal`: re-exported from `@js-temporal/polyfill`
- `plain`: timezone-free helpers
- `zoned`: timezone-aware helpers
- `regex`: low-level regex building blocks

You can also import subpaths directly:

```typescript
import { addDate } from "@burglekitt/gmt/plain/calculate";
import { getNow } from "@burglekitt/gmt/plain/get";
```

## Quick Start

### Plain arithmetic and comparisons

```typescript
import { addDate, diffDateTime } from "@burglekitt/gmt/plain/calculate";
import { areDatesEqual, isBeforeDateTime } from "@burglekitt/gmt/plain/compare";

addDate("2026-01-01", 90, "day");
// "2026-03-32" is impossible, so Temporal normalizes correctly -> "2026-04-01"

diffDateTime("2024-03-17T12:00:00", "2024-03-17T12:30:00", "minute");
// 30

areDatesEqual("2026-03-17", "2026-03-17T09:00:00");
// true

isBeforeDateTime("2026-03-17T09:00:00", "2026-03-17T10:00:00");
// true
```

### Zoned operations

```typescript
import { addZoned } from "@burglekitt/gmt/zoned/calculate";
import { formatZonedDateTime } from "@burglekitt/gmt/zoned/format";

addZoned("2026-03-07T23:00:00-05:00[America/New_York]", 2, "hour");
// "2026-03-08T01:00:00-05:00[America/New_York]"

formatZonedDateTime("2024-03-17T14:30:45+00:00[UTC]", "en-US", {
  dateStyle: "full",
  timeStyle: "short",
});
// locale-dependent non-empty formatted string
```

### Unix and UTC helpers

```typescript
import { getUnixNow } from "@burglekitt/gmt/unix/get";
import { getUtcNow } from "@burglekitt/gmt/utc/get";
import { convertUnixToPlainDate } from "@burglekitt/gmt/unix/convert";

getUnixNow("milliseconds");
// 1710685845000

getUtcNow();
// "2026-03-18T11:42:33.123Z"

convertUnixToPlainDate(1710685845);
// "2024-03-17"
```

## API Surface

For the complete API listing, see the namespace documentation on GitHub:

- [Plain API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/plain) — timezone-free operations
- [Zoned API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/zoned) — IANA timezone-aware operations
- [Unix API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/unix) — Unix epoch utilities
- [UTC API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/utc) — UTC instant utilities
- [Regex API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/regex) — composable regex patterns

## License

MIT — See [LICENSE](../../LICENSE) for details.
