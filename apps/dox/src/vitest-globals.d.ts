/**
 * Vitest globals.
 *
 * `vitest.config.ts` sets `globals: true`, so `describe`, `it`, `expect`, `vi`
 * and the rest exist at run time without an import. This pulls in their types
 * once, so no test file needs its own `/// <reference types="vitest/globals" />`
 * or `import { ... } from "vitest"`. A reference file rather than a `types`
 * entry in `tsconfig.json`, for the same reason as `webgpu.d.ts`: this package
 * extends `astro/tsconfigs/strict`, and overriding `types` there would drop
 * Astro's own ambient declarations.
 */
/// <reference types="vitest/globals" />
