/**
 * A period of time written as its two ends, `<start>/<end>`: two non-empty halves and the one
 * solidus that is outside any RFC 9557 bracket. UN/ECE Recommendation 7 ¶14: "Numerical
 * representations of the dates and times indicating the beginning, respectively, the end of a
 * period of time, separated by a solidus"
 * (http://web.archive.org/web/20201020110807/http://www.unece.org/fileadmin/DAM/cefact/recommendations/rec07/rec07_1988_inf108.pdf).
 * A bracketed annotation is stepped over whole, because a time zone annotation holds a solidus of
 * its own (`[Europe/London]`).
 */
const ISO_INTERVAL = /^((?:[^/[\]]|\[[^\]]*\])+)\/((?:[^/[\]]|\[[^\]]*\])+)$/;

/**
 * Split a period written as `<start>/<end>` at its solidus into its start and its end.
 *
 * - Shape only: neither half is read. Each goes to the validator of the kind its caller expects,
 *   so a duration (`P5D`), a shortened end (`06-20`) or a date that is not real is refused there.
 * - A solidus inside an RFC 9557 bracket belongs to the annotation and is not a separator:
 *   `2024-06-15T10:00+01:00[Europe/London]/2024-06-20T10:00+01:00[Europe/London]` has two halves.
 * - Null for a string with no solidus outside a bracket, with more than one, with an empty half,
 *   or with an unclosed or stray bracket.
 *
 * @param value candidate `<start>/<end>` string
 * @returns the two halves as written, or null when `value` is not an interval of two halves
 *
 * @example splitIsoInterval("2024-06-15/2024-06-20") // ["2024-06-15", "2024-06-20"]
 * @example splitIsoInterval("22:00/06:00") // ["22:00", "06:00"]
 * @example splitIsoInterval("2024-06-15T10:00Z[Europe/London]/2024-06-20T10:00Z") // ["2024-06-15T10:00Z[Europe/London]", "2024-06-20T10:00Z"]
 * @example splitIsoInterval("2024-06-15") // null (one value, not an interval)
 * @example splitIsoInterval("2024-06-15/2024-06-20/2024-06-25") // null (three halves)
 * @example splitIsoInterval("/2024-06-20") // null (an empty start)
 */
export function splitIsoInterval(value: string): [string, string] | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = ISO_INTERVAL.exec(value);
  return match === null ? null : [match[1], match[2]];
}
