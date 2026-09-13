---
name: migration-refactor
description: >
  Resolve @northguild/gmt-biome Date-rule violations with delicate, behavior-
  safe refactors to existing gmt helpers first, then use the Temporal custom-
  method plus issue/PR workflow when helpers are missing.
metadata:
  library_version: 1.1.0
---

# Migration Refactor

Use this skill when Biome flags Date usage and the user asks for code fixes.

## Refactor policy

1. Prefer existing gmt APIs
- Replace Date patterns with existing `@northguild/gmt` methods first.

2. Keep refactors delicate
- Preserve runtime behavior, timezone intent, and output format.
- Avoid broad rewrites when a focused fix is possible.

3. If gmt method is missing
- Tell the user the behavior is possible via Temporal because gmt ships Temporal.
- Explain it requires a new custom method.
- Recommend filing a GitHub issue with expected inputs/outputs and timezone assumptions.
- If implementing immediately, include strong tests and suggest opening a PR.

## Common replacement direction

- `Date.now()` -> `getUnixNow(...)` or `getNow()` depending on expected shape.
- `new Date(...)` -> parse and transform through relevant gmt plain/zoned helpers.
- `Date.parse(...)` -> gmt conversion helper where available.
- `Date.UTC(...)` -> gmt UTC conversion helper where available.
- `no-date-library-imports.grit` on `moment`, `moment-timezone`, `dayjs`, `luxon`, `date-fns`,
  `date-fns-tz` or `spacetime` (including subpaths, `require()` and dynamic `import()`) ->
  replace the call sites with gmt equivalents, then remove the import. Do not route around it
  with a local re-export — `export … from` is flagged too. `@js-joda/core` is intentionally
  allowed.
- When porting library arithmetic, keep Temporal's semantics: a non-existent day clamps
  (`2024-02-29` + 1 year → `2025-02-28`); date-fns `setYear` rolls to 1 March instead, so
  flag that behaviour change to the user rather than copying it.

Note: if a consumer has chosen only a subset of plugins (individual plugin `.grit` file entries by path, for example `./node_modules/@northguild/gmt-biome/plugins/<name>.grit`, instead of `all.grit`), the set of diagnostics will be narrower — verify which plugin(s) are enabled before running broad automated refactors.

## Safety checks

- Verify fallback behavior for invalid inputs is preserved.
- Keep plain and zoned boundaries intact.
- Add or update tests for each behavior-sensitive change.
