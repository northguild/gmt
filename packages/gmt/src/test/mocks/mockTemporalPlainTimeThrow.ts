import { Temporal } from "../../internal/temporal";

export function mockTemporalPlainTimeFromThrow() {
  vi.spyOn(Temporal.PlainTime, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
