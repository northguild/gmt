import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseHourFromDateTime } from "./parseHourFromDateTime";

describe("parseHourFromDateTime", () => {
  it.each`
    value                    | expected
    ${"2024-03-15T14:30:45"} | ${"14"}
    ${"2024-03-15T00:00:00"} | ${"00"}
    ${"2024-03-15T23:59:59"} | ${"23"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseHourFromDateTime(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-30T12:00:00"}
  `(
    "returns empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(parseHourFromDateTime(invalidValue)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalPlainDateTimeFromThrow();
    const result = parseHourFromDateTime("2024-02-29T00:00:00");
    expect(result).toBe("");
  });
});
