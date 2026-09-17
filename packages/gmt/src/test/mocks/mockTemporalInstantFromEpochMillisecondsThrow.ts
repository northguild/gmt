import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalInstantFromEpochMillisecondsThrow() {
  vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
