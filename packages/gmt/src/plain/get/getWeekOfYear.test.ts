import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowPlainDateTimeISOThrow } from "../../test/mocks";
import * as getSystemTimeZoneModule from "./getSystemTimeZone";
import { getWeekOfYear } from "./getWeekOfYear";

describe("getWeekOfYear", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

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

  it("returns current week of year", () => {
    expect(getWeekOfYear()).toBe(9);
  });

  it("returns null when system timeZone cannot be determined", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getWeekOfYear()).toBeNull();
  });

  it.each`
    timeZone             | expected
    ${"UTC"}             | ${9}
    ${YesterdayTimeZone} | ${9}
    ${TomorrowTimeZone}  | ${9}
  `(
    "yesterday / today tests: returns $expected for system timeZone $timeZone",
    ({ timeZone, expected }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      expect(getWeekOfYear()).toBe(expected);
    },
  );

  it("returns null on failure", () => {
    vi.useRealTimers();
    mockTemporalNowPlainDateTimeISOThrow();
    const result = getWeekOfYear();
    expect(result).toBeNull();
  });
});
