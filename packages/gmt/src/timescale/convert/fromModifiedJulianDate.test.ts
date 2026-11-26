import { Temporal } from "../../internal/temporal";
import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import type { TimeScale } from "../../types/time-scale";
import { fromModifiedJulianDate } from "./fromModifiedJulianDate";
import { toModifiedJulianDate } from "./toModifiedJulianDate";

// Expected values come from the rule: MJD - 40587 is the exact day count since 1970-01-01, rounded
// once to the nearest nanosecond, a half up (Temporal halfExpand).
describe("fromModifiedJulianDate", () => {
  it.each`
    mjd                          | scale        | expected                            | why
    ${51544}                     | ${undefined} | ${"2000-01-01T00:00:00Z"}           | ${"midnight"}
    ${51544}                     | ${"UTC"}     | ${"2000-01-01T00:00:00Z"}           | ${"explicit UTC is the default"}
    ${51544.5}                   | ${undefined} | ${"2000-01-01T12:00:00Z"}           | ${"J2000.0 day, noon"}
    ${51544.5}                   | ${"TT"}      | ${"2000-01-01T11:58:55.816Z"}       | ${"J2000.0 on TT"}
    ${57753.5}                   | ${undefined} | ${"2016-12-31T12:00:00.5Z"}         | ${"half of an 86401 s day is 43200.5 s"}
    ${61041.5}                   | ${"TAI"}     | ${"2026-01-01T11:59:23Z"}           | ${"noon TAI is 37 s before noon UTC"}
    ${57753 + 86_400 / 86_401}   | ${"UTC"}     | ${"2016-12-31T23:59:60.000000137Z"} | ${"the inserted second, 137 ns long after rounding to a double"}
    ${57753 + 172_801 / 172_802} | ${"UTC"}     | ${"2016-12-31T23:59:60.500000068Z"} | ${"86400.500000068 s into an 86401 s day: a second-60 reading"}
    ${61041 + 37 / 86_400}       | ${"TAI"}     | ${"2025-12-31T23:59:59.999999848Z"} | ${"TAI - UTC = 37 s, 152 ns short after rounding to a double"}
    ${51544 + 2 ** -17}          | ${undefined} | ${"2000-01-01T00:00:00.659179688Z"} | ${"2^-17 day is 659179687.5 ns, a tie that rounds up"}
    ${2973484 - 2 ** -31}        | ${undefined} | ${"9999-12-31T23:59:59.999959767Z"} | ${"the last double under the ceiling, 40233.135 ns short of it"}
    ${41317}                     | ${undefined} | ${"1972-01-01T00:00:00Z"}           | ${"the floor"}
    ${41316.99}                  | ${undefined} | ${""}                               | ${"before 1972"}
    ${2973484}                   | ${undefined} | ${""}                               | ${"10000-01-01"}
    ${41317}                     | ${"TAI"}     | ${""}                               | ${"the first TAI label is 00:00:10"}
  `(
    "returns '$expected' for mjd $mjd on scale $scale ($why)",
    ({ mjd, scale, expected }) => {
      expect(fromModifiedJulianDate(mjd, scale)).toBe(expected);
    },
  );

  it.each`
    mjd          | scale        | why
    ${NaN}       | ${undefined} | ${"NaN"}
    ${Infinity}  | ${undefined} | ${"Infinity"}
    ${-Infinity} | ${undefined} | ${"-Infinity"}
    ${"51544"}   | ${undefined} | ${"a numeric string"}
    ${51544n}    | ${undefined} | ${"a bigint"}
    ${null}      | ${undefined} | ${"null"}
    ${undefined} | ${undefined} | ${"undefined"}
    ${{}}        | ${undefined} | ${"an object"}
    ${1e300}     | ${undefined} | ${"far outside the domain"}
    ${-1e300}    | ${undefined} | ${"far below the domain"}
    ${51544}     | ${"TDB"}     | ${"TDB"}
    ${51544}     | ${"tt"}      | ${"lower case"}
    ${51544}     | ${null}      | ${"null scale"}
    ${51544}     | ${5}         | ${"number scale"}
    ${-0}        | ${undefined} | ${"negative zero is MJD 0, before 1972"}
  `("returns '' for $why", ({ mjd, scale }) => {
    expect(fromModifiedJulianDate(mjd, scale)).toBe("");
  });

  it("returns '' for an empty-string scale", () => {
    expect(fromModifiedJulianDate(51544, "" as TimeScale)).toBe("");
  });

  it("returns '' for the slack day 1971-12-31 and for the day just under the floor", () => {
    expect(fromModifiedJulianDate(41316.75)).toBe("");
    expect(fromModifiedJulianDate(41317 - 1e-6)).toBe("");
  });

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "returns '' 86 ms before the 1972-01-01 label and a value from noon on is accepted on $scale",
    ({ scale }: { scale: TimeScale }) => {
      const floor = toModifiedJulianDate(
        "1972-01-01T00:00:00Z",
        scale,
      ) as number;
      expect(fromModifiedJulianDate(floor - 1e-6, scale)).toBe("");
      expect(fromModifiedJulianDate(41317.5, scale)).not.toBe("");
    },
  );

  it("returns an instant within 41 µs of the last millisecond of 9999", () => {
    const mjd = toModifiedJulianDate("9999-12-31T23:59:59.999Z") as number;
    const back = fromModifiedJulianDate(mjd);
    const error =
      Temporal.Instant.from(back).epochNanoseconds -
      Temporal.Instant.from("9999-12-31T23:59:59.999Z").epochNanoseconds;
    expect(error >= -41_000n && error <= 41_000n).toBe(true);
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(fromModifiedJulianDate(51544)).toBe("");
  });
});
