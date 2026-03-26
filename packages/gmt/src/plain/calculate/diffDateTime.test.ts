import { diffDateTime } from "./diffDateTime";

describe("diffDateTime", () => {
  it.each`
    dateTime1                | dateTime2                          | unit              | expected
    ${"2023-01-01T00:00:00"} | ${"2024-01-01T00:00:00"}           | ${"years"}        | ${1}
    ${"2023-01-01T00:00:00"} | ${"2024-01-02T00:00:00"}           | ${"years"}        | ${1}
    ${"2023-01-01T00:00:00"} | ${"2023-12-31T00:00:00"}           | ${"years"}        | ${0}
    ${"2023-01-01T00:00:00"} | ${"2024-01-01T00:00:00"}           | ${"months"}       | ${12}
    ${"2023-01-01T00:00:00"} | ${"2023-02-01T00:00:00"}           | ${"months"}       | ${1}
    ${"2023-01-01T00:00:00"} | ${"2023-01-01T00:00:00"}           | ${"months"}       | ${0}
    ${"2023-01-01T00:00:00"} | ${"2023-01-08T00:00:00"}           | ${"weeks"}        | ${1}
    ${"2023-01-01T00:00:00"} | ${"2023-01-07T00:00:00"}           | ${"weeks"}        | ${0}
    ${"2023-01-01T00:00:00"} | ${"2023-01-31T00:00:00"}           | ${"days"}         | ${30}
    ${"2023-01-01T00:00:00"} | ${"2023-01-01T00:00:00"}           | ${"days"}         | ${0}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T01:00:00"}           | ${"hours"}        | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T12:00:00"}           | ${"hours"}        | ${12}
    ${"2024-02-29T12:30:45"} | ${"2024-02-29T13:30:45"}           | ${"hours"}        | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:01:00"}           | ${"minutes"}      | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:30:00"}           | ${"minutes"}      | ${30}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:01"}           | ${"seconds"}      | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:59"}           | ${"seconds"}      | ${59}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:00.001"}       | ${"milliseconds"} | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:00.000001"}    | ${"microseconds"} | ${1}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:00.000000001"} | ${"nanoseconds"}  | ${1}
  `(
    "returns int $expected for single unit $unit comparing $dateTime1, $dateTime2",
    ({ dateTime1, dateTime2, unit, expected }) => {
      expect(diffDateTime(dateTime1, dateTime2, unit)).toEqual(expected);
    },
  );

  it.each`
    dateTime1                | dateTime2                          | units               | expected
    ${"2023-01-01T00:00:00"} | ${"2024-01-01T00:00:00"}           | ${["years"]}        | ${{ years: 1 }}
    ${"2023-01-01T00:00:00"} | ${"2024-01-02T00:00:00"}           | ${["years"]}        | ${{ years: 1 }}
    ${"2023-01-01T00:00:00"} | ${"2023-12-31T00:00:00"}           | ${["years"]}        | ${{ years: 0 }}
    ${"2023-01-01T00:00:00"} | ${"2024-01-01T00:00:00"}           | ${["months"]}       | ${{ months: 12 }}
    ${"2023-01-01T00:00:00"} | ${"2023-02-01T00:00:00"}           | ${["months"]}       | ${{ months: 1 }}
    ${"2023-01-01T00:00:00"} | ${"2023-01-01T00:00:00"}           | ${["months"]}       | ${{ months: 0 }}
    ${"2023-01-01T00:00:00"} | ${"2023-01-08T00:00:00"}           | ${["weeks"]}        | ${{ weeks: 1 }}
    ${"2023-01-01T00:00:00"} | ${"2023-01-07T00:00:00"}           | ${["weeks"]}        | ${{ weeks: 0 }}
    ${"2023-01-01T00:00:00"} | ${"2023-01-31T00:00:00"}           | ${["days"]}         | ${{ days: 30 }}
    ${"2023-01-01T00:00:00"} | ${"2023-01-01T00:00:00"}           | ${["days"]}         | ${{ days: 0 }}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T01:00:00"}           | ${["hours"]}        | ${{ hours: 1 }}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T12:00:00"}           | ${["hours"]}        | ${{ hours: 12 }}
    ${"2024-02-29T12:30:45"} | ${"2024-02-29T13:30:45"}           | ${["hours"]}        | ${{ hours: 1 }}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:01:00"}           | ${["minutes"]}      | ${{ minutes: 1 }}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:30:00"}           | ${["minutes"]}      | ${{ minutes: 30 }}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:01"}           | ${["seconds"]}      | ${{ seconds: 1 }}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:59"}           | ${["seconds"]}      | ${{ seconds: 59 }}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:00.001"}       | ${["milliseconds"]} | ${{ milliseconds: 1 }}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:00.000001"}    | ${["microseconds"]} | ${{ microseconds: 1 }}
    ${"2024-02-29T00:00:00"} | ${"2024-02-29T00:00:00.000000001"} | ${["nanoseconds"]}  | ${{ nanoseconds: 1 }}
  `(
    "returns $expected for $units comparing $dateTime1, $dateTime2",
    ({ dateTime1, dateTime2, units, expected }) => {
      expect(diffDateTime(dateTime1, dateTime2, units)).toEqual(expected);
    },
  );

  it.each`
    dateTime1                    | dateTime2                | units               | expected
    ${"2024-02-29T00:00:00"}     | ${"2025-02-28T00:00:00"} | ${["years"]}        | ${{ years: 0 }}
    ${"2024-12-31T23:59:59"}     | ${"2025-01-01T00:00:00"} | ${["seconds"]}      | ${{ seconds: 1 }}
    ${"2024-01-01T00:00:00"}     | ${"2024-12-31T23:59:59"} | ${["hours"]}        | ${{ hours: 8783 }}
    ${"2024-01-31T00:00:00"}     | ${"2024-02-29T00:00:00"} | ${["months"]}       | ${{ months: 0 }}
    ${"2023-01-01T23:59:59.999"} | ${"2023-01-02T00:00:00"} | ${["milliseconds"]} | ${{ milliseconds: 1 }}
  `(
    "returns $expected for edge cases: $units comparing $dateTime1, $dateTime2",
    ({ dateTime1, dateTime2, units, expected }) => {
      expect(diffDateTime(dateTime1, dateTime2, units)).toEqual(expected);
    },
  );

  it.each`
    dateTime1                | dateTime2                | expected
    ${"2024-02-29T12:00:00"} | ${"2024-02-29T11:59:59"} | ${{ seconds: -1 }}
    ${"2024-02-29T12:00:00"} | ${"2024-02-28T12:00:00"} | ${{ seconds: -86400 }}
  `(
    "returns negative difference for dateTime1 after dateTime2: $dateTime1, $dateTime2 as $expected ",
    ({ dateTime1, dateTime2, expected }) => {
      expect(diffDateTime(dateTime1, dateTime2, ["seconds"])).toEqual(expected);
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
  `(
    "returns null for invalid dateTime1 $invalidDateTime1",
    ({ invalidDateTime1 }) => {
      expect(
        diffDateTime(invalidDateTime1 as never, "2024-01-01T00:00:00", [
          "days",
        ]),
      ).toBeNull();
    },
  );

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
  `(
    "returns null for invalid dateTime2 $invalidDateTime2",
    ({ invalidDateTime2 }) => {
      expect(
        diffDateTime("2024-01-01T00:00:00", invalidDateTime2 as never, [
          "days",
        ]),
      ).toBeNull();
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${"hour"}
    ${"day"}
    ${"month"}
    ${"year"}
    ${"second"}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(
      diffDateTime("2024-01-01T00:00:00", "2024-01-02T00:00:00", [
        invalidUnit,
      ] as never),
    ).toBeNull();
  });
});
