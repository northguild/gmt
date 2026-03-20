import { mapDatesInRange } from "./mapDatesInRange";

describe("mapDatesInRange", () => {
  it.each`
    startDate       | endDate         | stepDays | expected
    ${"2024-03-01"} | ${"2024-03-03"} | ${1}     | ${["2024-03-01", "2024-03-02", "2024-03-03"]}
    ${"2024-03-01"} | ${"2024-03-07"} | ${2}     | ${["2024-03-01", "2024-03-03", "2024-03-05", "2024-03-07"]}
    ${"2024-03-05"} | ${"2024-03-03"} | ${1}     | ${[]}
  `(
    "maps range $startDate to $endDate with step $stepDays",
    ({
      startDate,
      endDate,
      stepDays,
      expected,
    }: {
      startDate: string;
      endDate: string;
      stepDays: number;
      expected: string[];
    }) => {
      expect(mapDatesInRange(startDate, endDate, stepDays)).toEqual(expected);
    },
  );

  it.each`
    startDate       | endDate         | stepDays | expected
    ${"2024-03-01"} | ${"2024-03-01"} | ${1}     | ${["2024-03-01"]}
    ${"2024-02-28"} | ${"2024-03-01"} | ${1}     | ${["2024-02-28", "2024-02-29", "2024-03-01"]}
  `(
    "maps edge case range $startDate to $endDate with step $stepDays",
    ({ startDate, endDate, stepDays, expected }) => {
      expect(mapDatesInRange(startDate, endDate, stepDays)).toEqual(expected);
    },
  );

  it.each`
    startDate       | endDate         | invalidStep
    ${"2024-03-01"} | ${"2024-03-03"} | ${0}
    ${"2024-03-01"} | ${"2024-03-03"} | ${-1}
    ${"2024-03-01"} | ${"2024-03-03"} | ${1.5}
    ${"2024-03-01"} | ${"2024-03-03"} | ${NaN}
    ${"2024-03-01"} | ${"2024-03-03"} | ${null}
    ${"2024-03-01"} | ${"2024-03-03"} | ${undefined}
  `(
    "returns an empty array for invalid stepDays $invalidStep",
    ({ startDate, endDate, invalidStep }) => {
      expect(mapDatesInRange(startDate, endDate, invalidStep as never)).toEqual(
        [],
      );
    },
  );

  it.each`
    invalidStartDate | endDate         | stepDays
    ${"invalid"}     | ${"2024-03-03"} | ${1}
    ${"2024-02-30"}  | ${"2024-03-03"} | ${1}
    ${""}            | ${"2024-03-03"} | ${1}
    ${null}          | ${"2024-03-03"} | ${1}
    ${undefined}     | ${"2024-03-03"} | ${1}
  `(
    "returns an empty array for invalid startDate $invalidStartDate",
    ({ invalidStartDate, endDate, stepDays }) => {
      expect(
        mapDatesInRange(invalidStartDate as never, endDate, stepDays),
      ).toEqual([]);
    },
  );

  it.each`
    startDate       | invalidEndDate  | stepDays
    ${"2024-03-01"} | ${"invalid"}    | ${1}
    ${"2024-03-01"} | ${"2024-02-30"} | ${1}
    ${"2024-03-01"} | ${""}           | ${1}
    ${"2024-03-01"} | ${null}         | ${1}
    ${"2024-03-01"} | ${undefined}    | ${1}
  `(
    "returns an empty array for invalid endDate $invalidEndDate",
    ({ startDate, invalidEndDate, stepDays }) => {
      expect(
        mapDatesInRange(startDate, invalidEndDate as never, stepDays),
      ).toEqual([]);
    },
  );
});
