import { Temporal } from "../../internal/temporal";

export function mockTemporalInstantFromEpochMillisecondsThrow() {
  vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
