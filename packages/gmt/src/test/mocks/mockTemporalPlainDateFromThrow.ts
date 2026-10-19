import { Temporal } from "../../internal/temporal";

export function mockTemporalPlainDateFromThrow() {
  vi.spyOn(Temporal.PlainDate, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
