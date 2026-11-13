import { readHl7DateTime } from "../../internal/hl7DateTime";
import type { Hl7DateTime } from "../../types";

/**
 * Read an HL7 v2 date-time (`DTM`, or the older `TS`) as what it states: a moment, the sender's
 * local time, or a span.
 *
 * HL7 v2.5.1 2.A.22 (headed 2.A.1.22 in the hl7.eu v2.5.1 copy) defines the `DTM`
 * `YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]`; 2.A.77 the `TS`, a `DTM` then `^` and a
 * degree of precision.
 *
 * | `kind` | when | members |
 * | --- | --- | --- |
 * | `"instant"` | an offset and a minute or finer | `instant`, `offset`, `local`, `precision` |
 * | `"local"` | no offset and a minute or finer | `local`, `precision` |
 * | `"partial"` | year, month, day or hour | `local`, `offset` (`""` when none), `precision` |
 * | `"null"` | the string `""` | none |
 *
 * - No offset is the sender's local time: 2.A.22, "if the time zone is not included, the time
 *   zone defaults to that of the local time zone of the sender". It is never read as UTC; supply
 *   the sender's zone to `resolveLocal`.
 * - A partial value has no instant: padding a year or a day to a moment states a fact the sender
 *   did not send.
 * - The degree of precision only lowers (2.A.77.2: it "may not indicate greater precision"), by
 *   cutting, never rounding. `S` on a fractional value cuts the fraction.
 * - `0000` is the start of the stated day (2.A.22, `198807050000`: "Midnight of the night
 *   extending from July 4 to July 5, 1988"), not the end of the day before.
 * - `+0000` and `-0000` are both UTC (2.A.22), read as `+00:00`.
 * - `""` (two double quote marks) is the null value and differs from `''` (ch. 2 §2.5.3: "is
 *   different from omitting an optional data field"); `''` returns `null`.
 * - A lone `TS` carries no MSH-2, so `^` separates its components and `&` their subcomponents,
 *   the separators Figure 2-1 recommends (ch. 2 §2.5.4). When a feed's MSH-2 names others, the
 *   caller re-joins that `TS` with `^` and `&` first.
 * - Components and subcomponents that are present but not expected are ignored (ch. 2 §2.6.2;
 *   a later version adds them at the end, §2.8.1 and §2.8.2), so `20240615^D^X` reads as
 *   `20240615^D` and `2024&X` as `2024`. An empty component is not present (§2.6.2), so
 *   `20240615^D^` reads as `20240615^D` and `""^` as the null value, while `^D` and `&X` return
 *   `null`.
 * - Second `60` and hour `24` are rejected, as is any day the month lacks.
 * - Returns `null` on invalid input and for any value that is not a string. Never throws.
 *
 * @param value HL7 v2 `DTM` or `TS` string
 * @returns the reading, or `null` on invalid input
 *
 * @example parseHL7("20240615103000-0500") // { kind: "instant", instant: "2024-06-15T15:30:00Z", offset: "-05:00", local: "2024-06-15T10:30:00", precision: "second" }
 * @example parseHL7("20240615103000") // { kind: "local", local: "2024-06-15T10:30:00", precision: "second" }
 * @example parseHL7("20240615") // { kind: "partial", local: "2024-06-15", offset: "", precision: "day" }
 * @example parseHL7("199904011200^L") // { kind: "partial", local: "1999-04", offset: "", precision: "month" }
 * @example parseHL7("20240615^D^X") // { kind: "partial", local: "2024-06-15", offset: "", precision: "day" }
 * @example parseHL7('""') // { kind: "null" }
 * @example parseHL7("") // null
 * @example parseHL7("20240615240000") // null (hour 24)
 */
export function parseHL7(value: string): Hl7DateTime | null {
  return readHl7DateTime(value);
}
