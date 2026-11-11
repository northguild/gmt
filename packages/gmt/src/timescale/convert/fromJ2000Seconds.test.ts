import { Temporal } from "../../internal/temporal";
import { PARTS_INSTANTS } from "../../test/julianDateFixtures";
import type { TimeScale } from "../../types/time-scale";
import { fromJ2000Seconds } from "./fromJ2000Seconds";
import { toJ2000Seconds } from "./toJ2000Seconds";

/** The spacing of doubles at `x`, in nanoseconds (2^(floor(log2|x|) - 52) seconds). */
function ulpNanoseconds(x: number): number {
  return 2 ** (Math.floor(Math.log2(Math.abs(x))) - 52) * 1e9;
}

describe("fromJ2000Seconds", () => {
  it.each`
    seconds                       | scale        | expected                            | why
    ${0}                          | ${undefined} | ${"2000-01-01T11:58:55.816Z"}       | ${"J2000.0 on TT, inverted"}
    ${0}                          | ${"UTC"}     | ${"2000-01-01T12:00:00Z"}           | ${"noon UTC"}
    ${0}                          | ${"TAI"}     | ${"2000-01-01T11:59:28Z"}           | ${"TAI - UTC = 32 s"}
    ${820_497_600}                | ${"UTC"}     | ${"2026-01-01T00:00:00Z"}           | ${"ordinary day"}
    ${820_497_669.184}            | ${undefined} | ${"2026-01-01T00:00:00.000000015Z"} | ${"the double nearest 820497669.184 is 820497669.18400001526"}
    ${536_500_799.5}              | ${"UTC"}     | ${"2016-12-31T23:59:60.499994213Z"} | ${"quasi-day inverse: 86399.5 s x 86401 / 86400 = 86400.499994213 s"}
    ${536_500_799.000011574}      | ${"UTC"}     | ${"2016-12-31T23:59:59.999999989Z"} | ${"the double is 97 x 2^-23 s past ...799, so the leap second reads 11 ns short"}
    ${-43_201}                    | ${"UTC"}     | ${"1999-12-31T23:59:59Z"}           | ${"negative before J2000.0"}
    ${-883_656_000}               | ${"UTC"}     | ${"1972-01-01T00:00:00Z"}           | ${"the floor"}
    ${0.5}                        | ${"UTC"}     | ${"2000-01-01T12:00:00.5Z"}         | ${"exact dyadic fraction"}
    ${-0}                         | ${"UTC"}     | ${"2000-01-01T12:00:00Z"}           | ${"negative zero is zero"}
    ${-0}                         | ${undefined} | ${"2000-01-01T11:58:55.816Z"}       | ${"negative zero is zero on the default TT"}
    ${-0.5}                       | ${"UTC"}     | ${"2000-01-01T11:59:59.5Z"}         | ${"half a second before J2000.0"}
    ${-86_399.5}                  | ${"UTC"}     | ${"1999-12-31T12:00:00.5Z"}         | ${"negative with a dyadic fraction"}
    ${2 ** -10}                   | ${"UTC"}     | ${"2000-01-01T12:00:00.000976563Z"} | ${"2^-10 s is 976562.5 ns, a tie that rounds up"}
    ${-(2 ** -10)}                | ${"UTC"}     | ${"2000-01-01T11:59:59.999023438Z"} | ${"-976562.5 ns is a tie; a half rounds up in time, to -976562 ns"}
    ${536_500_799.5000058}        | ${"UTC"}     | ${"2016-12-31T23:59:60.499999995Z"} | ${"the double of the :60.5 reading reads 5 ns short"}
    ${-883_655_990}               | ${"TAI"}     | ${"1972-01-01T00:00:00Z"}           | ${"the floor on TAI"}
    ${252_455_572_800 - 2 ** -15} | ${"UTC"}     | ${"9999-12-31T23:59:59.999969482Z"} | ${"the last double under the ceiling, 30517.6 ns short of it"}
  `(
    "returns $expected for $seconds on scale $scale ($why)",
    ({ seconds, scale, expected }) => {
      expect(fromJ2000Seconds(seconds, scale)).toBe(expected);
    },
  );

  it("loses precision on the 2026 TT round trip, by 15 ns", () => {
    const seconds = toJ2000Seconds("2026-01-01T00:00:00Z") as number;
    expect(fromJ2000Seconds(seconds)).toBe("2026-01-01T00:00:00.000000015Z");
  });

  it.each`
    seconds            | scale    | label
    ${-883_656_000.5}  | ${"UTC"} | ${"'UTC'"}
    ${-883_656_000.5}  | ${"TT"}  | ${"'TT'"}
    ${-883_656_000}    | ${"TAI"} | ${"'TAI'"}
    ${-883_656_000}    | ${"TT"}  | ${"'TT'"}
    ${-883_656_000}    | ${"TCG"} | ${"'TCG'"}
    ${NaN}             | ${"UTC"} | ${"'UTC'"}
    ${Infinity}        | ${"UTC"} | ${"'UTC'"}
    ${-Infinity}       | ${"UTC"} | ${"'UTC'"}
    ${1e300}           | ${"UTC"} | ${"'UTC'"}
    ${-1e300}          | ${"UTC"} | ${"'UTC'"}
    ${252_455_572_800} | ${"UTC"} | ${"'UTC'"}
    ${0}               | ${"TDB"} | ${"'TDB'"}
    ${0}               | ${"tt"}  | ${"'tt'"}
    ${0}               | ${null}  | ${"null"}
    ${0}               | ${5}     | ${"5"}
  `("returns '' for $seconds on scale $label", ({ seconds, scale }) => {
    expect(fromJ2000Seconds(seconds, scale)).toBe("");
  });

  it("returns '' for an empty-string scale", () => {
    expect(fromJ2000Seconds(0, "" as TimeScale)).toBe("");
  });

  it.each`
    value
    ${"0"}
    ${null}
    ${undefined}
    ${0n}
    ${{}}
  `("returns '' for the non-number $value", ({ value }) => {
    expect(fromJ2000Seconds(value as unknown as number)).toBe("");
  });

  describe("round trips over 41 instants", () => {
    it.each`
      scale
      ${"UTC"}
      ${"TAI"}
      ${"TT"}
      ${"TCG"}
    `(
      "comes back within half an ulp and half a nanosecond on $scale",
      ({ scale }: { scale: TimeScale }) => {
        // The ceiling can round up past year 9999 (a double there is 30 µs wide), giving "".
        const inside = PARTS_INSTANTS.filter(
          (x) => !x.includes(":60") && !x.startsWith("9999-"),
        );
        expect(inside.length).toBe(PARTS_INSTANTS.length - 31);
        const bad = inside.filter((x) => {
          const seconds = toJ2000Seconds(x, scale);
          if (seconds === null) {
            return true;
          }
          const back = fromJ2000Seconds(seconds, scale);
          if (back === "") {
            return true;
          }
          const diff =
            Temporal.Instant.from(back).epochNanoseconds -
            Temporal.Instant.from(x).epochNanoseconds;
          const bound = BigInt(
            Math.ceil(ulpNanoseconds(seconds === 0 ? 1 : seconds) / 2 + 1),
          );
          return diff > bound || diff < -bound;
        });
        expect(bad).toEqual([]);
      },
    );

    it.each`
      scale
      ${"UTC"}
      ${"TAI"}
      ${"TT"}
      ${"TCG"}
    `(
      "re-encodes every leap-second reading to within an ulp on $scale",
      ({ scale }: { scale: TimeScale }) => {
        const leaps = PARTS_INSTANTS.filter((x) => x.includes(":60"));
        expect(leaps.length).toBe(30);
        // Reading the string written back gives the same double, give or take one ulp: the
        // quasi-day count of a leap-second reading survives the trip through a string.
        const bad = leaps.filter((x) => {
          const seconds = toJ2000Seconds(x, scale);
          if (seconds === null) {
            return true;
          }
          const again = toJ2000Seconds(fromJ2000Seconds(seconds, scale), scale);
          return (
            again === null ||
            Math.abs(again - seconds) > ulpNanoseconds(seconds) / 1e9
          );
        });
        expect(bad).toEqual([]);
      },
    );

    it("is exact on UTC for 2000-01-01T12:00:00.5Z, a multiple of 2^-24 s", () => {
      const seconds = toJ2000Seconds("2000-01-01T12:00:00.5Z", "UTC");
      expect(seconds).toBe(0.5);
      expect(fromJ2000Seconds(seconds as number, "UTC")).toBe(
        "2000-01-01T12:00:00.5Z",
      );
    });
  });
});
