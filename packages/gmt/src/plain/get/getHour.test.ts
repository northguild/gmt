import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowPlainDateTimeISOThrow } from "../../test/mocks";
import { getHour } from "./getHour";
import * as getSystemTimeZoneModule from "./getSystemTimeZone";

describe("getHour", () => {
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

  it("returns current hour", () => {
    expect(getHour()).toBe("00");
  });

  it("returns empty string when system timeZone cannot be determined", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getHour()).toBe("");
  });

  it.each`
    timeZone             | expected
    ${"UTC"}             | ${"00"}
    ${YesterdayTimeZone} | ${"13"}
    ${TomorrowTimeZone}  | ${"13"}
  `(
    "yesterday / today tests: returns $expected for system timeZone $timeZone",
    ({ timeZone, expected }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      expect(getHour()).toBe(expected);
    },
  );

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowPlainDateTimeISOThrow();
    const result = getHour();
    expect(result).toBe("");
  });
});
