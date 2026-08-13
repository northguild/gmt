import { endOfQuarterForZoned } from "./endOfQuarterForZoned";

describe("endOfQuarterForZoned", () => {
  it.each`
    value                         | expected
    ${"2024-01-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59+00:00[UTC]"}
    ${"2024-02-28T12:00:00[UTC]"} | ${"2024-03-31T23:59:59+00:00[UTC]"}
    ${"2024-03-31T12:00:00[UTC]"} | ${"2024-03-31T23:59:59+00:00[UTC]"}
    ${"2024-04-15T12:00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-05-15T12:00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-06-30T12:00:00[UTC]"} | ${"2024-06-30T23:59:59+00:00[UTC]"}
    ${"2024-07-15T12:00:00[UTC]"} | ${"2024-09-30T23:59:59+00:00[UTC]"}
    ${"2024-08-15T12:00:00[UTC]"} | ${"2024-09-30T23:59:59+00:00[UTC]"}
    ${"2024-09-30T12:00:00[UTC]"} | ${"2024-09-30T23:59:59+00:00[UTC]"}
    ${"2024-10-15T12:00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-11-15T12:00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-12-31T12:00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(endOfQuarterForZoned(value)).toBe(expected);
  });

  it.each`
    fractionalSecondDigits | value                         | expected
    ${0}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59+00:00[UTC]"}
    ${3}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999+00:00[UTC]"}
    ${6}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999999+00:00[UTC]"}
    ${9}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-03-31T23:59:59.999999999+00:00[UTC]"}
  `(
    "returns $expected for $value with fractionalSecondDigits $fractionalSecondDigits",
    ({ value, fractionalSecondDigits, expected }) => {
      expect(endOfQuarterForZoned(value, { fractionalSecondDigits })).toBe(
        expected,
      );
    },
  );

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

  // disambiguation + offset are wired through, though quarter boundaries (Mar31/Jun30/Sep30/Dec31
  // end-of-day) rarely coincide with a DST transition in common IANA zones — this verifies the
  // parameters are accepted and don't change output for the common case
  it.each`
    disambiguation  | offset
    ${"compatible"} | ${undefined}
    ${"earlier"}    | ${undefined}
    ${"later"}      | ${undefined}
    ${"reject"}     | ${undefined}
    ${"reject"}     | ${"prefer"}
    ${"reject"}     | ${"ignore"}
  `(
    "accepts disambiguation $disambiguation and offset $offset without changing output for a non-transition quarter end",
    ({ disambiguation, offset }) => {
      const optionsArg =
        offset === undefined ? { disambiguation } : { disambiguation, offset };
      expect(
        endOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", optionsArg),
      ).toBe("2024-03-31T23:59:59+00:00[UTC]");
    },
  );
});
