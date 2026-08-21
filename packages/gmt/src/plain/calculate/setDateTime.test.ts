import { setDateTime } from "./setDateTime";

describe("setDateTime", () => {
  it.each`
    value                    | fields                            | expected
    ${"2024-03-10T12:00:00"} | ${{ year: 2025 }}                 | ${"2025-03-10T12:00:00"}
    ${"2024-03-10T12:00:00"} | ${{ month: 6 }}                   | ${"2024-06-10T12:00:00"}
    ${"2024-03-10T12:00:00"} | ${{ day: 20 }}                    | ${"2024-03-20T12:00:00"}
    ${"2024-03-10T12:00:00"} | ${{ hour: 9 }}                    | ${"2024-03-10T09:00:00"}
    ${"2024-03-10T12:00:00"} | ${{ minute: 45 }}                 | ${"2024-03-10T12:45:00"}
    ${"2024-03-10T12:00:00"} | ${{ second: 30 }}                 | ${"2024-03-10T12:00:30"}
    ${"2024-03-10T12:00:00"} | ${{ millisecond: 250 }}           | ${"2024-03-10T12:00:00.25"}
    ${"2024-03-10T12:00:00"} | ${{ year: 2025, hour: 9 }}        | ${"2025-03-10T09:00:00"}
    ${"2024-03-10T12:00:00"} | ${{ month: 6, day: 20, hour: 9 }} | ${"2024-06-20T09:00:00"}
    ${"2024-03-10T12:00:00"} | ${{}}                             | ${"2024-03-10T12:00:00"}
  `(
    "returns $expected for $value with fields $fields",
    ({ value, fields, expected }) => {
      expect(setDateTime(value, fields)).toBe(expected);
    },
  );

  it("resolves multi-field updates atomically regardless of field order in the object", () => {
    const monthThenDay = setDateTime("2024-01-31T12:00:00", {
      month: 2,
      day: 5,
    });
    const dayThenMonth = setDateTime("2024-01-31T12:00:00", {
      day: 5,
      month: 2,
    });
    expect(monthThenDay).toBe("2024-02-05T12:00:00");
    expect(dayThenMonth).toBe("2024-02-05T12:00:00");
  });

  it.each`
    invalidDateTime
    ${"2024-02-30T12:00:00"}
    ${"not-a-datetime"}
    ${"2024-02-29T24:00:00"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"2024-03-10"}
  `(
    "returns an empty string for an invalid datetime $invalidDateTime",
    ({ invalidDateTime }) => {
      expect(setDateTime(invalidDateTime, { year: 2025 })).toBe("");
    },
  );

  it.each`
    value                    | fields          | overflow       | expected
    ${"2024-01-31T12:00:00"} | ${{ month: 2 }} | ${undefined}   | ${"2024-02-29T12:00:00"}
    ${"2024-01-31T12:00:00"} | ${{ month: 2 }} | ${"constrain"} | ${"2024-02-29T12:00:00"}
    ${"2024-01-31T12:00:00"} | ${{ month: 2 }} | ${"reject"}    | ${""}
    ${"2023-01-31T12:00:00"} | ${{ month: 2 }} | ${undefined}   | ${"2023-02-28T12:00:00"}
    ${"2023-01-31T12:00:00"} | ${{ month: 2 }} | ${"reject"}    | ${""}
    ${"2024-01-15T12:00:00"} | ${{ month: 2 }} | ${"reject"}    | ${"2024-02-15T12:00:00"}
  `(
    "returns $expected for $value with fields $fields and overflow $overflow",
    ({ value, fields, overflow, expected }) => {
      expect(
        setDateTime(
          value,
          fields,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  it("returns an empty string when the with() call throws for a malformed fields object", () => {
    expect(setDateTime("2024-03-10T12:00:00", { hour: Number.NaN })).toBe("");
  });
});
