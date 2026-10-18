import { Temporal } from "../../internal/temporal";

export function mockTemporalInstantFromEpochNanosecondsThrow() {
  vi.spyOn(Temporal.Instant, "fromEpochNanoseconds").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
