import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseDayFromDateTime } from "./parseDayFromDateTime";

describe("parseDayFromDateTime", () => {
  it.each`
    value                    | expected
    ${"2024-03-15T12:30:00"} | ${"15"}
    ${"2024-12-31T23:59:59"} | ${"31"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDayFromDateTime(value)).toBe(expected);
  });

  it.each`
    invalidDateTime
    ${"invalid"}
    ${"2024-02-30T12:00:00"}
  `(
    "returns empty string for invalid datetime $invalidDateTime",
    ({ invalidDateTime }) => {
      expect(parseDayFromDateTime(invalidDateTime)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalPlainDateTimeFromThrow();
    const result = parseDayFromDateTime("2024-02-29T00:00:00");
    expect(result).toBe("");
  });
});
