import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { parseWeekFromDateTime } from "./parseWeekFromDateTime";

describe("parseWeekFromDateTime", () => {
  it.each`
    value                    | expected
    ${"2024-01-01T12:00:00"} | ${1}
    ${"2024-01-08T00:00:00"} | ${2}
    ${"2024-02-29T23:59:59"} | ${9}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseWeekFromDateTime(value)).toBe(expected);
  });

  it.each`
    invalidDate
    ${"invalid-date"}
    ${"2024-02-30"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns null for invalid datetime $invalidDate", ({ invalidDate }) => {
    expect(parseWeekFromDateTime(invalidDate)).toBeNull();
  });

  it("returns null on failure", () => {
    mockTemporalPlainDateTimeFromThrow();
    const result = parseWeekFromDateTime("2024-02-29T00:00:00");
    expect(result).toBeNull();
  });
});
