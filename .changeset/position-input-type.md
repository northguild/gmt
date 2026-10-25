---
---

No release. `Position` and `readPosition` live in `packages/gmt/src/internal/position.ts`, which no export path reaches, so the public API does not change. No story in this epic takes a `Position` yet; the first one that does exports the type. The README's test counts change too.
