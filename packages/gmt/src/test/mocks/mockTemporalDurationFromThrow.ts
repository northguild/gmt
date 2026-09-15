import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalDurationFromThrow() {
  vi.spyOn(Temporal.Duration, "from").mockImplementation(() => {
    throw new RangeError("simulated failure");
  });
}
