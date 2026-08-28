import { cycleDate } from "./cycleDate";

describe("cycleDate", () => {
  it.each`
    value           | field      | amount | expected
    ${"2024-06-15"} | ${"year"}  | ${1}   | ${"2025-06-15"}
    ${"2024-06-15"} | ${"year"}  | ${-1}  | ${"2023-06-15"}
    ${"2024-06-15"} | ${"month"} | ${1}   | ${"2024-07-15"}
    ${"2024-06-15"} | ${"month"} | ${-1}  | ${"2024-05-15"}
    ${"2024-06-15"} | ${"day"}   | ${1}   | ${"2024-06-16"}
    ${"2024-06-15"} | ${"day"}   | ${-1}  | ${"2024-06-14"}
  `(
    "returns $expected for $value cycling $field by $amount",
    ({ value, field, amount, expected }) => {
      expect(cycleDate(value, field, amount)).toBe(expected);
    },
  );

  // the core E6 use case: cycling wraps within the field's own range and does NOT carry into the
  // next larger field the way addDate does (addDate("2024-12-15", { months: 1 }) => "2025-01-15")
  it.each`
    value           | field      | amount | expected        | label
    ${"2024-12-15"} | ${"month"} | ${1}   | ${"2024-01-15"} | ${"December +1 stays in the same year"}
    ${"2024-01-15"} | ${"month"} | ${-1}  | ${"2024-12-15"} | ${"January -1 stays in the same year"}
    ${"2024-12-31"} | ${"day"}   | ${1}   | ${"2024-12-01"} | ${"last day of month +1 stays in the same month"}
    ${"2024-12-01"} | ${"day"}   | ${-1}  | ${"2024-12-31"} | ${"first day of month -1 stays in the same month"}
  `(
    "wraps at the field boundary ($label): $value cycling $field by $amount -> $expected",
    ({ value, field, amount, expected }) => {
      expect(cycleDate(value, field, amount)).toBe(expected);
    },
  );

  it.each`
    value           | field      | amount | expected        | label
    ${"2024-01-15"} | ${"month"} | ${13}  | ${"2024-02-15"} | ${"amount larger than the field's range (+13 months)"}
    ${"2024-03-15"} | ${"month"} | ${-25} | ${"2024-02-15"} | ${"large negative amount, multiple ranges"}
  `(
    "$label: $value cycling $field by $amount -> $expected",
    ({ value, field, amount, expected }) => {
      expect(cycleDate(value, field, amount)).toBe(expected);
    },
  );

  it("returns the value unchanged when amount is 0", () => {
    expect(cycleDate("2024-06-15", "month", 0)).toBe("2024-06-15");
  });

  it.each`
    value           | daysInMonth | expected        | label
    ${"2024-01-31"} | ${31}       | ${"2024-01-01"} | ${"31-day month"}
    ${"2024-04-30"} | ${30}       | ${"2024-04-01"} | ${"30-day month"}
    ${"2024-02-29"} | ${29}       | ${"2024-02-01"} | ${"29-day month (leap Feb)"}
    ${"2023-02-28"} | ${28}       | ${"2023-02-01"} | ${"28-day month (non-leap Feb)"}
  `(
    "wraps day-of-month cycling in a $label: $value +1 day -> $expected",
    ({ value, expected }) => {
      expect(cycleDate(value, "day", 1)).toBe(expected);
    },
  );

  // cycling month/year can still clamp day via overflow, the natural consequence of delegating to
  // setDate's .with() call — matches addDate's own Jan 31 + 1 month => Feb 29 precedent
  it.each`
    value           | field      | amount | overflow       | expected
    ${"2024-01-31"} | ${"month"} | ${1}   | ${undefined}   | ${"2024-02-29"}
    ${"2024-01-31"} | ${"month"} | ${1}   | ${"constrain"} | ${"2024-02-29"}
    ${"2024-01-31"} | ${"month"} | ${1}   | ${"reject"}    | ${""}
    ${"2024-02-29"} | ${"year"}  | ${1}   | ${undefined}   | ${"2025-02-28"}
    ${"2024-02-29"} | ${"year"}  | ${1}   | ${"reject"}    | ${""}
  `(
    "returns $expected for $value cycling $field by $amount with overflow $overflow",
    ({ value, field, amount, overflow, expected }) => {
      expect(cycleDate(value, field, amount, { overflow })).toBe(expected);
    },
  );

  // round steps to the next/previous multiple of `amount`, not to the nearest one — see
  // cycleFieldValue's doc. Verified against @internationalized/date's own CycleOptions examples.
  it.each`
    value           | amount | round    | expected
    ${"2022-02-03"} | ${5}   | ${false} | ${"2027-02-03"}
    ${"2022-02-03"} | ${5}   | ${true}  | ${"2025-02-03"}
    ${"2022-02-03"} | ${-5}  | ${false} | ${"2017-02-03"}
    ${"2022-02-03"} | ${-5}  | ${true}  | ${"2020-02-03"}
  `(
    "returns $expected for $value cycling year by $amount with round: $round",
    ({ value, amount, round, expected }) => {
      expect(cycleDate(value, "year", amount, { round })).toBe(expected);
    },
  );

  it.each`
    field
    ${"week"}
    ${"hour"}
    ${"invalid"}
    ${""}
  `("returns an empty string for an invalid field $field", ({ field }) => {
    expect(cycleDate("2024-06-15", field, 1)).toBe("");
  });

  it.each`
    invalidValue
    ${"not-a-date"}
    ${"2024-13-01"}
    ${"2024-02-30"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${"2024-02-29T12:00:00"}
  `(
    "returns an empty string for an invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(cycleDate(invalidValue, "month", 1)).toBe("");
    },
  );
});
