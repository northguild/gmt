---
name: migration-refactor
description: >
  Resolve @northguild/gmt-eslint Date-rule violations with careful, behavior-
  preserving refactors to existing gmt helpers first, then guide the custom
  Temporal method + issue workflow when no helper exists.
metadata:
  library_version: 1.1.0
---

# Migration Refactor

Use this skill when ESLint surfaces Date-related violations and code changes are requested.

## Refactor policy

1. Prefer existing gmt methods
- Replace Date APIs with available `@northguild/gmt` plain/zoned helpers.

2. Preserve behavior
- Maintain output shape, timezone intent, and boundary behavior.
- Avoid risky wide-scope rewrites.

3. Missing helper flow
- Explain capability is possible through Temporal because gmt ships Temporal.
- Clarify this requires a new custom gmt method.
- Recommend opening a GitHub issue with expected behavior and examples.
- If implementing now, add robust tests and suggest opening a PR.

## Typical replacement direction

- `Date.now()` -> `getUnixNow(...)` or `getNow()` based on expected output.
- `new Date(...)` -> appropriate gmt parsing/conversion path.
- `Date.parse(...)` -> gmt conversion helper where available.
- `Date.UTC(...)` -> gmt UTC conversion helper where available.
- `no-restricted-imports` / `no-restricted-syntax` on `moment`, `moment-timezone`, `dayjs`,
  `luxon`, `date-fns`, `date-fns-tz` or `spacetime` (including subpaths, `require()` and dynamic
  `import()`) -> replace the call sites with gmt equivalents, then remove the import. Do not
  route around it with a local re-export — `export … from` is flagged too. `@js-joda/core` is
  intentionally allowed.
- When porting library arithmetic, keep Temporal's semantics: a non-existent day clamps
  (`2024-02-29` + 1 year → `2025-02-28`); date-fns `setYear` rolls to 1 March instead, so
  flag that behaviour change to the user rather than copying it.

## Validation

- Re-run ESLint and relevant tests.
- Confirm invalid-input fallback behavior remains correct.
