import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseMicrosecondFromDateTime } from "./parseMicrosecondFromDateTime";

describe("parseMicrosecondFromDateTime", () => {
  it.each`
    value                           | expected
    ${"2024-03-15T14:30:45"}        | ${"000"}
    ${"2024-03-15T14:30:45.123"}    | ${"000"}
    ${"2024-03-15T14:30:45.123456"} | ${"456"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMicrosecondFromDateTime(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-30T12:00:00"}
  `(
    "returns empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(parseMicrosecondFromDateTime(invalidValue)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalPlainDateTimeFromThrow();
    const result = parseMicrosecondFromDateTime("2024-02-29T00:00:00");
    expect(result).toBe("");
  });
});
