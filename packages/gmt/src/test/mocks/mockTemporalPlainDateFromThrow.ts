import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalPlainDateFromThrow() {
  vi.spyOn(Temporal.PlainDate, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
