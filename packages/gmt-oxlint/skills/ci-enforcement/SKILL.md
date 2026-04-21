---
name: ci-enforcement
description: >
  Enforce @burglekitt/gmt-oxlint Date-ban rules in CI with staged rollout,
  clear gmt-oxlint/* diagnostics, and policy alignment with ESLint/Biome where
  multiple linters are used.
---

# CI Enforcement

Use this skill when enabling Oxlint-based Date policy checks in CI.

## CI rollout

1. Add Oxlint lint step
- Ensure pull requests run Oxlint with gmt-oxlint plugin rules enabled.

2. Stage adoption for large repos
- Start with changed files or specific paths if baseline debt is high.
- Expand to full repository enforcement once baseline is controlled.

3. Keep diagnostics actionable
- Ensure CI output clearly reports `@burglekitt/gmt-oxlint/*` rule failures and paths.

4. Align multi-linter policy
- If ESLint/Biome are also enabled, keep Date-ban expectations consistent.

## Recommended sequence

1. Local baseline run.
2. PR enforcement.
3. Main branch full coverage.
4. Ongoing remediation through gmt-guided refactor suggestions.

## Guardrails

- Do not rely on broad suppression as default.
- Do not auto-apply risky time/date changes without tests.
- Preserve developer velocity with phased rollout where needed.
