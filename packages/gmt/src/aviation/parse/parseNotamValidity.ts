import type { NotamValidity } from "../../types/notam";
import type { TwoDigitYearOptions } from "../../types/two-digit-year";
import { readNotamValidity } from "../../internal/notamDateTime";

/**
 * Parse a NOTAM item B) or C) value as a UTC instant, an estimate, or a permanent validity.
 *
 * - **What it reads.** The ten-digit date-time group `YYMMDDHHMM` in UTC (item B and item C), the
 *   same group followed by `EST` with no space (item C), or `PERM` (item C). One group at a time:
 *   no `B)`/`C)` label, no whitespace.
 * - **`PERM` is a state.** Permanent validity has no end, so it is `{ kind: "permanent" }` and not
 *   a far-future date. It still needs `options.yearWindow`: a call without a window is malformed,
 *   found on the first value and not on the first dated one.
 * - **`EST` keeps its instant.** `estimated: true` marks the time as an estimate (the NOTAM is
 *   later replaced or cancelled), not an end.
 * - **The century is the caller's.** `options.yearWindow` places `YY` in a hundred-year window: a
 *   fixed first year, for stored NOTAMs, or `"rolling"`, for a live feed. Without `yearWindow`
 *   the result is `null`.
 * - **Nothing is corrected.** `2400`, `WIE` and `UFN` return `null`; OPADD gives those fixes to a
 *   NOTAM Processing Unit, not to a reader. A month, day, hour or minute that does not exist
 *   returns `null`.
 * - **UTC in and out.** Both are UTC by the standard, so no local wall time is resolved and no
 *   disambiguation policy applies.
 * - **Sources.** ICAO PANS-AIM (Doc 10066), Appendix 3 §5 and §6: the ten-figure group in UTC,
 *   `0000`, `2359` and not `2400`, `EST`, `PERM`, and the later cancellation or replacement of an
 *   `EST` NOTAM. EUROCONTROL-GUID-121, _OPADD_ Ed. 4.1, as the multinational peer, for what ICAO
 *   does not say: no space before `EST` and no `WIE`, `WEF`, `UFN` or `APRX DUR` (§2.3.16,
 *   §2.3.17), and the corrections a NOTAM Processing Unit makes (Ch. 3).
 *
 * @param value A NOTAM item B) or C) value (e.g. "2506151200", "1407031230EST", "PERM")
 * @param options The hundred-year window a two-digit year is read in
 * @returns the validity ({ kind: "instant", instant, estimated } or { kind: "permanent" }), or null on invalid input
 *
 * @example parseNotamValidity("2506151200", { yearWindow: 2000 }) // { kind: "instant", instant: "2025-06-15T12:00:00Z", estimated: false }
 * @example parseNotamValidity("1407031230EST", { yearWindow: 2000 }) // { kind: "instant", instant: "2014-07-03T12:30:00Z", estimated: true }
 * @example parseNotamValidity("PERM", { yearWindow: 2000 }) // { kind: "permanent" }
 * @example parseNotamValidity("1407031230 EST", { yearWindow: 2000 }) // null
 * @example parseNotamValidity("2506152400", { yearWindow: 2000 }) // null
 * @example parseNotamValidity("2506151200", {}) // null
 */
export function parseNotamValidity(
  value: string,
  options: TwoDigitYearOptions,
): NotamValidity | null {
  return readNotamValidity(value, options);
}
