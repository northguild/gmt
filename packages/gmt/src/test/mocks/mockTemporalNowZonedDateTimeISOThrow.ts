import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalNowZonedDateTimeISOThrow() {
  vi.spyOn(Temporal.Now, "zonedDateTimeISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
