import { readOffsetInstant } from "../../internal";

/**
 * An absolute instant paired with the local UTC offset in force where the event happened.
 *
 * Neither `instant` nor `offset` derives from the other, which is why both are stored. It is
 * the shape GS1 EPCIS 2.0 (`eventTime` + a required `eventTimeZoneOffset`), UN/EDIFACT DTM
 * (format codes `205` and `208`, a date and time with a `±HHMM` offset) and DICOM (`DT` +
 * `&ZZXX`) all exchange.
 *
 * @example
 * import { OffsetInstant } from "@northguild/gmt/instant";
 * const pair: OffsetInstant = {
 *   instant: "2024-07-15T16:00:00Z",
 *   offset: "+05:30",
 *   timeZone: "Asia/Kolkata",
 * };
 */
export interface OffsetInstant {
  /**
   * The UTC instant, ISO 8601 ending in `Z` (e.g. `2024-07-15T16:00:00Z`). Orders events globally.
   */
  instant: string;
  /**
   * The UTC offset in force where the event happened, `±HH:MM` (or `±HH:MM:SS` for a pre-1972
   * zone that did not run on a whole minute). Renders the event as the human on the ground saw it.
   */
  offset: string;
  /**
   * The IANA name of the zone, when one is known. Most feeds send none, so `toOffsetInstant` leaves
   * it out unless the string or its `timeZone` argument names a zone.
   *
   * @defaultValue None. The pair names no zone, and `offset` alone places the instant on a local
   * clock.
   */
  timeZone?: string;
}

/**
 * Split an ISO 8601 instant string into the instant-plus-offset pair the world exchanges.
 *
 * - **An offset is not a zone.** `+02:00` does not identify `Africa/Johannesburg` — it is every
 *   zone at `+02:00` that day. Keep the offset for what already happened; keep the zone for
 *   anything still to be scheduled. `timeZone` is optional because most feeds send no zone.
 * - Accepts a `Z` instant, a bare `±HH:MM` offset, or a bracketed IANA zone, in ISO 8601
 *   extended format with a `T` separator — `isValidInstant`'s grammar. Basic format, a space or
 *   lower-case `t` separator and a lower-case `z` return null. RFC 9557
 *   annotations are read as Temporal reads them (RFC 9557 §3.3, proposal-temporal
 *   `ParseISODateTime`): a calendar (`[u-ca=hebrew]`) or elective (`[x-provenance=estimated]`)
 *   annotation is ignored, and an unknown critical one (`[!foo=bar]`) returns null.
 * - A bracketed zone whose offset contradicts it (`"...T12:00:00+00:00[Europe/London]"` in
 *   July) returns null. The string states two things that cannot both be true, and guessing
 *   which one the sender meant is exactly the bug the pair exists to prevent.
 * - A bracketed *offset* time zone (Temporal's own `[-04:00]` shape) yields no `timeZone`
 *   field. It names no place, so filling the field with it would claim GMT knows where the
 *   event happened when all it has is the offset it already stores. Every other bracketed
 *   identifier Temporal accepts is kept, including the single-component IANA names (`EST5EDT`,
 *   `Zulu`), in its IANA casing.
 * - `timeZone` names the zone the offset is read in, and is how a UTC-only feed gets a pair with a
 *   local offset. It also overrides a zone bracketed in the string — the instant is unchanged
 *   either way, only the local rendering differs. Any IANA Zone or Link name is accepted,
 *   single-component ones (`Japan`, `Zulu`, `EST5EDT`) included, and so is a UTC offset: a time
 *   zone identifier (`+05:30`, `+0530`, `-08`) or a stored offset (`±HH:MM[:SS]`, what
 *   `getTimeZoneOffset` returns). An offset (`"-05:00"`, `"-00:44:30"`) sets the pair's offset and,
 *   like a bracketed offset zone, yields no `timeZone` field.
 * - The returned `timeZone` is the identifier in its IANA casing on every path —
 *   `"europe/london"` comes back as `"Europe/London"` — because identifiers match
 *   case-insensitively (ECMA-402). That is what the bracket path and `fromOffsetInstant` return,
 *   so `toOffsetInstant(fromOffsetInstant(pair))` returns `pair`. A link name is kept, not
 *   replaced by its target. Compatibility: earlier releases echoed the argument's casing; pass
 *   the IANA-cased identifier to get the same string back.
 * - A `Z` (or RFC 3339 `-00:00`) instant is recorded with offset `+00:00`. RFC 9557 §2.2 reads
 *   `Z` and `-00:00` as "UTC known, local offset unknown", which differs from an explicit
 *   `+00:00`; the pair has no spelling for an unknown offset, so that distinction is not kept.
 * - An offset with fractional seconds (`+01:00:00.5`), which `isValidInstant` accepts, returns
 *   null: `offset` holds at most `±HH:MM:SS`.
 * - `offset` is `±HH:MM`, except for the handful of zones that did not run on a whole minute
 *   before 1972, where it is `±HH:MM:SS` — `Africa/Monrovia` really was `-00:44:30`, and
 *   rounding it would put the pair 30 seconds from the event it describes. Such a zone's
 *   *string* still carries the rounded `-00:45`, because RFC 9557 caps a written offset at
 *   minutes; the bracketed zone is what resolves it, so the instant stays exact.
 * - A bracketed zone is checked as `Temporal.ZonedDateTime.from` checks it, which also rejects
 *   a local date of −271821-04-19. A zone west of Greenwich shows that date for the first hours
 *   of the instant range, so a zoned string written there
 *   (`-271821-04-19T23:59:00-00:01[Europe/London]`) returns null, although `isValidInstant`
 *   accepts it. Pass the instant in `Z` form with `timeZone` instead.
 * - Returns null on invalid input, not a zero-offset pair — `+00:00` is a real offset.
 *
 * @param value ISO 8601 instant string, with an offset designator and optionally a bracketed zone
 * @param timeZone optional IANA name or UTC offset to read the offset in: a time zone identifier
 *   (`+05:30`, `+0530`, `-08`) or a stored offset (`±HH:MM[:SS]`, what `getTimeZoneOffset` returns)
 * @returns `{ instant, offset, timeZone? }`, or null on invalid input
 *
 * @example toOffsetInstant("2024-07-15T12:00:00+09:00[Asia/Tokyo]") // { instant: "2024-07-15T03:00:00Z", offset: "+09:00", timeZone: "Asia/Tokyo" }
 * @example toOffsetInstant("2024-07-15T12:00:00-04:00") // { instant: "2024-07-15T16:00:00Z", offset: "-04:00" } — an offset with no zone behind it
 * @example toOffsetInstant("2024-07-15T16:00:00Z") // { instant: "2024-07-15T16:00:00Z", offset: "+00:00" }
 * @example toOffsetInstant("2024-07-15T16:00:00Z", "Europe/London") // { instant: "2024-07-15T16:00:00Z", offset: "+01:00", timeZone: "Europe/London" }
 * @example toOffsetInstant("2024-01-15T17:00:00Z", "Europe/London") // { instant: "2024-01-15T17:00:00Z", offset: "+00:00", timeZone: "Europe/London" } — same wall time, different offset, six months apart
 * @example toOffsetInstant("1970-01-01T00:00:00Z", "Africa/Monrovia") // { instant: "1970-01-01T00:00:00Z", offset: "-00:44:30", timeZone: "Africa/Monrovia" }
 * @example toOffsetInstant("1970-01-01T12:44:30Z", "-00:44:30") // { instant: "1970-01-01T12:44:30Z", offset: "-00:44:30" } — a stored offset with seconds, and no timeZone field
 * @example toOffsetInstant("1969-12-31T23:15:30-00:45[Africa/Monrovia]") // { instant: "1970-01-01T00:00:00Z", offset: "-00:44:30", timeZone: "Africa/Monrovia" } — the zone, not the rounded offset, fixes the instant
 * @example toOffsetInstant("2024-07-15T12:00:00-04:00[-04:00]") // { instant: "2024-07-15T16:00:00Z", offset: "-04:00" } — a bracketed offset is not a zone, so no timeZone field
 * @example toOffsetInstant("2024-07-15T12:00:00+00:00[Europe/London]") // null (offset contradicts the bracketed zone)
 * @example toOffsetInstant("-271821-04-19T23:59:00-00:01[Europe/London]") // null (a bracketed zone on a local date before Temporal's date range)
 * @example toOffsetInstant("-271821-04-20T00:00:15Z", "Europe/London") // { instant: "-271821-04-20T00:00:15Z", offset: "-00:01:15", timeZone: "Europe/London" }
 * @example toOffsetInstant("2024-07-15T12:00:00-04:00[foo=bar]") // { instant: "2024-07-15T16:00:00Z", offset: "-04:00" } — an elective annotation is ignored
 * @example toOffsetInstant("2024-07-15T12:00:00-04:00[!foo=bar]") // null (an unknown critical annotation)
 * @example toOffsetInstant("2024-07-15T12:00:00") // null (no offset designator)
 * @example toOffsetInstant("20240715T120000-0400") // null (basic format)
 * @example toOffsetInstant("2024-07-15T16:00:00Z", "europe/london") // { instant: "2024-07-15T16:00:00Z", offset: "+01:00", timeZone: "Europe/London" } — IANA casing
 * @example toOffsetInstant("2024-07-15T16:00:00Z", "Japan") // { instant: "2024-07-15T16:00:00Z", offset: "+09:00", timeZone: "Japan" }
 * @example toOffsetInstant("2024-07-15T16:00:00-00:00") // { instant: "2024-07-15T16:00:00Z", offset: "+00:00" } — "offset unknown" is not preserved
 * @example toOffsetInstant("2024-07-15T16:00:00+01:00:00.5") // null (fractional-second offset)
 * @example toOffsetInstant("2024-07-15T16:00:00Z", "Invalid/Zone") // null
 */
export function toOffsetInstant(
  value: string,
  timeZone?: string,
): OffsetInstant | null {
  return readOffsetInstant(value, timeZone);
}
