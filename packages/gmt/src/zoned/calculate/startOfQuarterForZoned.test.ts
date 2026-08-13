import { startOfQuarterForZoned } from "./startOfQuarterForZoned";

describe("startOfQuarterForZoned", () => {
  it.each`
    value                         | expected
    ${"2024-01-15T12:00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"2024-02-28T12:00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"2024-03-31T12:00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${"2024-04-15T12:00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"}
    ${"2024-05-15T12:00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"}
    ${"2024-06-30T12:00:00[UTC]"} | ${"2024-04-01T00:00:00+00:00[UTC]"}
    ${"2024-07-15T12:00:00[UTC]"} | ${"2024-07-01T00:00:00+00:00[UTC]"}
    ${"2024-08-15T12:00:00[UTC]"} | ${"2024-07-01T00:00:00+00:00[UTC]"}
    ${"2024-09-30T12:00:00[UTC]"} | ${"2024-07-01T00:00:00+00:00[UTC]"}
    ${"2024-10-15T12:00:00[UTC]"} | ${"2024-10-01T00:00:00+00:00[UTC]"}
    ${"2024-11-15T12:00:00[UTC]"} | ${"2024-10-01T00:00:00+00:00[UTC]"}
    ${"2024-12-31T12:00:00[UTC]"} | ${"2024-10-01T00:00:00+00:00[UTC]"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(startOfQuarterForZoned(value)).toBe(expected);
  });

  it.each`
    fractionalSecondDigits | value                         | expected
    ${0}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-01-01T00:00:00+00:00[UTC]"}
    ${3}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-01-01T00:00:00.000+00:00[UTC]"}
    ${6}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-01-01T00:00:00.000000+00:00[UTC]"}
    ${9}                   | ${"2024-02-15T12:00:00[UTC]"} | ${"2024-01-01T00:00:00.000000000+00:00[UTC]"}
  `(
    "returns $expected for $value with fractionalSecondDigits $fractionalSecondDigits",
    ({ value, fractionalSecondDigits, expected }) => {
      expect(startOfQuarterForZoned(value, { fractionalSecondDigits })).toBe(
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
      expect(startOfQuarterForZoned(invalidZoned)).toBe("");
    },
  );

  // disambiguation + offset are wired through, though quarter starts (Jan1/Apr1/Jul1/Oct1) rarely
  // coincide with a DST transition in common IANA zones — this verifies the parameters are accepted
  // and don't change output for the common case (mechanism verification, not a gap/overlap case)
  it.each`
    disambiguation  | offset
    ${"compatible"} | ${undefined}
    ${"earlier"}    | ${undefined}
    ${"later"}      | ${undefined}
    ${"reject"}     | ${undefined}
    ${"reject"}     | ${"prefer"}
    ${"reject"}     | ${"ignore"}
  `(
    "accepts disambiguation $disambiguation and offset $offset without changing output for a non-transition quarter start",
    ({ disambiguation, offset }) => {
      const optionsArg =
        offset === undefined ? { disambiguation } : { disambiguation, offset };
      expect(
        startOfQuarterForZoned("2024-02-15T14:30:00+00:00[UTC]", optionsArg),
      ).toBe("2024-01-01T00:00:00+00:00[UTC]");
    },
  );
});
