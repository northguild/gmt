import { sameInstantBattleCases } from "../../test";
import { parseZonedUnit } from "./parseZonedUnit";

describe("parseZonedUnit", () => {
  it.each`
    value                                               | unit             | expected
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"year"}        | ${"2024"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"month"}       | ${"02"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"day"}         | ${"29"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"hour"}        | ${"14"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"minute"}      | ${"30"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"second"}      | ${"45"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"millisecond"} | ${"123"}
    ${"2024-02-29T14:30:45.123+02:00[Europe/Helsinki]"} | ${"timeZone"}    | ${"Europe/Helsinki"}
  `("returns $expected for valid unit $unit", ({ value, unit, expected }) => {
    expect(parseZonedUnit(value, unit)).toBe(expected);
  });

  it.each`
    value                          | unit          | expected
    ${"2024-02-29T14:30:45Z[UTC]"} | ${"timeZone"} | ${"UTC"}
  `(
    "returns $expected for edge case unit $unit",
    ({ value, unit, expected }) => {
      expect(parseZonedUnit(value, unit)).toBe(expected);
    },
  );

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
      expect(parseZonedUnit(invalidValue as never, "year")).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"week"}
    ${"microsecond"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for invalid unit $invalidUnit",
    ({ invalidUnit }) => {
      expect(
        parseZonedUnit(
          "2024-02-29T14:30:45.123+02:00[Europe/Helsinki]",
          invalidUnit as never,
        ),
      ).toBe("");
    },
  );

  it.each`
    value                                               | expected
    ${"2024-02-29T00:00:00+00:00[UTC]"}                 | ${"UTC"}
    ${"2024-02-29T00:00:00+00:00[GMT]"}                 | ${"GMT"}
    ${"2024-02-29T00:00:00+00:00[Etc/GMT]"}             | ${"Etc/GMT"}
    ${"2024-02-29T00:00:00+00:00[Europe/Lisbon]"}       | ${"Europe/Lisbon"}
    ${"2024-02-29T00:00:00+00:00[Europe/Dublin]"}       | ${"Europe/Dublin"}
    ${"2024-02-29T01:00:00+01:00[Europe/Berlin]"}       | ${"Europe/Berlin"}
    ${"2024-02-29T02:00:00+02:00[Europe/Helsinki]"}     | ${"Europe/Helsinki"}
    ${"2024-02-29T03:00:00+03:00[Europe/Istanbul]"}     | ${"Europe/Istanbul"}
    ${"2024-02-29T05:30:00+05:30[Asia/Kolkata]"}        | ${"Asia/Kolkata"}
    ${"2024-02-29T05:45:00+05:45[Asia/Kathmandu]"}      | ${"Asia/Kathmandu"}
    ${"2024-02-29T08:00:00+08:00[Asia/Shanghai]"}       | ${"Asia/Shanghai"}
    ${"2024-02-29T11:00:00+11:00[Australia/Lord_Howe]"} | ${"Australia/Lord_Howe"}
    ${"2024-02-29T13:45:00+13:45[Pacific/Chatham]"}     | ${"Pacific/Chatham"}
    ${"2024-02-29T13:00:00+13:00[Pacific/Apia]"}        | ${"Pacific/Apia"}
    ${"2024-02-28T13:00:00-11:00[Pacific/Niue]"}        | ${"Pacific/Niue"}
    ${"2024-02-28T19:00:00-05:00[America/New_York]"}    | ${"America/New_York"}
    ${"2024-02-28T18:00:00-06:00[America/Chicago]"}     | ${"America/Chicago"}
    ${"2024-02-28T17:00:00-07:00[America/Phoenix]"}     | ${"America/Phoenix"}
  `(
    "returns timeZone $expected for battle-test $value (2024-02-29T00:00:00Z)",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseZonedUnit(value, "timeZone")).toBe(expected);
    },
  );

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`returns timeZone unit for battle-test timeZone ${timeZone}`, () => {
      expect(parseZonedUnit(value, "timeZone")).toBe(timeZone);
    });
  }
});
