import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate/isValidDateTime";
import { isValidTime } from "../validate/isValidTime";

export function chopMilliseconds(value: string): string {
  if (isValidDateTime(value)) {
    return Temporal.PlainDateTime.from(value).toString({
      smallestUnit: "second",
    });
  }
  if (isValidTime(value)) {
    return Temporal.PlainTime.from(value).toString({ smallestUnit: "second" });
  }
  return "";
}
