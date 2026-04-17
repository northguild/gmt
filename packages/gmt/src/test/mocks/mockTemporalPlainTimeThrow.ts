import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalPlainTimeFromThrow() {
  vi.spyOn(Temporal.PlainTime, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
