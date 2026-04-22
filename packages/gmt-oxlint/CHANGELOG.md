# @burglekitt/gmt-oxlint

## 1.1.1

### Patch Changes

- 7c4dbed: Fix @burglekitt/gmt-oxlint consumer integration by adding plugin discovery metadata and publishing a real recommended config artifact. Also update docs to reflect current Oxlint extends behavior (file-path based) and ensure recommended rules stay in sync via tests.

## 1.1.0

### Minor Changes

- 5fb3d57: Fixes consumption of gmt-oxlint, adding @burglekitt/gmt-oxlint to entire path

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
