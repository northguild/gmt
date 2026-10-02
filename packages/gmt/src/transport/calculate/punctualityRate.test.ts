import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { punctualityRate } from "./punctualityRate";

/** A pair planned at 10:00Z on 15 June 2024, arriving at `actual`. */
const pair = (actual: string) => ({ planned: "2024-06-15T10:00:00Z", actual });

/** Deviations of +5, +14, +16 and −3 minutes: under PT15M, one late and three on time. */
const fourWithOneLate = [
  pair("2024-06-15T10:05:00Z"),
  pair("2024-06-15T10:14:00Z"),
  pair("2024-06-15T10:16:00Z"),
  pair("2024-06-15T09:57:00Z"),
];

/** Deviations of 0, +20, −12 and +1 minutes. */
const mixed = [
  pair("2024-06-15T10:00:00Z"),
  pair("2024-06-15T10:20:00Z"),
  pair("2024-06-15T09:48:00Z"),
  pair("2024-06-15T10:01:00Z"),
];

describe("punctualityRate", () => {
  // onTime counts the pairs classifyPunctuality calls "onTime"; rate = onTime / total.
  it.each`
    pairs                             | tolerance                            | expected                                | why
    ${fourWithOneLate}                | ${{ late: "PT15M" }}                 | ${{ onTime: 3, total: 4, rate: 0.75 }}  | ${"four pairs with one late"}
    ${mixed}                          | ${{ late: "PT15M" }}                 | ${{ onTime: 3, total: 4, rate: 0.75 }}  | ${"without early, 12 minutes early is on time"}
    ${mixed}                          | ${{ late: "PT15M", early: "PT10M" }} | ${{ onTime: 2, total: 4, rate: 0.5 }}   | ${"with early PT10M, 12 minutes early is not on time"}
    ${mixed}                          | ${{ late: "PT30M" }}                 | ${{ onTime: 4, total: 4, rate: 1 }}     | ${"30-minute: every pair on time"}
    ${mixed}                          | ${{ late: "PT0S", early: "PT0S" }}   | ${{ onTime: 0, total: 4, rate: 0 }}     | ${"both PT0S: nothing is on time"}
    ${fourWithOneLate.slice(1, 4)}    | ${{ late: "PT15M" }}                 | ${{ onTime: 2, total: 3, rate: 2 / 3 }} | ${"a rate that is not a terminating decimal"}
    ${[pair("2024-06-15T10:15:00Z")]} | ${{ late: "PT15M" }}                 | ${{ onTime: 0, total: 1, rate: 0 }}     | ${"a single pair exactly on the late boundary"}
  `("gives $expected.rate for $why", ({ pairs, tolerance, expected }) => {
    expect(punctualityRate(pairs, tolerance)).toEqual(expected);
  });

  // New York fell back at 02:00 EDT on 3 November 2024: the same wall time an hour later is a
  // 60-minute delay, never 0.
  it("counts a delay across the fall-back as exact elapsed time", () => {
    expect(
      punctualityRate(
        [
          {
            planned: "2024-11-03T01:30:00-04:00[America/New_York]",
            actual: "2024-11-03T01:30:00-05:00[America/New_York]",
          },
          pair("2024-06-15T10:00:00Z"),
        ],
        { late: "PT15M" },
      ),
    ).toEqual({ onTime: 1, total: 2, rate: 0.5 });
  });

  it("counts every battle-test zone's plan the same way", () => {
    const pairs = battleTestTimeZones.map((timeZone) => ({
      planned: Temporal.Instant.from("2024-06-15T10:00:00Z")
        .toZonedDateTimeISO(timeZone)
        .toString(),
      actual: "2024-06-15T10:14:59Z",
    }));
    expect(punctualityRate(pairs, { late: "PT15M" })).toEqual({
      onTime: battleTestTimeZones.length,
      total: battleTestTimeZones.length,
      rate: 1,
    });
  });

  // "One tolerance" for the whole list: late and early are read once, however many pairs there
  // are, so a getter cannot change the tolerance between pairs.
  it("reads late and early exactly once for many pairs", () => {
    const reads = { late: 0, early: 0 };
    const tolerance = {
      get late(): string {
        reads.late += 1;
        return "PT15M";
      },
      get early(): string {
        reads.early += 1;
        return "PT10M";
      },
    };
    expect(punctualityRate([...fourWithOneLate, ...mixed], tolerance)).toEqual({
      onTime: 5,
      total: 8,
      rate: 0.625,
    });
    expect(reads).toEqual({ late: 1, early: 1 });
  });

  it("uses the tolerance read first for every pair, even if a getter changes it", () => {
    // Three pairs 5 minutes late: on time under PT15M, late under PT0S. The first read is
    // PT15M, so all three are on time.
    const values = ["PT15M", "PT0S", "PT0S"];
    let index = 0;
    const tolerance = {
      get late(): string {
        const value = values[Math.min(index, values.length - 1)] as string;
        index += 1;
        return value;
      },
    };
    const lateByFive = pair("2024-06-15T10:05:00Z");
    expect(
      punctualityRate([lateByFive, lateByFive, lateByFive], tolerance),
    ).toEqual({ onTime: 3, total: 3, rate: 1 });
  });

  it.each`
    pairs                                                                              | tolerance                          | why
    ${[]}                                                                              | ${{ late: "PT15M" }}               | ${"an empty list has no rate"}
    ${[...fourWithOneLate, pair("2024-06-15T10:14:00")]}                               | ${{ late: "PT15M" }}               | ${"one zoneless actual: never a partial rate"}
    ${[...fourWithOneLate, { planned: "not a date", actual: "2024-06-15T10:00:00Z" }]} | ${{ late: "PT15M" }}               | ${"one malformed plan"}
    ${[...fourWithOneLate, null]}                                                      | ${{ late: "PT15M" }}               | ${"a null pair"}
    ${[...fourWithOneLate, "2024-06-15T10:00:00Z"]}                                    | ${{ late: "PT15M" }}               | ${"a string pair"}
    ${[{ planned: "2024-06-15T10:00:00Z" }]}                                           | ${{ late: "PT15M" }}               | ${"a pair without an actual"}
    ${fourWithOneLate}                                                                 | ${{ late: "-PT15M" }}              | ${"a negative tolerance"}
    ${fourWithOneLate}                                                                 | ${{ late: "P1M" }}                 | ${"a calendar-unit tolerance"}
    ${fourWithOneLate}                                                                 | ${{ late: "PT15M", early: "P1W" }} | ${"a calendar-unit early tolerance"}
    ${fourWithOneLate}                                                                 | ${null}                            | ${"no tolerance"}
    ${"2024-06-15T10:00:00Z"}                                                          | ${{ late: "PT15M" }}               | ${"a string for the list"}
    ${{ 0: fourWithOneLate[0], length: 1 }}                                            | ${{ late: "PT15M" }}               | ${"an array-like object"}
    ${Object.assign([], { 0: fourWithOneLate[0], 2: fourWithOneLate[1] })}             | ${{ late: "PT15M" }}               | ${"a sparse list: a hole is not a pair"}
  `("returns null for $why", ({ pairs, tolerance }) => {
    expect(punctualityRate(pairs, tolerance)).toBeNull();
  });

  it.each`
    make                    | label
    ${() => hostileProxy()} | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()} | ${"a revoked Proxy"}
  `(
    "returns null for $label as the list, a pair or the tolerance",
    ({ make }) => {
      expect(punctualityRate(make(), { late: "PT15M" })).toBeNull();
      expect(punctualityRate([make()], { late: "PT15M" })).toBeNull();
      expect(punctualityRate(fourWithOneLate, make())).toBeNull();
    },
  );

  it("returns null for a pair whose getter throws", () => {
    const hostile = {
      planned: "2024-06-15T10:00:00Z",
      get actual(): string {
        throw new Error("hostile getter");
      },
    };
    expect(punctualityRate([hostile], { late: "PT15M" })).toBeNull();
  });

  it("returns null when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(punctualityRate(fourWithOneLate, { late: "PT15M" })).toBeNull();
  });
});
