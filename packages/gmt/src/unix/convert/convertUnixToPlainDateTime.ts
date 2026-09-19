// fallow-ignore-file code-duplication -- sibling variant keeps its own guard, parse and try/catch, by design
import { normalizeTimeZone } from "../../internal/normalizeTimeZone";
import {
  resolveUnixEpochUnit,
  unixEpochToInstant,
} from "../../internal/unixEpochValue";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { isOptionsArgument } from "../../internal/isObject";

/**
 * Convert a Unix timestamp to a plain datetime string in the format "YYYY-MM-DDTHH:mm:ss".
 *
 * - Converts to PlainDateTime in `timeZone`: omitted is UTC, `"local"` is the system zone, and an
 *   unknown zone returns "".
 * - `unix` is a safe integer or a string of optionally negative ASCII digits; anything else returns
 *   "".
 * - Validates epoch unit ("seconds" | "milliseconds", singular accepted).
 * - Returns "" for invalid input.
 *
 * @param unix Unix epoch: a safe integer or a digit string
 * @param options optional: epochUnit ("seconds" | "milliseconds", singular accepted; default "milliseconds"), timeZone (IANA, or "local" for the system zone; default "UTC")
 * @returns plain datetime string in "YYYY-MM-DDTHH:mm:ss" format or "" on invalid input
 *
 * @example convertUnixToPlainDateTime(1709164800000, { timeZone: "UTC" }) // "2024-02-29T00:00:00"
 * @example convertUnixToPlainDateTime(1709164800, { epochUnit: "seconds", timeZone: "UTC" }) // "2024-02-29T00:00:00"
 * @example convertUnixToPlainDateTime(-1, { timeZone: "UTC" }) // "1969-12-31T23:59:59.999"
 * @example convertUnixToPlainDateTime("1709164800000", { timeZone: "Asia/Tokyo" }) // "2024-02-29T09:00:00"
 * @example convertUnixToPlainDateTime(NaN) // ""
 */

export function convertUnixToPlainDateTime(
  unix: number | string,
  options?: { epochUnit?: UnixUnit; timeZone?: string },
): string {
  if (!isOptionsArgument(options)) {
    return "";
  }

  const epochUnit = resolveUnixEpochUnit(options?.epochUnit);
  const timeZone = normalizeTimeZone(options?.timeZone);

  if (epochUnit === null || !timeZone) return "";

  const instant = unixEpochToInstant(unix, epochUnit);

  if (instant === null) return "";

  try {
    return instant.toZonedDateTimeISO(timeZone).toPlainDateTime().toString();
  } catch {
    return "";
  }
}
