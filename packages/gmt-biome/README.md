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
bun add --dev @burglekitt/gmt-biome @biomejs/biome
```

## Usage

### JSON (Recommended)

In your `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "extends": ["@burglekitt/gmt-biome"]
}
```

### JSON with Comments

In your `biome.jsonc`:

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  // Extend the gmt defaults
  "extends": ["@burglekitt/gmt-biome"]
}
```

### TOML

In your `biome.toml`:

```toml
extends = ["@burglekitt/gmt-biome"]
```

## Banned patterns

| Pattern | Plugin | Suggestion |
|---|---|---|
| `new Date(...)` | `no-new-date` | Use `getUtcNow()`, `getNow()`, or `getZonedNow(timezone)` |
| `Date.now()` | `no-date-now` | Use `getUnixNow('milliseconds' \| 'seconds')` or `getNow()` |
| `Date.parse(...)` | `no-date-parse` | Use `convertToUnixMilliseconds(value)` or `convertToUnixSeconds(value)` |
| `Date.UTC(...)` | `no-date-utc` | Use `convertUtcDateTimeToUnix('YYYY-MM-DDTHH:mm:ss', 'milliseconds' \| 'seconds')` |
| `$date.getTimezoneOffset()` | `no-date-getTimezoneOffset` | Use `getZonedNow(timezone)` or `convertZonedDateTimeToUnix(date, timezone)` |

## Why Temporal?

[Temporal](https://tc39.es/proposal-temporal/) solves fundamental issues with JavaScript's `Date` object:

- **Immutability** — no accidental mutations
- **Timezone awareness** — explicit, unambiguous timezone handling
- **No DST bugs** — proper daylight saving time logic
- **Precision** — nanosecond precision where needed

All banned Date APIs have Temporal equivalents that are safer, clearer, and more correct.