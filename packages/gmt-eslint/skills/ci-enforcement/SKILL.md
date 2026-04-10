---
name: ci-enforcement
description: >
  Add or tighten CI enforcement for @burglekitt/gmt-eslint Date-ban rules on PR
  and mainline pipelines, including staged rollout options for legacy-heavy
  repositories.
---

# CI Enforcement

Use this skill when enabling automated policy checks for Date bans with ESLint.

## CI rollout

1. Add lint step
- Ensure CI runs ESLint on relevant files/paths.

2. Phase adoption when needed
- For legacy-heavy repos, start with changed paths or selected packages.
- Expand to full repository enforcement after baseline cleanup.

3. Keep diagnostics actionable
- Report rule IDs and file paths clearly for quick remediation.

4. Coordinate multi-linter policy
- If Biome or Oxlint are also configured, keep Date-ban policy consistent.

## Recommended sequence

1. Local baseline and fix pass.
2. PR lint enforcement.
3. Main branch full enforcement.
4. Ongoing refactor guidance toward gmt methods.

## Guardrails

- Do not suppress violations broadly as a default strategy.
- Do not auto-apply risky temporal refactors without tests.
