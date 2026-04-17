import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseMinuteFromDateTime } from "./parseMinuteFromDateTime";

describe("parseMinuteFromDateTime", () => {
  it.each`
    value                    | expected
    ${"2024-03-15T14:30:45"} | ${"30"}
    ${"2024-03-15T14:00:00"} | ${"00"}
    ${"2024-03-15T14:59:59"} | ${"59"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMinuteFromDateTime(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-30T12:00:00"}
  `(
    "returns empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(parseMinuteFromDateTime(invalidValue)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalPlainDateTimeFromThrow();
    const result = parseMinuteFromDateTime("2024-02-29T00:00:00");
    expect(result).toBe("");
  });
});
