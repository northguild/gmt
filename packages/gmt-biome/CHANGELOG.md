# @burglekitt/gmt-biome

## 1.0.2

### Patch Changes

- 9348e7c: Add `.grit` extension exports for all plugins to support both extensionless and `.grit` subpath imports (for example, `plugins/no-new-date` and `plugins/no-new-date.grit`), and change the package entrypoint from `recommended.json` to `biome.json` by removing `recommended.json`.

## 1.0.1

### Patch Changes

- f3af6b3: Replace top-level `biome.json` with a package `recommended.json` and export plugin subpaths. This avoids nested `biome.json` conflicts in the monorepo while keeping a consumer-facing entrypoint and direct plugin exports.

## 1.0.0

### Major Changes

- fa5a465: Initial public release of the gmt suite.

  ## @burglekitt/gmt

  Temporal-first date and time library. String-in, string-out API wrapping
  `@js-temporal/polyfill`. Covers plain and zoned arithmetic, comparison,
  formatting, parsing, mapping, conversion, and validation. No `Date` object
  used anywhere.

  ## @burglekitt/gmt-eslint

  ESLint flat-config plugin that bans the `Date` API (`new Date`, `Date.now`,
  `Date.UTC`, `Date.parse`, and the global `Date` reference) and points
  consumers toward `@burglekitt/gmt` replacements.

  ## @burglekitt/gmt-oxlint

  Oxlint JS plugin with the same `Date`-ban policy as `gmt-eslint`. Rules
  cover `new Date`, `Date.now`, `Date.UTC`, `Date.parse`,
  `date.getTimezoneOffset`, and bare `Date` global references.

  ## @burglekitt/gmt-biome

  Biome GritQL plugin enforcing the same `Date`-ban rules for projects using
  Biome as their formatter/linter.
