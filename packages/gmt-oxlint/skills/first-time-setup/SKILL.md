---
name: first-time-setup
description: >
  Install and configure @burglekitt/gmt-oxlint with the simplest consumer DX,
  prefer oxlint.config.ts + recommendedConfig import, and verify
  gmt-oxlint diagnostics while preserving current repository lint behavior.
---

# First-Time Setup

Use this skill when a user wants to adopt `@burglekitt/gmt-oxlint`.

## Setup flow

1. Install dependencies
- Install `@burglekitt/gmt-oxlint` and `oxlint` as dev dependencies.

2. Configure Oxlint (prefer TypeScript config for best DX)
- Prefer `oxlint.config.ts` with:
  - `import { defineConfig } from "oxlint"`
  - `import { recommendedConfig } from "@burglekitt/gmt-oxlint"`
  - `export default defineConfig(recommendedConfig)`
- If using `.oxlintrc.json`, add `@burglekitt/gmt-oxlint` to `jsPlugins` and use path-based extends:
  - `extends: ["./node_modules/@burglekitt/gmt-oxlint/config/recommended.json"]`
- Do not use named shared config specifiers in JSON `extends` (for example `@burglekitt/gmt-oxlint/recommended`); Oxlint currently resolves `extends` as file paths.
- Keep unrelated existing rules unless the user requests consolidation.

3. Verify enforcement
- Run Oxlint and confirm Date API bans are reported.
- Confirm rule IDs are emitted as `@burglekitt/gmt-oxlint/*`.

4. Optional aliasing
- If the user wants shorter rule IDs, use object-form `jsPlugins` with `name` alias and configure rules under that alias.
- Keep the default package-name namespace unless a shorter alias is explicitly requested.

5. Suggest companion packages
- If `@burglekitt/gmt` is missing, suggest installing it for safe Date-to-Temporal refactors.
- If ESLint or Biome are already used, optionally suggest matching gmt lint packages for policy consistency.

## Guardrails

- Keep setup additive and low-risk.
- Avoid broad config rewrites.
- Respect that developers may use one linter package or combine multiple.
