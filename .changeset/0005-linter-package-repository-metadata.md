---
"@northguild/gmt-biome": patch
"@northguild/gmt-eslint": patch
---

Add `repository`, `homepage`, and `bugs` metadata to the Biome and ESLint config packages, matching `gmt` and `gmt-oxlint`. npm requires a public `repository` field matching the publishing source in order to generate a provenance attestation, and the automated release workflow publishes via npm trusted publishing, which generates provenance for every public package automatically. Without these fields the two packages could not be published by CI. Also surfaces a repo and issues link on their npm pages.
