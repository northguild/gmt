import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseDayOfWeekFromDateTime } from "./parseDayOfWeekFromDateTime";

describe("parseDayOfWeekFromDateTime", () => {
  it.each`
    value                    | expected
    ${"2024-01-01T12:00:00"} | ${1}
    ${"2024-01-07T00:00:00"} | ${7}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDayOfWeekFromDateTime(value)).toBe(expected);
  });

  it.each`
    invalidDateTime
    ${"invalid"}
    ${"2024-02-30T12:00:00"}
  `(
    "returns null for invalid datetime $invalidDateTime",
    ({ invalidDateTime }) => {
      expect(parseDayOfWeekFromDateTime(invalidDateTime)).toBeNull();
    },
  );

  it("returns null on failure", () => {
    mockTemporalPlainDateTimeFromThrow();
    const result = parseDayOfWeekFromDateTime("2024-02-29T00:00:00");
    expect(result).toBeNull();
  });
});
