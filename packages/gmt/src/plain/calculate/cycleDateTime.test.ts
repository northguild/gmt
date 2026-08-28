import { cycleDateTime } from "./cycleDateTime";

describe("cycleDateTime", () => {
  it.each`
    value                    | field       | amount | expected
    ${"2024-06-15T09:30:00"} | ${"year"}   | ${1}   | ${"2025-06-15T09:30:00"}
    ${"2024-06-15T09:30:00"} | ${"month"}  | ${1}   | ${"2024-07-15T09:30:00"}
    ${"2024-06-15T09:30:00"} | ${"day"}    | ${1}   | ${"2024-06-16T09:30:00"}
    ${"2024-06-15T09:30:00"} | ${"hour"}   | ${1}   | ${"2024-06-15T10:30:00"}
    ${"2024-06-15T09:30:00"} | ${"minute"} | ${1}   | ${"2024-06-15T09:31:00"}
    ${"2024-06-15T09:30:00"} | ${"second"} | ${1}   | ${"2024-06-15T09:30:01"}
    ${"2024-06-15T09:30:00"} | ${"year"}   | ${-1}  | ${"2023-06-15T09:30:00"}
    ${"2024-06-15T09:30:00"} | ${"month"}  | ${-1}  | ${"2024-05-15T09:30:00"}
    ${"2024-06-15T09:30:00"} | ${"day"}    | ${-1}  | ${"2024-06-14T09:30:00"}
    ${"2024-06-15T09:30:00"} | ${"hour"}   | ${-1}  | ${"2024-06-15T08:30:00"}
    ${"2024-06-15T09:30:00"} | ${"minute"} | ${-1}  | ${"2024-06-15T09:29:00"}
    ${"2024-06-15T09:30:00"} | ${"second"} | ${-1}  | ${"2024-06-15T09:30:59"}
  `(
    "returns $expected for $value cycling $field by $amount",
    ({ value, field, amount, expected }) => {
      expect(cycleDateTime(value, field, amount)).toBe(expected);
    },
  );

  it.each`
    value                    | field      | amount | expected                 | label
    ${"2024-12-15T23:30:00"} | ${"month"} | ${1}   | ${"2024-01-15T23:30:00"} | ${"month wraps within the same year, time preserved"}
    ${"2024-12-15T23:30:00"} | ${"hour"}  | ${1}   | ${"2024-12-15T00:30:00"} | ${"hour wraps within the same day, date preserved"}
    ${"2024-12-31T09:00:00"} | ${"day"}   | ${1}   | ${"2024-12-01T09:00:00"} | ${"day wraps within the same month"}
  `(
    "wraps at the field boundary ($label): $value cycling $field by $amount -> $expected",
    ({ value, field, amount, expected }) => {
      expect(cycleDateTime(value, field, amount)).toBe(expected);
    },
  );

  it("returns the value unchanged when amount is 0", () => {
    expect(cycleDateTime("2024-06-15T09:30:00", "hour", 0)).toBe(
      "2024-06-15T09:30:00",
    );
  });

  it.each`
    value                    | field      | amount | overflow     | expected
    ${"2024-01-31T09:00:00"} | ${"month"} | ${1}   | ${undefined} | ${"2024-02-29T09:00:00"}
    ${"2024-01-31T09:00:00"} | ${"month"} | ${1}   | ${"reject"}  | ${""}
  `(
    "returns $expected for $value cycling $field by $amount with overflow $overflow",
    ({ value, field, amount, overflow, expected }) => {
      expect(cycleDateTime(value, field, amount, { overflow })).toBe(expected);
    },
  );

  it.each`
    amount | round    | expected
    ${15}  | ${false} | ${"2024-06-15T09:37:00"}
    ${15}  | ${true}  | ${"2024-06-15T09:30:00"}
  `(
    "returns $expected for 2024-06-15T09:22:00 cycling minute by $amount with round: $round",
    ({ amount, round, expected }) => {
      expect(
        cycleDateTime("2024-06-15T09:22:00", "minute", amount, { round }),
      ).toBe(expected);
    },
  );

  it.each`
    field
    ${"week"}
    ${"invalid"}
    ${""}
  `("returns an empty string for an invalid field $field", ({ field }) => {
    expect(cycleDateTime("2024-06-15T09:30:00", field, 1)).toBe("");
  });

  it.each`
    invalidValue
    ${"not-a-datetime"}
    ${"2024-02-30T09:00:00"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${true}
  `(
    "returns an empty string for an invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(cycleDateTime(invalidValue, "hour", 1)).toBe("");
    },
  );
});
