/**
 * Static registry of gmt module imports for the browser.
 *
 * Each entry is a dynamic import of a module barrel
 * (`@northguild/gmt/<ns>/<module>`). Vite resolves these at build time,
 * so the polyfill + the requested module are bundled into a separate chunk
 * that only loads when a playground hydrates (`client:visible`).
 *
 * Import at module granularity only — never namespace (`@northguild/gmt/zoned`)
 * and never per-function. See DOX-B1a spec, "Corrected 2026-08-26".
 */

export const GMT_MODULES: Record<string, () => Promise<Record<string, unknown>>> = {
  "zoned/calculate": () => import("@northguild/gmt/zoned/calculate"),
  "plain/calculate": () => import("@northguild/gmt/plain/calculate"),
  "plain/validate": () => import("@northguild/gmt/plain/validate"),
  "plain/compare": () => import("@northguild/gmt/plain/compare"),
  "plain/format": () => import("@northguild/gmt/plain/format"),
  "plain/parse": () => import("@northguild/gmt/plain/parse"),
  "plain/get": () => import("@northguild/gmt/plain/get"),
  "plain/interval": () => import("@northguild/gmt/plain/interval"),
  "duration": () => import("@northguild/gmt/duration"),
  "zoned/validate": () => import("@northguild/gmt/zoned/validate"),
  "zoned/convert": () => import("@northguild/gmt/zoned/convert"),
  "zoned/format": () => import("@northguild/gmt/zoned/format"),
  "zoned/get": () => import("@northguild/gmt/zoned/get"),
  "zoned/compare": () => import("@northguild/gmt/zoned/compare"),
  "zoned/parse": () => import("@northguild/gmt/zoned/parse"),
  "zoned/map": () => import("@northguild/gmt/zoned/map"),
  "unix/convert": () => import("@northguild/gmt/unix/convert"),
  "utc/convert": () => import("@northguild/gmt/utc/convert"),
  "utc/format": () => import("@northguild/gmt/utc/format"),
};
