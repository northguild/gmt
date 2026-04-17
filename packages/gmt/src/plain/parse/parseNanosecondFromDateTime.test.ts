import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseNanosecondFromDateTime } from "./parseNanosecondFromDateTime";

describe("parseNanosecondFromDateTime", () => {
  it.each`
    value                              | expected
    ${"2024-03-15T14:30:45"}           | ${"000"}
    ${"2024-03-15T14:30:45.123"}       | ${"000"}
    ${"2024-03-15T14:30:45.123456"}    | ${"000"}
    ${"2024-03-15T14:30:45.123456789"} | ${"789"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseNanosecondFromDateTime(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-30T12:00:00"}
  `(
    "returns empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(parseNanosecondFromDateTime(invalidValue)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalPlainDateTimeFromThrow();
    const result = parseNanosecondFromDateTime("2024-02-29T00:00:00.000000000");
    expect(result).toBe("");
  });
});
