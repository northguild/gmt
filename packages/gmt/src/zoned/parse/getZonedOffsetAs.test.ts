import { battleTestTimeZones, sameInstantBattleCases } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { getZonedOffsetAs } from "./getZonedOffsetAs";

describe("getZonedOffsetAs", () => {
  it.each`
    value                                            | unit             | expected
    ${"2024-07-15T12:00:00-04:00[America/New_York]"} | ${"minutes"}     | ${-240}
    ${"2024-07-15T12:00:00-04:00[America/New_York]"} | ${"nanoseconds"} | ${-14_400_000_000_000}
    ${"2024-05-15T12:00:00+05:45[Asia/Kathmandu]"}   | ${"minutes"}     | ${345}
    ${"2024-05-15T12:00:00+05:45[Asia/Kathmandu]"}   | ${"nanoseconds"} | ${20_700_000_000_000}
    ${"2024-02-29T12:00:00+00:00[UTC]"}              | ${"minutes"}     | ${0}
    ${"2024-02-29T12:00:00+00:00[UTC]"}              | ${"nanoseconds"} | ${0}
    ${"2024-05-15T12:00:00+05:30[Asia/Kolkata]"}     | ${"minutes"}     | ${330}
  `("returns $expected for $value as $unit", ({ value, unit, expected }) => {
    expect(getZonedOffsetAs(value, unit)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"2024-02-29T14:30:45.123-04:00"}
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns null for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(getZonedOffsetAs(invalidValue as never, "minutes")).toBe(null);
    },
  );

  it.each`
    unit
    ${"fortnights"}
    ${""}
    ${null}
    ${undefined}
    ${123}
  `("returns null for invalid unit $unit", ({ unit }) => {
    expect(
      getZonedOffsetAs("2024-02-29T12:00:00+00:00[UTC]", unit as never),
    ).toBe(null);
  });

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns a finite number for battle-test timeZone ${timeZone}`, () => {
      expect(getZonedOffsetAs(value, "minutes")).not.toBeNull();
      expect(Number.isInteger(getZonedOffsetAs(value, "minutes"))).toBe(true);
    });
  }

  it("covers every battle-test timeZone", () => {
    expect(sameInstantBattleCases.map((c) => c.timeZone)).toEqual(
      battleTestTimeZones,
    );
  });

  it("returns null on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      getZonedOffsetAs(
        "2024-02-29T14:30:45.123-05:00[America/New_York]",
        "minutes",
      ),
    ).toBe(null);
  });
});
