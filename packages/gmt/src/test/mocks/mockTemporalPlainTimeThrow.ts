import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalPlainTimeFromThrow() {
  vi.spyOn(Temporal.PlainTime, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
