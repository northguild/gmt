import type { Interval } from "../../types";
import { subtractIntervals } from "./subtractIntervals";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because
// interval endpoints are the scenario under test. NY spellings name the same instants as Z(09/17).
const A = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };
const at = (time: string) => `2024-01-01T${time}Z`;
const nineNy = "2024-01-01T04:00:00-05:00";
const seventeenNy = "2024-01-01T12:00:00-05:00";
const berlinEleven = "2024-01-01T11:00:00+01:00[Europe/Berlin]";
const tokyoTwenty = "2024-01-01T20:00:00+09:00[Asia/Tokyo]";

describe("subtractIntervals", () => {
  // Expected values derive from D3/D5: coalesce the removals (touching merge, empties vanish), walk
  // a cursor from from.start, emit [cursor, removal.start) when the removal starts after it, and
  // keep from's text wherever no removal strictly moves past it. Mixed zones: Berlin 11:00+01:00
  // is 10:00Z and Tokyo 20:00+09:00 is 11:00Z, so [09Z, 17Z) minus [10Z, 11Z) leaves two pieces.
  it.each`
    remove                                                                                                                                              | expected                                                                                                                                            | reason
    ${[]}                                                                                                                                               | ${[A]}                                                                                                                                              | ${"nothing removed"}
    ${[{ start: at("12:00:00"), end: at("13:00:00") }]}                                                                                                 | ${[{ start: at("09:00:00"), end: at("12:00:00") }, { start: at("13:00:00"), end: at("17:00:00") }]}                                                 | ${"interior removal splits in two"}
    ${[{ start: at("08:00:00"), end: at("10:00:00") }]}                                                                                                 | ${[{ start: at("10:00:00"), end: at("17:00:00") }]}                                                                                                 | ${"left edge trimmed"}
    ${[{ start: at("16:00:00"), end: at("18:00:00") }]}                                                                                                 | ${[{ start: at("09:00:00"), end: at("16:00:00") }]}                                                                                                 | ${"right edge trimmed"}
    ${[{ start: at("08:00:00"), end: at("18:00:00") }]}                                                                                                 | ${[]}                                                                                                                                               | ${"fully covered"}
    ${[{ start: nineNy, end: seventeenNy }]}                                                                                                            | ${[]}                                                                                                                                               | ${"exact cover, different spelling"}
    ${[{ start: at("17:00:00"), end: at("18:00:00") }]}                                                                                                 | ${[A]}                                                                                                                                              | ${"touching after removes nothing"}
    ${[{ start: at("08:00:00"), end: at("09:00:00") }]}                                                                                                 | ${[A]}                                                                                                                                              | ${"touching before removes nothing"}
    ${[{ start: at("18:00:00"), end: at("19:00:00") }]}                                                                                                 | ${[A]}                                                                                                                                              | ${"disjoint"}
    ${[{ start: at("12:00:00"), end: at("12:00:00") }]}                                                                                                 | ${[A]}                                                                                                                                              | ${"empty removal inside"}
    ${[{ start: at("09:00:00"), end: at("09:00:00") }]}                                                                                                 | ${[A]}                                                                                                                                              | ${"empty removal at the edge"}
    ${[{ start: at("14:00:00"), end: at("15:00:00") }, { start: at("10:00:00"), end: at("11:00:00") }, { start: at("10:30:00"), end: at("12:00:00") }]} | ${[{ start: at("09:00:00"), end: at("10:00:00") }, { start: at("12:00:00"), end: at("14:00:00") }, { start: at("15:00:00"), end: at("17:00:00") }]} | ${"several, unsorted, overlapping"}
    ${[{ start: at("10:00:00"), end: at("12:00:00") }, { start: at("12:00:00"), end: at("13:00:00") }]}                                                 | ${[{ start: at("09:00:00"), end: at("10:00:00") }, { start: at("13:00:00"), end: at("17:00:00") }]}                                                 | ${"touching removals"}
    ${[{ start: at("08:00:00"), end: nineNy }]}                                                                                                         | ${[{ start: at("09:00:00"), end: at("17:00:00") }]}                                                                                                 | ${"removal ends at from.start, different spelling: from's"}
    ${[{ start: seventeenNy, end: at("18:00:00") }]}                                                                                                    | ${[{ start: at("09:00:00"), end: at("17:00:00") }]}                                                                                                 | ${"removal starts at from.end, different spelling: from's"}
    ${[{ start: nineNy, end: at("10:00:00") }]}                                                                                                         | ${[{ start: at("10:00:00"), end: at("17:00:00") }]}                                                                                                 | ${"removal starts at from.start, different spelling"}
    ${[{ start: at("16:00:00"), end: seventeenNy }]}                                                                                                    | ${[{ start: at("09:00:00"), end: at("16:00:00") }]}                                                                                                 | ${"removal ends at from.end, different spelling: from's end"}
    ${[{ start: at("12:00:00"), end: at("12:00:00.000000001") }]}                                                                                       | ${[{ start: at("09:00:00"), end: at("12:00:00") }, { start: at("12:00:00.000000001"), end: at("17:00:00") }]}                                       | ${"1 ns removal"}
    ${[{ start: berlinEleven, end: tokyoTwenty }]}                                                                                                      | ${[{ start: at("09:00:00"), end: berlinEleven }, { start: tokyoTwenty, end: at("17:00:00") }]}                                                      | ${"mixed zones"}
  `(
    "subtracts $remove from [09:00Z, 17:00Z) to $expected ($reason)",
    ({ remove, expected }) => {
      const result = subtractIntervals(A, remove);

      expect(result).toEqual(expected);
      result.forEach((piece: Interval, k: number) => {
        expect(piece.start === expected[k].start).toBe(true);
        expect(piece.end === expected[k].end).toBe(true);
      });
    },
  );

  it.each`
    remove                                              | reason
    ${[]}                                               | ${"nothing removed"}
    ${[{ start: at("10:00:00"), end: at("14:00:00") }]} | ${"covering removal"}
  `(
    "returns [] for the empty from [12:00Z, 12:00Z) ($reason)",
    ({ remove }) => {
      expect(
        subtractIntervals(
          { start: at("12:00:00"), end: at("12:00:00") },
          remove,
        ),
      ).toEqual([]);
    },
  );

  // Range limits are Temporal's ±10^8 days; epoch 0 lies strictly inside.
  it.each`
    remove                                                                    | expected                                                               | reason
    ${[{ start: "-271821-04-20T00:00:00Z", end: "1970-01-01T00:00:00Z" }]}    | ${[{ start: "1970-01-01T00:00:00Z", end: "+275760-09-13T00:00:00Z" }]} | ${"removal from the earliest instant"}
    ${[{ start: "1970-01-01T00:00:00Z", end: "+275760-09-13T00:00:00Z" }]}    | ${[{ start: "-271821-04-20T00:00:00Z", end: "1970-01-01T00:00:00Z" }]} | ${"removal to the latest instant"}
    ${[{ start: "-271821-04-20T00:00:00Z", end: "+275760-09-13T00:00:00Z" }]} | ${[]}                                                                  | ${"removal of the whole range"}
  `(
    "subtracts $remove from the full Instant range to $expected ($reason)",
    ({ remove, expected }) => {
      expect(
        subtractIntervals(
          { start: "-271821-04-20T00:00:00Z", end: "+275760-09-13T00:00:00Z" },
          remove,
        ),
      ).toEqual(expected);
    },
  );

  it("returns fresh objects, never the caller's", () => {
    const result = subtractIntervals(A, []);

    expect(result).toEqual([A]);
    expect(result[0]).not.toBe(A);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${"x"}
    ${123}
    ${[]}
  `("returns [] when from $value is non-object input", ({ value }) => {
    expect(subtractIntervals(value as unknown as Interval, [])).toEqual([]);
  });

  it.each`
    value
    ${"x"}
    ${null}
    ${{}}
  `("returns [] when remove $value is not an array", ({ value }) => {
    expect(subtractIntervals(A, value as unknown as Interval[])).toEqual([]);
  });

  it.each`
    remove                                                      | reason
    ${[A, null]}                                                | ${"null element"}
    ${[{ start: at("12:00:00"), end: "2016-12-31T23:59:60Z" }]} | ${"leap-second removal"}
    ${[{ start: at("20:00:00"), end: at("19:00:00") }]}         | ${"inverted removal outside from"}
  `("returns [] when a removal is invalid ($reason)", ({ remove }) => {
    expect(subtractIntervals(A, remove)).toEqual([]);
  });

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
  `("returns [] when from or any removal is invalid ($reason)", ({ bad }) => {
    expect(subtractIntervals(bad, [])).toEqual([]);
    expect(subtractIntervals(A, [bad])).toEqual([]);
  });

  // Temporal.Instant.from ignores a calendar annotation (critical or not) and an elective unknown
  // annotation (proposal-temporal ParseTemporalInstantString; RFC 9557 §3.3), so these endpoints
  // are the unannotated instants. GMT echoes the caller's text (CORE-6), annotation included.
  it("subtracts annotated intervals by instant and keeps the annotated texts", () => {
    expect(
      subtractIntervals(
        {
          start: "2024-01-01T09:00:00Z[u-ca=iso8601]",
          end: "2024-01-01T17:00:00Z[foo=bar]",
        },
        [
          {
            start: "2024-01-01T12:00:00Z[!u-ca=hebrew]",
            end: "2024-01-01T13:00:00Z",
          },
        ],
      ),
    ).toEqual([
      {
        start: "2024-01-01T09:00:00Z[u-ca=iso8601]",
        end: "2024-01-01T12:00:00Z[!u-ca=hebrew]",
      },
      { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z[foo=bar]" },
    ]);
  });
});
