# @northguild/gmt-oxlint

Shared [Oxlint](https://oxc.rs/docs/guide/usage/linter) JS plugin for `@northguild/gmt` projects.

It enforces the same Date bans used by `@northguild/gmt-eslint` and `@northguild/gmt-biome`.

## Installation

### npm

```sh
npm install --save-dev @northguild/gmt-oxlint oxlint
```

### yarn

```sh
yarn add --dev @northguild/gmt-oxlint oxlint
```

### pnpm

```sh
pnpm add --save-dev @northguild/gmt-oxlint oxlint
```

### bun

```sh
bun add --save-dev @northguild/gmt-oxlint oxlint
```

## Usage

### Quick start (recommended for best DX)

In `oxlint.config.ts`:

```ts
import { defineConfig } from "oxlint";
import { recommendedConfig } from "@northguild/gmt-oxlint";

export default defineConfig(recommendedConfig);
```

If you prefer a custom alias for shorter rule names:

```ts
import { defineConfig } from "oxlint";
import { recommendedRules } from "@northguild/gmt-oxlint";

export default defineConfig({
  jsPlugins: [{ name: "gmt", specifier: "@northguild/gmt-oxlint" }],
  rules: {
    // Copy rules under your alias if you want "gmt/..." rule IDs.
    "gmt/no-date-global": "error",
    "gmt/no-new-date": "error",
    "gmt/no-date-now": "error",
    "gmt/no-date-parse": "error",
    "gmt/no-date-utc": "error",
    "gmt/no-date-getTimezoneOffset": "error",
  },
});
```

### JSON config quick start

In your `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "jsPlugins": ["@northguild/gmt-oxlint"],
  "extends": ["./node_modules/@northguild/gmt-oxlint/config/recommended.json"]
}
```

Oxlint currently resolves `extends` as file paths. Named shared config specifiers
such as `@northguild/gmt-oxlint/recommended` are not currently supported.

### Manual configuration

Or explicitly configure each rule. You can use either a string or an array form:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "jsPlugins": ["@northguild/gmt-oxlint"],
  "rules": {
    "@northguild/gmt-oxlint/no-date-global": "error",
    "@northguild/gmt-oxlint/no-new-date": "error",
    "@northguild/gmt-oxlint/no-date-now": "error",
    "@northguild/gmt-oxlint/no-date-parse": "error",
    "@northguild/gmt-oxlint/no-date-utc": "error",
    "@northguild/gmt-oxlint/no-date-getTimezoneOffset": "error"
  }
}
```

Array form also supported:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "jsPlugins": ["@northguild/gmt-oxlint"],
  "rules": {
    "@northguild/gmt-oxlint/no-date-global": ["error"],
    "@northguild/gmt-oxlint/no-new-date": ["error"],
    "@northguild/gmt-oxlint/no-date-now": ["error"],
    "@northguild/gmt-oxlint/no-date-parse": ["error"],
    "@northguild/gmt-oxlint/no-date-utc": ["error"],
    "@northguild/gmt-oxlint/no-date-getTimezoneOffset": ["error"]
  }
}
```

## Banned patterns

| Pattern                    | Rule                        | Suggestion                                                                                                            |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Date` global reference    | `no-date-global`            | Use `getNow()`, `getUnixNow('milliseconds' or 'seconds')`, `getUtcNow()`, or `getZonedNow(timezone)`                  |
| `new Date(...)`            | `no-new-date`               | Use `getUtcNow()`, `getNow()`, or `getZonedNow(timezone)`                                                             |
| `Date.now()`               | `no-date-now`               | Use `getUnixNow('milliseconds' or 'seconds')` or `getNow()`                                                           |
| `Date.parse(...)`          | `no-date-parse`             | Use `convertZonedToUnix(value)`                                                                                       |
| `Date.UTC(...)`            | `no-date-utc`               | Use `convertUtcDateTimeToUnix('YYYY-MM-DDTHH:mm:ss', 'milliseconds' or 'seconds')`                                    |
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
