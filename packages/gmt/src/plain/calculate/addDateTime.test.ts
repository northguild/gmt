import { addDateTime } from "./addDateTime";

describe("addDateTime", () => {
  it.each`
    value                 | units                  | expected
    ${"2024-02-29T14:30"} | ${{ years: 1 }}        | ${"2025-02-28T14:30:00"}
    ${"2024-02-29T14:30"} | ${{ months: 1 }}       | ${"2024-03-29T14:30:00"}
    ${"2024-02-29T14:30"} | ${{ weeks: 1 }}        | ${"2024-03-07T14:30:00"}
    ${"2024-02-29T14:30"} | ${{ days: 1 }}         | ${"2024-03-01T14:30:00"}
    ${"2024-02-29T14:30"} | ${{ hours: 1 }}        | ${"2024-02-29T15:30:00"}
    ${"2024-02-29T14:30"} | ${{ minutes: 1 }}      | ${"2024-02-29T14:31:00"}
    ${"2024-02-29T14:30"} | ${{ seconds: 1 }}      | ${"2024-02-29T14:30:01"}
    ${"2024-02-29T14:30"} | ${{ milliseconds: 1 }} | ${"2024-02-29T14:30:00.001"}
    ${"2024-02-29T14:30"} | ${{ microseconds: 1 }} | ${"2024-02-29T14:30:00.000001"}
    ${"2024-02-29T14:30"} | ${{ nanoseconds: 1 }}  | ${"2024-02-29T14:30:00.000000001"}
  `("returns $expected for $value + $units", ({ value, units, expected }) => {
    expect(addDateTime(value, units)).toBe(expected);
  });

  it.each`
    negativeAmount      | expectedDateTime
    ${{ minutes: -1 }}  | ${"2024-02-29T14:29:00"}
    ${{ minutes: -30 }} | ${"2024-02-29T14:00:00"}
    ${{ minutes: -90 }} | ${"2024-02-29T13:00:00"}
  `(
    "returns $expectedDateTime when adding a negative amount: $negativeAmount",
    ({ negativeAmount, expectedDateTime }) => {
      expect(addDateTime("2024-02-29T14:30", negativeAmount)).toBe(
        expectedDateTime,
      );
    },
  );

  it.each`
    invalidDateTime
    ${"not-a-datetime"}
    ${"2024-02-30T14:30:00"}
    ${"2024-02-30T14:30:00Z"}
    ${"2024-02-30"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
    ${""}
  `(
    "returns an empty string for an invalid datetime: $invalidDateTime",
    ({ invalidDateTime }) => {
      expect(addDateTime(invalidDateTime, { minutes: 30 })).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for an invalid unit: $invalidUnit",
    ({ invalidUnit }) => {
      expect(
        addDateTime("2024-02-29T14:30", { minutes: 30, [invalidUnit]: 1 }),
      ).toBe("");
    },
  );

  it.each`
    invalidAmount
    ${"not-a-number"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
    ${""}
  `(
    "returns an empty string for an invalid amount: $invalidAmount",
    ({ invalidAmount }) => {
      expect(addDateTime("2024-02-29T14:30", { minutes: invalidAmount })).toBe(
        "",
      );
    },
  );

  it.each`
    value                    | units             | overflow       | expected
    ${"2024-01-31T12:00:00"} | ${{ months: 1 }}  | ${undefined}   | ${"2024-02-29T12:00:00"}
    ${"2024-01-31T12:00:00"} | ${{ months: 1 }}  | ${"constrain"} | ${"2024-02-29T12:00:00"}
    ${"2024-01-31T12:00:00"} | ${{ months: 1 }}  | ${"reject"}    | ${""}
    ${"2024-01-31T12:00:00"} | ${{ months: 13 }} | ${undefined}   | ${"2025-02-28T12:00:00"}
    ${"2024-01-31T12:00:00"} | ${{ months: 13 }} | ${"constrain"} | ${"2025-02-28T12:00:00"}
    ${"2024-01-31T12:00:00"} | ${{ months: 13 }} | ${"reject"}    | ${""}
    ${"2024-02-29T12:00:00"} | ${{ years: 1 }}   | ${undefined}   | ${"2025-02-28T12:00:00"}
    ${"2024-02-29T12:00:00"} | ${{ years: 1 }}   | ${"constrain"} | ${"2025-02-28T12:00:00"}
    ${"2024-02-29T12:00:00"} | ${{ years: 1 }}   | ${"reject"}    | ${""}
    ${"2024-01-15T12:00:00"} | ${{ months: 1 }}  | ${"reject"}    | ${"2024-02-15T12:00:00"}
  `(
    "returns $expected for $value + $units with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(
        addDateTime(
          value,
          units,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  it.each`
    value                    | units             | overflow       | expected
    ${"2024-03-31T12:00:00"} | ${{ months: -1 }} | ${undefined}   | ${"2024-02-29T12:00:00"}
    ${"2024-03-31T12:00:00"} | ${{ months: -1 }} | ${"constrain"} | ${"2024-02-29T12:00:00"}
    ${"2024-03-31T12:00:00"} | ${{ months: -1 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for negative amount $units on $value with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(
        addDateTime(
          value,
          units,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );
});
