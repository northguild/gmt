import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getZonedMonth } from "./getZonedMonth";

describe("getZonedMonth", () => {
  const systemTime = "2024-02-29T23:59:59.999Z";

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
    ${"UTC"}             | ${"02"}
    ${YesterdayTimeZone} | ${"02"}
    ${TomorrowTimeZone}  | ${"03"}
  `(
    "returns current month for timeZone $timeZone",
    ({ timeZone, expected }) => {
      expect(getZonedMonth(timeZone)).toBe(expected);
    },
  );

  it("returns empty string for invalid timeZone", () => {
    expect(getZonedMonth("invalid")).toBe("");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getZonedMonth("America/New_York");
    expect(result).toBe("");
  });
});
