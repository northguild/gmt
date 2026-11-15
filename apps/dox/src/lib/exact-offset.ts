/**
 * Writes an instant as the local time in a zone plus the offset that zone has
 * at that instant, to the second: `1960-06-01T11:15:30-00:44:30` in
 * Africa/Monrovia.
 *
 * Temporal's `Instant#toString({ timeZone })` rounds the offset to the minute
 * (`-00:45`). The zone bracket that would correct it is not written, and the
 * library's instant functions take no bracket, so they would read the rounded
 * offset as written: a moment 30 seconds later. The local time and the exact
 * offset name the same instant.
 */

import { Temporal } from "@js-temporal/polyfill";

/** `instant` in `timeZone`, with the zone's exact offset. Throws on an unknown zone. */
export function exactOffsetText(
  instant: Temporal.Instant,
  timeZone: string,
): string {
  const zoned = instant.toZonedDateTimeISO(timeZone);
  return zoned.toPlainDateTime().toString() + zoned.offset;
}
