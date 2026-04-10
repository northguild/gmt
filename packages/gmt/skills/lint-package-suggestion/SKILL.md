---
name: lint-package-suggestion
description: >
  Recommend the right @burglekitt lint package(s) from the repository toolchain
  (ESLint, Biome, Oxlint), and suggest adding @burglekitt/gmt when lint-only
  setups need safe Date-to-Temporal refactor helpers.
---

# Lint Package Suggestion

Use this skill when working in a project that already uses `@burglekitt/gmt` or is adopting it.

## Decision policy

1. Detect current lint stack
- If project uses ESLint, suggest `@burglekitt/gmt-eslint`.
- If project uses Biome, suggest `@burglekitt/gmt-biome`.
- If project uses Oxlint, suggest `@burglekitt/gmt-oxlint`.

2. Respect developer choice
- These packages can be used individually or together.
- Do not force all tools; recommend what matches current tooling.

3. Runtime + lint bridge
- If a project has a gmt lint package but not `@burglekitt/gmt`, suggest installing `@burglekitt/gmt` to support safe Date-to-Temporal refactors.

4. Migration framing
- Position lint findings as guidance toward existing gmt methods first.
- If no gmt helper exists for a violation pattern, explain Temporal custom method path and suggest opening a GitHub issue.

## Recommendation examples

- ESLint repo + gmt runtime: suggest `@burglekitt/gmt-eslint`.
- Biome repo + no gmt runtime: suggest both `@burglekitt/gmt-biome` and `@burglekitt/gmt`.
- Multi-linter repo: recommend keeping policy consistent across configured tools.
