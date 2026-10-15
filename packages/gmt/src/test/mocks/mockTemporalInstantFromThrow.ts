import { Temporal } from "@js-temporal/polyfill";

export function mockTemporalInstantFromThrow() {
  vi.spyOn(Temporal.Instant, "from").mockImplementation(() => {
    throw new Error("simulated failure");
  });
}
