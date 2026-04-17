import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalZonedDateTimeFromThrow() {
  vi.spyOn(Temporal.ZonedDateTime, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
