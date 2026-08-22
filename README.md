# GMT: Give Me Temporal

Home of [@burglekitt/gmt](./packages/gmt) — **Give Me Temporal!**

A monorepo for Burglekitt community libraries, built with Nx and powered by pnpm, focused on making JavaScript date handling reliable and predictable.

## Agent prompt

```
You are working with the @burglekitt/gmt library — a Temporal-first date/time library for JavaScript. Before writing any date-related code, read the skill files in packages/gmt/skills/ and packages/gmt/skills/_artifacts/ to understand the full API surface, naming conventions, and Temporal patterns this project uses.

When a user asks about dates or times:

1. Ask whether they want GMT alone, GMT plus linters (gmt-eslint, gmt-oxlint, gmt-biome), or linters only.
2. Ask what difficulties they are having with JavaScript dates — this helps match them to the right GMT namespace (plain, zoned, unix, utc, regex).

Then install the appropriate package and generate code using GMT's string-in/string-out API, never new Date().
```

## Install

Install the runtime package:

| Package manager | Command                       |
| --------------- | ----------------------------- |
| npm             | `npm install @burglekitt/gmt` |
| yarn            | `yarn add @burglekitt/gmt`    |
| pnpm            | `pnpm add @burglekitt/gmt`    |
| bun             | `bun add @burglekitt/gmt`     |

Quick example:

```js
import { getNow } from "@burglekitt/gmt";
console.log(getNow()); // ISO 8601 string
```

## Why not JavaScript Date objects

We do not use JavaScript `Date` APIs in this monorepo.

- `new Date()` introduces mutability and environment drift.
- `Date.parse()` relies on ambiguous, engine-dependent parsing.
- `Date.UTC()` requires awkward positional arguments.
- `Date.now()` scatters untyped timestamps throughout code.

Use GMT instead:

- `getNow()`, `getUnixNow()`, and `getUtcNow()` for current time values.
- `convertUtcDateTimeToUnix()` and `convertUtcToUnix()` for explicit unix conversion.
- `convertTimezoneToUtc()` and `convertUtcToTimezone()` for timezone-safe conversion.
- String-in/string-out APIs with Temporal under the hood for safer behavior.

If you see a Date API in code, replace it with a GMT helper.

## Packages

| Package                             | npm                           | Description                                          |
| ----------------------------------- | ----------------------------- | ---------------------------------------------------- |
| [`@burglekitt/gmt`](./packages/gmt) | `npm install @burglekitt/gmt` | Give Me Temporal — string-in/string-out date library |

`@burglekitt/gmt` currently exports top-level `Temporal`, `duration`, `plain`, `zoned`, `unix`, `utc`, and `regex` namespaces, with direct subpath imports available under `@burglekitt/gmt/*`.

### How GMT is tested, vs. the libraries it targets

GMT's roadmap (see [context/roadmap](./context/roadmap)) is explicitly scoped against react-aria's **`@internationalized/date`**, **Luxon**, **date-fns**, and **Moment.js** — the same four libraries compared below. All numbers were verified **2026-08-22** against the exact package versions/commits below — nothing is estimated. Re-verify before citing these numbers elsewhere; library surfaces and CI configs move.

| Library                   | Version tested                          |
| ------------------------- | --------------------------------------- |
| GMT (`@burglekitt/gmt`)   | 1.12.0                                  |
| `@internationalized/date` | 3.12.3 (`adobe/react-spectrum@5d191ab`) |
| Luxon                     | 3.7.2 (`moment/luxon@f427515`)          |
| date-fns                  | 4.4.0 (`date-fns/date-fns@a0a3922`)     |
| Moment.js                 | 2.30.1 (`moment/moment@cf524af`)        |

| Metric                          | GMT                                                | `@internationalized/date`      | Luxon                                | date-fns                                  | Moment.js                        |
| ------------------------------- | -------------------------------------------------- | ------------------------------ | ------------------------------------ | ----------------------------------------- | -------------------------------- |
| Test files                      | 516                                                | 6                              | 58 / 60<br>(2 didn't run<br>locally) | 256                                       | 191<br>(52 core +<br>139 locale) |
| Individual test cases           | **15,632**                                         | 386                            | 1,222                                | 3,213                                     | 3,901                            |
| Effective CI test<br>executions | **312,640**<br>(15,632 × 2 Node<br>× 10 timezones) | 386<br>(×1 Node)               | 4,888<br>(1,222 × 4 Node)            | 3,213<br>(×1 Node)                        | 11,703<br>(3,901 × 3 Node)       |
| CI Node.js matrix               | 22, 24                                             | n/a — tests<br>React 16–canary | 20, 22, 24, 25                       | not explicit<br>(`node = "latest"`)       | LTS, LTS-1,<br>latest            |
| CI timezone matrix              | **10 zones × 2**<br>**Node, full suite**           | none found                     | none found                           | dedicated workflow,<br>zone scope unclear | 6 zones,<br>partial suite only   |
| Locale test matrix              | **17 locales**,<br>every locale fn                 | none found                     | none found                           | none found                                | none found                       |
| Real-browser CI                 | not yet                                            | yes (Playwright)               | not found                            | yes (Playwright)                          | not found                        |
| Maintenance                     | active                                             | active                         | active                               | active                                    | **maintenance<br>mode**          |

<sub>Methodology: "Test files" and the CI/maintenance rows come from each project's public CI configuration and repository file listing. "Individual test cases" for GMT, Luxon, date-fns, and Moment.js were obtained by actually cloning the repo at the commit above, installing dependencies, running the project's own test command (`vitest run` / `jest` / `node scripts/test.js`), and reading that runner's own final summary — not grepped from source. `@internationalized/date` was run by cloning `adobe/react-spectrum` at `5d191ab`, installing dependencies, and executing `npx jest packages/@internationalized/date/tests/`, yielding 386 passing tests. Luxon (39 failures) and date-fns (46 failures) had environment-dependent local failures that don't affect the total count: Luxon's suite assumes its CI container's local time zone is `America/New_York`; date-fns's experimental native-`Temporal` code path needs a global `Temporal` Node doesn't yet provide natively. Moment.js passed cleanly (0 failed) on Node 24. Sources: [GMT](./.github/workflows/ci.yml) · [`@internationalized/date`](https://github.com/adobe/react-spectrum/blob/main/.circleci/config.yml) · [Luxon](https://github.com/moment/luxon/blob/master/.github/workflows/test.yml) · [date-fns](https://github.com/date-fns/date-fns/tree/main/.github/workflows) · [Moment.js](https://github.com/moment/moment/tree/develop/.github/workflows).</sub>

### Functionality parity progress

GMT's roadmap tracks parity against the same four libraries story-by-story, with each gap sourced against the specific competitor function it closes — see [context/roadmap](./context/roadmap) for the full, source-verified audit trail. This is a live snapshot, not a finished-parity claim: ✅ shipped, 🟡 in progress, ⏳ backlog and not yet scheduled.

| Capability                                                                         | Status                       | Also has it                                                              |
| ---------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| Duration type<br>(ISO 8601 parse/format/arithmetic)                                | ✅ Done                      | Luxon `Duration`                                                         |
| Interval/range math<br>(contains, overlap, union,<br>intersection, split, set ops) | ✅ Done                      | Luxon `Interval`,<br>date-fns `areIntervalsOverlapping`                  |
| DST disambiguation control<br>on construction _and_ arithmetic                     | ✅ Done — **differentiator** | None of the others expose<br>this on arithmetic                          |
| Locale-aware calendar helpers<br>(weekend, week start/end, day-of-week)            | ✅ Done                      | `@internationalized/date`                                                |
| Business-day arithmetic,<br>clamp/closest, time rounding                           | ✅ Done                      | `temporal-kit`                                                           |
| Interval rounding-out<br>(boundary count, from-duration)                           | ✅ Done                      | Luxon                                                                    |
| Locale calendar metadata<br>(names, `hasDST`)                                      | ✅ Done                      | Luxon `Info`                                                             |
| Overlap-day count, relative<br>rounding, DST transitions, hours-in-day             | ✅ Done                      | date-fns, `@internationalized/date`                                      |
| Field setters, token-pattern<br>parsing, named machine formats                     | 🟡 14 of 16 stories done     | Luxon `.set()`,<br>`toRFC2822`/`toHTTP`/`toSQL`,<br>Moment `.calendar()` |
| Non-Gregorian calendar systems<br>(Hebrew, Islamic, solar, Ethiopic)               | ⏳ Backlog                   | `@internationalized/date`'s<br>`toCalendar`                              |

<sub>Status reflects [context/roadmap/tracker.md](./context/roadmap/tracker.md) as of this writing.</sub>

### Where GMT stands alone

Specific, sourced claims — not a repeat of the metrics above.

| Claim                                                                                                                                         | The others                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Only GMT runs its **entire** suite in CI<br>under a real `TZ` env var across 10<br>real-world zones × 2 Node versions<br>(20 full-suite runs) | Luxon/`@internationalized/date`: no<br>CI timezone matrix. date-fns: zone<br>scope unclear. Moment.js: 6 zones,<br>partial suite only |
| Only GMT enforces a mandatory<br>17-locale test matrix on every<br>locale-aware function                                                      | No CI-level or systematic<br>locale-matrix testing found<br>in any of the four                                                        |
| Only GMT exposes explicit DST<br>disambiguation control on both<br>construction _and_ arithmetic                                              | Luxon's docs call this explicitly<br>undefined; `@internationalized/date`<br>only covers construction, not arithmetic                 |
| Only GMT is Temporal-native with<br>zero `Date` usage, enforced by<br>3 dedicated lint packages                                               | Luxon, date-fns, and Moment.js all<br>still wrap or depend on `Date` internally                                                       |
| GMT's effective CI test<br>executions exceed all four<br>competitors **combined**<br>by ~15×                                                  | 312,640 vs. 386 + 4,888 + 3,213<br>+ 11,703 = 20,190                                                                                  |

## Optional: Add Linting for Date API Bans

Want to ban `Date` APIs in your own project? GMT provides three linting packages — pick the one matching your existing toolchain.

**`@burglekitt/gmt-biome`**

| Package manager | Command                                |
| --------------- | -------------------------------------- |
| npm             | `npm install -D @burglekitt/gmt-biome` |
| yarn            | `yarn add -D @burglekitt/gmt-biome`    |
| pnpm            | `pnpm add -D @burglekitt/gmt-biome`    |
| bun             | `bun add -D @burglekitt/gmt-biome`     |

**`@burglekitt/gmt-eslint`**

| Package manager | Command                                 |
| --------------- | --------------------------------------- |
| npm             | `npm install -D @burglekitt/gmt-eslint` |
| yarn            | `yarn add -D @burglekitt/gmt-eslint`    |
| pnpm            | `pnpm add -D @burglekitt/gmt-eslint`    |
| bun             | `bun add -D @burglekitt/gmt-eslint`     |

**`@burglekitt/gmt-oxlint`** (requires `oxlint`)

| Package manager | Command                                        |
| --------------- | ---------------------------------------------- |
| npm             | `npm install -D @burglekitt/gmt-oxlint oxlint` |
| yarn            | `yarn add -D @burglekitt/gmt-oxlint oxlint`    |
| pnpm            | `pnpm add -D @burglekitt/gmt-oxlint oxlint`    |
| bun             | `bun add -D @burglekitt/gmt-oxlint oxlint`     |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor setup, testing conventions, and publishing workflows.

---

## License

MIT — See [LICENSE](./LICENSE) for details.
