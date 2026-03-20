import { unixMilliseconds } from "../../regex/unix";

export function isValidUnixMilliseconds(timestamp: string): boolean {
  return unixMilliseconds.test(timestamp);
}
