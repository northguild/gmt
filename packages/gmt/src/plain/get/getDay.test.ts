import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getDay } from "./getDay";
import * as getSystemTimeZoneModule from "./getSystemTimeZone";

describe("getDay", () => {
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

  it("returns current day", () => {
    expect(getDay()).toBe("29");
  });

  it("returns empty string when system timeZone cannot be determined", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getDay()).toBe("");
  });

  it.each`
    timeZone             | expected
    ${"UTC"}             | ${"29"}
    ${YesterdayTimeZone} | ${"28"}
    ${TomorrowTimeZone}  | ${"29"}
  `(
    "yesterday / today tests: returns $expected for system timeZone $timeZone",
    ({ timeZone, expected }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      expect(getDay()).toBe(expected);
    },
  );

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getDay();
    expect(result).toBe("");
  });
});
