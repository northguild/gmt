import { Temporal } from "../../internal/temporal";

export function mockTemporalNowPlainDateTimeISOThrow() {
  vi.spyOn(Temporal.Now, "plainDateTimeISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
