import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseYearFromDateTime } from "./parseYearFromDateTime";

describe("parseYearFromDateTime", () => {
  it.each`
    value                    | expected
    ${"2024-03-15T12:30:00"} | ${"2024"}
    ${"0001-01-01T00:00:00"} | ${"1"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseYearFromDateTime(value)).toBe(expected);
  });

  it.each`
    invalidDate
    ${"invalid"}
    ${"2024-02-30"}
  `(
    "returns empty string for invalid datetime $invalidDate",
    ({ invalidDate }) => {
      expect(parseYearFromDateTime(invalidDate)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalPlainDateTimeFromThrow();
    const result = parseYearFromDateTime("2024-02-29T00:00:00");
    expect(result).toBe("");
  });
});
