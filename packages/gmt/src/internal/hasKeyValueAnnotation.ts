/** An RFC 9557 suffix annotation carrying a key, i.e. `[key=value]` rather than `[zone]`. */
const keyValueAnnotation = /\[[^\]]*=/;

/**
 * Return true when `value` carries any RFC 9557 `[key=value]` annotation.
 *
 * The wider sibling of `hasCalendarAnnotation`, which asks only about `[u-ca=...]`. A
 * bracketed time zone — `[America/New_York]`, `[!America/New_York]`, `[-04:00]` — carries no
 * `=` and does not match.
 *
 * Reach for this where an annotation GMT cannot vouch for must be refused rather than
 * ignored. `Temporal` silently drops an unknown non-critical annotation, per RFC 9557 §3.2,
 * which is the right default for a parser and the wrong one for a library whose contract is
 * that it never guesses: an event tagged `[x-provenance=estimated]` is not the same fact as
 * one without it, and GMT has no way to know that it is not.
 *
 * @param value candidate ISO 8601 string
 * @returns boolean indicating whether any key-carrying annotation is present
 *
 * @example hasKeyValueAnnotation("2024-07-15T12:00:00-04:00[u-ca=hebrew]") // true
 * @example hasKeyValueAnnotation("2024-07-15T12:00:00-04:00[foo=bar]") // true
 * @example hasKeyValueAnnotation("2024-07-15T12:00:00-04:00[America/New_York][foo=bar]") // true
 * @example hasKeyValueAnnotation("2024-07-15T12:00:00-04:00[America/New_York]") // false
 * @example hasKeyValueAnnotation("2024-07-15T12:00:00-04:00") // false
 */
export function hasKeyValueAnnotation(value: string): boolean {
  return typeof value === "string" && keyValueAnnotation.test(value);
}
