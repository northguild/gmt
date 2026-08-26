# @northguild/gmt-eslint

## 1.0.4

### Patch Changes

- e0b3c6e: Publish packages under the `@northguild` npm org, replacing the retired `@burglekitt` scope.

## 1.0.3

### Patch Changes

- 131087a: Add deprecation notice: this package is moving to `@northguild/gmt-eslint` under the [northguild](https://github.com/northguild) GitHub organization. `@northguild/gmt-eslint` will receive no further updates after this release.

## 1.0.2

### Patch Changes

- Nest skill frontmatter fields (`library_version`, etc.) under `metadata:` to match the Intent ≥0.1 schema. The previously published skill files used the older flat frontmatter and fail validation under current `@tanstack/intent` versions. No skill content or lint rule behavior changes.

## 1.0.1

### Patch Changes

- c064e99: Rewrite lint rule messages to remove informal "Aint nobody got time for..." phrasing in favor of direct, professional wording. No rule behavior changes — only the emitted message text.

## 1.0.0

### Major Changes

- fa5a465: Initial public release of the gmt suite.

  ## @northguild/gmt

  Temporal-first date and time library. String-in, string-out API wrapping
  `@js-temporal/polyfill`. Covers plain and zoned arithmetic, comparison,
  formatting, parsing, mapping, conversion, and validation. No `Date` object
  used anywhere.

  ## @northguild/gmt-eslint

  ESLint flat-config plugin that bans the `Date` API (`new Date`, `Date.now`,
  `Date.UTC`, `Date.parse`, and the global `Date` reference) and points
  consumers toward `@northguild/gmt` replacements.

  ## @northguild/gmt-oxlint

  Oxlint JS plugin with the same `Date`-ban policy as `gmt-eslint`. Rules
  cover `new Date`, `Date.now`, `Date.UTC`, `Date.parse`,
  `date.getTimezoneOffset`, and bare `Date` global references.

  ## @northguild/gmt-biome

  Biome GritQL plugin enforcing the same `Date`-ban rules for projects using
  Biome as their formatter/linter.
