# @burglekitt/gmt-biome

Shared [Biome](https://biomejs.dev/) configuration for `@burglekitt/gmt` projects. Enforces the Temporal-only policy by banning all `Date` APIs via Grit plugins.

## Installation

### npm

```sh
npm install --save-dev @burglekitt/gmt-biome @biomejs/biome
```

### yarn

```sh
yarn add --dev @burglekitt/gmt-biome @biomejs/biome
```

### pnpm

```sh
pnpm add --save-dev @burglekitt/gmt-biome @biomejs/biome
```

### bun

```sh
bun add --save-dev @burglekitt/gmt-biome @biomejs/biome
```

## Usage

Add the plugins to the `plugins` array in your `biome.json`. Biome resolves plugin paths as filesystem paths, so use the `./node_modules/` path with the `.grit` extension.

### All rules (recommended)

Use the combined `all` plugin to enable every Date-ban rule in a single entry:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.11/schema.json",
  "plugins": ["./node_modules/@burglekitt/gmt-biome/plugins/all.grit"]
}
```

### Select specific rules

Include only the plugins you need:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.11/schema.json",
  "plugins": [
    "./node_modules/@burglekitt/gmt-biome/plugins/no-new-date.grit",
    "./node_modules/@burglekitt/gmt-biome/plugins/no-date-now.grit",
    "./node_modules/@burglekitt/gmt-biome/plugins/no-date-parse.grit",
    "./node_modules/@burglekitt/gmt-biome/plugins/no-date-utc.grit",
    "./node_modules/@burglekitt/gmt-biome/plugins/no-date-getTimezoneOffset.grit"
  ]
}
```

> **Note:** The `.grit` extension is required. When installed from npm, the typical path uses the `./node_modules/` prefix (as shown above), but any relative or absolute filesystem path to the `.grit` file on disk will work — Biome does not resolve npm package specifiers in `plugins`.

> **Why not `extends`?** Biome's `extends` is for sharing `biome.json` config options (formatter, linter rules, etc.). It cannot be used to distribute GritQL plugins — plugin paths in an extended config file are always resolved relative to the consuming project root, not the npm package directory. Use `plugins` instead.

## Banned patterns

| Pattern | Plugin | Suggestion |
|---|---|---|
| `new Date(...)` | `no-new-date` | Use `getUtcNow()`, `getNow()`, or `getZonedNow(timezone)` |
| `Date.now()` | `no-date-now` | Use `getUnixNow('milliseconds' \| 'seconds')` or `getNow()` |
| `Date.parse(...)` | `no-date-parse` | Use `convertZonedToUnix(value)` |
| `Date.UTC(...)` | `no-date-utc` | Use `convertUtcDateTimeToUnix('YYYY-MM-DDTHH:mm:ss', 'milliseconds' \| 'seconds')` |
| `$date.getTimezoneOffset()` | `no-date-getTimezoneOffset` | Use `getZonedNow(timezone)`, other gmt zoned helpers such as `convertZonedToUnix(value)`, or `Temporal.ZonedDateTime` |

## Why Temporal?

[Temporal](https://tc39.es/proposal-temporal/) solves fundamental issues with JavaScript's `Date` object:

- **Immutability** — no accidental mutations
- **Timezone awareness** — explicit, unambiguous timezone handling
- **No DST bugs** — proper daylight saving time logic
- **Precision** — nanosecond precision where needed

All banned Date APIs have Temporal equivalents that are safer, clearer, and more correct.