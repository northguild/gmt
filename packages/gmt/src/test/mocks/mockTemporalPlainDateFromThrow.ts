import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";

export function mockTemporalPlainDateFromThrow() {
  vi.spyOn(Temporal.PlainDate, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
