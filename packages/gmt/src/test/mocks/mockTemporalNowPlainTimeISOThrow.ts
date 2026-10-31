import { Temporal } from "../../internal/temporal";

export function mockTemporalNowPlainTimeISOThrow() {
  vi.spyOn(Temporal.Now, "zonedDateTimeISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
