/**
 * Shared, **client-safe** widget data.
 *
 * ## Why this module exists
 *
 * `CURATED_TIMEZONES` used to live in `scripts/build-utils/build-utils.ts`,
 * which does `import ts from "typescript"` at its top level. That was safe only
 * by accident: its two consumers — `DstInspector.astro` and
 * `ConverterBench.astro` — both imported it from *frontmatter*, so the array was
 * inlined into server-rendered HTML at build time and the compiler never entered
 * a browser chunk. `globe-zones.ts` wanted the same list, could not risk the
 * import, and duplicated all twenty entries instead, with a test to police the
 * copies.
 *
 * `DOX-C3b` mounts these widgets from the chat rail, which means their zone
 * `<select>` has to be produced by a client-reachable template function. The
 * moment that function referenced the old location, the TypeScript compiler
 * would have been pulled into the `/dox` bundle.
 *
 * So the dependency is inverted: this module owns the data, and
 * `build-utils.ts` re-exports *from* here. Nothing in `src/lib/` reaches
 * `scripts/`, which `client-graph.test.ts` asserts mechanically.
 *
 * Keep this file free of imports. Its whole value is being safe to reach from
 * anywhere — build script, Astro frontmatter, or the browser.
 */

/**
 * A curated spread of UTC offsets and DST behaviours — northern and southern
 * hemisphere, half-hour and 45-minute offsets, and zones that do not observe
 * DST at all. Used by the DST inspector, the converter bench, the reference
 * playground and the globe.
 */
export const CURATED_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
] as const;

/**
 * The 17 locales `@northguild/gmt` is tested against — mirrors
 * `packages/gmt/src/test/localeMatrix.ts`'s `MustTestLocales`.
 *
 * Previously a bare array in `ConverterBench.astro`'s frontmatter with no module
 * at all, which made it unreachable from a client-side template.
 */
export const CONVERTER_LOCALES = [
  "en-US",
  "en-GB",
  "de-DE",
  "fr-FR",
  "es-ES",
  "it-IT",
  "pt-PT",
  "sv-SE",
  "is-IS",
  "zh-CN",
  "zh-TW",
  "ja-JP",
  "ko-KR",
  "ar-SA",
  "he-IL",
  "ru-RU",
  "tr-TR",
] as const;
