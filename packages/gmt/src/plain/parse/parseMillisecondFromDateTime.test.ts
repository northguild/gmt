import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseMillisecondFromDateTime } from "./parseMillisecondFromDateTime";

describe("parseMillisecondFromDateTime", () => {
  it.each`
    value                        | expected
    ${"2024-03-15T14:30:45.123"} | ${"123"}
    ${"2024-03-15T14:30:45.000"} | ${"000"}
    ${"2024-03-15T14:30:45.999"} | ${"999"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMillisecondFromDateTime(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-30T12:00:00"}
  `(
    "returns empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(parseMillisecondFromDateTime(invalidValue)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalPlainDateTimeFromThrow();
    const result = parseMillisecondFromDateTime("2024-02-29T00:00:00.000");
    expect(result).toBe("");
  });
});
