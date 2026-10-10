import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalInstantFromEpochNanosecondsThrow() {
  vi.spyOn(Temporal.Instant, "fromEpochNanoseconds").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
