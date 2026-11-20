/**
 * Zone names GMT refuses on every host (compat D35): hosts accept or refuse them by engine and OS
 * version, and tzdata versions give them different data. Lower case, for ASCII-case-insensitive
 * matching (ECMA-402 §6.5.1 matches identifiers ignoring ASCII case).
 *
 * - `EST5EDT`, `CST6CDT`, `MST7MDT`, `PST8PDT`: Zones in tzdb `backward` ("ahistorical", present
 *   only for backward compatibility); Links in tzdb 2024b to 2026c, Zones again with new
 *   pre-1967 data in 2026d.
 * - `CET`, `EET`, `MET`, `WET`: Links since tzdb 2024b.
 * - `Factory`: a Zone in tzdb `factory` whose meaning a distributor may change.
 */
const REFUSED_ZONE_NAMES: ReadonlySet<string> = new Set([
  "cet",
  "cst6cdt",
  "eet",
  "est5edt",
  "factory",
  "met",
  "mst7mdt",
  "pst8pdt",
  "wet",
]);

/**
 * Lower-case the ASCII letters of a string and nothing else. ECMA-402 §6.5.1 matches identifiers
 * ignoring ASCII case, so a locale-free, Unicode-free fold is the one it means; `toLowerCase()`
 * would also fold non-ASCII letters.
 *
 * @param text the string to fold
 * @returns the string with `A` to `Z` replaced by `a` to `z`
 *
 * @example asciiLower("EST5EDT") // "est5edt"
 * @example asciiLower("İ") // "İ"
 */
export function asciiLower(text: string): string {
  return text.replace(/[A-Z]/g, (letter) =>
    String.fromCharCode(letter.charCodeAt(0) + 32),
  );
}

/**
 * Whether a zone name is one of the nine GMT refuses on every host (compat D35), in any ASCII
 * case.
 *
 * @param id the candidate zone name
 * @returns `true` for `CET`, `CST6CDT`, `EET`, `EST5EDT`, `Factory`, `MET`, `MST7MDT`, `PST8PDT`
 *   and `WET`
 *
 * @example isRefusedZoneName("EST5EDT") // true
 * @example isRefusedZoneName("est5edt") // true
 * @example isRefusedZoneName("EST") // false
 */
export function isRefusedZoneName(id: string): boolean {
  return REFUSED_ZONE_NAMES.has(asciiLower(id));
}
