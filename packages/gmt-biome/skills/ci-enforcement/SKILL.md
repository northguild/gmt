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
- Use `"plugins": ["./node_modules/@burglekitt/gmt-biome/plugins/all.grit"]` as a common way to enforce all Date-ban rules at once. Reference individual files (for example, `./node_modules/@burglekitt/gmt-biome/plugins/<name>.grit`) only when you want a strict subset. Plugin entries must be filesystem paths to `.grit` files, and those paths may be relative or absolute depending on your repository layout.
- **Never use `extends`** for these plugins — `extends` only accepts `biome.json` config files, not `.grit` files.

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
