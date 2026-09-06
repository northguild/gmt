---
name: gmt-integration
description: >
  Application integration patterns — stable cache keys, router/query params,
  table-sort keys, and lint package selection (ESLint, Biome, Oxlint). Reads
  the installed package README.md and lint-package READMEs for API details; this
  skill is a routing pointer, not an API dump.
sources:
  - 'northguild/gmt:README.md'
  - 'northguild/gmt:packages/gmt/src/zoned/validate/index.ts'
metadata:
  type: composition
  library: '@northguild/gmt'
  library_version: '1.14.2'
---

# GMT Integration

Use this skill when integrating GMT into an application framework or choosing
which lint package to install for Date-ban enforcement.

## When to load

- The user asks about cache keys, router params, or table-sort keys for dates.
- The user wants to validate a timezone id before using it as a cache key.
- The user is picking an ESLint, Biome, or Oxlint plugin to ban `Date` APIs.
- The user has a lint package but not the gmt runtime (or vice versa).

## Core rules

1. **Canonical, stable representations at boundaries.** Use ISO 8601 strings or
   normalized epoch numbers for cache keys — never `Date` objects or fuzzy
   strings. Different environments must produce the same key.
2. **Validate before you key.** Always run `isValidTimeZone` on a timezone parameter
   before using it as a cache key or router param — `"Invalid/Zone"` is a sentinel
   failure, not a real zone.
3. **Pick one canonical Unix unit.** If you mix epoch seconds and milliseconds,
   convert explicitly with `convertUtcToUnix` / `convertUtcToUnixMs` rather than
   dividing/multiplying by hand.
4. **Lint packages are toolchain-specific, not mutually exclusive.** Recommend
   only the one matching the project's existing linter; do not force all three.
5. **Read the READMEs.** This skill is a routing pointer. For full integration
   guidance, read the installed package's `README.md` and the matching
   `@northguild/gmt-eslint` / `gmt-oxlint` / `gmt-biome` README.

## Lint package selection

| Current lint stack | Recommend |
| --- | --- |
| ESLint | `@northguild/gmt-eslint` |
| Biome | `@northguild/gmt-biome` |
| Oxlint | `@northguild/gmt-oxlint` |
| No linter yet | Add one of the above; install `@northguild/gmt` first |

These can be used individually or together. If the project has a lint package
but no `@northguild/gmt`, suggest adding gmt to support safe Date-to-Temporal
refactors. Lint findings should point toward existing gmt methods first; only
suggest a new Temporal custom method (and an issue) when no gmt helper covers
the pattern.

## Integration guidance

- **Query/cache keys**: `['events', { start: '2024-02-29', end: '2024-03-01' }]`
  — ISO strings, validated.
- **Router params**: validate with `isValidDate` / `isValidTimeZone` before use.
- **Table sorting**: use ISO strings as sort keys for consistent ordering.
- **State management**: canonicalized strings/numbers at boundaries only.

## References

- [README — Install and Design Philosophy](README.md)
- [Lint Package Selection guide](/guides/integration/linting/)
- [Core Rules](/core-rules/)
