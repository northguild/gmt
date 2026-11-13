import type { MockedFunction } from "vitest";
import {
  setFakeSystemTime,
  TomorrowTimeZone,
  YesterdayTimeZone,
} from "../../test";
import { mockTemporalNowPlainDateTimeISOThrow } from "../../test/mocks";
import { systemTimeZone } from "../../internal/resolveLocale";
import { getNanosecond } from "./getNanosecond";

vi.mock("../../internal/resolveLocale", { spy: true });

describe("getNanosecond", () => {
  const systemTime = "2024-02-29T00:00:00.000Z";
  let timeZoneSpy: MockedFunction<typeof systemTimeZone>;

  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(systemTime);

    timeZoneSpy = vi.mocked(systemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
    vi.useRealTimers();
  });

  it("returns current nanosecond", () => {
    const result = getNanosecond();
    expect(result).toMatch(/^\d{3}$/);
  });

  it("returns empty string when system timeZone cannot be determined", () => {
    timeZoneSpy.mockReturnValue("");
    expect(getNanosecond()).toBe("");
  });

  it.each`
    timeZone             | expected
    ${"UTC"}             | ${"000"}
    ${YesterdayTimeZone} | ${"000"}
    ${TomorrowTimeZone}  | ${"000"}
  `(
    "yesterday / today tests: returns $expected for system timeZone $timeZone",
    ({ timeZone, expected }) => {
      timeZoneSpy.mockReturnValue(timeZone);
      expect(getNanosecond()).toBe(expected);
    },
  );

  it("returns empty string on failure", () => {
    vi.useRealTimers();
    mockTemporalNowPlainDateTimeISOThrow();
    const result = getNanosecond();
    expect(result).toBe("");
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
