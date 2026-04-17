import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getMonth } from "./getMonth";
import * as getSystemTimeZoneModule from "./getSystemTimeZone";

describe("getMonth", () => {
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

  it("returns current month", () => {
    expect(getMonth()).toBe("02");
  });

  it("returns empty string when system timeZone cannot be determined", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getMonth()).toBe("");
  });

  it.each`
    timeZone             | expected
    ${"UTC"}             | ${"02"}
    ${YesterdayTimeZone} | ${"02"}
    ${TomorrowTimeZone}  | ${"02"}
  `(
    "yesterday / today tests: returns $expected for system timeZone $timeZone",
    ({ timeZone, expected }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      expect(getMonth()).toBe(expected);
    },
  );

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getMonth();
    expect(result).toBe("");
  });
});
