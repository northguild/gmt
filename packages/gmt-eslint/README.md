# @burglekitt/gmt-eslint

Shared [ESLint](https://eslint.org/) flat configuration for `@burglekitt/gmt` projects. Enforces the Temporal-only policy by banning all `Date` APIs via ESLint rules.

## Installation

### npm

```sh
npm install --save-dev @burglekitt/gmt-eslint eslint @typescript-eslint/parser
```

### yarn

```sh
yarn add --dev @burglekitt/gmt-eslint eslint @typescript-eslint/parser
```

### pnpm

```sh
pnpm add --save-dev @burglekitt/gmt-eslint eslint @typescript-eslint/parser
```

### bun

```sh
bun add --dev @burglekitt/gmt-eslint eslint @typescript-eslint/parser
```

## Usage

### Modern ESLint (Flat Config)

```js
// eslint.config.mjs
import gmtEslintConfig from "@burglekitt/gmt-eslint";

export default [...gmtEslintConfig];
```

### ESLint RC (.eslintrc.js)

```js
// .eslintrc.js
const gmtEslintConfig = require("@burglekitt/gmt-eslint");

module.exports = [...gmtEslintConfig];
```

### ESLint RC (CommonJS)

```js
// .eslintrc.cjs
const gmtEslintConfig = require("@burglekitt/gmt-eslint");

module.exports = [...gmtEslintConfig];
```

### ESLint RC (JSON)

```json
// .eslintrc.json
{
  "extends": ["@burglekitt/gmt-eslint"]
}
```

> **Note:** JSON format requires the package to export a named configuration. For best compatibility, use the `eslint.config.mjs` (flat config) approach or `.eslintrc.js`/`.eslintrc.cjs` with CommonJS require.

## Banned patterns

| Pattern | Rule | Suggestion |
|---|---|---|
| `Date` (global reference) | `no-restricted-globals` | Use `getUtcNow()`, `getNow()`, `getUnixNow()`, or `getZonedNow(timezone)` |
| `new Date(...)` | `no-restricted-syntax` | Use `getUtcNow()`, `getNow()`, or `getZonedNow(timezone)` |
| `Date.now()` | `no-restricted-properties` | Use `getUnixNow('milliseconds' \| 'seconds')` or `getNow()` |
| `Date.UTC(...)` | `no-restricted-properties` | Use `convertUtcDateTimeToUnix('YYYY-MM-DDTHH:mm:ss', 'milliseconds' \| 'seconds')` |
| `Date.parse(...)` | `no-restricted-properties` | Use `convertZonedToUnix(value)` |
| `$date.getTimezoneOffset()` | `no-restricted-syntax` | Use `getZonedNow(timezone)` or `convertZonedDateTimeToUnix(date, timezone)` |

## Why Temporal?

[Temporal](https://tc39.es/proposal-temporal/) solves fundamental issues with JavaScript's `Date` object:

- **Immutability** — no accidental mutations
- **Timezone awareness** — explicit, unambiguous timezone handling
- **No DST bugs** — proper daylight saving time logic
- **Precision** — nanosecond precision where needed

All banned Date APIs have Temporal equivalents that are safer, clearer, and more correct.