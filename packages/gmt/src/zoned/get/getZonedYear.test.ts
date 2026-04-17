import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getZonedYear } from "./getZonedYear";

describe("getZonedYear", () => {
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
    ${"UTC"}             | ${"2024"}
    ${YesterdayTimeZone} | ${"2024"}
    ${TomorrowTimeZone}  | ${"2024"}
  `("returns current year for timeZone $timeZone", ({ timeZone, expected }) => {
    expect(getZonedYear(timeZone)).toBe(expected);
  });

  it("returns empty string for invalid timeZone", () => {
    expect(getZonedYear("invalid")).toBe("");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getZonedYear("America/New_York");
    expect(result).toBe("");
  });
});
