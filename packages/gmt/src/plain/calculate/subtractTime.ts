import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidTime, isValidTimeUnit } from "../validate";

export function subtractTime(
  value: string,
  amount: number,
  unit: Temporal.TimeUnit,
): string {
  const validTime = isValidTime(value);
  const validUnit = isValidTimeUnit(unit);
  const validAmount = isValidAmount(amount);

  if (!validTime || !validUnit || !validAmount) {
    return "";
  }

  const time = Temporal.PlainTime.from(value);

  return time.subtract({ [`${unit}s`]: amount }).toString();
}
