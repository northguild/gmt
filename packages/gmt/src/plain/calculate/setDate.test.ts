import { setDate } from "./setDate";

describe("setDate", () => {
  it.each`
    value           | fields                               | expected
    ${"2024-03-10"} | ${{ year: 2025 }}                    | ${"2025-03-10"}
    ${"2024-03-10"} | ${{ month: 6 }}                      | ${"2024-06-10"}
    ${"2024-03-10"} | ${{ day: 20 }}                       | ${"2024-03-20"}
    ${"2024-03-10"} | ${{ year: 2025, month: 6 }}          | ${"2025-06-10"}
    ${"2024-03-10"} | ${{ month: 6, day: 20 }}             | ${"2024-06-20"}
    ${"2024-03-10"} | ${{ year: 2025, day: 20 }}           | ${"2025-03-20"}
    ${"2024-03-10"} | ${{ year: 2025, month: 6, day: 20 }} | ${"2025-06-20"}
    ${"2024-03-10"} | ${{}}                                | ${"2024-03-10"}
  `(
    "returns $expected for $value with fields $fields",
    ({ value, fields, expected }) => {
      expect(setDate(value, fields)).toBe(expected);
    },
  );

  // multi-field atomicity: month-then-day and day-then-month must resolve identically in one call,
  // unlike composing addDate() calls where each step constrains against a different intermediate month
  it("resolves multi-field updates atomically regardless of field order in the object", () => {
    const monthThenDay = setDate("2024-01-31", { month: 2, day: 5 });
    const dayThenMonth = setDate("2024-01-31", { day: 5, month: 2 });
    expect(monthThenDay).toBe("2024-02-05");
    expect(dayThenMonth).toBe("2024-02-05");
  });

  it.each`
    invalidDate
    ${"2024-02-30"}
    ${"not-a-date"}
    ${"2024-13-01"}
    ${"2024-00-10"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"2024-02-29T12:00:00"}
  `(
    "returns an empty string for an invalid date $invalidDate",
    ({ invalidDate }) => {
      expect(setDate(invalidDate, { year: 2025 })).toBe("");
    },
  );

  it.each`
    value           | fields          | overflow       | expected
    ${"2024-01-31"} | ${{ month: 2 }} | ${undefined}   | ${"2024-02-29"}
    ${"2024-01-31"} | ${{ month: 2 }} | ${"constrain"} | ${"2024-02-29"}
    ${"2024-01-31"} | ${{ month: 2 }} | ${"reject"}    | ${""}
    ${"2023-01-31"} | ${{ month: 2 }} | ${undefined}   | ${"2023-02-28"}
    ${"2023-01-31"} | ${{ month: 2 }} | ${"reject"}    | ${""}
    ${"2024-01-15"} | ${{ month: 2 }} | ${"reject"}    | ${"2024-02-15"}
    ${"2024-03-15"} | ${{ day: 1 }}   | ${"reject"}    | ${"2024-03-01"}
  `(
    "returns $expected for $value with fields $fields and overflow $overflow",
    ({ value, fields, overflow, expected }) => {
      expect(
        setDate(
          value,
          fields,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  it("returns an empty string when the with() call throws for a malformed fields object", () => {
    expect(setDate("2024-03-10", { year: Number.NaN })).toBe("");
  });
});
