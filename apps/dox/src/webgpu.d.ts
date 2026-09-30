/**
 * WebGPU type definitions (#289).
 *
 * TypeScript's own `lib.dom.d.ts` still declares only `GPUError`, with no
 * `navigator.gpu`, so the globe's GPU renderer needs `@webgpu/types` pulled in
 * globally. A reference file rather than a `types` entry in `tsconfig.json`,
 * because this package extends `astro/tsconfigs/strict` and overriding `types`
 * there would drop Astro's own ambient declarations.
 */
/// <reference types="@webgpu/types" />
