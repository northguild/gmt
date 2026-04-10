---
name: ci-enforcement
description: >
  Add reliable CI enforcement for @burglekitt/gmt-biome Date-ban policy across
  PR and mainline builds, with phased rollout controls to avoid blocking
  unrelated migration progress.
---

# CI Enforcement

Use this skill when a team wants automated enforcement of gmt-biome rules.

## CI strategy

1. Add lint/check command
- Ensure CI runs a Biome check command on pull requests.

2. Plugin selection
- Decide whether to extend the full `@burglekitt/gmt-biome` bundle or include specific plugins by referencing `@burglekitt/gmt-biome/plugins/<name>` (or `@burglekitt/gmt-biome/plugins/<name>.grit`) in your project's `plugins` list. Prefer plugin subpaths when you only want a subset of rules.

3. Scope rollout
- If the repository has many existing violations, propose incremental adoption:
  - start on changed files or selected paths,
  - then expand to full repository enforcement.

4. Keep output actionable
- Configure CI so diagnostics are visible and easy to triage.

5. Coordinate with other linters
- If ESLint/Oxlint are present, avoid redundant failures where possible.
- Keep Date-ban policy consistent across tools.

## Recommended progression

1. Establish baseline locally.
2. Enable PR enforcement.
3. Expand to full repo checks.
4. Pair rule violations with guided gmt refactor suggestions.

## Guardrails

- Do not hide violations silently.
- Do not auto-fix risky date/time behavior without tests.
- Preserve developer velocity with phased rollout when needed.
