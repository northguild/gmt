import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalNowInstantThrow() {
  vi.spyOn(Temporal.Now, "instant").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
