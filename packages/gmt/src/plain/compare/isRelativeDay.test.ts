import type { MockedFunction } from "vitest";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { getSystemTimeZone } from "../../zoned/get/getSystemTimeZone";
import { isRelativeDay } from "./isRelativeDay";

vi.mock("../../zoned/get/getSystemTimeZone", { spy: true });

describe("isRelativeDay", () => {
  let timeZoneSpy: MockedFunction<typeof getSystemTimeZone>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
    timeZoneSpy = vi.mocked(getSystemTimeZone).mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockReset();
    vi.useRealTimers();
  });

  it.each`
    value           | offsetDays | expected
    ${"2024-02-29"} | ${0}       | ${true}
    ${"2024-02-28"} | ${-1}      | ${true}
    ${"2024-03-01"} | ${1}       | ${true}
    ${"2024-03-10"} | ${10}      | ${true}
    ${"2024-02-19"} | ${-10}     | ${true}
    ${"2024-02-28"} | ${0}       | ${false}
    ${"2024-02-29"} | ${-1}      | ${false}
    ${"2024-02-29"} | ${1}       | ${false}
  `(
    "returns $expected for $value with offsetDays $offsetDays (today is 2024-02-29)",
    ({ value, offsetDays, expected }) => {
      expect(isRelativeDay(value, offsetDays)).toBe(expected);
    },
  );

  it.each`
    systemTime                    | expected
    ${"2024-02-28T23:59:59.999Z"} | ${false}
    ${"2024-02-29T00:00:00.000Z"} | ${true}
  `(
    "boundary at midnight: value 2024-02-29, offsetDays 0, system time $systemTime -> $expected",
    ({ systemTime, expected }) => {
      vi.setSystemTime(systemTime);
      expect(isRelativeDay("2024-02-29", 0)).toBe(expected);
    },
  );

  it.each`
    value           | offsetDays
    ${"2024-02-29"} | ${1.5}
    ${"2024-02-29"} | ${NaN}
    ${"2024-02-29"} | ${Infinity}
    ${"invalid"}    | ${0}
    ${""}           | ${0}
    ${null}         | ${0}
    ${undefined}    | ${0}
  `(
    "returns false for invalid input value $value, offsetDays $offsetDays",
    ({ value, offsetDays }) => {
      expect(isRelativeDay(value as never, offsetDays)).toBe(false);
    },
  );

  it("returns false when the system timeZone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");
    expect(isRelativeDay("2024-02-29", 0)).toBe(false);
  });

  it("returns false when Temporal.Now.zonedDateTimeISO throws", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    expect(isRelativeDay("2024-02-29", 0)).toBe(false);
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
