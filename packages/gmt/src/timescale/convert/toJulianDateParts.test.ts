import {
  canonicalInstant,
  PARTS_INSTANTS,
  partsOfLabel,
} from "../../test/julianDateFixtures";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { TimeScale } from "../../types/time-scale";
import { fromJulianDateParts } from "./fromJulianDateParts";
import { toJulianDateParts } from "./toJulianDateParts";
import { toTAI } from "./toTAI";
import { toTCG } from "./toTCG";
import { toTT } from "./toTT";

// Expected values come from the rule (IAU 1997 B1 App. 2: JD days begin at noon; ERFA dtf2d.c
// Notes 3-4: quasi-JD on UTC) worked out by hand in integers. Every jd2 is the double one
// division of the stated integers gives, never a typed decimal.
const DAY = 86_400_000_000_000;

describe("toJulianDateParts", () => {
  it.each`
    isoString                                    | scale        | jd1        | jd2                         | why
    ${"2000-01-01T12:00:00Z"}                    | ${undefined} | ${2451545} | ${0}                        | ${"J2000.0 day, noon (ERFA_DJ00)"}
    ${"2000-01-01T12:00:00Z"}                    | ${"UTC"}     | ${2451545} | ${0}                        | ${"explicit UTC is the default"}
    ${"2000-01-01T00:00:00Z"}                    | ${undefined} | ${2451544} | ${0.5}                      | ${"midnight is .5"}
    ${"2000-01-01T11:58:55.816Z"}                | ${"TT"}      | ${2451545} | ${0}                        | ${"J2000.0 itself: TT - UTC = 64.184 s in 2000"}
    ${"2000-01-01T12:00:00Z"}                    | ${"TCG"}     | ${2451545} | ${64_689_833_330 / DAY}     | ${"label 12:01:04.68983333 TCG"}
    ${"2016-12-31T23:59:60Z"}                    | ${undefined} | ${2457754} | ${86_399 / 172_802}         | ${"quasi-JD: 86400 s into an 86401 s day"}
    ${"2016-12-31T12:00:00Z"}                    | ${undefined} | ${2457753} | ${172_801 / 172_802}        | ${"noon on a leap-second day is not .0"}
    ${"2016-12-31T23:59:60.5Z"}                  | ${undefined} | ${2457754} | ${86_400 / 172_802}         | ${"half a second into the inserted second"}
    ${"2017-01-01T00:00:00Z"}                    | ${undefined} | ${2457754} | ${0.5}                      | ${"the day after is ordinary"}
    ${"2026-01-01T00:00:00Z"}                    | ${"TAI"}     | ${2461041} | ${(43_200 + 37) / 86_400}   | ${"TAI - UTC = 37 s"}
    ${"2016-12-31T23:59:60Z"}                    | ${"TAI"}     | ${2457754} | ${(43_200 + 36) / 86_400}   | ${"the inserted second is TAI 2017-01-01T00:00:36"}
    ${"2016-12-31T23:59:30Z"}                    | ${"TAI"}     | ${2457754} | ${(43_200 + 6) / 86_400}    | ${"the TAI label is already on the next day: 00:00:06"}
    ${"2026-01-01T00:00:00Z"}                    | ${"TT"}      | ${2461041} | ${43_269_184 / 86_400_000}  | ${"plus 32.184 s"}
    ${"2026-01-01T00:00:00.000000001Z"}          | ${undefined} | ${2461041} | ${43_200_000_000_001 / DAY} | ${"one nanosecond survives"}
    ${"2026-01-01T01:00:00+01:00"}               | ${undefined} | ${2461041} | ${0.5}                      | ${"an offset is read as its instant"}
    ${"2026-01-01T01:00:00+01:00[Europe/Paris]"} | ${undefined} | ${2461041} | ${0.5}                      | ${"a bracketed zone is accepted"}
    ${"1972-01-01T00:00:00Z"}                    | ${undefined} | ${2441317} | ${0.5}                      | ${"the floor"}
    ${"9999-12-31T23:59:59.999999999Z"}          | ${undefined} | ${5373484} | ${43_199_999_999_999 / DAY} | ${"the ceiling"}
  `(
    "returns jd1 $jd1 and jd2 $jd2 for '$isoString' on scale $scale ($why)",
    ({ isoString, scale, jd1, jd2 }) => {
      expect(toJulianDateParts(isoString, scale)).toEqual({ jd1, jd2 });
    },
  );

  it.each`
    isoString                           | scale    | label
    ${"1971-12-31T23:59:59.999999999Z"} | ${"UTC"} | ${"'UTC'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TAI"} | ${"'TAI'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TT"}  | ${"'TT'"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"TCG"} | ${"'TCG'"}
    ${"2017-12-31T23:59:60Z"}           | ${"UTC"} | ${"'UTC'"}
    ${""}                               | ${"UTC"} | ${"'UTC'"}
    ${"not a date"}                     | ${"UTC"} | ${"'UTC'"}
    ${"2026-01-01"}                     | ${"UTC"} | ${"'UTC'"}
    ${"2026-01-01T00:00:00"}            | ${"UTC"} | ${"'UTC'"}
    ${"+010000-01-01T00:00:00Z"}        | ${"UTC"} | ${"'UTC'"}
    ${"2026-01-01T00:00:00Z"}           | ${"TDB"} | ${"'TDB'"}
    ${"2026-01-01T00:00:00Z"}           | ${"tt"}  | ${"'tt'"}
    ${"2026-01-01T00:00:00Z"}           | ${null}  | ${"null"}
    ${"2026-01-01T00:00:00Z"}           | ${5}     | ${"5"}
  `("returns null for '$isoString' on scale $label", ({ isoString, scale }) => {
    expect(toJulianDateParts(isoString, scale)).toBeNull();
  });

  it("returns null for an empty-string scale", () => {
    expect(
      toJulianDateParts("2026-01-01T00:00:00Z", "" as TimeScale),
    ).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(toJulianDateParts(undefined as unknown as string)).toBeNull();
    expect(toJulianDateParts(5 as unknown as string)).toBeNull();
  });

  it("treats an explicit undefined scale as the default", () => {
    expect(toJulianDateParts("2000-01-01T00:00:00Z", undefined)).toEqual(
      toJulianDateParts("2000-01-01T00:00:00Z", "UTC"),
    );
  });

  it("returns a new object each call", () => {
    const first = toJulianDateParts("2000-01-01T12:00:00Z");
    const second = toJulianDateParts("2000-01-01T12:00:00Z");
    expect(first).not.toBe(second);
  });

  it("returns null when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(toJulianDateParts("2016-12-31T23:59:60Z")).toBeNull();
  });

  describe("properties over 41 instants", () => {
    it.each`
      scale
      ${"UTC"}
      ${"TAI"}
      ${"TT"}
      ${"TCG"}
    `(
      "jd1 is a whole number and jd2 lies in [0, 1) on $scale",
      ({ scale }: { scale: TimeScale }) => {
        const bad = PARTS_INSTANTS.filter((x) => {
          const parts = toJulianDateParts(x, scale);
          return (
            parts === null ||
            !Number.isInteger(parts.jd1) ||
            !(parts.jd2 >= 0 && parts.jd2 < 1)
          );
        });
        expect(bad).toEqual([]);
      },
    );

    // The label is the one SPA-47 writes (toTAI / toTT / toTCG); the JD is counted from it by a
    // helper that parses the label and uses bigint, independent of the core.
    it.each`
      scale    | label
      ${"TAI"} | ${toTAI}
      ${"TT"}  | ${toTT}
      ${"TCG"} | ${toTCG}
    `(
      "agrees with the label SPA-47 writes on $scale",
      ({
        scale,
        label,
      }: {
        scale: TimeScale;
        label: (x: string) => string;
      }) => {
        // The label is "" where it passes year 9999 (the UTC ceiling on TT and TCG).
        const labelled = PARTS_INSTANTS.filter((x) => label(x) !== "");
        expect(labelled.length).toBeGreaterThanOrEqual(
          PARTS_INSTANTS.length - 1,
        );
        const bad = labelled.filter(
          (x) =>
            JSON.stringify(toJulianDateParts(x, scale)) !==
            JSON.stringify(partsOfLabel(label(x))),
        );
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
      "fromJulianDateParts gives back the canonical instant on $scale",
      ({ scale }: { scale: TimeScale }) => {
        const bad = PARTS_INSTANTS.filter(
          (x) =>
            fromJulianDateParts(
              toJulianDateParts(x, scale) as { jd1: number; jd2: number },
              scale,
            ) !== canonicalInstant(x),
        );
        expect(bad).toEqual([]);
      },
    );
  });
});
