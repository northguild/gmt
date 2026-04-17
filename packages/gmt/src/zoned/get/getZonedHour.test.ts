import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getZonedHour } from "./getZonedHour";

describe("getZonedHour", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // yesterday tomorrow tests
  it.each`
    timeZone             | expected
    ${"UTC"}             | ${"00"}
    ${YesterdayTimeZone} | ${"13"}
    ${TomorrowTimeZone}  | ${"13"}
  `("returns $expected for timeZone $timeZone", ({ timeZone, expected }) => {
    expect(getZonedHour(timeZone)).toBe(expected);
  });

  it("returns empty string for invalid timeZone", () => {
    expect(getZonedHour("invalid")).toBe("");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getZonedHour("America/New_York");
    expect(result).toBe("");
  });
});
