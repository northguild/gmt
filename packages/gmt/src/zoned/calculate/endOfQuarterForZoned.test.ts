import { endOfQuarterForZoned } from "./endOfQuarterForZoned";

describe("endOfQuarterForZoned", () => {
  it.each`
    value                         | expected
    ${"2024-01-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999999999+00:00[UTC]"}
    ${"2024-02-28T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999999999+00:00[UTC]"}
    ${"2024-03-31T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999999999+00:00[UTC]"}
    ${"2024-04-15T12:00:00[UTC]"} | ${"2024-06-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-05-15T12:00:00[UTC]"} | ${"2024-06-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-06-30T12:00:00[UTC]"} | ${"2024-06-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-07-15T12:00:00[UTC]"} | ${"2024-09-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-08-15T12:00:00[UTC]"} | ${"2024-09-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-09-30T12:00:00[UTC]"} | ${"2024-09-30T23:59:59.999999999+00:00[UTC]"}
    ${"2024-10-15T12:00:00[UTC]"} | ${"2024-12-31T23:59:59.999999999+00:00[UTC]"}
    ${"2024-11-15T12:00:00[UTC]"} | ${"2024-12-31T23:59:59.999999999+00:00[UTC]"}
    ${"2024-12-31T12:00:00[UTC]"} | ${"2024-12-31T23:59:59.999999999+00:00[UTC]"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(endOfQuarterForZoned(value)).toBe(expected);
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
  `(
    "returns empty string for invalid zoned $invalidZoned",
    ({ invalidZoned }) => {
      expect(endOfQuarterForZoned(invalidZoned)).toBe("");
    },
  );
});
