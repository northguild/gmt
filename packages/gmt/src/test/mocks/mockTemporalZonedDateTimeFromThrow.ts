import { Temporal } from "../../internal/temporal";

export function mockTemporalZonedDateTimeFromThrow() {
  vi.spyOn(Temporal.ZonedDateTime, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
