import { getQuarterForZoned } from "./getQuarterForZoned";

describe("getQuarterForZoned", () => {
  it.each`
    value                         | expected
    ${"2024-01-15T12:00:00[UTC]"} | ${1}
    ${"2024-02-15T12:00:00[UTC]"} | ${1}
    ${"2024-03-15T12:00:00[UTC]"} | ${1}
    ${"2024-04-15T12:00:00[UTC]"} | ${2}
    ${"2024-05-15T12:00:00[UTC]"} | ${2}
    ${"2024-06-15T12:00:00[UTC]"} | ${2}
    ${"2024-07-15T12:00:00[UTC]"} | ${3}
    ${"2024-08-15T12:00:00[UTC]"} | ${3}
    ${"2024-09-15T12:00:00[UTC]"} | ${3}
    ${"2024-10-15T12:00:00[UTC]"} | ${4}
    ${"2024-11-15T12:00:00[UTC]"} | ${4}
    ${"2024-12-15T12:00:00[UTC]"} | ${4}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(getQuarterForZoned(value)).toBe(expected);
  });

  it.each`
    invalidZoned
    ${"invalid-zoned"}
    ${"2024-02-30T12:00:00[UTC]"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns null for invalid zoned $invalidZoned", ({ invalidZoned }) => {
    expect(getQuarterForZoned(invalidZoned)).toBeNull();
  });
});
