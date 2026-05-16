import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalNowPlainDateISOThrow() {
  vi.spyOn(Temporal.Now, "plainDateISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
