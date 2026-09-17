import { localRangeBattleCases } from "../../test";
import { mapZonedDatesInRange } from "./mapZonedDatesInRange";

describe("mapZonedDatesInRange", () => {
  it.each`
    start                                            | end                                              | stepDays | expected
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}     | ${["2024-03-01", "2024-03-02", "2024-03-03"]}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-07T10:00:00-05:00[America/New_York]"} | ${2}     | ${["2024-03-01", "2024-03-03", "2024-03-05", "2024-03-07"]}
    ${"2024-03-05T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}     | ${[]}
  `(
    "maps zoned dates from $start to $end with step $stepDays",
    ({
      start,
      end,
      stepDays,
      expected,
    }: {
      start: string;
      end: string;
      stepDays: number;
      expected: string[];
    }) => {
      expect(mapZonedDatesInRange(start, end, stepDays)).toEqual(expected);
    },
  );

  it.each`
    start                                            | end                                              | stepDays | expected
    ${"2024-03-10T10:00:00-04:00[America/New_York]"} | ${"2024-03-12T10:00:00-04:00[America/New_York]"} | ${1}     | ${["2024-03-10", "2024-03-11", "2024-03-12"]}
  `(
    "maps edge case zoned dates from $start to $end",
    ({ start, end, stepDays, expected }) => {
      expect(mapZonedDatesInRange(start, end, stepDays)).toEqual(expected);
    },
  );

  it.each`
    start                                            | end
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T15:00:00+00:00[UTC]"}
  `("returns an empty array for mismatched time zones", ({ start, end }) => {
    expect(mapZonedDatesInRange(start, end)).toEqual([]);
  });

  it.each`
    start                                            | end                                              | invalidStep
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${0}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${-1}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1.5}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${null}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${undefined}
  `(
    "returns an empty array for invalid stepDays $invalidStep",
    ({ start, end, invalidStep }) => {
      expect(mapZonedDatesInRange(start, end, invalidStep as never)).toEqual(
        [],
      );
    },
  );

  it.each`
    invalidStart             | end                                              | stepDays
    ${"invalid"}             | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}
    ${"2024-03-01T10:00:00"} | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}
    ${""}                    | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}
    ${null}                  | ${"2024-03-03T10:00:00-05:00[America/New_York]"} | ${1}
  `(
    "returns an empty array for invalid start value $invalidStart",
    ({ invalidStart, end, stepDays }) => {
      expect(
        mapZonedDatesInRange(invalidStart as never, end, stepDays),
      ).toEqual([]);
    },
  );

  it.each`
    start                                            | invalidEnd
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"invalid"}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${"2024-03-03T10:00:00"}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${""}
    ${"2024-03-01T10:00:00-05:00[America/New_York]"} | ${null}
  `(
    "returns an empty array for invalid end value $invalidEnd",
    ({ start, invalidEnd }) => {
      expect(mapZonedDatesInRange(start, invalidEnd as never)).toEqual([]);
    },
  );

  it.each`
    start                                               | end                                                 | expected
    ${"2024-02-29T10:00:00+00:00[UTC]"}                 | ${"2024-03-02T10:00:00+00:00[UTC]"}                 | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+00:00[GMT]"}                 | ${"2024-03-02T10:00:00+00:00[GMT]"}                 | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+00:00[Etc/GMT]"}             | ${"2024-03-02T10:00:00+00:00[Etc/GMT]"}             | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+00:00[Europe/Lisbon]"}       | ${"2024-03-02T10:00:00+00:00[Europe/Lisbon]"}       | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+00:00[Europe/Dublin]"}       | ${"2024-03-02T10:00:00+00:00[Europe/Dublin]"}       | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+01:00[Europe/Berlin]"}       | ${"2024-03-02T10:00:00+01:00[Europe/Berlin]"}       | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+02:00[Europe/Helsinki]"}     | ${"2024-03-02T10:00:00+02:00[Europe/Helsinki]"}     | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+03:00[Europe/Istanbul]"}     | ${"2024-03-02T10:00:00+03:00[Europe/Istanbul]"}     | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+05:30[Asia/Kolkata]"}        | ${"2024-03-02T10:00:00+05:30[Asia/Kolkata]"}        | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+05:45[Asia/Kathmandu]"}      | ${"2024-03-02T10:00:00+05:45[Asia/Kathmandu]"}      | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+08:00[Asia/Shanghai]"}       | ${"2024-03-02T10:00:00+08:00[Asia/Shanghai]"}       | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+11:00[Australia/Lord_Howe]"} | ${"2024-03-02T10:00:00+11:00[Australia/Lord_Howe]"} | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+13:45[Pacific/Chatham]"}     | ${"2024-03-02T10:00:00+13:45[Pacific/Chatham]"}     | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00+13:00[Pacific/Apia]"}        | ${"2024-03-02T10:00:00+13:00[Pacific/Apia]"}        | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00-11:00[Pacific/Niue]"}        | ${"2024-03-02T10:00:00-11:00[Pacific/Niue]"}        | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00-05:00[America/New_York]"}    | ${"2024-03-02T10:00:00-05:00[America/New_York]"}    | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00-06:00[America/Chicago]"}     | ${"2024-03-02T10:00:00-06:00[America/Chicago]"}     | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
    ${"2024-02-29T10:00:00-07:00[America/Phoenix]"}     | ${"2024-03-02T10:00:00-07:00[America/Phoenix]"}     | ${["2024-02-29", "2024-03-01", "2024-03-02"]}
  `(
    "maps a normal date range from $start to $end in battle-test timeZone",
    ({
      start,
      end,
      expected,
    }: {
      start: string;
      end: string;
      expected: string[];
    }) => {
      expect(mapZonedDatesInRange(start, end)).toEqual(expected);
    },
  );

  for (const { timeZone, start, end, expected } of localRangeBattleCases) {
    it(`maps a normal date range in battle-test timeZone ${timeZone}`, () => {
      expect(mapZonedDatesInRange(start, end)).toEqual(expected);
    });
  }
});

describe("mapZonedDatesInRange maxPieces", () => {
  // 2024-02-28..2024-03-02 local dates inclusive: 4 dates at step 1, 2 at step 2.
  it.each`
    stepDays | maxPieces | expected
    ${1}     | ${4}      | ${["2024-02-28", "2024-02-29", "2024-03-01", "2024-03-02"]}
    ${1}     | ${10}     | ${["2024-02-28", "2024-02-29", "2024-03-01", "2024-03-02"]}
    ${2}     | ${2}      | ${["2024-02-28", "2024-03-01"]}
  `(
    "returns $expected for step $stepDays with maxPieces $maxPieces",
    ({ stepDays, maxPieces, expected }) => {
      expect(
        mapZonedDatesInRange(
          "2024-02-28T12:00:00+00:00[UTC]",
          "2024-03-02T12:00:00+00:00[UTC]",
          stepDays,
          { maxPieces },
        ),
      ).toEqual(expected);
    },
  );

  // Owner decision A2: more dates than maxPieces returns the sentinel.
  it.each`
    stepDays | maxPieces
    ${1}     | ${3}
    ${2}     | ${1}
  `(
    "returns [] at step $stepDays over maxPieces $maxPieces",
    ({ stepDays, maxPieces }) => {
      expect(
        mapZonedDatesInRange(
          "2024-02-28T12:00:00+00:00[UTC]",
          "2024-03-02T12:00:00+00:00[UTC]",
          stepDays,
          { maxPieces },
        ).length,
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
      mapZonedDatesInRange(
        "2024-02-28T12:00:00+00:00[UTC]",
        "2024-03-02T12:00:00+00:00[UTC]",
        1,
        options as never,
      ).length,
    ).toBe(0);
  });
});

describe("mapZonedDatesInRange default piece limit", () => {
  // Default maxPieces is 1_000_000. 2024-01-01 + 1_000_000 days = 4761-11-28 (Temporal
  // PlainDate.add), so the inclusive range holds 1_000_001 dates.
  it("returns [] for 1_000_001 local dates in UTC", () => {
    expect(
      mapZonedDatesInRange(
        "2024-01-01T00:00:00+00:00[UTC]",
        "4761-11-28T00:00:00+00:00[UTC]",
      ).length,
    ).toBe(0);
  });

  // Temporal: the maximum instant +275760-09-13T00:00Z is valid, so its local date is in range; the
  // cursor stepping past the date limit after it ends the walk instead of discarding the result.
  it.each`
    start                                  | end                                    | stepDays | expected
    ${"+275760-09-12T00:00:00+00:00[UTC]"} | ${"+275760-09-13T00:00:00+00:00[UTC]"} | ${1}     | ${["+275760-09-12", "+275760-09-13"]}
    ${"+275760-09-13T00:00:00+00:00[UTC]"} | ${"+275760-09-13T00:00:00+00:00[UTC]"} | ${1}     | ${["+275760-09-13"]}
    ${"2024-01-01T00:00:00+00:00[UTC]"}    | ${"2024-01-02T00:00:00+00:00[UTC]"}    | ${1e15}  | ${["2024-01-01"]}
  `(
    "returns $expected from $start to $end every $stepDays days at the date limit",
    ({ start, end, stepDays, expected }) => {
      expect(mapZonedDatesInRange(start, end, stepDays)).toEqual(expected);
    },
  );
});
