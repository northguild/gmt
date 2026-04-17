import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { chopTime, chopUtc } from "../chop";
import { areDatesEqual } from "../compare";
import { isValidDate } from "../validate";
import { getNow } from "./getNow";
import * as getSystemTimeZoneModule from "./getSystemTimeZone";
import { getToday } from "./getToday";

describe("getToday", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;
  const systemTime = "2024-02-29T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
    vi.useRealTimers();
  });

  it("returns an exact plain date for the mocked system timeZone", () => {
    const today = getToday();

    // today should be same day as system time
    expect(areDatesEqual(today, chopTime(chopUtc(systemTime)))).toBe(true);
  });

  it("returns a valid ISO date and matches the date part of getNow", () => {
    expect(isValidDate(getToday())).toBe(true);
    expect(getToday()).toBe(chopTime(getNow()));
  });

  it.each`
    timeZone             | expected
    ${"UTC"}             | ${"2024-02-29"}
    ${YesterdayTimeZone} | ${"2024-02-28"}
    ${TomorrowTimeZone}  | ${"2024-02-29"}
  `(
    "yesterday / today tests: returns $expected for system timeZone $timeZone",
    ({ timeZone, expected }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      expect(getToday()).toBe(expected);
    },
  );

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getToday();
    expect(result).toBe("");
  });
});
