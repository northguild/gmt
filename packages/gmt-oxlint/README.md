# @burglekitt/gmt-oxlint

Shared [Oxlint](https://oxc.rs/docs/guide/usage/linter) JS plugin for `@burglekitt/gmt` projects.

It enforces the same Date bans used by `@burglekitt/gmt-eslint` and `@burglekitt/gmt-biome`.

## Installation

### npm

```sh
npm install --save-dev @burglekitt/gmt-oxlint oxlint
```

### yarn

```sh
yarn add --dev @burglekitt/gmt-oxlint oxlint
```

### pnpm

```sh
pnpm add --save-dev @burglekitt/gmt-oxlint oxlint
```

### bun

```sh
bun add --save-dev @burglekitt/gmt-oxlint oxlint
```

## Usage

### Quick start (recommended)

In your `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "jsPlugins": ["@burglekitt/gmt-oxlint"],
  "extends": ["@burglekitt/gmt-oxlint/recommended"]
}
```

### Manual configuration

Or explicitly configure each rule. You can use either a string or an array form:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "jsPlugins": ["@burglekitt/gmt-oxlint"],
  "rules": {
    "@burglekitt/gmt-oxlint/no-date-global": "error",
    "@burglekitt/gmt-oxlint/no-new-date": "error",
    "@burglekitt/gmt-oxlint/no-date-now": "error",
    "@burglekitt/gmt-oxlint/no-date-parse": "error",
    "@burglekitt/gmt-oxlint/no-date-utc": "error",
    "@burglekitt/gmt-oxlint/no-date-getTimezoneOffset": "error"
  }
}
```

Array form also supported:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "jsPlugins": ["@burglekitt/gmt-oxlint"],
  "rules": {
    "@burglekitt/gmt-oxlint/no-date-global": ["error"],
    "@burglekitt/gmt-oxlint/no-new-date": ["error"],
    "@burglekitt/gmt-oxlint/no-date-now": ["error"],
    "@burglekitt/gmt-oxlint/no-date-parse": ["error"],
    "@burglekitt/gmt-oxlint/no-date-utc": ["error"],
    "@burglekitt/gmt-oxlint/no-date-getTimezoneOffset": ["error"]
  }
}
```

## Banned patterns

| Pattern | Rule | Suggestion |
| --- | --- | --- |
| `Date` global reference | `no-date-global` | Use `getNow()`, `getUnixNow('milliseconds' or 'seconds')`, `getUtcNow()`, or `getZonedNow(timezone)` |
| `new Date(...)` | `no-new-date` | Use `getUtcNow()`, `getNow()`, or `getZonedNow(timezone)` |
| `Date.now()` | `no-date-now` | Use `getUnixNow('milliseconds' or 'seconds')` or `getNow()` |
| `Date.parse(...)` | `no-date-parse` | Use `convertZonedToUnix(value)` |
| `Date.UTC(...)` | `no-date-utc` | Use `convertUtcDateTimeToUnix('YYYY-MM-DDTHH:mm:ss', 'milliseconds' or 'seconds')` |
| `date.getTimezoneOffset()` | `no-date-getTimezoneOffset` | Use `getZonedNow(timezone)`, other gmt zoned helpers such as `convertZonedToUnix(value)`, or `Temporal.ZonedDateTime` |

## Why Temporal?

[Temporal](https://tc39.es/proposal-temporal/) solves fundamental issues with JavaScript's `Date` object:

- Immutability: no accidental mutations
- Timezone awareness: explicit, unambiguous timezone handling
- No DST bugs: proper daylight saving time logic
- Precision: nanosecond precision where needed

All banned Date APIs have Temporal equivalents that are safer, clearer, and more correct.

## Notes

- Oxlint JS plugins are currently in alpha.
- This package is authored in TypeScript and bundled with `tsup` for publishing.
