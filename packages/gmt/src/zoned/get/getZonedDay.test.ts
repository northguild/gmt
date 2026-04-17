import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getZonedDay } from "./getZonedDay";

describe("getZonedDay", () => {
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
    ${"UTC"}             | ${"29"}
    ${YesterdayTimeZone} | ${"28"}
    ${TomorrowTimeZone}  | ${"29"}
  `("returns $expected for timeZone $timeZone", ({ timeZone, expected }) => {
    expect(getZonedDay(timeZone)).toBe(expected);
  });

  it("returns empty string for invalid timeZone", () => {
    expect(getZonedDay("invalid")).toBe("");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getZonedDay("America/New_York");
    expect(result).toBe("");
  });
});
