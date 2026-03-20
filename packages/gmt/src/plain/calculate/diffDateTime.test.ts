import { diffDateTime } from "./diffDateTime";

describe("diffDateTime", () => {
  it.each`
    dateTime1                | dateTime2                          | unit             | expected
    ${"2023-01-01T00:00:00"} | ${"2024-01-01T00:00:00"}           | ${"year"}        | ${1}
    ${"2023-01-01T00:00:00"} | ${"2024-01-02T00:00:00"}           | ${"year"}        | ${1}
    ${"2023-01-01T00:00:00"} | ${"2023-12-31T00:00:00"}           | ${"year"}        | ${0}
    ${"2023-01-01T00:00:00"} | ${"2024-01-01T00:00:00"}           | ${"month"}       | ${12}
    ${"2023-01-01T00:00:00"} | ${"2023-02-01T00:00:00"}           | ${"month"}       | ${1}
    ${"2023-01-01T00:00:00"} | ${"2023-01-01T00:00:00"}           | ${"month"}       | ${0}
    ${"2023-01-01T00:00:00"} | ${"2023-01-08T00:00:00"}           | ${"week"}        | ${1}
    ${"2023-01-01T00:00:00"} | ${"2023-01-07T00:00:00"}           | ${"week"}        | ${0}
    ${"2023-01-01T00:00:00"} | ${"2023-01-31T00:00:00"}           | ${"day"}         | ${30}
    ${"2023-01-01T00:00:00"} | ${"2023-01-01T00:00:00"}           | ${"day"}         | ${0}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T01:00:00"}           | ${"hour"}        | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T12:00:00"}           | ${"hour"}        | ${12}
    ${"2024-02-29T12:30:45"} | ${"2024-02-29T13:30:45"}           | ${"hour"}        | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:01:00"}           | ${"minute"}      | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:30:00"}           | ${"minute"}      | ${30}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:01"}           | ${"second"}      | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:59"}           | ${"second"}      | ${59}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:00.001"}       | ${"millisecond"} | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:00.000001"}    | ${"microsecond"} | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:00.000000001"} | ${"nanosecond"}  | ${1}
  `(
    "returns $expected for $unit comparing $dateTime1, $dateTime2",
    ({ dateTime1, dateTime2, unit, expected }) => {
      expect(diffDateTime(dateTime1, dateTime2, unit)).toBe(expected);
    },
  );

  it.each`
    dateTime1                    | dateTime2                | unit             | expected
    ${"2024-02-29T00:00:00"}     | ${"2025-02-28T00:00:00"} | ${"year"}        | ${0}
    ${"2024-12-31T23:59:59"}     | ${"2025-01-01T00:00:00"} | ${"second"}      | ${1}
    ${"2024-01-01T00:00:00"}     | ${"2024-12-31T23:59:59"} | ${"hour"}        | ${8783}
    ${"2024-01-31T00:00:00"}     | ${"2024-02-29T00:00:00"} | ${"month"}       | ${0}
    ${"2023-01-01T23:59:59.999"} | ${"2023-01-02T00:00:00"} | ${"millisecond"} | ${1}
  `(
    "returns $expected for edge cases: $unit comparing $dateTime1, $dateTime2",
    ({ dateTime1, dateTime2, unit, expected }) => {
      expect(diffDateTime(dateTime1, dateTime2, unit)).toBe(expected);
    },
  );

  it.each`
    dateTime1                | dateTime2
    ${"2024-02-29T12:00:00"} | ${"2023-01-01T00:00:00"}
    ${"2024-12-31T23:59:59"} | ${"2024-01-01T00:00:00"}
    ${"2023-06-15T18:30:00"} | ${"2023-01-01T00:00:00"}
  `(
    "returns negative difference for dateTime1 after dateTime2: $dateTime1, $dateTime2",
    ({ dateTime1, dateTime2 }) => {
      expect(diffDateTime(dateTime1, dateTime2, "second")).toBeLessThan(0);
    },
  );

  it.each`
    invalidDateTime1
    ${"2024-02-30T12:00:00"}
    ${"not-a-datetime"}
    ${"2024-13-01T12:00:00"}
    ${"2024-00-10T12:00:00"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"12"}
    ${"2024"}
    ${"2024-02"}
    ${"2024-02-29"}
    ${"12:00:00"}
    ${"2024-02-29T25:00:00"}
  `("returns null for invalid dateTime1", ({ invalidDateTime1 }) => {
    expect(
      diffDateTime(invalidDateTime1 as never, "2024-01-01T00:00:00", "day"),
    ).toBeNull();
  });

  it.each`
    invalidDateTime2
    ${"2024-02-30T12:00:00"}
    ${"not-a-datetime"}
    ${"2024-13-01T12:00:00"}
    ${"2024-00-10T12:00:00"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"12"}
    ${"2024"}
    ${"2024-02"}
    ${"2024-02-29"}
    ${"12:00:00"}
    ${"2024-02-29T25:00:00"}
  `("returns null for invalid dateTime2", ({ invalidDateTime2 }) => {
    expect(
      diffDateTime("2024-01-01T00:00:00", invalidDateTime2 as never, "day"),
    ).toBeNull();
  });

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${"hours"}
    ${"days"}
    ${"months"}
    ${"years"}
    ${"seconds"}
  `("returns null for invalid unit", ({ invalidUnit }) => {
    expect(
      diffDateTime(
        "2024-01-01T00:00:00",
        "2024-01-02T00:00:00",
        invalidUnit as never,
      ),
    ).toBeNull();
  });
});
