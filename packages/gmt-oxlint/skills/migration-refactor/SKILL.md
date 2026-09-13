---
name: migration-refactor
description: >
  Resolve @northguild/gmt-oxlint Date-rule violations by preferring existing gmt
  helpers, preserving behavior, and guiding the Temporal custom-method path when
  gmt does not yet provide a needed helper.
metadata:
  library_version: 1.2.0
---

# Migration Refactor

Use this skill when Oxlint reports Date API violations and the user asks for fixes.

## Refactor policy

1. Prefer existing gmt helpers
- Replace Date APIs with available `@northguild/gmt` methods first.

2. Preserve behavior
- Keep output format, timezone intent, and edge-case semantics stable.
- Avoid risky broad rewrites if focused edits are sufficient.

3. If helper is missing
- Explain the behavior is possible through Temporal (shipped by gmt).
- Clarify this requires a new custom gmt method.
- Recommend opening a GitHub issue with examples and expected behavior.
- If implemented now, include robust tests and suggest opening a PR.

## Common replacement direction

- `Date` global usage -> explicit gmt get/convert/parse flows.
- `new Date(...)` -> gmt plain/zoned parsing + conversion where available.
- `Date.now()` -> `getUnixNow(...)` or `getNow()` based on expected shape.
- `Date.parse(...)` -> gmt conversion helper where available.
- `Date.UTC(...)` -> gmt UTC conversion helper where available.
- `getTimezoneOffset()` usage -> timezone-aware gmt zoned helpers.
- `no-date-library-imports` (`moment`, `moment-timezone`, `dayjs`, `luxon`, `date-fns`,
  `date-fns-tz`, `spacetime`, including subpaths, `require()` and dynamic `import()`) ->
  replace the call sites with gmt equivalents, then remove the import. Do not silence it by
  re-exporting through a local module — `export … from` is flagged too. `@js-joda/core` is
  intentionally allowed.
- When porting library arithmetic, keep Temporal's semantics: a non-existent day clamps
  (`2024-02-29` + 1 year → `2025-02-28`); date-fns `setYear` rolls to 1 March instead, so
  flag that behaviour change to the user rather than copying it.

## Validation

- Re-run Oxlint and related tests.
- Verify invalid-input fallback behavior remains compliant.
