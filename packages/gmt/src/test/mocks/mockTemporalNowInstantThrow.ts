import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalNowInstantThrow() {
  vi.spyOn(Temporal.Now, "instant").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
