import { Temporal } from "../../internal/temporal";

export function mockTemporalNowZonedDateTimeISOThrow() {
  vi.spyOn(Temporal.Now, "zonedDateTimeISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
