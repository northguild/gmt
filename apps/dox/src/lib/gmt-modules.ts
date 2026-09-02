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

export const GMT_MODULES: Record<
  string,
  () => Promise<Record<string, unknown>>
> = {
  // --- plain ---
  "plain/calculate": () => import("@northguild/gmt/plain/calculate"),
  "plain/chop": () => import("@northguild/gmt/plain/chop"),
  "plain/compare": () => import("@northguild/gmt/plain/compare"),
  "plain/convert": () => import("@northguild/gmt/plain/convert"),
  "plain/format": () => import("@northguild/gmt/plain/format"),
  "plain/get": () => import("@northguild/gmt/plain/get"),
  "plain/interval": () => import("@northguild/gmt/plain/interval"),
  "plain/locale": () => import("@northguild/gmt/plain/locale"),
  "plain/map": () => import("@northguild/gmt/plain/map"),
  "plain/parse": () => import("@northguild/gmt/plain/parse"),
  "plain/validate": () => import("@northguild/gmt/plain/validate"),

  // --- duration ---
  duration: () => import("@northguild/gmt/duration"),

  // --- zoned ---
  "zoned/calculate": () => import("@northguild/gmt/zoned/calculate"),
  "zoned/chop": () => import("@northguild/gmt/zoned/chop"),
  "zoned/compare": () => import("@northguild/gmt/zoned/compare"),
  "zoned/convert": () => import("@northguild/gmt/zoned/convert"),
  "zoned/format": () => import("@northguild/gmt/zoned/format"),
  "zoned/get": () => import("@northguild/gmt/zoned/get"),
  "zoned/interval": () => import("@northguild/gmt/zoned/interval"),
  "zoned/map": () => import("@northguild/gmt/zoned/map"),
  "zoned/parse": () => import("@northguild/gmt/zoned/parse"),
  "zoned/validate": () => import("@northguild/gmt/zoned/validate"),

  // --- unix ---
  "unix/calculate": () => import("@northguild/gmt/unix/calculate"),
  "unix/compare": () => import("@northguild/gmt/unix/compare"),
  "unix/convert": () => import("@northguild/gmt/unix/convert"),
  "unix/format": () => import("@northguild/gmt/unix/format"),
  "unix/get": () => import("@northguild/gmt/unix/get"),
  "unix/interval": () => import("@northguild/gmt/unix/interval"),
  "unix/parse": () => import("@northguild/gmt/unix/parse"),
  "unix/validate": () => import("@northguild/gmt/unix/validate"),

  // --- utc ---
  "utc/calculate": () => import("@northguild/gmt/utc/calculate"),
  "utc/chop": () => import("@northguild/gmt/utc/chop"),
  "utc/compare": () => import("@northguild/gmt/utc/compare"),
  "utc/convert": () => import("@northguild/gmt/utc/convert"),
  "utc/format": () => import("@northguild/gmt/utc/format"),
  "utc/get": () => import("@northguild/gmt/utc/get"),
  "utc/interval": () => import("@northguild/gmt/utc/interval"),
  "utc/parse": () => import("@northguild/gmt/utc/parse"),
  "utc/validate": () => import("@northguild/gmt/utc/validate"),

  // --- regex ---
  regex: () => import("@northguild/gmt/regex"),
};
