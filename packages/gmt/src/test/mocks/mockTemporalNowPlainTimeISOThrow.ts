import { Temporal } from "../../internal/temporal";

export function mockTemporalNowPlainTimeISOThrow() {
  vi.spyOn(Temporal.Now, "plainTimeISO").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
