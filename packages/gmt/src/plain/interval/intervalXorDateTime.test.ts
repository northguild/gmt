import { intervalXorDateTime } from "./intervalXorDateTime";

describe("intervalXorDateTime", () => {
  // Half-open [start, end): the symmetric difference is every maximal run covered by exactly one
  // interval, sorted by start. Pieces end exactly where the other interval starts (no one-unit
  // steps), touching intervals form one run, and an empty interval contributes nothing.
  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected                                                                                                                        | reason
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-12-31T17:00:00"} | ${[{ start: "2024-01-01T09:00:00", end: "2024-12-31T17:00:00" }]}                                                               | ${"touching: one run"}
    ${"2024-06-30T12:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${[{ start: "2024-01-01T09:00:00", end: "2024-12-31T17:00:00" }]}                                                               | ${"touching, reversed order"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-04-01T11:00:00"} | ${"2024-12-31T17:00:00"} | ${[{ start: "2024-01-01T09:00:00", end: "2024-04-01T11:00:00" }, { start: "2024-06-30T12:00:00", end: "2024-12-31T17:00:00" }]} | ${"partial overlap"}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-04-01T11:00:00"} | ${"2024-06-30T12:00:00"} | ${[{ start: "2024-01-01T09:00:00", end: "2024-04-01T11:00:00" }, { start: "2024-06-30T12:00:00", end: "2024-12-31T17:00:00" }]} | ${"B inside A"}
    ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-12-31T17:00:00"} | ${[]}                                                                                                                           | ${"identical"}
    ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${[{ start: "2024-01-01T09:00:00", end: "2024-06-30T12:00:00" }, { start: "2024-07-01T13:00:00", end: "2024-12-31T17:00:00" }]} | ${"disjoint, sorted by start"}
    ${"2024-01-01T09:00:00"} | ${"2024-01-01T17:00:00"} | ${"2024-01-01T12:00:00"} | ${"2024-01-01T12:00:00"} | ${[{ start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00" }]}                                                               | ${"empty B"}
  `(
    "returns $expected for A=[$aStart, $aEnd) xor B=[$bStart, $bEnd) ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorDateTime(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd                     | expected
    ${"2024-12-31T17:00:00"} | ${"2024-01-01T09:00:00"} | ${"2024-06-01T12:00:00"} | ${"2024-07-01T13:00:00"} | ${[]}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-06-15T12:00:00"} | ${"2024-06-10T12:00:00"} | ${[]}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalXorDateTime(aStart, aEnd, bStart, bEnd)).toEqual(expected);
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd
    ${"invalid"}             | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${""}                    | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"invalid"}             | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${""}                    | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"invalid"}             | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${""}                    | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${"invalid"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${""}
  `(
    "returns [] for malformed datetime: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalXorDateTime(aStart, aEnd, bStart, bEnd)).toEqual([]);
    },
  );

  it.each`
    aStart                   | aEnd                     | bStart                   | bEnd
    ${null}                  | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${undefined}             | ${"2024-07-01T13:00:00"} | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${null}                  | ${"2024-12-31T17:00:00"}
    ${"2024-01-01T09:00:00"} | ${"2024-06-30T12:00:00"} | ${"2024-07-01T13:00:00"} | ${undefined}
  `("returns [] for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalXorDateTime(aStart, aEnd, bStart, bEnd)).toEqual([]);
  });
});
