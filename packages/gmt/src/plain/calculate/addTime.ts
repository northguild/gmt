import { Temporal } from "@js-temporal/polyfill";
import { isValidAmount } from "../../internal";
import { isValidTime, isValidTimeUnit } from "../validate";

export function addTime(
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

  switch (unit) {
    case "hour":
      return time.add({ hours: amount }).toString();
    case "minute":
      return time.add({ minutes: amount }).toString();
    case "second":
      return time.add({ seconds: amount }).toString();
    case "millisecond":
      return time.add({ milliseconds: amount }).toString();
    case "microsecond":
      return time.add({ microseconds: amount }).toString();
    case "nanosecond":
      return time.add({ nanoseconds: amount }).toString();
  }
}
