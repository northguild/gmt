import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalNowZonedDateTimeISOThrow() {
  vi.spyOn(Temporal.Now, "zonedDateTimeISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
