# GMT: Give Me Temporal

[![npm](https://img.shields.io/npm/v/@northguild/gmt)](https://www.npmjs.com/package/@northguild/gmt) [![License: MIT](https://img.shields.io/npm/l/@northguild/gmt)](https://github.com/northguild/gmt/blob/main/LICENSE) [![CI](https://github.com/northguild/gmt/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/northguild/gmt/actions/workflows/ci.yml) [![Node](https://img.shields.io/node/v/@northguild/gmt)](https://www.npmjs.com/package/@northguild/gmt)

**The most tested date and time library for JavaScript and TypeScript.** `@northguild/gmt` handles time zones, DST and business days in one library, in place of Luxon, date-fns, Moment.js, Day.js, Spacetime and `@internationalized/date`. It is built on the TC39 Temporal standard and never touches `Date`.

[Docs](https://northguild.dev/gmt/) · [API reference](https://northguild.dev/gmt/reference/) · [Tools](https://northguild.dev/gmt/tools/) · [Discord](https://discord.gg/TdvQdP3t5a)

```typescript
import { resolveLocal } from "@northguild/gmt";

// 02:30 on 31 March 2024 did not happen in Berlin: the clocks jumped from 02:00 to 03:00.
new Date("2024-03-31T02:30:00").toISOString(); // "2024-03-31T01:30:00.000Z" on a machine in Berlin, "2024-03-30T17:30:00.000Z" on one in Tokyo
resolveLocal("2024-03-31T02:30:00", "Europe/Berlin", { disambiguation: "reject" }); // "" — the same on every machine
```

- **69,631 tests, run 2,088,930 times in CI.** Every test runs in 10 time zones on 3 Node versions.
- **63× the CI test runs** of the six libraries below, combined.
- **714 functions, to the nanosecond**, tested in 17 locales.
- **Never throws.** ISO 8601 strings in. Invalid input returns `""`, `null`, `false` or `[]`.

| Library                   | Tests      | CI test runs  | Built on  |
| ------------------------- | ---------- | ------------- | --------- |
| **`@northguild/gmt`**     | **69,631** | **2,088,930** | Temporal  |
| Spacetime                 | 6,086      | 12,172        | `Date`    |
| Moment.js                 | 3,901      | 11,703        | `Date`    |
| date-fns                  | 3,213      | 3,213         | `Date`    |
| Luxon                     | 1,222      | 4,888         | `Date`    |
| Day.js                    | 794        | 1,034         | `Date`    |
| `@internationalized/date` | 386        | 386           | own types |

The other libraries were measured from 2026-08-22 to 2026-09-09, each by running its own test suite. [The full comparison and the method](https://northguild.dev/gmt/compare/).

Moving from another library: [date-fns](https://northguild.dev/gmt/migrate/date-fns/) · [Luxon](https://northguild.dev/gmt/migrate/luxon/) · [Day.js](https://northguild.dev/gmt/migrate/dayjs/) · [Moment.js](https://northguild.dev/gmt/migrate/moment/) · [`@internationalized/date`](https://northguild.dev/gmt/migrate/internationalized-date/).

## Install

```bash
npm install @northguild/gmt
```

To ban `Date` in your own code, add a lint plugin: [ESLint](https://github.com/northguild/gmt/tree/main/packages/gmt-eslint) · [Oxlint](https://github.com/northguild/gmt/tree/main/packages/gmt-oxlint) · [Biome](https://github.com/northguild/gmt/tree/main/packages/gmt-biome).

## Use

```typescript
import { addBusinessDays, addDate, addZoned, convertUtcToZoned } from "@northguild/gmt";

addDate("2024-01-31", { months: 1 }); // "2024-02-29"
addBusinessDays("2024-03-15", 1); // "2024-03-18"
convertUtcToZoned("2024-06-15T12:00:00Z", "Asia/Tokyo"); // "2024-06-15T21:00:00+09:00[Asia/Tokyo]"
addZoned("2024-10-06T01:30:00+10:00[Australia/Sydney]", { hours: 1 }); // "2024-10-06T03:30:00+11:00[Australia/Sydney]"
```

Every function has a reference page with a live playground:
[plain](https://northguild.dev/gmt/reference/plain/) · [zoned](https://northguild.dev/gmt/reference/zoned/) · [utc](https://northguild.dev/gmt/reference/utc/) · [unix](https://northguild.dev/gmt/reference/unix/) · [instant](https://northguild.dev/gmt/reference/instant/) · [calendar](https://northguild.dev/gmt/reference/calendar/) · [duration](https://northguild.dev/gmt/reference/duration/) · [interval](https://northguild.dev/gmt/reference/interval/) · [workforce](https://northguild.dev/gmt/reference/workforce/) · [span](https://northguild.dev/gmt/reference/span/) · [precision](https://northguild.dev/gmt/reference/precision/) · [recurrence](https://northguild.dev/gmt/reference/recurrence/) · [timescale](https://northguild.dev/gmt/reference/timescale/) · [gnss](https://northguild.dev/gmt/reference/gnss/) · [transport](https://northguild.dev/gmt/reference/transport/) · [intermodal](https://northguild.dev/gmt/reference/intermodal/)

By industry: [Workforce](https://northguild.dev/gmt/industries/workforce/) · [Transport](https://northguild.dev/gmt/industries/transport/) · [Intermodal](https://northguild.dev/gmt/industries/intermodal/) · [GNSS](https://northguild.dev/gmt/industries/gnss/) · [Maritime](https://northguild.dev/gmt/industries/maritime/)

Then the [guides](https://northguild.dev/gmt/guides/) show how to do each job, and the [tools](https://northguild.dev/gmt/tools/) let you try it on your own values.

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
   For API details, read https://northguild.dev/gmt/llms.txt and the
   JSDoc in the installed package.

3. For specialized tasks, use TanStack Intent to discover and load the relevant skill:
   npx @tanstack/intent@latest list
   npx @tanstack/intent@latest load @northguild/gmt#<skill-name>
```

## License

MIT. The four npm packages in `packages/` and the
[root `LICENSE`](https://github.com/northguild/gmt/blob/main/LICENSE) are MIT.

Every other folder is © 2026 NorthGuild, all rights reserved, under the `LICENSE` file in that
folder: `apps/` (the docs site), `context/`, `.agents/`, `.claude/`, `scripts/` and `docs/`. The
root files `AGENTS.md` and `CLAUDE.md` are reserved too, under `.agents/LICENSE`.
Code examples in the documentation may be used under MIT-0 (MIT No Attribution); see
[`apps/LICENSE`](https://github.com/northguild/gmt/blob/main/apps/LICENSE).
