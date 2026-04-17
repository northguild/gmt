import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowPlainDateTimeISOThrow } from "../../test/mocks";
import { getMicrosecond } from "./getMicrosecond";
import * as getSystemTimeZoneModule from "./getSystemTimeZone";

describe("getMicrosecond", () => {
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

  it("returns current microsecond", () => {
    const result = getMicrosecond();
    expect(result).toMatch(/^\d{3}$/);
  });

  it("returns empty string when system timeZone cannot be determined", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getMicrosecond()).toBe("");
  });

  it.each`
    timeZone
    ${"UTC"}
    ${YesterdayTimeZone}
    ${TomorrowTimeZone}
  `(
    "yesterday / today tests: returns a valid microsecond for system timeZone $timeZone",
    ({ timeZone }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      const result = getMicrosecond();
      expect(result).toMatch(/^\d{3}$/);
    },
  );

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowPlainDateTimeISOThrow();
    const result = getMicrosecond();
    expect(result).toBe("");
  });
});
