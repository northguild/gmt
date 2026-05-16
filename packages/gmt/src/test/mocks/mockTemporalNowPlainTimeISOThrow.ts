import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalNowPlainTimeISOThrow() {
  vi.spyOn(Temporal.Now, "plainTimeISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
