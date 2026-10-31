import { Temporal } from "../../internal/temporal";

export function mockTemporalNowPlainDateISOThrow() {
  vi.spyOn(Temporal.Now, "zonedDateTimeISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
