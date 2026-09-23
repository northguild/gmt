import { intervalXorUtc } from "./intervalXorUtc";

describe("intervalXorUtc", () => {
  // Half-open [start, end): the symmetric difference is every maximal run covered by exactly one
  // interval, sorted by start. Pieces end exactly where the other interval starts (no one-unit
  // steps), touching intervals form one run, and an empty interval contributes nothing.
  it.each`
    aStart                        | aEnd                         | bStart                       | bEnd                         | expected                                                                                                                            | reason
    ${"2024-01-01T09:00:00Z"}     | ${"2024-01-01T13:00:00Z"}    | ${"2024-01-01T12:00:00Z"}    | ${"2024-01-01T17:00:00Z"}    | ${[{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]} | ${"story row: (A, C) xor (B, D)"}
    ${"2024-01-01T09:00:00Z"}     | ${"2024-06-30T12:00:00Z"}    | ${"2024-06-30T12:00:00Z"}    | ${"2024-12-31T17:00:00Z"}    | ${[{ start: "2024-01-01T09:00:00Z", end: "2024-12-31T17:00:00Z" }]}                                                                 | ${"touching: one run"}
    ${"2024-06-30T12:00:00Z"}     | ${"2024-12-31T17:00:00Z"}    | ${"2024-01-01T09:00:00Z"}    | ${"2024-06-30T12:00:00Z"}    | ${[{ start: "2024-01-01T09:00:00Z", end: "2024-12-31T17:00:00Z" }]}                                                                 | ${"touching, reversed order"}
    ${"2024-01-01T09:00:00Z"}     | ${"2024-12-31T17:00:00Z"}    | ${"2024-04-01T11:00:00Z"}    | ${"2024-06-30T12:00:00Z"}    | ${[{ start: "2024-01-01T09:00:00Z", end: "2024-04-01T11:00:00Z" }, { start: "2024-06-30T12:00:00Z", end: "2024-12-31T17:00:00Z" }]} | ${"B inside A"}
    ${"2024-01-01T09:00:00Z"}     | ${"2024-12-31T17:00:00Z"}    | ${"2024-01-01T09:00:00Z"}    | ${"2024-12-31T17:00:00Z"}    | ${[]}                                                                                                                               | ${"identical"}
    ${"2024-07-01T13:00:00Z"}     | ${"2024-12-31T17:00:00Z"}    | ${"2024-01-01T09:00:00Z"}    | ${"2024-06-30T12:00:00Z"}    | ${[{ start: "2024-01-01T09:00:00Z", end: "2024-06-30T12:00:00Z" }, { start: "2024-07-01T13:00:00Z", end: "2024-12-31T17:00:00Z" }]} | ${"disjoint, sorted by start"}
    ${"2024-01-01T09:00:00Z"}     | ${"2024-01-01T17:00:00Z"}    | ${"2024-01-01T12:00:00Z"}    | ${"2024-01-01T12:00:00Z"}    | ${[{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }]}                                                                 | ${"empty B"}
    ${"2024-01-01T09:00:00.000Z"} | ${"2024-01-01T13:00Z"}       | ${"2024-01-01T12:00:00Z"}    | ${"2024-01-01T17:00:00Z"}    | ${[{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]} | ${"re-serialised"}
    ${"+275760-09-12T00:00:00Z"}  | ${"+275760-09-13T00:00:00Z"} | ${"+275760-09-12T12:00:00Z"} | ${"+275760-09-13T00:00:00Z"} | ${[{ start: "+275760-09-12T00:00:00Z", end: "+275760-09-12T12:00:00Z" }]}                                                           | ${"ends on the last instant"}
  `(
    "returns $expected for A=[$aStart, $aEnd) xor B=[$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorUtc(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd                      | expected
    ${"2024-12-31T17:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"2024-06-01T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${[]}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-06-15T12:00:00Z"} | ${"2024-06-10T12:00:00Z"} | ${[]}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorUtc(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"invalid"}              | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${""}                     | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"invalid"}              | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${""}                     | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"invalid"}              | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${""}                     | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"invalid"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${""}
  `(
    "returns [] for malformed UTC datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalXorUtc(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${null}                   | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${undefined}              | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${null}                   | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${undefined}
  `("returns [] for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalXorUtc(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });

  it.each`
    aStart                    | aEnd                      | bStart                    | bEnd
    ${"2024-06-30T23:59:60Z"} | ${"2024-12-31T17:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T23:59:60Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-06-30T23:59:60Z"} | ${"2024-12-31T17:00:00Z"}
    ${"2024-01-01T09:00:00Z"} | ${"2024-06-30T12:00:00Z"} | ${"2024-07-01T13:00:00Z"} | ${"2024-06-30T23:59:60Z"}
  `("returns [] for leap second input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalXorUtc(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });
});
