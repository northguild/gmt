import { Temporal } from "../../internal/temporal";

export function mockTemporalNowPlainDateTimeISOThrow() {
  vi.spyOn(Temporal.Now, "zonedDateTimeISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
