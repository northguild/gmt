import { subtractDateTime } from "./subtractDateTime";

describe("subtractDateTime", () => {
  it.each`
    value                 | units                  | expected
    ${"2024-02-29T14:30"} | ${{ years: 1 }}        | ${"2023-02-28T14:30:00"}
    ${"2024-02-29T14:30"} | ${{ months: 1 }}       | ${"2024-01-29T14:30:00"}
    ${"2024-02-29T14:30"} | ${{ weeks: 1 }}        | ${"2024-02-22T14:30:00"}
    ${"2024-02-29T14:30"} | ${{ days: 1 }}         | ${"2024-02-28T14:30:00"}
    ${"2024-02-29T14:30"} | ${{ hours: 1 }}        | ${"2024-02-29T13:30:00"}
    ${"2024-02-29T14:30"} | ${{ minutes: 1 }}      | ${"2024-02-29T14:29:00"}
    ${"2024-02-29T14:30"} | ${{ seconds: 1 }}      | ${"2024-02-29T14:29:59"}
    ${"2024-02-29T14:30"} | ${{ milliseconds: 1 }} | ${"2024-02-29T14:29:59.999"}
    ${"2024-02-29T14:30"} | ${{ microseconds: 1 }} | ${"2024-02-29T14:29:59.999999"}
    ${"2024-02-29T14:30"} | ${{ nanoseconds: 1 }}  | ${"2024-02-29T14:29:59.999999999"}
  `("returns $expected for $value - $units", ({ value, units, expected }) => {
    expect(subtractDateTime(value, units)).toBe(expected);
  });

  it.each`
    negativeAmount | expectedDateTime
    ${-1}          | ${"2024-02-29T14:31:00"}
    ${-30}         | ${"2024-02-29T15:00:00"}
    ${-90}         | ${"2024-02-29T16:00:00"}
  `(
    "returns $expectedDateTime when subtracting a negative amount: $negativeAmount",
    ({ negativeAmount, expectedDateTime }) => {
      expect(
        subtractDateTime("2024-02-29T14:30", { minutes: negativeAmount }),
      ).toBe(expectedDateTime);
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
      expect(
        subtractDateTime("2024-02-29T14:30", {
          minutes: invalidAmount,
        } as never),
      ).toBe("");
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
      expect(subtractDateTime(invalidDateTime as never, { minutes: 30 })).toBe(
        "",
      );
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
        subtractDateTime("2024-02-29T14:30", { [invalidUnit as never]: 1 }),
      ).toBe("");
    },
  );
});
