import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalNowPlainDateTimeISOThrow() {
  vi.spyOn(Temporal.Now, "plainDateTimeISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
