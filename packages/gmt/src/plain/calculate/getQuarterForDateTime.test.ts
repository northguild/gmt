import { getQuarterForDateTime } from "./getQuarterForDateTime";

describe("getQuarterForDateTime", () => {
  it.each`
    value                    | expected
    ${"2024-01-15T12:00:00"} | ${1}
    ${"2024-02-15T12:00:00"} | ${1}
    ${"2024-03-15T12:00:00"} | ${1}
    ${"2024-04-15T12:00:00"} | ${2}
    ${"2024-05-15T12:00:00"} | ${2}
    ${"2024-06-15T12:00:00"} | ${2}
    ${"2024-07-15T12:00:00"} | ${3}
    ${"2024-08-15T12:00:00"} | ${3}
    ${"2024-09-15T12:00:00"} | ${3}
    ${"2024-10-15T12:00:00"} | ${4}
    ${"2024-11-15T12:00:00"} | ${4}
    ${"2024-12-15T12:00:00"} | ${4}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(getQuarterForDateTime(value)).toBe(expected);
  });

  it.each`
    invalidDateTime
    ${"invalid-date"}
    ${"2024-02-30T12:00:00"}
    ${"2024-02-29T00:00:00Z"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns null for invalid dateTime $invalidDateTime",
    ({ invalidDateTime }) => {
      expect(getQuarterForDateTime(invalidDateTime)).toBeNull();
    },
  );
});
