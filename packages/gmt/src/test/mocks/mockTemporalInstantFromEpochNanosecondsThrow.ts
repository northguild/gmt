import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalInstantFromEpochNanosecondsThrow() {
  vi.spyOn(Temporal.Instant, "fromEpochNanoseconds").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
