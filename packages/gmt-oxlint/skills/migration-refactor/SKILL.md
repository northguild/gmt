---
name: migration-refactor
description: >
  Resolve @burglekitt/gmt-oxlint Date-rule violations by preferring existing
  gmt helpers, preserving behavior, and guiding the Temporal custom-method path
  when gmt does not yet provide a needed helper.
---

# Migration Refactor

Use this skill when Oxlint reports Date API violations and the user asks for fixes.

## Refactor policy

1. Prefer existing gmt helpers
- Replace Date APIs with available `@burglekitt/gmt` methods first.

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

## Validation

- Re-run Oxlint and related tests.
- Verify invalid-input fallback behavior remains compliant.
