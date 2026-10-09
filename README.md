# GMT: Give Me Temporal

**The most tested date and time library for JavaScript.** `@northguild/gmt` is one library in place of Luxon, date-fns, Moment.js, Day.js, Spacetime and `@internationalized/date`. It is built on the TC39 Temporal standard and never touches `Date`.

[Docs](https://gmt-dox.northguild.workers.dev/) · [API reference](https://gmt-dox.northguild.workers.dev/reference/) · [Tools](https://gmt-dox.northguild.workers.dev/tools/) · [Discord](https://discord.gg/TdvQdP3t5a)

- **46,338 tests, run 1,390,140 times in CI.** Every test runs in 10 time zones on 3 Node versions.
- **42× the CI test runs** of the six libraries below, combined.
- **632 functions, to the nanosecond**, tested in 17 locales.
- **Never throws.** ISO 8601 strings in. Invalid input returns `""`, `null`, `false` or `[]`.

| Library                   | Tests      | CI test runs  | Built on  |
| ------------------------- | ---------- | ------------- | --------- |
| **`@northguild/gmt`**     | **46,338** | **1,390,140** | Temporal  |
| Spacetime                 | 6,086      | 12,172        | `Date`    |
| Moment.js                 | 3,901      | 11,703        | `Date`    |
| date-fns                  | 3,213      | 3,213         | `Date`    |
| Luxon                     | 1,222      | 4,888         | `Date`    |
| Day.js                    | 794        | 1,034         | `Date`    |
| `@internationalized/date` | 386        | 386           | own types |

The other libraries were measured from 2026-08-22 to 2026-09-09, each by running its own test suite. [The full comparison and the method](https://gmt-dox.northguild.workers.dev/compare/).

## Install

```bash
npm install @northguild/gmt
```

To ban `Date` in your own code, add a lint plugin: [ESLint](https://github.com/northguild/gmt/tree/main/packages/gmt-eslint) · [Oxlint](https://github.com/northguild/gmt/tree/main/packages/gmt-oxlint) · [Biome](https://github.com/northguild/gmt/tree/main/packages/gmt-biome).

## Use

```typescript
import { addBusinessDays, addDate, addZoned, convertUtcToZoned, diffDate, formatDate, isValidDate, resolveLocal } from "@northguild/gmt";

addDate("2024-01-31", { months: 1 }); // "2024-02-29"
diffDate("2024-01-01", "2024-03-01", "day"); // 60
formatDate("2024-03-15", "en-GB", { dateStyle: "long" }); // "15 March 2024"
isValidDate("2023-02-29"); // false
addBusinessDays("2024-03-15", 1); // "2024-03-18"

// Time zones, and the night the clocks change
convertUtcToZoned("2024-06-15T12:00:00Z", "Asia/Tokyo"); // "2024-06-15T21:00:00+09:00[Asia/Tokyo]"
addZoned("2024-03-10T01:30:00-05:00[America/New_York]", { hours: 1 }); // "2024-03-10T03:30:00-04:00[America/New_York]"
resolveLocal("2024-03-10T02:30:00", "America/New_York", { disambiguation: "reject" }); // "" (02:30 did not happen that day)
```

Every function has a reference page with a live playground:
[plain](https://gmt-dox.northguild.workers.dev/reference/plain/) · [zoned](https://gmt-dox.northguild.workers.dev/reference/zoned/) · [utc](https://gmt-dox.northguild.workers.dev/reference/utc/) · [unix](https://gmt-dox.northguild.workers.dev/reference/unix/) · [instant](https://gmt-dox.northguild.workers.dev/reference/instant/) · [calendar](https://gmt-dox.northguild.workers.dev/reference/calendar/) · [duration](https://gmt-dox.northguild.workers.dev/reference/duration/) · [interval](https://gmt-dox.northguild.workers.dev/reference/interval/) · [span](https://gmt-dox.northguild.workers.dev/reference/span/) · [precision](https://gmt-dox.northguild.workers.dev/reference/precision/)

By industry: [transport](https://gmt-dox.northguild.workers.dev/reference/transport/) · [intermodal](https://gmt-dox.northguild.workers.dev/reference/intermodal/)

Then the [guides](https://gmt-dox.northguild.workers.dev/guides/) show how to do each job, and the [tools](https://gmt-dox.northguild.workers.dev/tools/) let you try it on your own values.

## Agent prompt

Paste this into your AI coding agent:

```
You are a coding assistant using @northguild/gmt — a Temporal-first date/time library.

SETUP (do this once per project):

1. Install the runtime:
   npm install @northguild/gmt

2. (Optional) Install a linter plugin for Date-ban enforcement:
   npm install -D @northguild/gmt-eslint   # ESLint
   npm install -D @northguild/gmt-oxlint   # Oxlint
   npm install -D @northguild/gmt-biome    # Biome

3. Wire TanStack Intent so skill guidance is discoverable in AGENTS.md:
   npx @tanstack/intent@latest install

WHEN HELPING THE USER:

1. Ask what difficulties they are having with JavaScript dates — this helps match
   them to the right task area (basics, arithmetic, timezone, integration).

2. Generate code using GMT's string-in/string-out API. NEVER use new Date().
   For API details, read https://gmt-dox.northguild.workers.dev/llms.txt and the
   JSDoc in the installed package.

3. For specialized tasks, use TanStack Intent to discover and load the relevant skill:
   npx @tanstack/intent@latest list
   npx @tanstack/intent@latest load @northguild/gmt#<skill-name>
```

## License

MIT. See [LICENSE](https://github.com/northguild/gmt/blob/main/LICENSE).
