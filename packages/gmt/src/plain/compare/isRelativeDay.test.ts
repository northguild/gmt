import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { isRelativeDay } from "./isRelativeDay";

describe("isRelativeDay", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
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
