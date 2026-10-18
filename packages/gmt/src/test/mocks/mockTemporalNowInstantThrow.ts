import { Temporal } from "../../internal/temporal";

export function mockTemporalNowInstantThrow() {
  vi.spyOn(Temporal.Now, "instant").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
