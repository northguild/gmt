import { Temporal } from "../../internal/temporal";

export function mockTemporalPlainDateTimeFromThrow() {
  vi.spyOn(Temporal.PlainDateTime, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
