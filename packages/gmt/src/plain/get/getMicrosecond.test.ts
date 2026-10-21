import type { MockedFunction } from "vitest";
import { TomorrowTimeZone, YesterdayTimeZone } from "../../test";
import { mockTemporalNowPlainDateTimeISOThrow } from "../../test/mocks";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { getMicrosecond } from "./getMicrosecond";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("getMicrosecond", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);

    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
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
