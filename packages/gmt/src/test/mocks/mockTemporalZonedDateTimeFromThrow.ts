import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalZonedDateTimeFromThrow() {
  vi.spyOn(Temporal.ZonedDateTime, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
