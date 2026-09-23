import { sameInstantBattleCases } from "../../test";
import type { Interval } from "../../types";
import { mergeIntervals } from "./mergeIntervals";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because
// interval endpoints are the scenario under test. NY spellings name the same instants as Z(09/12/17).
const A = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };
const nineZ = "2024-01-01T09:00:00Z";
const tenZ = "2024-01-01T10:00:00Z";
const elevenZ = "2024-01-01T11:00:00Z";
const twelveZ = "2024-01-01T12:00:00Z";
const thirteenZ = "2024-01-01T13:00:00Z";
const fifteenZ = "2024-01-01T15:00:00Z";
const seventeenZ = "2024-01-01T17:00:00Z";
const nineNy = "2024-01-01T04:00:00-05:00";
const twelveNy = "2024-01-01T07:00:00-05:00";
const seventeenNy = "2024-01-01T12:00:00-05:00";

describe("mergeIntervals", () => {
  it.each`
    input                                                                                                                                                                          | expected                                                                                          | reason
    ${[]}                                                                                                                                                                          | ${[]}                                                                                             | ${"empty list"}
    ${[{ start: thirteenZ, end: seventeenZ }, { start: nineZ, end: twelveZ }]}                                                                                                     | ${[{ start: nineZ, end: twelveZ }, { start: thirteenZ, end: seventeenZ }]}                        | ${"unsorted, disjoint"}
    ${[{ start: nineZ, end: twelveZ }, { start: twelveZ, end: seventeenZ }]}                                                                                                       | ${[{ start: nineZ, end: seventeenZ }]}                                                            | ${"touching"}
    ${[{ start: nineZ, end: thirteenZ }, { start: twelveZ, end: seventeenZ }]}                                                                                                     | ${[{ start: nineZ, end: seventeenZ }]}                                                            | ${"overlapping"}
    ${[A, { start: tenZ, end: elevenZ }]}                                                                                                                                          | ${[A]}                                                                                            | ${"contained"}
    ${[{ start: nineZ, end: twelveZ }, { start: "2024-01-01T12:00:00.000000001Z", end: seventeenZ }]}                                                                              | ${[{ start: nineZ, end: twelveZ }, { start: "2024-01-01T12:00:00.000000001Z", end: seventeenZ }]} | ${"1 ns gap stays two runs"}
    ${[{ start: fifteenZ, end: seventeenZ }, { start: nineZ, end: twelveZ }, { start: twelveZ, end: fifteenZ }]}                                                                   | ${[A]}                                                                                            | ${"chain, unsorted"}
    ${[A, { start: twelveZ, end: twelveZ }]}                                                                                                                                       | ${[A]}                                                                                            | ${"empty inside a run is absorbed"}
    ${[{ start: nineZ, end: twelveZ }, { start: twelveNy, end: twelveNy }]}                                                                                                        | ${[{ start: nineZ, end: twelveZ }]}                                                               | ${"empty touching the end keeps the run's end"}
    ${[{ start: twelveNy, end: twelveNy }, { start: twelveZ, end: seventeenZ }]}                                                                                                   | ${[{ start: twelveNy, end: seventeenZ }]}                                                         | ${"empty touching the start, listed first, starts the run"}
    ${[{ start: twelveZ, end: seventeenZ }, { start: twelveNy, end: twelveNy }]}                                                                                                   | ${[{ start: twelveZ, end: seventeenZ }]}                                                          | ${"empty touching the start, listed second"}
    ${[{ start: nineZ, end: tenZ }, { start: twelveZ, end: twelveZ }]}                                                                                                             | ${[{ start: nineZ, end: tenZ }]}                                                                  | ${"stranded empty dropped"}
    ${[{ start: twelveZ, end: twelveZ }]}                                                                                                                                          | ${[]}                                                                                             | ${"only an empty interval"}
    ${[{ start: twelveZ, end: twelveZ }, { start: twelveNy, end: twelveNy }]}                                                                                                      | ${[]}                                                                                             | ${"identical empties"}
    ${[A, { start: nineNy, end: seventeenNy }]}                                                                                                                                    | ${[{ start: nineZ, end: seventeenZ }]}                                                            | ${"duplicate, different spelling: first wins"}
    ${[{ start: nineZ, end: twelveZ }, { start: nineNy, end: seventeenZ }]}                                                                                                        | ${[{ start: nineZ, end: seventeenZ }]}                                                            | ${"same start, different spelling: first wins"}
    ${[A, { start: tenZ, end: seventeenNy }]}                                                                                                                                      | ${[{ start: nineZ, end: seventeenZ }]}                                                            | ${"end tie: first to reach the max end wins"}
    ${[{ start: "2024-01-01T13:00:00+01:00[Europe/Berlin]", end: "2024-01-01T12:00:00-05:00[America/New_York]" }, { start: nineZ, end: "2024-01-01T21:00:00+09:00[Asia/Tokyo]" }]} | ${[{ start: nineZ, end: "2024-01-01T12:00:00-05:00[America/New_York]" }]}                         | ${"mixed zones: Tokyo 21:00+09:00 and Berlin 13:00+01:00 are both 12:00Z, so the runs touch"}
  `("merges $input to $expected ($reason)", ({ input, expected }) => {
    const result = mergeIntervals(input);

    expect(result).toEqual(expected);
    result.forEach((run: Interval, k: number) => {
      expect(run.start === expected[k].start).toBe(true);
      expect(run.end === expected[k].end).toBe(true);
    });
  });

  it("returns fresh objects, never the caller's", () => {
    const result = mergeIntervals([A]);

    expect(result).toEqual([A]);
    expect(result[0]).not.toBe(A);
  });

  it("does not mutate the input list or its records", () => {
    const first = { start: thirteenZ, end: seventeenZ };
    const second = { start: nineZ, end: thirteenZ };
    const input = [first, second];

    mergeIntervals(input);

    expect(input).toEqual([
      { start: thirteenZ, end: seventeenZ },
      { start: nineZ, end: thirteenZ },
    ]);
    expect(input[0]).toBe(first);
  });

  it.each(sameInstantBattleCases)(
    "keeps $value as the run start when it ties $utc ($timeZone)",
    ({ value, utc }) => {
      expect(
        mergeIntervals([
          { start: value, end: "2024-02-29T01:00:00Z" },
          { start: utc, end: "2024-02-29T02:00:00Z" },
        ]),
      ).toEqual([{ start: value, end: "2024-02-29T02:00:00Z" }]);
    },
  );

  it.each`
    value
    ${"x"}
    ${null}
    ${{}}
  `("returns [] when intervals $value is not an array", ({ value }) => {
    expect(mergeIntervals(value as unknown as Interval[])).toEqual([]);
  });

  it.each`
    list                                      | reason
    ${[A, null]}                              | ${"null element"}
    ${[A, undefined]}                         | ${"undefined element"}
    ${[A, "x"]}                               | ${"string element"}
    ${[A, 123]}                               | ${"number element"}
    ${[A, []]}                                | ${"array element"}
    ${[A, { start: seventeenZ, end: nineZ }]} | ${"inverted element among valid ones"}
  `(
    "returns [] when an element is non-object or invalid ($reason)",
    ({ list }) => {
      expect(mergeIntervals(list)).toEqual([]);
    },
  );

  it.each`
    bad                                                                               | reason
    ${{}}                                                                             | ${"empty record"}
    ${{ start: "2024-01-01T09:00:00Z" }}                                              | ${"missing end"}
    ${{ start: 1, end: "2024-01-01T09:00:00Z" }}                                      | ${"non-string start"}
    ${{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }}                 | ${"inverted"}
    ${{ start: "2024-01-01T09:30:00Z", end: "2024-01-01T10:00:00+01:00" }}            | ${"inverted by instant, ascending as text"}
    ${{ start: "2016-12-31T23:59:60Z", end: "2017-01-01T00:00:00Z" }}                 | ${"leap second"}
    ${{ start: "2024-01-01T09:00:00Z[!foo=bar]", end: "2024-01-01T17:00:00Z" }}       | ${"unknown critical annotation"}
    ${{ start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00Z" }}                  | ${"zoneless"}
    ${{ start: "2024-01-01T09:00:00[UTC]", end: "2024-01-01T17:00:00Z" }}             | ${"bracket-only zone"}
    ${{ start: "2024-01-01", end: "2024-01-01T17:00:00Z" }}                           | ${"date only"}
    ${{ start: "-271821-04-20T00:00:00Z", end: "+275760-09-13T00:00:00.000000001Z" }} | ${"past the Instant range"}
  `("returns [] when any element is invalid ($reason)", ({ bad }) => {
    expect(mergeIntervals([A, bad])).toEqual([]);
  });

  // Temporal.Instant.from ignores a calendar annotation (critical or not) and an elective unknown
  // annotation (proposal-temporal ParseTemporalInstantString; RFC 9557 §3.3), so these endpoints
  // are the unannotated instants. GMT echoes the caller's text (CORE-6), annotation included.
  it("merges touching annotated intervals by instant and keeps the annotated texts", () => {
    expect(
      mergeIntervals([
        {
          start: "2024-01-01T09:00:00Z[u-ca=iso8601]",
          end: "2024-01-01T12:00:00Z[foo=bar]",
        },
        {
          start: "2024-01-01T12:00:00Z",
          end: "2024-01-01T17:00:00Z[!u-ca=hebrew]",
        },
      ]),
    ).toEqual([
      {
        start: "2024-01-01T09:00:00Z[u-ca=iso8601]",
        end: "2024-01-01T17:00:00Z[!u-ca=hebrew]",
      },
    ]);
  });
});
