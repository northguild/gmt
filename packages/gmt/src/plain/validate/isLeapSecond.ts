import { leapSecond } from "../../regex/leap-second";

export function isLeapSecond(value: string): boolean {
  return leapSecond.test(value);
}
