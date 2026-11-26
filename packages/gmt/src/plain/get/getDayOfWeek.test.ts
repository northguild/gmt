import type { MockedFunction } from "vitest";
import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { systemTimeZone } from "../../internal/resolveLocale";
import { getDayOfWeek } from "./getDayOfWeek";

vi.mock("../../internal/resolveLocale", { spy: true });

describe("getDayOfWeek", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";
  let timeZoneSpy: MockedFunction<typeof systemTimeZone>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);

    timeZoneSpy = vi.mocked(systemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
    vi.useRealTimers();
  });

  it("returns current day of week", () => {
    expect(getDayOfWeek()).toBe(4);
  });

  it("returns null when system timeZone cannot be determined", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getDayOfWeek()).toBeNull();
  });

  it.each`
    timeZone             | expected
    ${"UTC"}             | ${4}
    ${YesterdayTimeZone} | ${3}
    ${TomorrowTimeZone}  | ${4}
  `(
    "yesterday / today tests: returns $expected for system timeZone $timeZone",
    ({ timeZone, expected }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      expect(getDayOfWeek()).toBe(expected);
    },
  );

  it("returns null on failure", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    const result = getDayOfWeek();
    expect(result).toBeNull();
  });
});

// A mocked row must not leak: the module is replaced with a spy for the whole file, and Vitest
// restores only spies it created itself, so each file resets this one explicitly.
describe("systemTimeZone after a mocked row", () => {
  afterEach(() => {
    vi.mocked(systemTimeZone).mockReset();
  });

  it("returns the mocked zone while a row replaces it", () => {
    vi.mocked(systemTimeZone).mockReturnValue("Pacific/Kiritimati");
    expect(systemTimeZone()).toBe("Pacific/Kiritimati");
  });

  it("returns the host's own zone again in the next row", () => {
    expect(systemTimeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});
