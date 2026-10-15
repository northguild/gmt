import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalInstantFromEpochMillisecondsThrow() {
  vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
