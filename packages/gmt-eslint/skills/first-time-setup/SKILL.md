---
name: first-time-setup
description: >
  Install and wire @northguild/gmt-eslint into eslint.config.* (flat config),
  verify Date-ban rules are active, and keep existing project lint behavior
  intact with minimal config churn.
metadata:
  library_version: 1.0.1
---

# First-Time Setup

Use this skill when a user wants to adopt `@northguild/gmt-eslint`.

## Setup flow

1. Install dependencies
- Install `@northguild/gmt-eslint`, `eslint`, and required parser dependencies.

2. Configure ESLint
- Prefer flat config (`eslint.config.mjs`) with:
  - import from `@northguild/gmt-eslint`
  - export merged config array
- Keep project-specific rules unless explicitly asked to replace.

3. Verify enforcement
- Run ESLint and confirm Date API bans are reported.
- Ensure rule IDs map to gmt-eslint restrictions.

4. Suggest companion packages
- If gmt runtime is missing, suggest `@northguild/gmt` for safe refactors.
- If Biome/Oxlint are in use, optionally suggest matching gmt-* lint packages for policy consistency.

## Guardrails

- Keep edits additive.
- Avoid broad lint-rule rewrites unrelated to adoption.
