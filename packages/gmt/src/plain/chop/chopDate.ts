import { Temporal } from "@js-temporal/polyfill";
import { isValidDateTime } from "../validate/isValidDateTime";

export function chopDate(value: string): string {
  if (!isValidDateTime(value)) return "";
  return Temporal.PlainDateTime.from(value).toPlainTime().toString();
}
