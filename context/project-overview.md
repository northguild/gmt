# GMT Project Overview

`@northguild/gmt` — **Give Me Temporal!** — is a Temporal-first date and time library for JavaScript and TypeScript. It wraps `temporal-polyfill` behind a small, opinionated API with a strict contract: ISO 8601 strings in, ISO 8601 strings (or numbers, booleans, or arrays) out. No `Date` object anywhere.

## Why This Exists

The JavaScript `Date` object is famously broken: 0-indexed months, mutable instances, implicit local-time assumptions, implementation-defined `Date.parse()`, no timezone support beyond UTC and "local", no distinct types for a date and a datetime, and no leap seconds. The legacy libraries built on it inherit many of those problems.

GMT exists to make the right thing the obvious thing: use Temporal types internally, expose a narrow string-in/string-out surface to consumers, and ban the `Date` API at the linting level.

## The Temporal API

Temporal is the TC39 proposal that replaces `Date`. It has a distinct type for each concept — `PlainDate`, `PlainTime`, `PlainDateTime`, `ZonedDateTime`, `Instant`, `Duration` — so mixing timezone-naive and timezone-aware values is a compile-time error rather than a silent bug.

| Reference                        | URL                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| TC39 proposal repo               | https://github.com/tc39/proposal-temporal                                                 |
| Temporal spec (tc39.es)          | https://tc39.es/proposal-temporal/                                                        |
| Temporal docs portal             | https://tc39.es/proposal-temporal/docs/                                                   |
| MDN: Temporal                    | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal |
| `temporal-polyfill` (npm)        | https://www.npmjs.com/package/temporal-polyfill                                           |
| `temporal-polyfill` (GitHub)     | https://github.com/fullcalendar/temporal-polyfill                                         |

GMT uses `temporal-polyfill` exclusively (its `/full/implementation` entry), and names it in one module, `packages/gmt/src/internal/temporal.ts`. Every other file imports `Temporal` from there, so moving to another implementation changes that one file.

## Intl APIs Used Internally

GMT's format functions delegate locale rendering to the host runtime's `Intl` APIs ([MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat), [MDN: Intl.RelativeTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat)).

**Important:** `Intl` output depends on the ICU data bundled with the runtime. Official Node.js builds from nodejs.org ship full ICU; some repackaged or embedded Node builds ship partial ICU and fall back to English for non-Latin locales. CLDR wording also changes between Node major versions. GMT's tests tolerate verified wording variants with the helpers in `packages/gmt/src/test/icuVariants.ts` (`oneOfIcu`, `expectOneOfIcu`, `expectDateTimeEqual`, `expectOneOfDateTimeIcu`) — see [testing standards](./testing-standards/references/locale-tests.md#icucldr-wording-variance-across-node-versions).

## Comparison Libraries

Compare against these to understand the design space and their open bug reports. They are never authority for a rule (see [AGENTS.md](../AGENTS.md)).

| Library    | Docs                              | Issues                                        | Difference from GMT                                                                                          |
| ---------- | --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Luxon      | https://moment.github.io/luxon/   | https://github.com/moment/luxon/issues        | `DateTime` objects, still wraps `Date`; DST boundaries are a known source of issues                          |
| date-fns   | https://date-fns.org/docs/        | https://github.com/date-fns/date-fns/issues   | Passes `Date` objects; locales imported separately; timezones need `date-fns-tz`                             |
| Moment.js  | https://momentjs.com/docs/        | https://github.com/moment/moment/issues       | Maintenance mode; mutable; hard to tree-shake; timezones need `moment-timezone` with a hand-updated database |

## Standards

See [AGENTS.md](../AGENTS.md) for a full index of coding, testing, JSDoc, and review standards.
