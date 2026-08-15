# GMT: Give Me Temporal

Home of [@burglekitt/gmt](./packages/gmt) — **Give Me Temporal!**

A monorepo for Burglekitt community libraries, built with Nx, powered by pnpm, and dead serious about making JavaScript date handling not terrible.

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

## Aint Nobody Got Time For JavaScript Date objects

![Aint nobody got time for that](https://media.giphy.com/media/bWM2eWYfN3r20/giphy.gif)

We do not use JavaScript `Date` APIs in this monorepo.

- Aint nobody got time for `new Date()` mutability and environment drift.
- Aint nobody got time for `Date.parse()` guessing what you meant.
- Aint nobody got time for `Date.UTC()` argument gymnastics.
- Aint nobody got time for `Date.now()` scattered magic numbers.

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

## Optional: Add Linting for Date API Bans

Want to ban `Date` APIs in your own project? GMT provides linting packages:

| Package                                           | npm                                            | yarn                                        | pnpm                                        | bun                                        |
| ------------------------------------------------- | ---------------------------------------------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------ |
| [`@burglekitt/gmt-biome`](./packages/gmt-biome)   | `npm install -D @burglekitt/gmt-biome`         | `yarn add -D @burglekitt/gmt-biome`         | `pnpm add -D @burglekitt/gmt-biome`         | `bun add -D @burglekitt/gmt-biome`         |
| [`@burglekitt/gmt-eslint`](./packages/gmt-eslint) | `npm install -D @burglekitt/gmt-eslint`        | `yarn add -D @burglekitt/gmt-eslint`        | `pnpm add -D @burglekitt/gmt-eslint`        | `bun add -D @burglekitt/gmt-eslint`        |
| [`@burglekitt/gmt-oxlint`](./packages/gmt-oxlint) | `npm install -D @burglekitt/gmt-oxlint oxlint` | `yarn add -D @burglekitt/gmt-oxlint oxlint` | `pnpm add -D @burglekitt/gmt-oxlint oxlint` | `bun add -D @burglekitt/gmt-oxlint oxlint` |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor setup, testing conventions, and publishing workflows.

---

## License

MIT — See [LICENSE](./LICENSE) for details.
