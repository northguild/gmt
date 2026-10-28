import { Temporal } from "../../internal/temporal";

export function mockTemporalPlainYearMonthFromThrow() {
  vi.spyOn(Temporal.PlainYearMonth, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
