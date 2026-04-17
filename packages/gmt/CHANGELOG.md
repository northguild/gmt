# @burglekitt/gmt

## 1.2.0

### Minor Changes

- Adds parser methods for plain, unix, utc, zoned. Updates tanstack-intent skills.

## 1.1.0

### Minor Changes

- cc4feab: Adds more unix and utc methods. Adds min, max, sort methods.

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
