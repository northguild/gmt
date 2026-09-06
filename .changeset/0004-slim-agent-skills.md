---
"@northguild/gmt": patch
---

Slim the AI agent skill bundle: replace 13 verbose consumer skill files with 4 lightweight routing pointers (gmt-basics, gmt-arithmetic, gmt-timezone, gmt-integration) and relocate 5 contributor/maintainer skills under a `contributor/` subdirectory that is excluded from the published npm package. The `files` allowlist in package.json and `.npmignore` now prevent consumer installs from receiving contributor skills or `_artifacts/` build output. No TypeScript source or public API changed — the package dist output is identical.
