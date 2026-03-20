import { isValidUnixMilliseconds, isValidUnixSeconds } from "../validate";
import { getUnixNow } from "./getUnixNow";

describe("getUnixNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the exact mocked unix timestamp in seconds", () => {
    const unixNowSeconds = getUnixNow("seconds");

    expect(unixNowSeconds).toBe(1709164800);
    expect(isValidUnixSeconds(String(unixNowSeconds))).toBe(true);
  });

  it("returns the exact mocked unix timestamp in milliseconds", () => {
    const unixNowMilliseconds = getUnixNow("milliseconds");

    expect(unixNowMilliseconds).toBe(1709164800000);
    expect(isValidUnixMilliseconds(String(unixNowMilliseconds))).toBe(true);
  });

  it("keeps seconds and milliseconds aligned", () => {
    const unixNowSeconds = getUnixNow("seconds");
    const unixNowMilliseconds = getUnixNow("milliseconds");
    expect(unixNowSeconds).not.toBeNull();
    expect(unixNowMilliseconds).not.toBeNull();

    if (unixNowSeconds === null || unixNowMilliseconds === null) {
      throw new Error("Expected valid unix timestamp values");
    }

    expect(unixNowMilliseconds - unixNowSeconds * 1000).toBeGreaterThanOrEqual(
      0,
    );
    expect(unixNowMilliseconds - unixNowSeconds * 1000).toBeLessThan(1000);
  });

  it("defaults to milliseconds when no unit is provided", () => {
    const unixNowMilliseconds = getUnixNow();

    expect(unixNowMilliseconds).toBe(1709164800000);
    expect(isValidUnixMilliseconds(String(unixNowMilliseconds))).toBe(true);
  });

  it.each`
    unit
    ${"minutes"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid unit: $unit", ({ unit }: { unit: unknown }) => {
    expect(getUnixNow(unit as never)).toBeNull();
  });
});
