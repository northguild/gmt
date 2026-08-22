import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, sameInstantBattleCases } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { getZonedOffset } from "./getZonedOffset";

describe("getZonedOffset", () => {
  it.each`
    value                                            | expected
    ${"2024-02-29T12:34:56.789+00:00[UTC]"}          | ${"+00:00"}
    ${"2024-07-15T12:00:00-04:00[America/New_York]"} | ${"-04:00"}
    ${"2024-01-15T12:00:00-05:00[America/New_York]"} | ${"-05:00"}
    ${"2024-05-15T12:00:00+05:45[Asia/Kathmandu]"}   | ${"+05:45"}
    ${"2024-05-15T12:00:00+05:30[Asia/Kolkata]"}     | ${"+05:30"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(getZonedOffset(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"2024-02-29T14:30:45.123-04:00"}
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid zoned datetime $invalidValue",
    ({ invalidValue }) => {
      expect(getZonedOffset(invalidValue as never)).toBe("");
    },
  );

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns the correct offset for battle-test timeZone ${timeZone}`, () => {
      const expected = Temporal.ZonedDateTime.from(value).offset;
      expect(getZonedOffset(value)).toBe(expected);
    });
  }

  it("covers every battle-test timeZone", () => {
    expect(sameInstantBattleCases.map((c) => c.timeZone)).toEqual(
      battleTestTimeZones,
    );
  });

  it("returns empty string on failure", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      getZonedOffset("2024-02-29T14:30:45.123-05:00[America/New_York]"),
    ).toBe("");
  });
});
