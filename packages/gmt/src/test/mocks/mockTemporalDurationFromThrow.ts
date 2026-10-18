import { Temporal } from "../../internal/temporal";

export function mockTemporalDurationFromThrow() {
  vi.spyOn(Temporal.Duration, "from").mockImplementation(() => {
    throw new RangeError("simulated failure");
  });
}
