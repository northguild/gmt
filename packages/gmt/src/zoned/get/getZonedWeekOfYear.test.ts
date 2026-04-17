import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getZonedWeekOfYear } from "./getZonedWeekOfYear";

describe("getZonedWeekOfYear", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // yesterday tomorrow tests
  it.each`
    timeZone             | expected
    ${"UTC"}             | ${9}
    ${YesterdayTimeZone} | ${9}
    ${TomorrowTimeZone}  | ${9}
  `("returns current week for timeZone $timeZone", ({ timeZone, expected }) => {
    expect(getZonedWeekOfYear(timeZone)).toBe(expected);
  });

  it("returns null for invalid timeZone", () => {
    expect(getZonedWeekOfYear("invalid")).toBeNull();
  });
  it("returns null on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getZonedWeekOfYear("America/New_York");
    expect(result).toBeNull();
  });
});
