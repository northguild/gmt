import type { Interval } from "../../types";
import { splitIntervalAt } from "./splitIntervalAt";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because
// interval endpoints are the scenario under test. NY spellings name the same instants as Z(09/12).
const A = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };
const at = (time: string) => `2024-01-01T${time}Z`;
const nineNy = "2024-01-01T04:00:00-05:00";
const twelveNy = "2024-01-01T07:00:00-05:00";
const berlinThirteen = "2024-01-01T13:00:00+01:00[Europe/Berlin]";
const tokyoTwentyThree = "2024-01-01T23:00:00+09:00[Asia/Tokyo]";

describe("splitIntervalAt", () => {
  // Expected values derive from D3/D5: keep boundaries strictly inside (start < b < end), order by
  // instant (stable, so the first spelling of a duplicate wins), and chain the texts pairwise.
  // Mixed zones: Berlin 13:00+01:00 is 12:00Z and Tokyo 23:00+09:00 is 14:00Z, so Berlin comes
  // first whichever order they are passed in.
  it.each`
    boundaries                            | expected                                                                                                                                                | reason
    ${[at("12:00:00")]}                   | ${[{ start: at("09:00:00"), end: at("12:00:00") }, { start: at("12:00:00"), end: at("17:00:00") }]}                                                     | ${"one boundary"}
    ${[at("15:00:00"), at("11:00:00")]}   | ${[{ start: at("09:00:00"), end: at("11:00:00") }, { start: at("11:00:00"), end: at("15:00:00") }, { start: at("15:00:00"), end: at("17:00:00") }]}     | ${"unsorted"}
    ${[at("12:00:00"), twelveNy]}         | ${[{ start: at("09:00:00"), end: at("12:00:00") }, { start: at("12:00:00"), end: at("17:00:00") }]}                                                     | ${"duplicate instant, Z first"}
    ${[twelveNy, at("12:00:00")]}         | ${[{ start: at("09:00:00"), end: twelveNy }, { start: twelveNy, end: at("17:00:00") }]}                                                                 | ${"duplicate instant, NY first"}
    ${[at("09:00:00"), at("17:00:00")]}   | ${[A]}                                                                                                                                                  | ${"at the edges, dropped"}
    ${[at("08:00:00"), at("18:00:00")]}   | ${[A]}                                                                                                                                                  | ${"outside, dropped"}
    ${[nineNy]}                           | ${[{ start: at("09:00:00"), end: at("17:00:00") }]}                                                                                                     | ${"at start, different spelling, dropped"}
    ${[]}                                 | ${[A]}                                                                                                                                                  | ${"no boundaries"}
    ${[at("09:00:00.000000001")]}         | ${[{ start: at("09:00:00"), end: at("09:00:00.000000001") }, { start: at("09:00:00.000000001"), end: at("17:00:00") }]}                                 | ${"1 ns inside the start"}
    ${[berlinThirteen, tokyoTwentyThree]} | ${[{ start: at("09:00:00"), end: berlinThirteen }, { start: berlinThirteen, end: tokyoTwentyThree }, { start: tokyoTwentyThree, end: at("17:00:00") }]} | ${"mixed zones, ordered by instant"}
    ${[tokyoTwentyThree, berlinThirteen]} | ${[{ start: at("09:00:00"), end: berlinThirteen }, { start: berlinThirteen, end: tokyoTwentyThree }, { start: tokyoTwentyThree, end: at("17:00:00") }]} | ${"mixed zones passed out of order, still ordered by instant"}
  `(
    "splits [09:00Z, 17:00Z) at $boundaries into $expected ($reason)",
    ({ boundaries, expected }) => {
      const result = splitIntervalAt(A, boundaries);

      expect(result).toEqual(expected);
      result.forEach((piece: Interval, k: number) => {
        expect(piece.start === expected[k].start).toBe(true);
        expect(piece.end === expected[k].end).toBe(true);
      });
    },
  );

  it.each`
    boundaries                            | reason
    ${[at("15:00:00"), at("11:00:00")]}   | ${"unsorted"}
    ${[berlinThirteen, tokyoTwentyThree]} | ${"mixed zones"}
  `(
    "tiles the interval: each piece's end is the next piece's start ($reason)",
    ({ boundaries }) => {
      const pieces = splitIntervalAt(A, boundaries);

      expect(pieces[0].start === A.start).toBe(true);
      expect(pieces[pieces.length - 1].end === A.end).toBe(true);
      for (let k = 0; k < pieces.length - 1; k++) {
        expect(pieces[k].end === pieces[k + 1].start).toBe(true);
      }
    },
  );

  it.each`
    boundaries          | reason
    ${[at("12:00:00")]} | ${"boundary at its instant"}
    ${[]}               | ${"no boundaries"}
  `(
    "returns the empty interval [12:00Z, 12:00Z) as its single piece ($reason)",
    ({ boundaries }) => {
      const empty = { start: at("12:00:00"), end: at("12:00:00") };

      expect(splitIntervalAt(empty, boundaries)).toEqual([empty]);
    },
  );

  // Range limits are Temporal's ±10^8 days; epoch 0 lies strictly inside, the limits are edges.
  it("splits the full Instant range at the epoch and drops boundaries on its limits", () => {
    expect(
      splitIntervalAt(
        { start: "-271821-04-20T00:00:00Z", end: "+275760-09-13T00:00:00Z" },
        [
          "+275760-09-13T00:00:00Z",
          "1970-01-01T00:00:00Z",
          "-271821-04-20T00:00:00Z",
        ],
      ),
    ).toEqual([
      { start: "-271821-04-20T00:00:00Z", end: "1970-01-01T00:00:00Z" },
      { start: "1970-01-01T00:00:00Z", end: "+275760-09-13T00:00:00Z" },
    ]);
  });

  it("returns fresh objects, never the caller's", () => {
    const result = splitIntervalAt(A, []);

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
  `("returns [] when interval $value is non-object input", ({ value }) => {
    expect(splitIntervalAt(value as unknown as Interval, [])).toEqual([]);
  });

  it.each`
    boundaries                               | reason
    ${"x"}                                   | ${"not an array"}
    ${null}                                  | ${"null"}
    ${["2016-12-31T23:59:60Z"]}              | ${"leap-second boundary outside the interval"}
    ${[123]}                                 | ${"non-string boundary"}
    ${["2024-01-01T12:00:00"]}               | ${"zoneless boundary"}
    ${[at("12:00:00"), undefined]}           | ${"undefined boundary among valid ones"}
    ${["2024-01-01T12:00:00Z[!foo=bar]"]}    | ${"unknown critical annotation on a boundary inside the interval"}
    ${["+275760-09-13T00:00:00.000000001Z"]} | ${"boundary past the Instant range"}
  `("returns [] when boundaries are invalid ($reason)", ({ boundaries }) => {
    expect(splitIntervalAt(A, boundaries)).toEqual([]);
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
  `("returns [] when the interval is invalid ($reason)", ({ bad }) => {
    expect(splitIntervalAt(bad, [at("12:00:00")])).toEqual([]);
  });

  // Temporal.Instant.from ignores a calendar annotation (critical or not) and an elective unknown
  // annotation (proposal-temporal ParseTemporalInstantString; RFC 9557 §3.3), so these endpoints
  // are the unannotated instants. GMT echoes the caller's text (CORE-6), annotation included.
  it("splits at annotated boundaries by instant and keeps the annotated texts", () => {
    expect(
      splitIntervalAt(
        {
          start: "2024-01-01T09:00:00Z[!u-ca=hebrew]",
          end: "2024-01-01T17:00:00Z",
        },
        ["2024-01-01T15:00:00Z[foo=bar]", "2024-01-01T12:00:00Z[u-ca=iso8601]"],
      ),
    ).toEqual([
      {
        start: "2024-01-01T09:00:00Z[!u-ca=hebrew]",
        end: "2024-01-01T12:00:00Z[u-ca=iso8601]",
      },
      {
        start: "2024-01-01T12:00:00Z[u-ca=iso8601]",
        end: "2024-01-01T15:00:00Z[foo=bar]",
      },
      { start: "2024-01-01T15:00:00Z[foo=bar]", end: "2024-01-01T17:00:00Z" },
    ]);
  });
});
