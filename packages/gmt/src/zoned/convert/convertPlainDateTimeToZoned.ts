import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../../plain/validate";
import type { Disambiguation, Offset } from "../../types";
import { isValidTimeZone } from "../validate";

/**
 * Attach the specified `timeZone` to a plain datetime string and return a zoned ISO 8601 datetime string.
 *
 * - Combines plain datetime with timezone to create ZonedDateTime.
 * - `disambiguation` controls DST gap/overlap resolution: "compatible" (default, matches Temporal's default), "earlier", "later", or "reject" (throws, resulting in "").
 * - `offset` ("prefer" | "use" | "ignore" (default) | "reject", per Temporal's `OffsetDisambiguationOptions`) is accepted for API consistency with sibling zoned-construction functions (see `startOfZoned`, `endOfZoned`, etc.) but has **no effect here**: `value` is a plain datetime string with no UTC offset embedded, so there is never a stored offset for `offset` to prefer/use/ignore/reject against. `disambiguation` is the only option that affects this function's output.
 * - Returns "" for invalid input.
 *
 * @param value plain datetime string (e.g. "2024-02-29T14:30:45")
 * @param timeZone IANA timeZone identifier
 * @param optionsArg optional: smallestUnit, disambiguation ("compatible" | "earlier" | "later" | "reject"), offset ("prefer" | "use" | "ignore" | "reject" — accepted but inert, see above)
 * @returns zoned ISO 8601 datetime string or "" when invalid
 *
 * @example convertPlainDateTimeToZoned("2024-02-29T14:30:45", "America/New_York") // "2024-02-29T14:30:45.123-05:00[America/New_York]"
 * @example convertPlainDateTimeToZoned("invalid", "America/New_York") // ""
 * @example convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", { disambiguation: "earlier" }) // "2024-03-10T01:30:00.000-05:00[America/New_York]" (spring-forward gap)
 * @example convertPlainDateTimeToZoned("2024-11-03T01:30:00", "America/New_York", { disambiguation: "later" }) // "2024-11-03T01:30:00.000-05:00[America/New_York]" (fall-back overlap)
 * @example convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", { disambiguation: "reject" }) // ""
 */
export function convertPlainDateTimeToZoned(
  value: string,
  timeZone: string,
  optionsArg?: {
    smallestUnit?: Temporal.ZonedDateTimeToStringOptions["smallestUnit"];
    disambiguation?: Disambiguation;
    offset?: Offset;
  },
): string {
  if (!isValidDateTime(value) || !isValidTimeZone(timeZone)) {
    return "";
  }

  const disambiguation = optionsArg?.disambiguation ?? "compatible";
  const offset = optionsArg?.offset ?? "ignore";

  const options: Partial<Temporal.ZonedDateTimeToStringOptions> = {
    smallestUnit: optionsArg?.smallestUnit ?? "milliseconds",
  };

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(`${value}[${timeZone}]`, {
      disambiguation,
      offset,
    });
    return zonedDateTime.toString(options);
  } catch {
    return "";
  }
}
