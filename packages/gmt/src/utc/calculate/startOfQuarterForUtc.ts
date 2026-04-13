import { Temporal } from "@js-temporal/polyfill";
import { isValidUtc } from "../validate";

export function startOfQuarterForUtc(value: string): string {
  if (!isValidUtc(value)) {
    return "";
  }

  try {
    const instant = Temporal.Instant.from(value);
    const zdt = instant.toZonedDateTimeISO("UTC");
    const month = zdt.month;
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;

    const result = zdt
      .with({ month: quarterStartMonth, day: 1, hour: 0, minute: 0, second: 0 })
      .toInstant();

    return result.toString();
  } catch {
    return "";
  }
}
