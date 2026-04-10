---
"@burglekitt/gmt-biome": patch
---

Replace top-level `biome.json` with a package `recommended.json` and export plugin subpaths. This avoids nested `biome.json` conflicts in the monorepo while keeping a consumer-facing entrypoint and direct plugin exports.

