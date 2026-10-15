import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalPlainDateTimeFromThrow() {
  vi.spyOn(Temporal.PlainDateTime, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
