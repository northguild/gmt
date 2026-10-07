import { Temporal } from "@js-temporal/polyfill";
import { getUtcNanosecond } from "./getUtcNanosecond";

describe("getUtcNanosecond", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T12:30:45.123456789Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current nanosecond", () => {
    const result = getUtcNanosecond();
    expect(result).toMatch(/^\d{3}$/);
  });

  // Fake timers fix the clock to the millisecond only: the polyfill fills the
  // sub-millisecond digits from the previous clock read. A spy fixes the instant.
  it("returns 789, the nanosecond field of 2024-02-29T12:30:45.123456789Z", () => {
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(
      Temporal.Instant.from("2024-02-29T12:30:45.123456789Z"),
    );

    expect(getUtcNanosecond()).toBe("789");
  });
});
