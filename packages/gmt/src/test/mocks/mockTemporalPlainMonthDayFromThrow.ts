import { Temporal } from "../../internal/temporal";

export function mockTemporalPlainMonthDayFromThrow() {
  vi.spyOn(Temporal.PlainMonthDay, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
