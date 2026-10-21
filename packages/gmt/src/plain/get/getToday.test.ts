import type { MockedFunction } from "vitest";
import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { chopUtc } from "../../utc/chop";
import { chopTime } from "../chop";
import { areDatesEqual } from "../compare";
import { isValidDate } from "../validate";
import { getNow } from "./getNow";
import { getToday } from "./getToday";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("getToday", () => {
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;
  const systemTime = "2024-02-29T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);
    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
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

// A mocked row must not leak: the module is replaced with a spy for the whole file, and Vitest
// restores only spies it created itself, so each file resets this one explicitly.
describe("getSystemTimeZone after a mocked row", () => {
  afterEach(() => {
    vi.mocked(getSystemTimeZone).mockReset();
  });

  it("returns the mocked zone while a row replaces it", () => {
    vi.mocked(getSystemTimeZone).mockReturnValue("Pacific/Kiritimati");
    expect(getSystemTimeZone()).toBe("Pacific/Kiritimati");
  });

  it("returns the host's own zone again in the next row", () => {
    expect(getSystemTimeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});
