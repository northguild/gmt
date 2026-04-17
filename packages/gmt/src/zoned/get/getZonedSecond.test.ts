import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getZonedSecond } from "./getZonedSecond";

describe("getZonedSecond", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each`
    timeZone
    ${"UTC"}
    ${YesterdayTimeZone}
    ${TomorrowTimeZone}
  `("returns current second for timeZone $timeZone", ({ timeZone }) => {
    const result = getZonedSecond(timeZone);
    expect(result).toMatch(/^\d{2}$/);
  });

  it("returns empty string for invalid timeZone", () => {
    expect(getZonedSecond("invalid")).toBe("");
  });

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getZonedSecond("America/New_York");
    expect(result).toBe("");
  });
});
