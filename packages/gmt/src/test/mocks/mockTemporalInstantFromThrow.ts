import { Temporal } from "../../internal/temporal";

export function mockTemporalInstantFromThrow() {
  vi.spyOn(Temporal.Instant, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
