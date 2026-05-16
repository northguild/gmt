# GMT Project Overview

`@burglekitt/gmt` — **Give Me Temporal!** — is a Temporal-first date and time library for JavaScript and TypeScript. It wraps `@js-temporal/polyfill` behind a small, opinionated API with a strict contract: ISO 8601 strings in, ISO 8601 strings (or numbers, booleans, or arrays) out. No `Date` object anywhere.

## Why This Exists

The JavaScript `Date` object is famously broken. Its design decisions — 0-indexed months, mutable instances, implicit local-time assumptions, `Date.parse()` with implementation-defined behavior, no timezone support beyond UTC and "local" — have caused decades of production bugs. The legacy date libraries that grew up around it inherit many of those problems.

GMT exists to make the right thing the obvious thing: use Temporal types internally, expose a narrow string-in/string-out surface to consumers, and ban the `Date` API at the linting level.

## The Temporal API

Temporal is the TC39 Stage 3 proposal that replaces `Date`. It introduces distinct types for each concept — `PlainDate`, `PlainTime`, `PlainDateTime`, `ZonedDateTime`, `Instant`, `Duration` — so mixing timezone-naive and timezone-aware values is a compile-time error rather than a silent bug.

| Reference | URL |
|---|---|
| TC39 proposal repo | https://github.com/tc39/proposal-temporal |
| Temporal spec (tc39.es) | https://tc39.es/proposal-temporal/ |
| Temporal docs portal | https://tc39.es/proposal-temporal/docs/ |
| MDN: Temporal | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal |
| `@js-temporal/polyfill` (npm) | https://www.npmjs.com/package/@js-temporal/polyfill |
| `@js-temporal/polyfill` (GitHub) | https://github.com/js-temporal/temporal-polyfill |

GMT imports exclusively from `@js-temporal/polyfill`. When Temporal ships natively in all target environments, the polyfill import will be the only thing that needs to change.

Key Temporal types used in GMT:

- `Temporal.PlainDate` — calendar date without time or timezone (`"2024-03-17"`)
- `Temporal.PlainTime` — wall-clock time without date or timezone (`"14:30:00"`)
- `Temporal.PlainDateTime` — date + time without timezone (`"2024-03-17T14:30:00"`)
- `Temporal.ZonedDateTime` — date + time + IANA timezone (`"2024-03-17T14:30:00+00:00[UTC]"`)
- `Temporal.Instant` — absolute point in time (epoch-based, no calendar)
- `Temporal.Duration` — length of time between two points
- `Temporal.Now` — current values in any of the above types

## The Legacy `Date` Object (What We Replace)

| Reference | URL |
|---|---|
| MDN: Date | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date |

Known pitfalls of `Date` that Temporal solves:

- **0-indexed months**: `new Date(2024, 0, 1)` is January 1, not month 0.
- **Mutable by default**: `date.setMonth(3)` mutates in place; aliasing causes silent bugs.
- **Implicit local time**: `new Date("2024-03-17")` is midnight UTC on some platforms, midnight local on others.
- **`Date.parse()` is implementation-defined**: The same string can parse differently across engines.
- **No timezone support**: Only UTC and the host system's local timezone. No IANA timezone arithmetic.
- **No distinct types**: A "date" and a "datetime" are both `Date` objects; mixing them silently produces wrong results.
- **Leap second ignorance**: `Date` has no concept of leap seconds.

Canonical reading: [UTC is Enough for Everyone, Right?](https://zachholman.com/talk/utc-is-enough-for-everyone-right) — covers why "just use UTC" doesn't save you from timezone complexity.

## Intl APIs Used Internally

GMT's format functions delegate locale rendering to the host runtime's `Intl` APIs. Understanding these is essential when working on any `format*` function.

| Reference | URL |
|---|---|
| MDN: Intl.DateTimeFormat | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat |
| MDN: Intl.RelativeTimeFormat | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat |

**Important:** `Intl` output depends on the ICU data bundled with the runtime. Official Node.js builds from nodejs.org ship full ICU; some repackaged or embedded Node builds ship partial ICU and fall back to English for non-Latin locales. GMT's test suite uses `hasFullIcu` (in `src/test/hasFullIcu.ts`) to detect which environment it's running in and assert the correct expected value for each path.

## Comparison Libraries

When designing or reviewing GMT's API surface, compare against these libraries to understand the design space, their open bug reports, and where they fall short.

### Luxon

Moment's successor, built by the same team. Immutable, uses `Intl` for timezone support. Still wraps `Date` internally.

| Reference | URL |
|---|---|
| Docs | https://moment.github.io/luxon/ |
| API docs | https://moment.github.io/luxon/api-docs/index.html |
| GitHub | https://github.com/moment/luxon |
| Open issues | https://github.com/moment/luxon/issues |

Key differences from GMT: Luxon uses `DateTime` objects (not strings); timezone support depends on `Intl.DateTimeFormat` with an `Intl` object per instance; DST handling at boundaries is a known source of issues in the tracker.

### date-fns

Functional, tree-shakable, large surface area. Operates on native `Date` objects, which means all of `Date`'s pitfalls apply at the boundaries.

| Reference | URL |
|---|---|
| Docs | https://date-fns.org/docs/ |
| GitHub | https://github.com/date-fns/date-fns |
| Open issues | https://github.com/date-fns/date-fns/issues |

Key differences from GMT: date-fns passes `Date` objects between functions; locale handling requires separately importing locale objects; timezone support requires a separate `date-fns-tz` package, which has its own open issue tracker for DST and offset bugs.

### Moment.js

The original dominant date library. Now in **maintenance mode** — no new features, only security fixes. The Moment team actively recommends migrating away.

| Reference | URL |
|---|---|
| Docs | https://momentjs.com/docs/ |
| GitHub | https://github.com/moment/moment |
| Open issues | https://github.com/moment/moment/issues |

Key differences from GMT: Moment objects are mutable by default (a constant source of aliasing bugs); the library is large and difficult to tree-shake; timezone support requires `moment-timezone` with a bundled IANA database that must be kept up to date manually.

## Standards

See [AGENTS.md](../AGENTS.md) for a full index of coding, testing, JSDoc, and review standards.
