import { endOfQuarterForDateTime } from "./endOfQuarterForDateTime";

describe("endOfQuarterForDateTime", () => {
  it.each`
    value                    | expected
    ${"2024-01-15T12:00:00"} | ${"2024-03-31T23:59:59.999999999"}
    ${"2024-02-28T12:00:00"} | ${"2024-03-31T23:59:59.999999999"}
    ${"2024-03-31T12:00:00"} | ${"2024-03-31T23:59:59.999999999"}
    ${"2024-04-15T12:00:00"} | ${"2024-06-30T23:59:59.999999999"}
    ${"2024-05-15T12:00:00"} | ${"2024-06-30T23:59:59.999999999"}
    ${"2024-06-30T12:00:00"} | ${"2024-06-30T23:59:59.999999999"}
    ${"2024-07-15T12:00:00"} | ${"2024-09-30T23:59:59.999999999"}
    ${"2024-08-15T12:00:00"} | ${"2024-09-30T23:59:59.999999999"}
    ${"2024-09-30T12:00:00"} | ${"2024-09-30T23:59:59.999999999"}
    ${"2024-10-15T12:00:00"} | ${"2024-12-31T23:59:59.999999999"}
    ${"2024-11-15T12:00:00"} | ${"2024-12-31T23:59:59.999999999"}
    ${"2024-12-31T12:00:00"} | ${"2024-12-31T23:59:59.999999999"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(endOfQuarterForDateTime(value)).toBe(expected);
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
    "returns empty string for invalid dateTime $invalidDateTime",
    ({ invalidDateTime }) => {
      expect(endOfQuarterForDateTime(invalidDateTime)).toBe("");
    },
  );
});
