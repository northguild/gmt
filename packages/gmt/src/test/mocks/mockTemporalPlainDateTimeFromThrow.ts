import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalPlainDateTimeFromThrow() {
  vi.spyOn(Temporal.PlainDateTime, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
