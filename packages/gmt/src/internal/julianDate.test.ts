import { Temporal } from "./temporal";
import { JULIAN_DAY_OF_UNIX_EPOCH } from "./foreignEpochs";
import { LEAP_SECOND_STEPS } from "./leapSeconds";
import {
  dayPositionOf,
  dayPositionOfDays,
  epochDaysOfJ2000Seconds,
  epochDaysOfJulianDate,
  epochDaysOfModifiedJulianDate,
  exactDyadic,
  fractionOfDay,
  isTimeScale,
  J2000_EPOCH_DAY,
  JD_OF_UNIX_EPOCH_MIDNIGHT_HALF_DAYS,
  julianDatePartsOf,
  MJD_OF_UNIX_EPOCH,
  nearestDouble,
  readingOfDayPosition,
  readsBackInDomain,
  UTC_JD_FLOOR_NANOSECONDS,
} from "./julianDate";
import { LAST_FOUR_DIGIT_UTC_NANOSECONDS } from "./utcReading";

const DAY = 86_400_000_000_000n;
const SECOND = 1_000_000_000n;

/** Epoch nanoseconds of a UTC instant string. */
function utcNs(iso: string): bigint {
  return Temporal.Instant.from(iso).epochNanoseconds;
}

function ordinary(iso: string) {
  return { epochNanoseconds: utcNs(iso), secondSixty: false };
}

/** A second-60 reading: the instant Temporal clamps `…:60.f` to, `…:59.f`. */
function secondSixty(isoAt59: string) {
  return { epochNanoseconds: utcNs(isoAt59), secondSixty: true };
}

describe("constants", () => {
  it("MJD_OF_UNIX_EPOCH is the days from 1858-11-17 to 1970-01-01", () => {
    expect(MJD_OF_UNIX_EPOCH).toBe(
      BigInt(
        Temporal.PlainDate.from("1858-11-17").until("1970-01-01", {
          largestUnit: "days",
        }).days,
      ),
    );
  });

  it("JD_OF_UNIX_EPOCH_MIDNIGHT_HALF_DAYS is twice 2440587.5, the Julian day number of the epoch less a half", () => {
    expect(JD_OF_UNIX_EPOCH_MIDNIGHT_HALF_DAYS).toBe(
      2n * BigInt(JULIAN_DAY_OF_UNIX_EPOCH) - 1n,
    );
  });

  it("J2000_EPOCH_DAY is the days from 1970-01-01 to 2000-01-01", () => {
    expect(J2000_EPOCH_DAY).toBe(
      BigInt(
        Temporal.PlainDate.from("1970-01-01").until("2000-01-01", {
          largestUnit: "days",
        }).days,
      ),
    );
  });

  it("UTC_JD_FLOOR_NANOSECONDS is 1972-01-01T00:00:00Z, the first row of the leap-second table", () => {
    expect(UTC_JD_FLOOR_NANOSECONDS).toBe(utcNs("1972-01-01T00:00:00Z"));
    expect(UTC_JD_FLOOR_NANOSECONDS).toBe(LEAP_SECOND_STEPS.at[0]);
  });
});

describe("isTimeScale", () => {
  it.each`
    value    | expected
    ${"UTC"} | ${true}
    ${"TAI"} | ${true}
    ${"TT"}  | ${true}
    ${"TCG"} | ${true}
    ${"TDB"} | ${false}
    ${"tt"}  | ${false}
    ${""}    | ${false}
  `("isTimeScale('$value') is $expected", ({ value, expected }) => {
    expect(isTimeScale(value)).toBe(expected);
  });

  it.each`
    label          | value
    ${"null"}      | ${null}
    ${"undefined"} | ${undefined}
    ${"a number"}  | ${7}
    ${"an object"} | ${{}}
  `("isTimeScale is false for $label", ({ value }) => {
    expect(isTimeScale(value)).toBe(false);
  });

  it("is false for a name on the object prototype", () => {
    expect(isTimeScale("toString")).toBe(false);
    expect(isTimeScale("__proto__")).toBe(false);
  });
});

describe("exactDyadic", () => {
  // x = numerator / 2^exponent, reduced (odd numerator unless the exponent is 0).
  it.each`
    label                | x                   | numerator                       | exponent
    ${"zero"}            | ${0}                | ${0n}                           | ${0n}
    ${"negative zero"}   | ${-0}               | ${0n}                           | ${0n}
    ${"a half"}          | ${0.5}              | ${1n}                           | ${1n}
    ${"the J2000 JD"}    | ${2451545}          | ${2451545n}                     | ${0n}
    ${"one tenth"}       | ${0.1}              | ${3602879701896397n}            | ${55n}
    ${"smallest value"}  | ${Number.MIN_VALUE} | ${1n}                           | ${1074n}
    ${"minus 2.75"}      | ${-2.75}            | ${-11n}                         | ${2n}
    ${"two to the 60th"} | ${2 ** 60}          | ${1n << 60n}                    | ${0n}
    ${"largest value"}   | ${Number.MAX_VALUE} | ${(1n << 1024n) - (1n << 971n)} | ${0n}
  `(
    "reads $label ($x) as $numerator over 2 to the $exponent",
    ({ x, numerator, exponent }) => {
      expect(exactDyadic(x)).toEqual({ numerator, exponent });
    },
  );
});

describe("nearestDouble", () => {
  // Expected values are exact doubles, IEEE divisions of exact doubles (one correct rounding,
  // IEEE 754-2019 §4.3) or decimal literals of exact decimal rationals, which the parser rounds
  // to nearest, ties to even (ECMA-262 §12.9.3.1; every literal here has under 20 digits).
  const P53 = 2n ** 53n;
  it.each`
    label                                        | numerator                       | denominator       | expected
    ${"zero"}                                    | ${0n}                           | ${7n}             | ${0}
    ${"one"}                                     | ${1n}                           | ${1n}             | ${1}
    ${"two to the 60th"}                         | ${1n << 60n}                    | ${1n}             | ${2 ** 60}
    ${"two to the -40th"}                        | ${1n}                           | ${1n << 40n}      | ${2 ** -40}
    ${"minus 4, unreduced"}                      | ${-8n}                          | ${2n}             | ${-4}
    ${"3 x 2^200, past 2^53 with no fraction"}   | ${3n << 200n}                   | ${1n}             | ${3 * 2 ** 200}
    ${"1/3"}                                     | ${1n}                           | ${3n}             | ${1 / 3}
    ${"2/3"}                                     | ${2n}                           | ${3n}             | ${2 / 3}
    ${"-1/3"}                                    | ${-1n}                          | ${3n}             | ${-1 / 3}
    ${"-7/2"}                                    | ${-7n}                          | ${2n}             | ${-3.5}
    ${"tie 2^53 + 1 to even, down"}              | ${P53 + 1n}                     | ${1n}             | ${2 ** 53}
    ${"tie 2^53 + 3 to even, up"}                | ${P53 + 3n}                     | ${1n}             | ${2 ** 53 + 4}
    ${"tie -(2^53 + 1) to even, toward zero"}    | ${-(P53 + 1n)}                  | ${1n}             | ${-(2 ** 53)}
    ${"tie -(2^53 + 3) to even, away from zero"} | ${-(P53 + 3n)}                  | ${1n}             | ${-(2 ** 53 + 4)}
    ${"tie 1 + 2^-53 to even, down"}             | ${P53 + 1n}                     | ${P53}            | ${1}
    ${"tie 1 + 3 x 2^-53 to even, up"}           | ${P53 + 3n}                     | ${P53}            | ${1 + 2 ** -51}
    ${"tie (2^53 + 1) x 3 / 3, unreduced"}       | ${(P53 + 1n) * 3n}              | ${3n}             | ${2 ** 53}
    ${"just over a tie rounds up"}               | ${(P53 + 1n) * 1_000n + 1n}     | ${1_000n}         | ${2 ** 53 + 2}
    ${"carry: 1 - 2^-54 ties up to 1"}           | ${P53 * 2n - 1n}                | ${P53 * 2n}       | ${1}
    ${"carry: 2^53 - 1/4 rounds up to 2^53"}     | ${P53 * 4n - 1n}                | ${4n}             | ${2 ** 53}
    ${"carry: -(1 - 2^-54) ties to -1"}          | ${-(P53 * 2n - 1n)}             | ${P53 * 2n}       | ${-1}
    ${"1 ns as seconds"}                         | ${1n}                           | ${1_000_000_000n} | ${1e-9}
    ${"-1 ns as seconds"}                        | ${-1n}                          | ${1_000_000_000n} | ${-1e-9}
    ${"0.123456789 s"}                           | ${123_456_789n}                 | ${1_000_000_000n} | ${0.123456789}
    ${"2^53 - 1 ns as seconds"}                  | ${P53 - 1n}                     | ${1_000_000_000n} | ${9_007_199.254740991}
    ${"2^53 ns as seconds"}                      | ${P53}                          | ${1_000_000_000n} | ${9_007_199.254740992}
    ${"2^53 + 1 ns as seconds"}                  | ${P53 + 1n}                     | ${1_000_000_000n} | ${9_007_199.254740993}
    ${"-(2^53 + 1) ns as seconds"}               | ${-(P53 + 1n)}                  | ${1_000_000_000n} | ${-9_007_199.254740993}
    ${"a year-9999 count of ns as seconds"}      | ${252_423_727_199_999_999_999n} | ${1_000_000_000n} | ${252_423_727_199.999999999}
    ${"2^-1000, shift past 1023"}                | ${1n}                           | ${1n << 1000n}    | ${9.332636185032189e-302}
    ${"1/3 x 2^-1000, shift past 1023"}          | ${1n}                           | ${3n << 1000n}    | ${3.110878728344063e-302}
    ${"-2^-1022, the smallest normal"}           | ${-1n}                          | ${1n << 1022n}    | ${-2.2250738585072014e-308}
  `(
    "rounds $label to the nearest double, ties to even",
    ({ numerator, denominator, expected }) => {
      expect(Object.is(nearestDouble(numerator, denominator), expected)).toBe(
        true,
      );
    },
  );

  it("matches the IEEE division n / d of exact doubles for every denominator d from 3 to 1000", () => {
    const bad: number[] = [];
    for (let d = 3; d <= 1_000; d += 1) {
      for (const n of [1, 7, 999_999_937]) {
        if (!Object.is(nearestDouble(BigInt(n), BigInt(d)), n / d)) {
          bad.push(d);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("dayPositionOf", () => {
  const noon = ordinary("2000-01-01T12:00:00Z");

  // 2000-01-01 is epoch day 10957; TAI − UTC is 32 s then, TT − TAI is 32.184 s, and TCG − TT is
  // the floored 6.969290134e-10/(1 − 6.969290134e-10) of the TT nanoseconds since the 1977
  // epoch, so TCG is 43 264.68983333 s (the JSDoc example of toTCG).
  it.each`
    scale    | nanosOfDay
    ${"UTC"} | ${43_200n * SECOND}
    ${"TAI"} | ${43_232n * SECOND}
    ${"TT"}  | ${43_264_184_000_000n}
    ${"TCG"} | ${43_264_689_833_330n}
  `("places 2000-01-01T12:00:00Z on $scale", ({ scale, nanosOfDay }) => {
    expect(dayPositionOf(LEAP_SECOND_STEPS, noon, scale)).toEqual({
      epochDay: 10_957n,
      nanosOfDay,
      dayLength: DAY,
    });
  });

  it("counts the inserted second as the end of an 86 401 s UTC day", () => {
    expect(
      dayPositionOf(
        LEAP_SECOND_STEPS,
        secondSixty("2016-12-31T23:59:59Z"),
        "UTC",
      ),
    ).toEqual({
      epochDay: 17_166n,
      nanosOfDay: 86_400n * SECOND,
      dayLength: 86_401n * SECOND,
    });
  });

  it("keeps the fraction of the inserted second on UTC", () => {
    expect(
      dayPositionOf(
        LEAP_SECOND_STEPS,
        secondSixty("2016-12-31T23:59:59.5Z"),
        "UTC",
      ),
    ).toEqual({
      epochDay: 17_166n,
      nanosOfDay: 86_400_500_000_000n,
      dayLength: 86_401n * SECOND,
    });
  });

  it("places the last nanosecond before the inserted second on an 86 401 s day", () => {
    expect(
      dayPositionOf(
        LEAP_SECOND_STEPS,
        ordinary("2016-12-31T23:59:59.999999999Z"),
        "UTC",
      ),
    ).toEqual({
      epochDay: 17_166n,
      nanosOfDay: 86_399_999_999_999n,
      dayLength: 86_401n * SECOND,
    });
  });

  // TAI − UTC is 36 s up to the inserted second, which is TAI 2017-01-01T00:00:36, and 37 s after.
  it.each`
    scale    | nanosOfDay
    ${"TAI"} | ${36n * SECOND}
    ${"TT"}  | ${68_184_000_000n}
  `(
    "places the inserted second 2016-12-31T23:59:60Z on $scale at day 17167, $nanosOfDay ns",
    ({ scale, nanosOfDay }) => {
      expect(
        dayPositionOf(
          LEAP_SECOND_STEPS,
          secondSixty("2016-12-31T23:59:59Z"),
          scale,
        ),
      ).toEqual({ epochDay: 17_167n, nanosOfDay, dayLength: DAY });
    },
  );

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "has no position for a second 60 on a day with no insertion on $scale",
    ({ scale }) => {
      expect(
        dayPositionOf(
          LEAP_SECOND_STEPS,
          secondSixty("2017-12-31T23:59:59Z"),
          scale,
        ),
      ).toBeNull();
    },
  );

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "has no position for 1971-12-31T23:59:59.999999999Z on $scale",
    ({ scale }) => {
      expect(
        dayPositionOf(
          LEAP_SECOND_STEPS,
          ordinary("1971-12-31T23:59:59.999999999Z"),
          scale,
        ),
      ).toBeNull();
    },
  );

  it("places 1972-01-01T00:00:00Z at the start of day 730 on UTC", () => {
    expect(
      dayPositionOf(LEAP_SECOND_STEPS, ordinary("1972-01-01T00:00:00Z"), "UTC"),
    ).toEqual({ epochDay: 730n, nanosOfDay: 0n, dayLength: DAY });
  });

  it("places 1972-01-01T00:00:00Z at 10 s on TAI (TAI − UTC is 10 s)", () => {
    expect(
      dayPositionOf(LEAP_SECOND_STEPS, ordinary("1972-01-01T00:00:00Z"), "TAI"),
    ).toEqual({ epochDay: 730n, nanosOfDay: 10n * SECOND, dayLength: DAY });
  });

  it("places the last four-digit UTC nanosecond on day 2 932 896", () => {
    expect(
      dayPositionOf(
        LEAP_SECOND_STEPS,
        {
          epochNanoseconds: LAST_FOUR_DIGIT_UTC_NANOSECONDS,
          secondSixty: false,
        },
        "UTC",
      ),
    ).toEqual({
      epochDay: 2_932_896n,
      nanosOfDay: DAY - 1n,
      dayLength: DAY,
    });
  });

  it.each`
    scale
    ${"UTC"}
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "has no position one nanosecond past 9999-12-31T23:59:59.999999999Z on $scale",
    ({ scale }) => {
      expect(
        dayPositionOf(
          LEAP_SECOND_STEPS,
          {
            epochNanoseconds: LAST_FOUR_DIGIT_UTC_NANOSECONDS + 1n,
            secondSixty: false,
          },
          scale,
        ),
      ).toBeNull();
    },
  );
});

describe("readingOfDayPosition", () => {
  it("reads an inserted-second position on UTC as a second-60 reading", () => {
    expect(
      readingOfDayPosition(
        LEAP_SECOND_STEPS,
        17_166n,
        86_400_500_000_000n,
        "UTC",
      ),
    ).toEqual(secondSixty("2016-12-31T23:59:59.5Z"));
  });

  it("reads an ordinary UTC position as the instant", () => {
    expect(
      readingOfDayPosition(LEAP_SECOND_STEPS, 10_957n, 43_200n * SECOND, "UTC"),
    ).toEqual(ordinary("2000-01-01T12:00:00Z"));
  });

  it("has no reading on UTC before 1972-01-01", () => {
    expect(
      readingOfDayPosition(LEAP_SECOND_STEPS, 729n, DAY - 1n, "UTC"),
    ).toBeNull();
  });

  it.each`
    scale    | nanosOfDay             | iso
    ${"TAI"} | ${10n * SECOND}        | ${"1972-01-01T00:00:00Z"}
    ${"TAI"} | ${43_232n * SECOND}    | ${"2000-01-01T12:00:00Z"}
    ${"TT"}  | ${43_264_184_000_000n} | ${"2000-01-01T12:00:00Z"}
    ${"TCG"} | ${43_264_689_833_330n} | ${"2000-01-01T12:00:00Z"}
  `(
    "reads $scale day position $nanosOfDay ns as $iso (day 10957 unless 1972)",
    ({ scale, nanosOfDay, iso }) => {
      const epochDay = iso.startsWith("1972") ? 730n : 10_957n;
      expect(
        readingOfDayPosition(LEAP_SECOND_STEPS, epochDay, nanosOfDay, scale),
      ).toEqual(ordinary(iso));
    },
  );

  it.each`
    scale
    ${"TAI"}
    ${"TT"}
    ${"TCG"}
  `(
    "has no reading on $scale at the start of 1972-01-01 (day 730, 0 ns)",
    ({ scale }) => {
      expect(
        readingOfDayPosition(LEAP_SECOND_STEPS, 730n, 0n, scale),
      ).toBeNull();
    },
  );

  it("reads the TAI label of the inserted second as a second-60 reading", () => {
    expect(
      readingOfDayPosition(LEAP_SECOND_STEPS, 17_167n, 36n * SECOND, "TAI"),
    ).toEqual(secondSixty("2016-12-31T23:59:59Z"));
  });

  it.each`
    label                                      | reading                                                                      | scale
    ${"the 1972 floor"}                        | ${ordinary("1972-01-01T00:00:00Z")}                                          | ${"UTC"}
    ${"the 1972 floor"}                        | ${ordinary("1972-01-01T00:00:00Z")}                                          | ${"TAI"}
    ${"the 1972 floor"}                        | ${ordinary("1972-01-01T00:00:00Z")}                                          | ${"TT"}
    ${"the 1972 floor"}                        | ${ordinary("1972-01-01T00:00:00Z")}                                          | ${"TCG"}
    ${"an ordinary noon"}                      | ${ordinary("2000-01-01T12:00:00Z")}                                          | ${"UTC"}
    ${"an ordinary noon"}                      | ${ordinary("2000-01-01T12:00:00Z")}                                          | ${"TAI"}
    ${"an ordinary noon"}                      | ${ordinary("2000-01-01T12:00:00Z")}                                          | ${"TT"}
    ${"an ordinary noon"}                      | ${ordinary("2000-01-01T12:00:00Z")}                                          | ${"TCG"}
    ${"the inserted second's last nanosecond"} | ${secondSixty("2016-12-31T23:59:59.999999999Z")}                             | ${"UTC"}
    ${"the inserted second's last nanosecond"} | ${secondSixty("2016-12-31T23:59:59.999999999Z")}                             | ${"TAI"}
    ${"the inserted second's last nanosecond"} | ${secondSixty("2016-12-31T23:59:59.999999999Z")}                             | ${"TT"}
    ${"the inserted second's last nanosecond"} | ${secondSixty("2016-12-31T23:59:59.999999999Z")}                             | ${"TCG"}
    ${"the last four-digit nanosecond"}        | ${{ epochNanoseconds: LAST_FOUR_DIGIT_UTC_NANOSECONDS, secondSixty: false }} | ${"UTC"}
    ${"the last four-digit nanosecond"}        | ${{ epochNanoseconds: LAST_FOUR_DIGIT_UTC_NANOSECONDS, secondSixty: false }} | ${"TAI"}
    ${"the last four-digit nanosecond"}        | ${{ epochNanoseconds: LAST_FOUR_DIGIT_UTC_NANOSECONDS, secondSixty: false }} | ${"TT"}
    ${"the last four-digit nanosecond"}        | ${{ epochNanoseconds: LAST_FOUR_DIGIT_UTC_NANOSECONDS, secondSixty: false }} | ${"TCG"}
  `("round-trips $label on $scale", ({ reading, scale }) => {
    const position = dayPositionOf(LEAP_SECOND_STEPS, reading, scale);
    expect(position).not.toBeNull();
    expect(
      readingOfDayPosition(
        LEAP_SECOND_STEPS,
        position!.epochDay,
        position!.nanosOfDay,
        scale,
      ),
    ).toEqual(reading);
  });
});

describe("dayPositionOfDays", () => {
  it.each`
    label                          | n             | d     | scale    | epochDay      | nanosOfDay
    ${"a whole day"}               | ${10_957n}    | ${1n} | ${"UTC"} | ${10_957n}    | ${0n}
    ${"half a day"}                | ${21_915n}    | ${2n} | ${"UTC"} | ${10_957n}    | ${43_200n * SECOND}
    ${"a quarter on TAI"}          | ${43_829n}    | ${4n} | ${"TAI"} | ${10_957n}    | ${21_600n * SECOND}
    ${"the 1971-12-31 slack day"}  | ${729n}       | ${1n} | ${"UTC"} | ${729n}       | ${0n}
    ${"the 10000-01-01 slack day"} | ${2_932_897n} | ${1n} | ${"TT"}  | ${2_932_897n} | ${0n}
    ${"half a leap day"}           | ${34_333n}    | ${2n} | ${"UTC"} | ${17_166n}    | ${43_200_500_000_000n}
    ${"half of a plain day"}       | ${34_333n}    | ${2n} | ${"TAI"} | ${17_166n}    | ${43_200n * SECOND}
  `(
    "reads $label ($n/$d days) on $scale as day $epochDay, $nanosOfDay ns",
    ({ n, d, scale, epochDay, nanosOfDay }) => {
      expect(dayPositionOfDays(n, d, LEAP_SECOND_STEPS, scale)).toEqual({
        epochDay,
        nanosOfDay,
      });
    },
  );

  it("rounds a half nanosecond up (halfExpand on a non-negative fraction)", () => {
    const d = 2n * DAY;
    expect(
      dayPositionOfDays(10_957n * d + 1n, d, LEAP_SECOND_STEPS, "UTC"),
    ).toEqual({ epochDay: 10_957n, nanosOfDay: 1n });
  });

  it("rounds under a half nanosecond down", () => {
    const d = 4n * DAY;
    expect(
      dayPositionOfDays(10_957n * d + 1n, d, LEAP_SECOND_STEPS, "UTC"),
    ).toEqual({ epochDay: 10_957n, nanosOfDay: 0n });
  });

  it("carries a fraction that rounds up to the day length into the next day", () => {
    const d = 4n * DAY;
    expect(
      dayPositionOfDays(10_958n * d - 1n, d, LEAP_SECOND_STEPS, "UTC"),
    ).toEqual({ epochDay: 10_958n, nanosOfDay: 0n });
  });

  it("carries past 86 401 s on a leap-second day, not past 86 400 s", () => {
    const d = 4n * (DAY + SECOND);
    expect(
      dayPositionOfDays(17_167n * d - 1n, d, LEAP_SECOND_STEPS, "UTC"),
    ).toEqual({ epochDay: 17_167n, nanosOfDay: 0n });
  });

  it.each`
    label                     | n                 | d
    ${"day 728"}              | ${728n}           | ${1n}
    ${"day 2 932 898"}        | ${2_932_898n}     | ${1n}
    ${"1e300 days"}           | ${10n ** 300n}    | ${1n}
    ${"minus 1e300 days"}     | ${-(10n ** 300n)} | ${1n}
    ${"a fraction below 729"} | ${1_457n}         | ${2n}
    ${"minus half a day"}     | ${-1n}            | ${2n}
  `("has no position for $label ($n/$d)", ({ n, d }) => {
    expect(dayPositionOfDays(n, d, LEAP_SECOND_STEPS, "UTC")).toBeNull();
  });
});

describe("fractionOfDay", () => {
  it.each`
    nanosOfDay          | dayLength           | expected
    ${43_200n * SECOND} | ${DAY}              | ${0.5}
    ${0n}               | ${DAY}              | ${0}
    ${1n}               | ${DAY}              | ${1 / 86_400_000_000_000}
    ${43_200n * SECOND} | ${86_401n * SECOND} | ${43_200 / 86_401}
  `(
    "is $nanosOfDay over $dayLength as one division",
    ({ nanosOfDay, dayLength, expected }) => {
      expect(fractionOfDay({ epochDay: 0n, nanosOfDay, dayLength })).toBe(
        expected,
      );
    },
  );
});

describe("julianDatePartsOf", () => {
  // JD 2451544.5 is 2000-01-01T00:00 and 2451545.0 is noon (IAU 1997 B1 App. 2).
  it.each`
    label                             | epochDay   | nanosOfDay             | dayLength           | jd1          | jd2
    ${"midnight of 2000-01-01"}       | ${10_957n} | ${0n}                  | ${DAY}              | ${2_451_544} | ${0.5}
    ${"noon of 2000-01-01 (J2000)"}   | ${10_957n} | ${43_200n * SECOND}    | ${DAY}              | ${2_451_545} | ${0}
    ${"six in the evening"}           | ${10_957n} | ${64_800n * SECOND}    | ${DAY}              | ${2_451_545} | ${0.25}
    ${"the Unix epoch"}               | ${0n}      | ${0n}                  | ${DAY}              | ${2_440_587} | ${0.5}
    ${"the last 86 401 s second"}     | ${17_166n} | ${86_400n * SECOND}    | ${86_401n * SECOND} | ${2_457_754} | ${86_399 / 172_802}
    ${"the half-point of a leap day"} | ${17_166n} | ${43_200_500_000_000n} | ${86_401n * SECOND} | ${2_457_754} | ${0}
  `(
    "splits $label into $jd1 and $jd2",
    ({ epochDay, nanosOfDay, dayLength, jd1, jd2 }) => {
      expect(julianDatePartsOf({ epochDay, nanosOfDay, dayLength })).toEqual({
        jd1,
        jd2,
      });
    },
  );

  it.each`
    nanosOfDay
    ${0n}
    ${1n}
    ${43_199_999_999_999n}
    ${43_200n * SECOND}
    ${DAY - 1n}
  `(
    "writes a whole jd1 and a jd2 in [0, 1) at $nanosOfDay ns of a plain day",
    ({ nanosOfDay }) => {
      const parts = julianDatePartsOf({
        epochDay: 10_957n,
        nanosOfDay,
        dayLength: DAY,
      });
      expect(Number.isInteger(parts.jd1)).toBe(true);
      expect(parts.jd2).toBeGreaterThanOrEqual(0);
      expect(parts.jd2).toBeLessThan(1);
    },
  );

  // UTC leap-second day: the two doubles, read exactly, give the position back through the UTC
  // day length (86 401 s), including the inserted second.
  it.each`
    nanosOfDay
    ${0n}
    ${43_200_000_000_001n}
    ${86_400n * SECOND}
    ${86_401n * SECOND - 1n}
  `(
    "round-trips 2016-12-31 at $nanosOfDay ns of the 86 401 s UTC day through the two doubles",
    ({ nanosOfDay }) => {
      const parts = julianDatePartsOf({
        epochDay: 17_166n,
        nanosOfDay,
        dayLength: 86_401n * SECOND,
      });
      const one = exactDyadic(parts.jd1);
      const two = exactDyadic(parts.jd2);
      const exponent = [one.exponent, two.exponent, 1n].reduce((a, b) =>
        a > b ? a : b,
      );
      const d = 1n << exponent;
      const n =
        one.numerator * (d >> one.exponent) +
        two.numerator * (d >> two.exponent) -
        JD_OF_UNIX_EPOCH_MIDNIGHT_HALF_DAYS * (d >> 1n);
      expect(dayPositionOfDays(n, d, LEAP_SECOND_STEPS, "UTC")).toEqual({
        epochDay: 17_166n,
        nanosOfDay,
      });
    },
  );

  it("writes jd2 below 1 at the last nanosecond of an 86 401 s day", () => {
    const parts = julianDatePartsOf({
      epochDay: 17_166n,
      nanosOfDay: 86_401n * SECOND - 1n,
      dayLength: 86_401n * SECOND,
    });
    expect(parts.jd2).toBeGreaterThanOrEqual(0);
    expect(parts.jd2).toBeLessThan(1);
  });

  // The inverse seen from the callers' side: the two doubles, read exactly and summed, less the
  // JD of the Unix epoch, give the day position back to the nanosecond.
  it.each`
    epochDay      | nanosOfDay
    ${730n}       | ${0n}
    ${10_957n}    | ${1n}
    ${10_957n}    | ${43_200_000_000_001n}
    ${10_957n}    | ${DAY - 1n}
    ${2_932_896n} | ${DAY - 1n}
  `(
    "round-trips day $epochDay at $nanosOfDay ns through the two doubles and dayPositionOfDays",
    ({ epochDay, nanosOfDay }) => {
      const parts = julianDatePartsOf({ epochDay, nanosOfDay, dayLength: DAY });
      const one = exactDyadic(parts.jd1);
      const two = exactDyadic(parts.jd2);
      const exponent = [one.exponent, two.exponent, 1n].reduce((a, b) =>
        a > b ? a : b,
      );
      const d = 1n << exponent;
      const n =
        one.numerator * (d >> one.exponent) +
        two.numerator * (d >> two.exponent) -
        JD_OF_UNIX_EPOCH_MIDNIGHT_HALF_DAYS * (d >> 1n);
      expect(dayPositionOfDays(n, d, LEAP_SECOND_STEPS, "TAI")).toEqual({
        epochDay,
        nanosOfDay,
      });
    },
  );
});

/** Whether `days` names exactly `n / d` days since 1970-01-01 (cross-multiplied, so any reduction). */
function namesDays(
  days: { numerator: bigint; denominator: bigint },
  n: bigint,
  d: bigint,
): boolean {
  return days.numerator * d === n * days.denominator && days.denominator > 0n;
}

describe("epochDaysOfJulianDate", () => {
  it.each`
    jd                      | n              | d                 | why
    ${2451545}              | ${21_915n}     | ${2n}             | ${"J2000.0 is 10957.5 days after 1970-01-01"}
    ${2440587.5}            | ${0n}          | ${1n}             | ${"the Unix epoch"}
    ${2440587.5 + 0.25}     | ${1n}          | ${4n}             | ${"a quarter day"}
    ${2440587.5 + 2 ** -31} | ${1n}          | ${2_147_483_648n} | ${"one ulp above the epoch"}
    ${0}                    | ${-4_881_175n} | ${2n}             | ${"JD 0"}
    ${-0}                   | ${-4_881_175n} | ${2n}             | ${"negative zero is zero"}
    ${5373484.5}            | ${2_932_897n}  | ${1n}             | ${"10000-01-01"}
  `("names $n/$d days for jd $jd ($why)", ({ jd, n, d }) => {
    expect(namesDays(epochDaysOfJulianDate(jd), n, d)).toBe(true);
  });
});

describe("epochDaysOfModifiedJulianDate", () => {
  it.each`
    mjd                  | n           | d                 | why
    ${40_587}            | ${0n}       | ${1n}             | ${"the Unix epoch"}
    ${51_544.5}          | ${21_915n}  | ${2n}             | ${"J2000.0"}
    ${40_586.5}          | ${-1n}      | ${2n}             | ${"half a day before the epoch"}
    ${40_587 + 2 ** -31} | ${1n}       | ${2_147_483_648n} | ${"one ulp above the epoch"}
    ${0}                 | ${-40_587n} | ${1n}             | ${"MJD 0"}
    ${-0}                | ${-40_587n} | ${1n}             | ${"negative zero is zero"}
  `("names $n/$d days for mjd $mjd ($why)", ({ mjd, n, d }) => {
    expect(namesDays(epochDaysOfModifiedJulianDate(mjd), n, d)).toBe(true);
  });
});

describe("epochDaysOfJ2000Seconds", () => {
  it.each`
    seconds    | n                         | d           | why
    ${0}       | ${21_915n}                | ${2n}       | ${"J2000.0 is noon of day 10957"}
    ${-0}      | ${21_915n}                | ${2n}       | ${"negative zero is zero"}
    ${86_400}  | ${21_917n}                | ${2n}       | ${"one day later"}
    ${-43_200} | ${10_957n}                | ${1n}       | ${"midnight before J2000.0"}
    ${0.5}     | ${21_915n * 86_400n + 1n} | ${172_800n} | ${"half a second is 1/172800 day"}
    ${-0.5}    | ${21_915n * 86_400n - 1n} | ${172_800n} | ${"half a second before"}
  `("names $n/$d days for $seconds s ($why)", ({ seconds, n, d }) => {
    expect(namesDays(epochDaysOfJ2000Seconds(seconds), n, d)).toBe(true);
  });
});

describe("readsBackInDomain", () => {
  const days = (numerator: bigint, denominator: bigint) => ({
    numerator,
    denominator,
  });

  it.each`
    n                                     | d              | scale    | expected | why
    ${730n}                               | ${1n}          | ${"UTC"} | ${true}  | ${"1972-01-01T00:00:00Z itself"}
    ${729n}                               | ${1n}          | ${"UTC"} | ${false} | ${"1971-12-31, before the floor"}
    ${5_865_793n}                         | ${2n}          | ${"UTC"} | ${true}  | ${"noon of 9999-12-31"}
    ${2_932_897n}                         | ${1n}          | ${"UTC"} | ${false} | ${"10000-01-01"}
    ${730n * 86_400n}                     | ${86_400n}     | ${"TAI"} | ${false} | ${"TAI label 00:00:00 is before the first UTC second"}
    ${730n * 86_400n + 10n}               | ${86_400n}     | ${"TAI"} | ${true}  | ${"TAI label 00:00:10 is 1972-01-01T00:00:00Z"}
    ${730n * 86_400_000n + 42_183n}       | ${86_400_000n} | ${"TT"}  | ${false} | ${"one millisecond before the TT label of the floor"}
    ${730n * 86_400_000n + 42_184n}       | ${86_400_000n} | ${"TT"}  | ${true}  | ${"the TT label of the floor, 00:00:42.184"}
    ${730n}                               | ${1n}          | ${"TCG"} | ${false} | ${"TCG label 1972-01-01T00:00:00 is before the floor"}
    ${731n}                               | ${1n}          | ${"TCG"} | ${true}  | ${"a day later"}
    ${2_932_896n}                         | ${1n}          | ${"TAI"} | ${true}  | ${"the TAI label 9999-12-31T00:00:00"}
    ${2_932_897n * 86_400_000n + 69_183n} | ${86_400_000n} | ${"TT"}  | ${true}  | ${"the TT label 1 ms before 10000-01-01T00:00:00Z is 9999-12-31T23:59:59.999Z"}
    ${2_932_897n * 86_400_000n + 69_184n} | ${86_400_000n} | ${"TT"}  | ${false} | ${"the TT label of 10000-01-01T00:00:00Z, 00:01:09.184"}
    ${10n ** 300n}                        | ${1n}          | ${"UTC"} | ${false} | ${"far outside"}
  `(
    "is $expected for $n/$d days on $scale ($why)",
    ({ n, d, scale, expected }) => {
      expect(readsBackInDomain(days(n, d), LEAP_SECOND_STEPS, scale)).toBe(
        expected,
      );
    },
  );
});
