import { Temporal } from "../../internal/temporal";

export function mockTemporalZonedDateTimeOffsetThrow() {
  vi.spyOn(
    Temporal.ZonedDateTime.prototype,
    "offsetNanoseconds",
    "get",
  ).mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
