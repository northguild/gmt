import { unixSeconds } from "../../regex/unix";

export function isValidUnixSeconds(timestamp: string): boolean {
  return unixSeconds.test(timestamp);
}
