import { Temporal } from "@js-temporal/polyfill";
import { getUtcMicrosecond } from "./getUtcMicrosecond";

describe("getUtcMicrosecond", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123456Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current microsecond", () => {
    const result = getUtcMicrosecond();
    expect(result).toMatch(/^\d{3}$/);
  });

  // Fake timers fix the clock to the millisecond only: the polyfill fills the
  // sub-millisecond digits from the previous clock read. A spy fixes the instant.
  it("returns 456, the microsecond field of 2024-02-29T12:30:45.123456789Z", () => {
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(
      Temporal.Instant.from("2024-02-29T12:30:45.123456789Z"),
    );

    expect(getUtcMicrosecond()).toBe("456");
  });
});
