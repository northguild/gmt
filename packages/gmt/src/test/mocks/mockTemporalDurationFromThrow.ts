import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalDurationFromThrow() {
  vi.spyOn(Temporal.Duration, "from").mockImplementation(() => {
    throw new RangeError("simulated failure");
  });
}
