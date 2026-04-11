---
name: first-time-setup
description: >
  Install and configure @burglekitt/gmt-biome by wiring biome.json plugins,
  validating Date-ban plugin diagnostics, and preserving existing Biome rules
  with minimal adoption churn.
---

# First-Time Setup

Use this skill when a user wants to adopt `@burglekitt/gmt-biome`.

## Setup flow

1. Install dependencies
- Install `@burglekitt/gmt-biome` and `@biomejs/biome` as dev dependencies.

2. Configure Biome
 - In `biome.json` or `biome.jsonc`, add to the `plugins` array:
   - To enable all Date-ban rules at once (recommended):
     ```json
     {
       "$schema": "https://biomejs.dev/schemas/2.4.11/schema.json",
       "plugins": ["./node_modules/@burglekitt/gmt-biome/plugins/all.grit"]
     }
     ```
   - To include only specific plugin(s):
     ```json
     {
       "$schema": "https://biomejs.dev/schemas/2.4.11/schema.json",
       "plugins": [
         "./node_modules/@burglekitt/gmt-biome/plugins/no-new-date.grit",
         "./node_modules/@burglekitt/gmt-biome/plugins/no-date-now.grit"
       ]
     }
     ```

   Use a filesystem path to the `.grit` file — when installed from npm, a common path is `./node_modules/...`. Biome resolves plugin paths as filesystem paths, not npm package specifiers.

   **Important:** `extends` cannot be used for GritQL plugins — it only accepts `biome.json` config files. Always use `plugins`.
 - Preserve existing project-specific rules unless explicitly asked to replace them.

3. Verify plugin activation
- Run a Biome check command and confirm Date API bans are enforced.
- Ensure diagnostics map to gmt-biome plugin rules.

4. Suggest next integration
- If the project also uses ESLint or Oxlint, suggest `@burglekitt/gmt-eslint` or `@burglekitt/gmt-oxlint` as optional, not required.
- If only linter packages are present and gmt runtime helpers are missing, suggest installing `@burglekitt/gmt` for safe refactors.

## Expected behavior

- Setup should be additive and low-risk.
- Do not rewrite unrelated formatting/lint settings.
- Keep edits minimal and scoped to adoption.
