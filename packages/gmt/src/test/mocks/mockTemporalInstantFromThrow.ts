import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalInstantFromThrow() {
  vi.spyOn(Temporal.Instant, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
