import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalNowPlainDateISOThrow() {
  vi.spyOn(Temporal.Now, "plainDateISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
