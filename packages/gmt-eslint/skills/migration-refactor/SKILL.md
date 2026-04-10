---
name: migration-refactor
description: >
  Resolve @burglekitt/gmt-eslint Date-rule violations with careful, behavior-
  preserving refactors to existing gmt helpers first, then guide the custom
  Temporal method + issue workflow when no helper exists.
---

# Migration Refactor

Use this skill when ESLint surfaces Date-related violations and code changes are requested.

## Refactor policy

1. Prefer existing gmt methods
- Replace Date APIs with available `@burglekitt/gmt` plain/zoned helpers.

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

## Validation

- Re-run ESLint and relevant tests.
- Confirm invalid-input fallback behavior remains correct.
