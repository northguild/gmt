---
name: lint-package-suggestion
description: >
  Recommend the right @northguild lint package(s) from the repository toolchain
  (ESLint, Biome, Oxlint), and suggest adding @northguild/gmt when lint-only
  setups need safe Date-to-Temporal refactor helpers.
metadata:
  library_version: 1.14.1
---

# Lint Package Suggestion

Use this skill when working in a project that already uses `@northguild/gmt` or is adopting it.

## Decision policy

1. Detect current lint stack
- If project uses ESLint, suggest `@northguild/gmt-eslint`.
 - If project uses Biome, suggest `@northguild/gmt-biome` (or suggest selecting individual plugins via `@northguild/gmt-biome/plugins/<name>` when only a subset of rules is desired). Both `.../<name>` and `.../<name>.grit` forms are supported; prefer the extensionless form.
- If project uses Oxlint, suggest `@northguild/gmt-oxlint`.

2. Respect developer choice
- These packages can be used individually or together.
- Do not force all tools; recommend what matches current tooling.

3. Runtime + lint bridge
- If a project has a gmt lint package but not `@northguild/gmt`, suggest installing `@northguild/gmt` to support safe Date-to-Temporal refactors.

4. Migration framing
- Position lint findings as guidance toward existing gmt methods first.
- If no gmt helper exists for a violation pattern, explain Temporal custom method path and suggest opening a GitHub issue.

## Recommendation examples

- ESLint repo + gmt runtime: suggest `@northguild/gmt-eslint`.
- Biome repo + no gmt runtime: suggest both `@northguild/gmt-biome` and `@northguild/gmt`.
- Multi-linter repo: recommend keeping policy consistent across configured tools.
