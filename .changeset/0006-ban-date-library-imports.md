---
"@northguild/gmt-biome": minor
"@northguild/gmt-eslint": minor
"@northguild/gmt-oxlint": minor
---

Ban imports of date libraries that wrap or pass native `Date` objects: `moment`, `moment-timezone`, `dayjs`, `luxon`, `date-fns`, `date-fns-tz`, and `spacetime`. Reaching for one of these reintroduces exactly the ambient-timezone and DST bugs GMT exists to prevent, so all three linter packages now flag it at the import site rather than waiting for the `Date` misuse downstream.

Every specifier form is covered — default, named, namespace, side-effect, type-only, subpaths such as `date-fns/format`, `require()`, dynamic `import()`, and `export … from`. Relative paths that merely contain a banned name (`./my-moment-helper`) are not flagged.

`@js-joda/core` is deliberately **not** banned. Its internal representation is its own value types and it touches `Date` only at the boundary — reading the clock, host zone lookup, and `toDate()` interop — so it does not carry the problems this ban targets.

New in each package: `no-date-library-imports.grit` for Biome (also folded into `all.grit`), `no-restricted-imports` plus two `no-restricted-syntax` selectors for ESLint, and a `no-date-library-imports` rule for Oxlint, added to its recommended config.
