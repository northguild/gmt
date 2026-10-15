import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalNowPlainTimeISOThrow() {
  vi.spyOn(Temporal.Now, "plainTimeISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
