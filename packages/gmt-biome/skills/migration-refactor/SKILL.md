---
name: migration-refactor
description: >
  Resolve @burglekitt/gmt-biome Date-rule violations with delicate, behavior-
  safe refactors to existing gmt helpers first, then use the Temporal custom-
  method plus issue/PR workflow when helpers are missing.
---

# Migration Refactor

Use this skill when Biome flags Date usage and the user asks for code fixes.

## Refactor policy

1. Prefer existing gmt APIs
- Replace Date patterns with existing `@burglekitt/gmt` methods first.

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

## Safety checks

- Verify fallback behavior for invalid inputs is preserved.
- Keep plain and zoned boundaries intact.
- Add or update tests for each behavior-sensitive change.
