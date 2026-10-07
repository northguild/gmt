import { Temporal } from "@js-temporal/polyfill";
import { convertUtcToUnix } from "../convert";
import { getUtcNow } from "./getUtcNow";

describe("getUtcNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the exact mocked UTC datetime string", () => {
    // Fake timers fix the clock to the millisecond only: the polyfill fills the
    // sub-millisecond digits from the previous clock read. A spy fixes the instant.
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(
      Temporal.Instant.from("2024-02-29T00:00:00Z"),
    );

    const utcNow = getUtcNow();

    expect(utcNow).toBe("2024-02-29T00:00:00Z");
  });

  it("returns a value consumable by zoned unix converters", () => {
    const value = getUtcNow();

    expect(convertUtcToUnix(value, { epochUnit: "milliseconds" })).toBe(
      1709164800000,
    );
    expect(convertUtcToUnix(value, { epochUnit: "seconds" })).toBe(1709164800);
  });
});
