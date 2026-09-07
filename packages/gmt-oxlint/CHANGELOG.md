# @northguild/gmt-oxlint

## 1.2.0

### Minor Changes

- 4b5d68b: Ban imports of date libraries that wrap or pass native `Date` objects: `moment`, `moment-timezone`, `dayjs`, `luxon`, `date-fns`, `date-fns-tz`, and `spacetime`. Reaching for one of these reintroduces exactly the ambient-timezone and DST bugs GMT exists to prevent, so all three linter packages now flag it at the import site rather than waiting for the `Date` misuse downstream.

  Every specifier form is covered — default, named, namespace, side-effect, type-only, subpaths such as `date-fns/format`, `require()`, dynamic `import()`, and `export … from`. Relative paths that merely contain a banned name (`./my-moment-helper`) are not flagged.

  `@js-joda/core` is deliberately **not** banned. Its internal representation is its own value types and it touches `Date` only at the boundary — reading the clock, host zone lookup, and `toDate()` interop — so it does not carry the problems this ban targets.

  New in each package: `no-date-library-imports.grit` for Biome (also folded into `all.grit`), `no-restricted-imports` plus two `no-restricted-syntax` selectors for ESLint, and a `no-date-library-imports` rule for Oxlint, added to its recommended config.

## 1.1.5

### Patch Changes

- e0b3c6e: Publish packages under the `@northguild` npm org, replacing the retired `@burglekitt` scope.

## 1.1.4

### Patch Changes

- 131087a: Add deprecation notice: this package is moving to `@northguild/gmt-oxlint` under the [northguild](https://github.com/northguild) GitHub organization. `@northguild/gmt-oxlint` will receive no further updates after this release.

## 1.1.3

### Patch Changes

- Nest skill frontmatter fields (`library_version`, etc.) under `metadata:` to match the Intent ≥0.1 schema. The previously published skill files used the older flat frontmatter and fail validation under current `@tanstack/intent` versions. No skill content or lint rule behavior changes.

## 1.1.2

### Patch Changes

- c064e99: Rewrite lint rule messages to remove informal "Aint nobody got time for..." phrasing in favor of direct, professional wording. No rule behavior changes — only the emitted message text.

## 1.1.1

### Patch Changes

- 7c4dbed: Fix @northguild/gmt-oxlint consumer integration by adding plugin discovery metadata and publishing a real recommended config artifact. Also update docs to reflect current Oxlint extends behavior (file-path based) and ensure recommended rules stay in sync via tests.

## 1.1.0

### Minor Changes

- 5fb3d57: Fixes consumption of gmt-oxlint, adding @northguild/gmt-oxlint to entire path

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
