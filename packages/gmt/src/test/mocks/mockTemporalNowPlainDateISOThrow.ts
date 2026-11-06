import { Temporal } from "../../internal/temporal";

export function mockTemporalNowPlainDateISOThrow() {
  vi.spyOn(Temporal.Now, "plainDateISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
