import { readFileSync } from "node:fs";
import path from "node:path";
import { Temporal } from "@js-temporal/polyfill";
import {
  LEAP_SECOND_STEPS,
  type LeapSecondSteps,
  nextStepIndex,
  stepReading,
  taiOfUtc,
  utcOfTai,
} from "./leapSeconds";
import { formatUtcReading } from "./utcReading";

/** Epoch nanoseconds of a UTC instant string. */
function utcNs(iso: string): bigint {
  return Temporal.Instant.from(iso).epochNanoseconds;
}

/** Label nanoseconds of a TAI wall clock (`YYYY-MM-DDTHH:MM:SS[.f]`), read as if UTC. */
function taiNs(label: string): bigint {
  return Temporal.PlainDateTime.from(label).toZonedDateTime("UTC")
    .epochNanoseconds;
}

function ordinary(iso: string) {
  return { epochNanoseconds: utcNs(iso), secondSixty: false };
}

/** A second-60 reading: the instant Temporal clamps `…:60.f` to, `…:59.f`. */
function secondSixty(isoAt59: string) {
  return { epochNanoseconds: utcNs(isoAt59), secondSixty: true };
}

/**
 * The closed table plus a negative leap second at 2030-01-01T00:00:00Z (TAI − UTC 37 → 36).
 * ITU-R TF.460-6 Annex 1 §2.2 allows one ("23h 59m 58s will be followed, one second later, by
 * 0h 0m 0s"); the closed table has none, so only this synthetic table reaches that branch.
 */
const negativeStepSteps: LeapSecondSteps = {
  at: [...LEAP_SECOND_STEPS.at, utcNs("2030-01-01T00:00:00Z")],
  taiMinusUtc: [...LEAP_SECOND_STEPS.taiMinusUtc, 36n],
};

/** Each `[bigint, offset], // date` row of the literal in leapSeconds.ts. */
function sourceRows(): { at: bigint; offset: bigint; date: string }[] {
  const source = readFileSync(
    path.resolve(import.meta.dirname, "leapSeconds.ts"),
    "utf8",
  );
  return [...source.matchAll(/^\s*\[(\d+)n, (\d+)n\], \/\/ (\S+)$/gm)].map(
    (match) => ({
      at: BigInt(match[1]),
      offset: BigInt(match[2]),
      date: match[3],
    }),
  );
}

describe("LEAP_SECOND_STEPS (IERS Leap_Second.dat, Bulletin C 72)", () => {
  it("has 28 rows: 1972-01-01 at 10 s (first whole-second row) to 2017-01-01 at 37 s", () => {
    expect(LEAP_SECOND_STEPS.at).toHaveLength(28);
    expect(LEAP_SECOND_STEPS.taiMinusUtc).toHaveLength(28);
    expect(LEAP_SECOND_STEPS.at[0]).toBe(utcNs("1972-01-01T00:00:00Z"));
    expect(LEAP_SECOND_STEPS.taiMinusUtc[0]).toBe(10n);
    expect(LEAP_SECOND_STEPS.at[27]).toBe(utcNs("2017-01-01T00:00:00Z"));
    expect(LEAP_SECOND_STEPS.taiMinusUtc[27]).toBe(37n);
  });

  it("matches every row of the source literal, and each bigint is the date in its comment", () => {
    const rows = sourceRows();
    expect(rows).toHaveLength(28);
    rows.forEach((row, index) => {
      expect(row.at).toBe(utcNs(row.date));
      expect(LEAP_SECOND_STEPS.at[index]).toBe(row.at);
      expect(LEAP_SECOND_STEPS.taiMinusUtc[index]).toBe(row.offset);
    });
  });

  // IERS Earth Orientation Center, Leap_Second.dat (Bulletin C 72), typed here as literals: MJD
  // and TAI − UTC. A table that moved a row, or changed an offset, still agreed with itself in
  // every other test; this one does not.
  it.each`
    mjd      | date            | offset
    ${41317} | ${"1972-01-01"} | ${10}
    ${41499} | ${"1972-07-01"} | ${11}
    ${41683} | ${"1973-01-01"} | ${12}
    ${42048} | ${"1974-01-01"} | ${13}
    ${42413} | ${"1975-01-01"} | ${14}
    ${42778} | ${"1976-01-01"} | ${15}
    ${43144} | ${"1977-01-01"} | ${16}
    ${43509} | ${"1978-01-01"} | ${17}
    ${43874} | ${"1979-01-01"} | ${18}
    ${44239} | ${"1980-01-01"} | ${19}
    ${44786} | ${"1981-07-01"} | ${20}
    ${45151} | ${"1982-07-01"} | ${21}
    ${45516} | ${"1983-07-01"} | ${22}
    ${46247} | ${"1985-07-01"} | ${23}
    ${47161} | ${"1988-01-01"} | ${24}
    ${47892} | ${"1990-01-01"} | ${25}
    ${48257} | ${"1991-01-01"} | ${26}
    ${48804} | ${"1992-07-01"} | ${27}
    ${49169} | ${"1993-07-01"} | ${28}
    ${49534} | ${"1994-07-01"} | ${29}
    ${50083} | ${"1996-01-01"} | ${30}
    ${50630} | ${"1997-07-01"} | ${31}
    ${51179} | ${"1999-01-01"} | ${32}
    ${53736} | ${"2006-01-01"} | ${33}
    ${54832} | ${"2009-01-01"} | ${34}
    ${56109} | ${"2012-07-01"} | ${35}
    ${57204} | ${"2015-07-01"} | ${36}
    ${57754} | ${"2017-01-01"} | ${37}
  `(
    "has the IERS row MJD $mjd ($date) at TAI − UTC $offset s",
    ({ mjd, offset }) => {
      // MJD 40587 is 1970-01-01 (the Unix epoch); a day is 86 400 s.
      const at = BigInt(mjd - 40587) * 86_400_000_000_000n;
      const index = LEAP_SECOND_STEPS.at.indexOf(at);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(LEAP_SECOND_STEPS.taiMinusUtc[index]).toBe(BigInt(offset));
    },
  );

  it("starts every row at 00:00:00 UTC on a month's first day (TF.460-6 Annex 1 §2.1-2.2)", () => {
    for (const at of LEAP_SECOND_STEPS.at) {
      const wall = Temporal.Instant.fromEpochNanoseconds(at)
        .toZonedDateTimeISO("UTC")
        .toPlainDateTime();
      expect(wall.day).toBe(1);
      expect(wall.toPlainTime().toString()).toBe("00:00:00");
    }
  });

  it("is strictly increasing, and every step is exactly +1 s (27 inserted leap seconds)", () => {
    const { at, taiMinusUtc } = LEAP_SECOND_STEPS;
    let insertions = 0;
    for (let index = 1; index < at.length; index += 1) {
      expect(at[index] > at[index - 1]).toBe(true);
      expect(taiMinusUtc[index] - taiMinusUtc[index - 1]).toBe(1n);
      insertions += 1;
    }
    expect(insertions).toBe(27);
  });
});

describe("taiOfUtc", () => {
  it.each`
    utc                                 | tai                                | why
    ${"1972-01-01T00:00:00Z"}           | ${"1972-01-01T00:00:10"}           | ${"first row, 10 s"}
    ${"1980-01-06T00:00:00Z"}           | ${"1980-01-06T00:00:19"}           | ${"1980-01-01 row, 19 s"}
    ${"2016-12-31T23:59:59Z"}           | ${"2017-01-01T00:00:35"}           | ${"last second before the insertion, 36 s"}
    ${"2017-01-01T00:00:00Z"}           | ${"2017-01-01T00:00:37"}           | ${"first instant of the 37 s row"}
    ${"2024-01-01T00:00:00Z"}           | ${"2024-01-01T00:00:37"}           | ${"37 s"}
    ${"2100-01-01T00:00:00.5Z"}         | ${"2100-01-01T00:00:37.5"}         | ${"closed table: 37 s with no upper bound"}
    ${"2016-12-31T23:59:59.999999999Z"} | ${"2017-01-01T00:00:35.999999999"} | ${"1 ns before the inserted second, 36 s"}
  `("maps UTC $utc to TAI $tai ($why)", ({ utc, tai }) => {
    expect(taiOfUtc(LEAP_SECOND_STEPS, ordinary(utc))).toBe(taiNs(tai));
  });

  it.each`
    at59                                | tai                                | label
    ${"2016-12-31T23:59:59Z"}           | ${"2017-01-01T00:00:36"}           | ${"2016-12-31T23:59:60Z"}
    ${"2016-12-31T23:59:59.5Z"}         | ${"2017-01-01T00:00:36.5"}         | ${"2016-12-31T23:59:60.5Z"}
    ${"2016-12-31T23:59:59.999999999Z"} | ${"2017-01-01T00:00:36.999999999"} | ${"2016-12-31T23:59:60.999999999Z"}
    ${"1972-06-30T23:59:59Z"}           | ${"1972-07-01T00:00:10"}           | ${"1972-06-30T23:59:60Z"}
  `(
    "maps the inserted second $label to its own TAI second $tai (old offset + 1 s)",
    ({ at59, tai }) => {
      expect(taiOfUtc(LEAP_SECOND_STEPS, secondSixty(at59))).toBe(taiNs(tai));
    },
  );

  it.each`
    reading                                       | why
    ${ordinary("1971-12-31T23:59:59.999999999Z")} | ${"1 ns before the first row"}
    ${secondSixty("1971-12-31T23:59:59Z")}        | ${"second 60 before the first row"}
    ${secondSixty("2017-12-31T23:59:59Z")}        | ${"second 60 on a day with no insertion"}
    ${secondSixty("2016-12-31T12:34:59Z")}        | ${"second 60 not in the last minute of the day"}
    ${secondSixty("2016-06-30T23:59:59Z")}        | ${"second 60 at a month end with no insertion"}
  `("returns null for $why", ({ reading }) => {
    expect(taiOfUtc(LEAP_SECOND_STEPS, reading)).toBeNull();
  });

  it.each`
    reading                                       | expected                           | why
    ${ordinary("2029-12-31T23:59:58Z")}           | ${"2030-01-01T00:00:35"}           | ${"last second before the deleted one, 37 s"}
    ${ordinary("2029-12-31T23:59:58.999999999Z")} | ${"2030-01-01T00:00:35.999999999"} | ${"1 ns before the deleted second, 37 s"}
    ${ordinary("2029-12-31T23:59:59Z")}           | ${null}                            | ${"the deleted second 23:59:59"}
    ${ordinary("2029-12-31T23:59:59.5Z")}         | ${null}                            | ${"inside the deleted second"}
    ${ordinary("2030-01-01T00:00:00Z")}           | ${"2030-01-01T00:00:36"}           | ${"first instant after the deletion, 36 s"}
    ${secondSixty("2029-12-31T23:59:59Z")}        | ${null}                            | ${"second 60 where a second was deleted"}
  `(
    "on a table with a negative step, returns $expected for $why",
    ({ reading, expected }) => {
      expect(taiOfUtc(negativeStepSteps, reading)).toBe(
        expected === null ? null : taiNs(expected),
      );
    },
  );
});

describe("utcOfTai", () => {
  it.each`
    tai                                | utc                                 | secondSixty | why
    ${"1972-01-01T00:00:10"}           | ${"1972-01-01T00:00:00Z"}           | ${false}    | ${"first TAI instant of the table"}
    ${"2017-01-01T00:00:35"}           | ${"2016-12-31T23:59:59Z"}           | ${false}    | ${"before the insertion"}
    ${"2017-01-01T00:00:36"}           | ${"2016-12-31T23:59:59Z"}           | ${true}     | ${"start of the inserted second, 23:59:60"}
    ${"2017-01-01T00:00:36.5"}         | ${"2016-12-31T23:59:59.5Z"}         | ${true}     | ${"inside the inserted second, 23:59:60.5"}
    ${"2017-01-01T00:00:37"}           | ${"2017-01-01T00:00:00Z"}           | ${false}    | ${"after the insertion"}
    ${"1972-07-01T00:00:10"}           | ${"1972-06-30T23:59:59Z"}           | ${true}     | ${"1972-06-30 inserted second"}
    ${"2100-01-01T00:00:37"}           | ${"2100-01-01T00:00:00Z"}           | ${false}    | ${"closed table, 37 s"}
    ${"2017-01-01T00:00:35.999999999"} | ${"2016-12-31T23:59:59.999999999Z"} | ${false}    | ${"1 ns before the inserted second"}
    ${"2017-01-01T00:00:36.999999999"} | ${"2016-12-31T23:59:59.999999999Z"} | ${true}     | ${"the last nanosecond of the inserted second, 23:59:60.999999999"}
  `(
    "maps TAI $tai to UTC $utc with secondSixty $secondSixty ($why)",
    ({ tai, utc, secondSixty: sixty }) => {
      expect(utcOfTai(LEAP_SECOND_STEPS, taiNs(tai))).toEqual({
        epochNanoseconds: utcNs(utc),
        secondSixty: sixty,
      });
    },
  );

  it("returns null before 1972-01-01T00:00:10 TAI", () => {
    expect(
      utcOfTai(LEAP_SECOND_STEPS, taiNs("1972-01-01T00:00:09.999999999")),
    ).toBeNull();
  });

  it.each`
    tai                                | utc
    ${"2030-01-01T00:00:35"}           | ${"2029-12-31T23:59:58Z"}
    ${"2030-01-01T00:00:35.999999999"} | ${"2029-12-31T23:59:58.999999999Z"}
    ${"2030-01-01T00:00:35.5"}         | ${"2029-12-31T23:59:58.5Z"}
    ${"2030-01-01T00:00:36"}           | ${"2030-01-01T00:00:00Z"}
  `(
    "on a table with a negative step, maps TAI $tai to UTC $utc with no second 60",
    ({ tai, utc }) => {
      expect(utcOfTai(negativeStepSteps, taiNs(tai))).toEqual({
        epochNanoseconds: utcNs(utc),
        secondSixty: false,
      });
    },
  );
});

describe("nextStepIndex", () => {
  it.each`
    reading                                | expected | why
    ${ordinary("1972-01-01T00:00:00Z")}    | ${1}     | ${"the 1972-07-01 row"}
    ${ordinary("2016-01-01T00:00:00Z")}    | ${27}    | ${"the 2017-01-01 row"}
    ${ordinary("2016-12-31T23:59:59.5Z")}  | ${27}    | ${"half a second before the insertion"}
    ${secondSixty("2015-06-30T23:59:59Z")} | ${27}    | ${"from inside the 2015 inserted second"}
    ${secondSixty("2016-12-31T23:59:59Z")} | ${-1}    | ${"from inside the last inserted second"}
    ${ordinary("2017-01-01T00:00:00Z")}    | ${-1}    | ${"after the last row"}
    ${ordinary("2024-01-01T00:00:00Z")}    | ${-1}    | ${"closed table: none after 2017"}
  `("returns $expected from $why", ({ reading, expected }) => {
    expect(nextStepIndex(LEAP_SECOND_STEPS, reading)).toBe(expected);
  });

  it("finds a negative step on the synthetic table", () => {
    expect(
      nextStepIndex(negativeStepSteps, ordinary("2024-01-01T00:00:00Z")),
    ).toBe(28);
  });
});

describe("stepReading", () => {
  // TF.460-6 Annex 1 §2.2: a positive leap second is 23:59:60; a negative one omits 23:59:59.
  it.each`
    steps                | index | at59                      | secondSixty | written
    ${LEAP_SECOND_STEPS} | ${1}  | ${"1972-06-30T23:59:59Z"} | ${true}     | ${"1972-06-30T23:59:60Z: the inserted second"}
    ${LEAP_SECOND_STEPS} | ${27} | ${"2016-12-31T23:59:59Z"} | ${true}     | ${"2016-12-31T23:59:60Z: the inserted second"}
    ${negativeStepSteps} | ${28} | ${"2029-12-31T23:59:59Z"} | ${false}    | ${"2029-12-31T23:59:59Z: the deleted second"}
  `(
    "reads step $index as $written",
    ({ steps, index, at59, secondSixty: sixty }) => {
      expect(stepReading(steps, index)).toEqual({
        epochNanoseconds: utcNs(at59),
        secondSixty: sixty,
      });
    },
  );

  // nextLeapSecond writes a step's second with formatUtcReading: 23:59:60 for an insertion, the
  // omitted 23:59:59 for a deletion (TF.460-6 Annex 1 §2.2).
  it.each`
    steps                | index | written
    ${LEAP_SECOND_STEPS} | ${27} | ${"2016-12-31T23:59:60Z"}
    ${negativeStepSteps} | ${28} | ${"2029-12-31T23:59:59Z"}
  `("writes step $index as $written", ({ steps, index, written }) => {
    expect(formatUtcReading(stepReading(steps, index))).toBe(written);
  });
});
