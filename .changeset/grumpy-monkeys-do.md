---
"@burglekitt/gmt-biome": patch
---

Add `.grit` extension exports for all plugins to support both extensionless and `.grit` subpath imports (for example, `plugins/no-new-date` and `plugins/no-new-date.grit`), and change the package entrypoint from `recommended.json` to `biome.json` by removing `recommended.json`.
