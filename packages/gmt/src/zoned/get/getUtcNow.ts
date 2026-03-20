import { Temporal } from "@js-temporal/polyfill";

export function getUtcNow(): string {
  try {
    return Temporal.Now.instant().toString();
  } catch {
    return "";
  }
}
