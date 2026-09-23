import { cycleTime } from "./cycleTime";

describe("cycleTime", () => {
  it.each`
    value         | field       | amount | expected
    ${"09:30:00"} | ${"hour"}   | ${1}   | ${"10:30:00"}
    ${"09:30:00"} | ${"hour"}   | ${-1}  | ${"08:30:00"}
    ${"09:30:00"} | ${"minute"} | ${1}   | ${"09:31:00"}
    ${"09:30:00"} | ${"minute"} | ${-1}  | ${"09:29:00"}
    ${"09:30:00"} | ${"second"} | ${1}   | ${"09:30:01"}
    ${"09:30:00"} | ${"second"} | ${-1}  | ${"09:30:59"}
  `(
    "returns $expected for $value cycling $field by $amount",
    ({ value, field, amount, expected }) => {
      expect(cycleTime(value, field, amount)).toBe(expected);
    },
  );

  it.each`
    value             | field            | amount | expected      | label
    ${"23:00:00"}     | ${"hour"}        | ${1}   | ${"00:00:00"} | ${"hour 23 +1 wraps to 0"}
    ${"00:00:00"}     | ${"hour"}        | ${-1}  | ${"23:00:00"} | ${"hour 0 -1 wraps to 23"}
    ${"09:59:00"}     | ${"minute"}      | ${1}   | ${"09:00:00"} | ${"minute 59 +1 wraps to 0"}
    ${"09:00:00"}     | ${"minute"}      | ${-1}  | ${"09:59:00"} | ${"minute 0 -1 wraps to 59"}
    ${"09:30:59"}     | ${"second"}      | ${1}   | ${"09:30:00"} | ${"second 59 +1 wraps to 0"}
    ${"09:30:00.999"} | ${"millisecond"} | ${1}   | ${"09:30:00"} | ${"millisecond 999 +1 wraps to 0"}
  `(
    "wraps at the field boundary ($label): $value cycling $field by $amount -> $expected",
    ({ value, field, amount, expected }) => {
      expect(cycleTime(value, field, amount)).toBe(expected);
    },
  );

  it("wraps an amount larger than the field's range (+25 hours)", () => {
    expect(cycleTime("00:00:00", "hour", 25)).toBe("01:00:00");
  });

  it("returns the value unchanged when amount is 0", () => {
    expect(cycleTime("09:30:00", "hour", 0)).toBe("09:30:00");
  });

  // `overflow` was removed in 1.16.0: the cycled value is always in range for its own field, so
  // there was nothing to constrain or reject. Passing it is a type error, and a JavaScript caller's
  // stray property changes nothing.
  it("treats the removed overflow option as a type error and ignores it at runtime", () => {
    expect(
      cycleTime("23:00:00", "hour", 1, {
        // @ts-expect-error -- `overflow` was removed in 1.16.0
        overflow: "reject",
      }),
    ).toBe("00:00:00");
  });

  it.each`
    amount | round    | expected
    ${15}  | ${false} | ${"09:37:00"}
    ${15}  | ${true}  | ${"09:30:00"}
    ${-15} | ${false} | ${"09:07:00"}
    ${-15} | ${true}  | ${"09:15:00"}
  `(
    "returns $expected for 09:22:00 cycling minute by $amount with round: $round",
    ({ amount, round, expected }) => {
      expect(cycleTime("09:22:00", "minute", amount, { round })).toBe(expected);
    },
  );

  it.each`
    field
    ${"year"}
    ${"day"}
    ${"invalid"}
    ${""}
  `("returns an empty string for an invalid field $field", ({ field }) => {
    expect(cycleTime("09:30:00", field, 1)).toBe("");
  });

  it.each`
    invalidValue
    ${"not-a-time"}
    ${"25:00:00"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${"2024-02-29T12:00:00"}
  `(
    "returns an empty string for an invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(cycleTime(invalidValue, "hour", 1)).toBe("");
    },
  );

  // `amount` must be a finite number (isValidAmount); anything else is invalid input, never 0.
  it.each`
    amount
    ${null}
    ${undefined}
    ${""}
    ${"1"}
    ${[]}
    ${{}}
    ${true}
    ${Number.NaN}
    ${Number.POSITIVE_INFINITY}
  `(
    "returns an empty string for a non-finite-number amount $amount",
    ({ amount }) => {
      expect(cycleTime("09:30:00", "hour", amount)).toBe("");
    },
  );
});
