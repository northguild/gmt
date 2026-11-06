import {
  compareDurations,
  normalizeDuration,
  totalDuration,
} from "../duration";
import {
  diffUnix,
  diffUnixAsDuration,
  formatRelativeUnix,
  intervalLengthUnix,
} from "../unix";
import { formatRelativeUtc } from "../utc";
import {
  diffZoned,
  diffZonedAsDuration,
  formatRelativeZoned,
  intervalLengthZoned,
} from "../zoned";

/**
 * A length in days or larger measured from either pass of a repeated hour.
 *
 * A zoned `relativeTo` or start can name either pass of a repeated hour. TC39 `ComputeNudgeWindow`
 * starts the window at the origin's own exact time when no unit has been added
 * (tc39/proposal-temporal #3148, #3149, and tc39/ecma262#3759 commit `1f4e6717ef23` for the condition),
 * and `DifferenceZonedDateTime` subtracts the two exact times when both fall on one local date
 * (#3141). `temporal-polyfill` 1.0.8 gets the origin right, but where TC39 has no value it answers one. A polyfill that did neither would, from the later pass, turn the wall clock back
 * into an exact time with `"compatible"`, which takes the earlier pass, so the origin moves an hour
 * early. From the earlier pass, an end in the later pass at a lower wall clock on the same date makes
 * it back up a day it should never have left, which reads as `-P2D` or throws.
 *
 * Every expected value is worked out by hand from those rules and checked against `Temporal` in
 * Chromium 153.0.8010.12, native V8, never the polyfill and never GMT. New York repeats 01:00-02:00
 * on 2024-11-03: from the later pass the next day is 24 hours away and from the earlier pass 25, a
 * week is 168 and 169 hours, a year is 8760 and 8761, and one month on is 720 and 721.
 */
const LATER = "2024-11-03T01:30:00-05:00[America/New_York]";
const EARLIER = "2024-11-03T01:30:00-04:00[America/New_York]";
// Half an hour after EARLIER: the later pass, at a lower wall clock than EARLIER on the same date.
const BACKWARD_END = "2024-11-03T01:00:00-05:00[America/New_York]";

describe("totalDuration from a repeated hour", () => {
  it.each`
    duration   | unit         | relativeTo | total
    ${"PT0S"}  | ${"days"}    | ${LATER}   | ${0}
    ${"PT1S"}  | ${"days"}    | ${LATER}   | ${0.000011574074074074073}
    ${"PT1H"}  | ${"days"}    | ${LATER}   | ${0.041666666666666664}
    ${"P1D"}   | ${"weeks"}   | ${LATER}   | ${0.14285714285714285}
    ${"P1M"}   | ${"years"}   | ${LATER}   | ${0.0821917808219178}
    ${"PT1H"}  | ${"months"}  | ${LATER}   | ${1 / 720}
    ${"-PT1H"} | ${"days"}    | ${LATER}   | ${-1 / 25}
    ${"-P1D"}  | ${"days"}    | ${LATER}   | ${-1}
    ${"P1D"}   | ${"days"}    | ${LATER}   | ${1}
    ${"PT25H"} | ${"days"}    | ${LATER}   | ${1 + 1 / 24}
    ${"PT0S"}  | ${"days"}    | ${EARLIER} | ${0}
    ${"PT1S"}  | ${"days"}    | ${EARLIER} | ${1 / 90000}
    ${"PT1H"}  | ${"days"}    | ${EARLIER} | ${1 / 25}
    ${"P1D"}   | ${"weeks"}   | ${EARLIER} | ${25 / 169}
    ${"P1M"}   | ${"years"}   | ${EARLIER} | ${721 / 8761}
    ${"PT1H"}  | ${"seconds"} | ${LATER}   | ${3600}
    ${"PT1H"}  | ${"minutes"} | ${LATER}   | ${60}
    ${"P1D"}   | ${"hours"}   | ${LATER}   | ${24}
    ${"P1D"}   | ${"seconds"} | ${LATER}   | ${86400}
    ${"PT30M"} | ${"days"}    | ${EARLIER} | ${1 / 50}
    ${"PT45M"} | ${"days"}    | ${EARLIER} | ${3 / 100}
    ${"PT30M"} | ${"weeks"}   | ${EARLIER} | ${1 / 338}
    ${"PT30M"} | ${"months"}  | ${EARLIER} | ${1 / 1442}
    ${"PT30M"} | ${"years"}   | ${EARLIER} | ${1 / 17522}
  `(
    "$duration from $relativeTo is $total $unit",
    ({ duration, unit, relativeTo, total }) => {
      expect(totalDuration(duration, unit, { relativeTo })).toBe(total);
    },
  );

  // Lord Howe repeats half an hour, Paris an hour in the east, São Paulo's repeat runs across
  // midnight, and a calendar annotation changes nothing about which pass the origin is.
  it.each`
    relativeTo
    ${"2024-04-07T01:45:00+10:30[Australia/Lord_Howe]"}
    ${"2026-10-25T02:30:00+01:00[Europe/Paris]"}
    ${"2018-02-17T23:30:00-03:00[America/Sao_Paulo]"}
    ${"2024-11-03T01:30:00-05:00[America/New_York][u-ca=gregory]"}
  `("PT1H from $relativeTo is 1/24 of a day", ({ relativeTo }) => {
    expect(totalDuration("PT1H", "days", { relativeTo })).toBe(1 / 24);
  });

  it("reads a date-time outside any repeated hour as it always did", () => {
    expect(
      totalDuration("PT1H", "days", {
        relativeTo: "2024-06-15T12:00:00-04:00[America/New_York]",
      }),
    ).toBe(1 / 24);
  });
});

describe("normalizeDuration from a repeated hour", () => {
  // No repeated hour in either origin. js-temporal `main` (`3c403686d39`) answers P1W1D from both:
  // it tests r1 = 0 where tc39/ecma262#3759 commit `1f4e6717ef23` tests for an empty start duration.
  const UTC = "2024-11-01T00:00:00+00:00[UTC]";
  const ORDINARY = "2024-06-01T12:00:00-04:00[America/New_York]";

  // From the later pass 11:45 of a 24-hour day, 83:45 of a 168-hour week and 359:45 of a 720-hour
  // month are all under half, so they round to zero. From the earlier pass P1D is 25 hours, which
  // makes the same durations 84:45 of 169 hours and 360:45 of 721 hours: over half, so a whole unit.
  it.each`
    duration         | options                                                                | relativeTo  | rounded
    ${"PT11H45M"}    | ${{ smallestUnit: "day" }}                                             | ${LATER}    | ${"PT0S"}
    ${"PT0S"}        | ${{ smallestUnit: "day", roundingMode: "ceil" }}                       | ${LATER}    | ${"PT0S"}
    ${"PT1H"}        | ${{ smallestUnit: "day", roundingMode: "ceil" }}                       | ${LATER}    | ${"P1D"}
    ${"P3DT11H45M"}  | ${{ smallestUnit: "week" }}                                            | ${LATER}    | ${"PT0S"}
    ${"P14DT23H45M"} | ${{ smallestUnit: "month" }}                                           | ${LATER}    | ${"PT0S"}
    ${"PT1S"}        | ${{ largestUnit: "day", smallestUnit: "hour", roundingMode: "trunc" }} | ${LATER}    | ${"PT0S"}
    ${"PT1H"}        | ${{ largestUnit: "day" }}                                              | ${LATER}    | ${"PT1H"}
    ${"-PT1H"}       | ${{ largestUnit: "day" }}                                              | ${LATER}    | ${"-PT1H"}
    ${"P7D"}         | ${{ largestUnit: "week", smallestUnit: "day" }}                        | ${LATER}    | ${"P1W"}
    ${"P1Y2D"}       | ${{ largestUnit: "year", smallestUnit: "month" }}                      | ${LATER}    | ${"P1Y"}
    ${"PT11H45M"}    | ${{ smallestUnit: "day" }}                                             | ${EARLIER}  | ${"PT0S"}
    ${"P7D"}         | ${{ largestUnit: "week", smallestUnit: "day" }}                        | ${EARLIER}  | ${"P1W"}
    ${"P3DT11H45M"}  | ${{ smallestUnit: "week" }}                                            | ${EARLIER}  | ${"P1W"}
    ${"P14DT23H45M"} | ${{ smallestUnit: "month" }}                                           | ${EARLIER}  | ${"P1M"}
    ${"PT30M"}       | ${{ largestUnit: "day" }}                                              | ${EARLIER}  | ${"PT30M"}
    ${"PT30M"}       | ${{ smallestUnit: "day" }}                                             | ${EARLIER}  | ${"PT0S"}
    ${"P7D"}         | ${{ largestUnit: "week", smallestUnit: "day" }}                        | ${UTC}      | ${"P1W"}
    ${"P7D"}         | ${{ largestUnit: "week", smallestUnit: "day" }}                        | ${ORDINARY} | ${"P1W"}
  `(
    "$duration with $options from $relativeTo is $rounded",
    ({ duration, options, relativeTo, rounded }) => {
      expect(normalizeDuration(duration, { ...options, relativeTo })).toBe(
        rounded,
      );
    },
  );
});

describe("compareDurations from a repeated hour", () => {
  // Duration.compare adds both durations to the origin and compares the exact times. It builds no
  // window, so it never moved the origin: P1D is 24 hours from the later pass and 25 from the earlier.
  it.each`
    one      | two        | relativeTo | sign
    ${"P1D"} | ${"PT24H"} | ${LATER}   | ${0}
    ${"P1D"} | ${"PT24H"} | ${EARLIER} | ${1}
    ${"P1D"} | ${"PT25H"} | ${EARLIER} | ${0}
  `(
    "$one against $two from $relativeTo is $sign",
    ({ one, two, relativeTo, sign }) => {
      expect(compareDurations(one, two, { relativeTo })).toBe(sign);
    },
  );
});

describe("differences from a repeated hour", () => {
  const PLUS_1_HOUR = "2024-11-03T02:30:00-05:00[America/New_York]";
  const PLUS_1_SECOND = "2024-11-03T01:30:01-05:00[America/New_York]";
  const PLUS_11H45 = "2024-11-03T13:15:00-05:00[America/New_York]";
  const EPOCH_MS_LATER = 1730615400000; // 2024-11-03T06:30:00Z
  const EPOCH_MS_PLUS_1_HOUR = 1730619000000; // 2024-11-03T07:30:00Z
  const EPOCH_MS_PLUS_11H45 = 1730657700000; // 2024-11-03T18:15:00Z
  const NEW_YORK = { timeZone: "America/New_York" };

  it.each`
    end              | units                  | options                                                | difference
    ${PLUS_1_HOUR}   | ${["days", "hours"]}   | ${undefined}                                           | ${{ days: 0, hours: 1 }}
    ${PLUS_1_SECOND} | ${["days", "seconds"]} | ${undefined}                                           | ${{ days: 0, seconds: 1 }}
    ${PLUS_11H45}    | ${"days"}              | ${{ smallestUnit: "day", roundingMode: "halfExpand" }} | ${0}
    ${PLUS_1_HOUR}   | ${"hours"}             | ${undefined}                                           | ${1}
    ${EARLIER}       | ${["days", "hours"]}   | ${undefined}                                           | ${{ days: 0, hours: -1 }}
  `(
    "diffZoned from the later pass to $end in $units with $options is $difference",
    ({ end, units, options, difference }) => {
      expect(diffZoned(LATER, end, units, options)).toEqual(difference);
    },
  );

  it("diffZoned from the earlier pass counts the hour it repeats", () => {
    expect(diffZoned(EARLIER, LATER, ["days", "hours"])).toEqual({
      days: 0,
      hours: 1,
    });
  });

  it.each`
    end              | total
    ${PLUS_1_HOUR}   | ${1 / 24}
    ${PLUS_1_SECOND} | ${1 / 86400}
    ${LATER}         | ${0}
  `(
    "intervalLengthZoned from the later pass to $end is $total days",
    ({ end, total }) => {
      expect(intervalLengthZoned(LATER, end, "days")).toBe(total);
    },
  );

  it("diffZonedAsDuration measures an hour from the later pass", () => {
    expect(diffZonedAsDuration(LATER, PLUS_1_HOUR, "days")).toBe("PT1H");
  });

  it("diffUnix in a zone measures an hour from the later pass", () => {
    expect(
      diffUnix(
        EPOCH_MS_LATER,
        EPOCH_MS_PLUS_1_HOUR,
        ["days", "hours"],
        NEW_YORK,
      ),
    ).toEqual({ days: 0, hours: 1 });
  });

  it("diffUnix in a zone rounds 11:45 of a 24-hour day down", () => {
    expect(
      diffUnix(EPOCH_MS_LATER, EPOCH_MS_PLUS_11H45, "days", {
        ...NEW_YORK,
        smallestUnit: "day",
        roundingMode: "halfExpand",
      }),
    ).toBe(0);
  });

  it("diffUnix in UTC has no repeated hour to measure from", () => {
    expect(
      diffUnix(EPOCH_MS_LATER, EPOCH_MS_PLUS_1_HOUR, ["days", "hours"]),
    ).toEqual({ days: 0, hours: 1 });
  });

  it("diffUnixAsDuration in a zone measures an hour from the later pass", () => {
    expect(
      diffUnixAsDuration(
        EPOCH_MS_LATER,
        EPOCH_MS_PLUS_1_HOUR,
        "days",
        NEW_YORK,
      ),
    ).toBe("PT1H");
  });

  it("intervalLengthUnix in a zone is 1/24 of a day from the later pass", () => {
    expect(
      intervalLengthUnix(
        EPOCH_MS_LATER,
        EPOCH_MS_PLUS_1_HOUR,
        "days",
        NEW_YORK,
      ),
    ).toBe(1 / 24);
  });
});

describe("an end in the later pass at a lower wall clock on the same date", () => {
  // TC39 DifferenceZonedDateTime: both exact times fall on one local date, so the difference is their
  // subtraction with no date part. The window then runs from the origin's own exact time to the next
  // date at the origin's wall clock, which falls after the repeat. New York: E + 30 minutes = B.
  const EPOCH_MS_EARLIER = 1730611800000; // 2024-11-03T05:30:00Z
  const EPOCH_MS_END = 1730613600000; // 2024-11-03T06:00:00Z
  const NEW_YORK = { timeZone: "America/New_York" };

  it.each`
    units                  | difference
    ${"days"}              | ${0}
    ${["days", "minutes"]} | ${{ days: 0, minutes: 30 }}
  `("diffZoned in $units is $difference", ({ units, difference }) => {
    expect(diffZoned(EARLIER, BACKWARD_END, units)).toEqual(difference);
  });

  it("diffZoned the other way is the same half hour, signed", () => {
    expect(diffZoned(BACKWARD_END, EARLIER, ["days", "minutes"])).toEqual({
      days: 0,
      minutes: -30,
    });
  });

  it("diffZonedAsDuration is PT30M", () => {
    expect(diffZonedAsDuration(EARLIER, BACKWARD_END, "day")).toBe("PT30M");
  });

  it("intervalLengthZoned is 30 minutes of a 25-hour day", () => {
    expect(intervalLengthZoned(EARLIER, BACKWARD_END, "day")).toBe(1 / 50);
  });

  it("diffUnix in a zone is 0 days", () => {
    expect(
      diffUnix(EPOCH_MS_EARLIER, EPOCH_MS_END, "days", {
        epochUnit: "milliseconds",
        ...NEW_YORK,
      }),
    ).toBe(0);
  });

  it("diffUnix in a zone counts the 30 minutes", () => {
    expect(
      diffUnix(EPOCH_MS_EARLIER, EPOCH_MS_END, ["days", "minutes"], {
        epochUnit: "milliseconds",
        ...NEW_YORK,
      }),
    ).toEqual({ days: 0, minutes: 30 });
  });

  it("diffUnixAsDuration in a zone is PT30M", () => {
    expect(
      diffUnixAsDuration(EPOCH_MS_EARLIER, EPOCH_MS_END, "days", {
        epochUnit: "milliseconds",
        ...NEW_YORK,
      }),
    ).toBe("PT30M");
  });

  it("intervalLengthUnix in a zone is 30 minutes of a 25-hour day", () => {
    expect(
      intervalLengthUnix(EPOCH_MS_EARLIER, EPOCH_MS_END, "days", {
        epochUnit: "milliseconds",
        ...NEW_YORK,
      }),
    ).toBe(1 / 50);
  });

  it("-PT30M from the later pass reaches the earlier pass, 30 minutes of a 25-hour day", () => {
    expect(totalDuration("-PT30M", "days", { relativeTo: BACKWARD_END })).toBe(
      -1 / 50,
    );
  });

  // Each zone falls back at its own hour, so the next date at the origin's wall clock is one repeat
  // longer than a plain day. Lord Howe repeats half an hour: 15 minutes of 24.5 hours is 1/98.
  describe.each`
    start                                               | end                                                 | duration   | minutes | total
    ${"2026-10-25T02:30:00+02:00[Europe/Paris]"}        | ${"2026-10-25T02:00:00+01:00[Europe/Paris]"}        | ${"PT30M"} | ${30}   | ${1 / 50}
    ${"2018-02-17T23:30:00-02:00[America/Sao_Paulo]"}   | ${"2018-02-17T23:00:00-03:00[America/Sao_Paulo]"}   | ${"PT30M"} | ${30}   | ${1 / 50}
    ${"2024-11-03T00:30:00-04:00[America/Havana]"}      | ${"2024-11-03T00:00:00-05:00[America/Havana]"}      | ${"PT30M"} | ${30}   | ${1 / 50}
    ${"2011-04-02T03:30:00-10:00[Pacific/Apia]"}        | ${"2011-04-02T03:00:00-11:00[Pacific/Apia]"}        | ${"PT30M"} | ${30}   | ${1 / 50}
    ${"2024-04-07T01:45:00+11:00[Australia/Lord_Howe]"} | ${"2024-04-07T01:30:00+10:30[Australia/Lord_Howe]"} | ${"PT15M"} | ${15}   | ${1 / 98}
  `("from $start to $end", ({ start, end, duration, minutes, total }) => {
    it("totalDuration in days", () => {
      expect(totalDuration(duration, "days", { relativeTo: start })).toBe(
        total,
      );
    });

    it("normalizeDuration with a largestUnit of day keeps the time", () => {
      expect(
        normalizeDuration(duration, { largestUnit: "day", relativeTo: start }),
      ).toBe(duration);
    });

    it("normalizeDuration with a smallestUnit of day rounds to zero", () => {
      expect(
        normalizeDuration(duration, { smallestUnit: "day", relativeTo: start }),
      ).toBe("PT0S");
    });

    it("diffZoned in days is 0", () => {
      expect(diffZoned(start, end, "days")).toBe(0);
    });

    it("diffZoned in days and minutes counts the time", () => {
      expect(diffZoned(start, end, ["days", "minutes"])).toEqual({
        days: 0,
        minutes,
      });
    });

    it("diffZonedAsDuration keeps the time", () => {
      expect(diffZonedAsDuration(start, end, "day")).toBe(duration);
    });

    it("intervalLengthZoned in days", () => {
      expect(intervalLengthZoned(start, end, "day")).toBe(total);
    });
  });
});

describe("formatRelative from a repeated hour", () => {
  // Only a forced month or year reads the anchor. 359:30 of the 720 hours from the later pass is
  // under half, so it rounds to zero; 360:30 of the 721 hours from the earlier pass is exactly half,
  // which rounds up. Both end at the same instant, 2024-11-18T06:00:00Z.
  const FORCED = { largestUnit: "month", numeric: "always" } as const;
  const END_UTC = "2024-11-18T06:00:00Z";
  const END_EPOCH_MS = 1731909600000; // END_UTC
  const END_ZONED = "2024-11-18T01:00:00-05:00[America/New_York]";
  const LATER_UTC = "2024-11-03T06:30:00Z";
  const EARLIER_UTC = "2024-11-03T05:30:00Z";
  const NEW_YORK = "America/New_York";

  it.each`
    reference  | text
    ${LATER}   | ${"in 0 months"}
    ${EARLIER} | ${"in 1 month"}
  `("formatRelativeZoned from $reference is '$text'", ({ reference, text }) => {
    expect(
      formatRelativeZoned(END_ZONED, "en-US", { ...FORCED, reference }),
    ).toBe(text);
  });

  it.each`
    reference      | text
    ${LATER_UTC}   | ${"in 0 months"}
    ${EARLIER_UTC} | ${"in 1 month"}
  `(
    "formatRelativeUtc in New York from $reference is '$text'",
    ({ reference, text }) => {
      expect(
        formatRelativeUtc(END_UTC, "en-US", {
          ...FORCED,
          reference,
          timeZone: NEW_YORK,
        }),
      ).toBe(text);
    },
  );

  it.each`
    reference      | text
    ${LATER_UTC}   | ${"in 0 months"}
    ${EARLIER_UTC} | ${"in 1 month"}
  `(
    "formatRelativeUnix in New York from $reference is '$text'",
    ({ reference, text }) => {
      expect(
        formatRelativeUnix(END_EPOCH_MS, "en-US", {
          ...FORCED,
          reference,
          timeZone: NEW_YORK,
        }),
      ).toBe(text);
    },
  );
});
