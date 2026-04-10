---
name: first-time-setup
description: >
  Install and configure @burglekitt/gmt-oxlint in .oxlintrc.*, enable plugin
  rules in jsPlugins/rules, and verify gmt-oxlint diagnostics while preserving
  current repository lint behavior.
---

# First-Time Setup

Use this skill when a user wants to adopt `@burglekitt/gmt-oxlint`.

## Setup flow

1. Install dependencies
- Install `@burglekitt/gmt-oxlint` and `oxlint` as dev dependencies.

2. Configure Oxlint
- Add `@burglekitt/gmt-oxlint` to `.oxlintrc.json` `jsPlugins`.
- Enable gmt-oxlint Date-ban rules under `rules`.
- Keep unrelated existing rules unless the user requests consolidation.

3. Verify enforcement
- Run Oxlint and confirm Date API bans are reported.
- Confirm rule IDs are emitted as `gmt-oxlint/*`.

4. Suggest companion packages
- If `@burglekitt/gmt` is missing, suggest installing it for safe Date-to-Temporal refactors.
- If ESLint or Biome are already used, optionally suggest matching gmt lint packages for policy consistency.

## Guardrails

- Keep setup additive and low-risk.
- Avoid broad config rewrites.
- Respect that developers may use one linter package or combine multiple.
