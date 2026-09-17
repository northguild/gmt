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

describe("mapDatesInRange maxPieces", () => {
  // 2024-03-01..2024-03-05 inclusive is 5 dates at step 1 and 3 dates at step 2.
  it.each`
    stepDays | maxPieces | expected
    ${1}     | ${5}      | ${["2024-03-01", "2024-03-02", "2024-03-03", "2024-03-04", "2024-03-05"]}
    ${1}     | ${10}     | ${["2024-03-01", "2024-03-02", "2024-03-03", "2024-03-04", "2024-03-05"]}
    ${2}     | ${3}      | ${["2024-03-01", "2024-03-03", "2024-03-05"]}
  `(
    "returns $expected for step $stepDays with maxPieces $maxPieces",
    ({ stepDays, maxPieces, expected }) => {
      expect(
        mapDatesInRange("2024-03-01", "2024-03-05", stepDays, { maxPieces }),
      ).toEqual(expected);
    },
  );

  // Owner decision A2: more dates than maxPieces returns the sentinel.
  it.each`
    endDate         | stepDays | maxPieces
    ${"2024-03-05"} | ${1}     | ${4}
    ${"2024-03-05"} | ${2}     | ${2}
    ${"2024-03-02"} | ${1}     | ${1}
  `(
    "returns [] for 2024-03-01 to $endDate at step $stepDays over maxPieces $maxPieces",
    ({ endDate, stepDays, maxPieces }) => {
      expect(
        mapDatesInRange("2024-03-01", endDate, stepDays, { maxPieces }).length,
      ).toBe(0);
    },
  );

  it.each`
    label                   | options
    ${"maxPieces 0"}        | ${{ maxPieces: 0 }}
    ${"maxPieces -1"}       | ${{ maxPieces: -1 }}
    ${"maxPieces 1.5"}      | ${{ maxPieces: 1.5 }}
    ${"maxPieces NaN"}      | ${{ maxPieces: Number.NaN }}
    ${"maxPieces Infinity"} | ${{ maxPieces: Number.POSITIVE_INFINITY }}
    ${"maxPieces string"}   | ${{ maxPieces: "5" }}
    ${"null options"}       | ${null}
    ${"number options"}     | ${5}
  `("returns [] for invalid $label", ({ options }) => {
    expect(
      mapDatesInRange("2024-03-01", "2024-03-05", 1, options as never).length,
    ).toBe(0);
  });
});

describe("mapDatesInRange default piece limit", () => {
  // Default maxPieces is 1_000_000. 2024-01-01 + 1_000_000 days = 4761-11-28 (Temporal
  // PlainDate.add), so the inclusive range holds 1_000_001 dates. The full PlainDate range
  // holds 200_000_002 dates.
  it.each`
    startDate          | endDate            | stepDays
    ${"2024-01-01"}    | ${"4761-11-28"}    | ${1}
    ${"-271821-04-19"} | ${"+275760-09-13"} | ${1}
    ${"-271821-04-19"} | ${"+275760-09-13"} | ${100}
  `(
    "returns [] for $startDate to $endDate at step $stepDays",
    ({ startDate, endDate, stepDays }) => {
      expect(mapDatesInRange(startDate, endDate, stepDays).length).toBe(0);
    },
  );

  // Temporal ISODateWithinLimits: +275760-09-13 is a valid PlainDate, so a range ending there yields
  // its dates; the cursor stepping past the limit after the last in-range date ends the walk.
  it.each`
    startDate          | endDate            | stepDays | expected
    ${"+275760-09-11"} | ${"+275760-09-13"} | ${1}     | ${["+275760-09-11", "+275760-09-12", "+275760-09-13"]}
    ${"+275760-09-13"} | ${"+275760-09-13"} | ${1}     | ${["+275760-09-13"]}
    ${"+275760-09-10"} | ${"+275760-09-13"} | ${2}     | ${["+275760-09-10", "+275760-09-12"]}
    ${"2024-01-01"}    | ${"2024-01-02"}    | ${1e15}  | ${["2024-01-01"]}
  `(
    "returns $expected from $startDate to $endDate every $stepDays days at the date limit",
    ({ startDate, endDate, stepDays, expected }) => {
      expect(mapDatesInRange(startDate, endDate, stepDays)).toEqual(expected);
    },
  );
});
