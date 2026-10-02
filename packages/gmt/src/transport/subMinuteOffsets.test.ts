import {
  bestAvailable,
  classifyPunctuality,
  crossingTime,
  cutoffAt,
  cutoffSchedule,
  dwellTime,
  estimateDrift,
  etaAtZone,
  isPastCutoff,
  nextDeparture,
  punctualityRate,
  scheduleDelivery,
  scheduleDeviation,
  timeToCutoff,
  transitTime,
} from "./index";

/**
 * A zoned string whose zone has a sub-minute UTC offset, read by every transport function.
 *
 * `Temporal.ZonedDateTime.prototype.toString` writes the offset rounded to the minute
 * (FormatDateTimeUTCOffsetRounded), so a zoned string GMT writes for such a zone carries an
 * offset up to 30 seconds from the real one. TC39 `ToTemporalZonedDateTime` reads it back with
 * match-minutes: an offset written without seconds matches a candidate whose real offset rounds
 * to it (`InterpretISODateTimeOffset`), so the string names the instant it was written from (the
 * one exception, a repeated wall time inside a sub-minute offset change, is pinned in
 * `test/minuteRoundedOffsets.test.ts`).
 * `Temporal.Instant.from` takes the written offset literally and lands up to 30 seconds away.
 *
 * Every expected value below is derived from the zone's real offset in the IANA database and
 * checked against a plain `Temporal.ZonedDateTime.from(zoned).toInstant()`:
 *
 * - Africa/Monrovia stood at −00:44:30 until 7 January 1972, written `-00:45`:
 *   00:20:00 local is 01:04:30Z (literal reading: 01:05:00Z, 30 seconds late).
 * - America/New_York stood at −04:56:02 until noon on 18 November 1883, written `-04:56`:
 *   09:00:00 local is 13:56:02Z (literal reading: 13:56:00Z, 2 seconds early).
 *
 * `between` is an instant strictly between the real moment and the literal reading.
 */
describe("transport functions read a minute-rounded offset as its zone's real offset", () => {
  const cases = it.each`
    zone                  | zoned                                            | instant                   | utc                                 | gap        | earlierZoned                                     | earlierInstant            | laterInstant              | laterZoned                                       | laterUtc                            | between
    ${"Africa/Monrovia"}  | ${"1960-01-01T00:20:00-00:45[Africa/Monrovia]"}  | ${"1960-01-01T01:04:30Z"} | ${"1960-01-01T01:04:30+00:00[UTC]"} | ${"PT20M"} | ${"1960-01-01T00:00:00-00:45[Africa/Monrovia]"}  | ${"1960-01-01T00:44:30Z"} | ${"1960-01-01T01:24:30Z"} | ${"1960-01-01T00:40:00-00:45[Africa/Monrovia]"}  | ${"1960-01-01T01:24:30+00:00[UTC]"} | ${"1960-01-01T01:04:45Z"}
    ${"America/New_York"} | ${"1883-11-18T09:00:00-04:56[America/New_York]"} | ${"1883-11-18T13:56:02Z"} | ${"1883-11-18T13:56:02+00:00[UTC]"} | ${"PT1H"}  | ${"1883-11-18T08:00:00-04:56[America/New_York]"} | ${"1883-11-18T12:56:02Z"} | ${"1883-11-18T14:56:02Z"} | ${"1883-11-18T10:00:00-04:56[America/New_York]"} | ${"1883-11-18T14:56:02+00:00[UTC]"} | ${"1883-11-18T13:56:01Z"}
  `;

  cases(
    "scheduleDeviation measures $zoned from its real instant $instant",
    ({ zoned, instant, gap, earlierInstant }) => {
      expect(scheduleDeviation(instant, zoned)).toBe("PT0S");
      expect(scheduleDeviation(zoned, instant)).toBe("PT0S");
      expect(scheduleDeviation(earlierInstant, zoned)).toBe(gap);
    },
  );

  cases(
    "classifyPunctuality calls $zoned on time against $instant under a one-second tolerance",
    ({ zoned, instant }) => {
      const tolerance = { late: "PT1S", early: "PT1S" };
      expect(classifyPunctuality(instant, zoned, tolerance)).toBe("onTime");
      expect(classifyPunctuality(zoned, instant, tolerance)).toBe("onTime");
    },
  );

  cases(
    "punctualityRate counts $zoned against $instant as on time",
    ({ zoned, instant }) => {
      expect(
        punctualityRate(
          [
            { planned: instant, actual: zoned },
            { planned: zoned, actual: instant },
          ],
          { late: "PT1S", early: "PT1S" },
        ),
      ).toEqual({ onTime: 2, total: 2, rate: 1 });
    },
  );

  cases(
    "bestAvailable orders a record at $zoned against one at $between by the real instant",
    ({ zoned, instant, between }) => {
      const atZoned = "2000-01-01T00:00:00Z";
      const atBetween = "2000-01-02T00:00:00Z";
      // The newest record wins: whichever of the real instant and `between` is later.
      const newest = instant > between ? atZoned : atBetween;
      expect(
        bestAvailable([
          { classifier: "ACT", at: atZoned, recordedAt: zoned },
          { classifier: "ACT", at: atBetween, recordedAt: between },
        ]),
      ).toEqual({ at: newest, classifier: "ACT" });
      expect(
        bestAvailable([
          { classifier: "ACT", at: atBetween, recordedAt: between },
          { classifier: "ACT", at: atZoned, recordedAt: zoned },
        ]),
      ).toEqual({ at: newest, classifier: "ACT" });
    },
  );

  cases(
    "estimateDrift measures an estimate revised from $earlierInstant to $zoned as $gap",
    ({ zoned, gap, earlierInstant }) => {
      expect(
        estimateDrift([
          {
            classifier: "EST",
            at: earlierInstant,
            recordedAt: "2000-01-01T00:00:00Z",
          },
          { classifier: "EST", at: zoned, recordedAt: "2000-01-02T00:00:00Z" },
        ]),
      ).toEqual({
        first: earlierInstant,
        last: zoned,
        drift: gap,
        revisions: 2,
        exceedsTolerance: null,
      });
    },
  );

  cases(
    "timeToCutoff and isPastCutoff read a cut-off at $zoned as $instant",
    ({ zoned, instant, gap, earlierInstant, between }) => {
      expect(timeToCutoff(earlierInstant, zoned)).toBe(gap);
      expect(timeToCutoff(instant, zoned)).toBe("PT0S");
      // Half-open: at the cut-off itself the window has closed.
      expect(isPastCutoff(instant, zoned)).toBe(true);
      expect(isPastCutoff(zoned, instant)).toBe(true);
      // `between` is past the cut-off exactly when it is after the real instant.
      expect(isPastCutoff(between, zoned)).toBe(between > instant);
      expect(isPastCutoff(zoned, between)).toBe(instant > between);
    },
  );

  cases(
    "etaAtZone renders $zoned as $utc, and in $zone as itself",
    ({ zone, zoned, utc }) => {
      expect(etaAtZone(zoned, "UTC")).toBe(utc);
      expect(etaAtZone(zoned, zone)).toBe(zoned);
    },
  );

  cases(
    "crossingTime measures $zoned to $laterInstant as $gap",
    ({ zoned, utc, gap, laterInstant, laterUtc }) => {
      expect(crossingTime(zoned, laterInstant, "UTC")).toEqual({
        duration: gap,
        enter: utc,
        exit: laterUtc,
      });
    },
  );

  cases(
    "dwellTime measures $zoned to $laterInstant as $gap and echoes the entry",
    ({ zone, zoned, gap, laterInstant, laterZoned }) => {
      const dwell = {
        duration: gap,
        enter: zoned,
        exit: laterZoned,
        calendarDays: 1,
      };
      expect(dwellTime(zoned, laterInstant)).toEqual(dwell);
      expect(dwellTime(zoned, laterZoned, zone)).toEqual(dwell);
    },
  );

  cases(
    "cutoffAt and cutoffSchedule count $gap back from $zoned to $earlierZoned",
    ({ zone, zoned, gap, earlierZoned }) => {
      expect(cutoffAt(zoned, gap, { timeZone: zone })).toBe(earlierZoned);
      expect(
        cutoffSchedule(zoned, [{ name: "gate-in", offset: gap }], {
          timeZone: zone,
        }),
      ).toEqual([{ name: "gate-in", at: earlierZoned }]);
    },
  );

  // GMT's own output is the next GMT function's input: the string one function writes must name
  // the same instant in the next. `from` is written with the zone's exact offset, so its instant
  // is unambiguous under every reading.
  it.each`
    from                                                | after                                               | to                                                  | headway    | departure                                        | instant                   | gap
    ${"1960-01-01T00:00:00-00:44:30[Africa/Monrovia]"}  | ${"1960-01-01T00:10:00-00:44:30[Africa/Monrovia]"}  | ${"1960-01-01T05:00:00-00:44:30[Africa/Monrovia]"}  | ${"PT20M"} | ${"1960-01-01T00:20:00-00:45[Africa/Monrovia]"}  | ${"1960-01-01T01:04:30Z"} | ${"PT20M"}
    ${"1883-11-18T08:00:00-04:56:02[America/New_York]"} | ${"1883-11-18T08:30:00-04:56:02[America/New_York]"} | ${"1883-11-18T11:00:00-04:56:02[America/New_York]"} | ${"PT1H"}  | ${"1883-11-18T09:00:00-04:56[America/New_York]"} | ${"1883-11-18T13:56:02Z"} | ${"PT1H"}
  `(
    "nextDeparture's $departure and transitTime's arrival name $instant in the next function",
    ({ from, after, to, headway, departure, instant, gap }) => {
      const next = nextDeparture(after, { headway, from, to });
      expect(next).toBe(departure);
      expect(transitTime(from, gap)).toBe(departure);

      expect(scheduleDeviation(from, next)).toBe(gap);
      expect(classifyPunctuality(instant, next, { late: "PT1S" })).toBe(
        "onTime",
      );
      expect(classifyPunctuality(next, instant, { late: "PT1S" })).toBe(
        "onTime",
      );
      expect(timeToCutoff(from, next)).toBe(gap);
      expect(isPastCutoff(instant, next)).toBe(true);
      expect(dwellTime(from, next)?.duration).toBe(gap);
      expect(dwellTime(from, next)?.exit).toBe(departure);
      // A second hop from the written string lands one more headway on, not 30 seconds off.
      expect(nextDeparture(next, { headway, from, to })).toBe(departure);
      expect(
        scheduleDelivery([
          { departure: next, duration: "PT0S", timeZone: "UTC" },
        ])?.legTimes[0]?.arrival,
      ).toBe(instant);
    },
  );

  // Africa/Monrovia moved from −00:44:30 to +00:00 at 1972-01-07T00:44:30Z. Counting back from
  // 01:00:00Z, PT15M40S is 00:44:20Z (23:59:50 at −00:44:30, written `-00:45`) and PT15M20S is
  // 00:44:40Z (00:44:40 at +00:00). Read literally the first is 00:44:50Z and sorts last.
  it("cutoffSchedule sorts cut-offs either side of Monrovia's 1972 transition by real instant", () => {
    expect(
      cutoffSchedule(
        "1972-01-07T01:00:00Z",
        [
          { name: "after the change", offset: "PT15M20S" },
          { name: "before the change", offset: "PT15M40S" },
        ],
        { timeZone: "Africa/Monrovia" },
      ),
    ).toEqual([
      {
        name: "before the change",
        at: "1972-01-06T23:59:50-00:45[Africa/Monrovia]",
      },
      {
        name: "after the change",
        at: "1972-01-07T00:44:40+00:00[Africa/Monrovia]",
      },
    ]);
  });
});

/**
 * Everything else reads as before: the written offset fixes the instant.
 *
 * - No bracket: nothing names a zone, so `-00:45` is −00:45:00 (01:05:00Z).
 * - An offset written with seconds is matched exactly (TC39 `ToTemporalZonedDateTime`:
 *   match-exactly when the offset has a seconds part), so `-00:45:00[Africa/Monrovia]` is not
 *   Monrovia's −00:44:30 and stays −00:45:00.
 * - A bracket whose zone does not exist, or whose offset is neither the zone's offset nor its
 *   rounded form (`-00:44` for −00:44:30), is not read by the instant readers.
 */
describe("transport instant readers keep the written offset in every other case", () => {
  it.each`
    value                                              | instant                   | why
    ${"1960-01-01T00:20:00-00:45"}                     | ${"1960-01-01T01:05:00Z"} | ${"no bracket"}
    ${"1960-01-01T00:20:00-00:44:30[Africa/Monrovia]"} | ${"1960-01-01T01:04:30Z"} | ${"the zone's exact offset"}
    ${"1960-01-01T00:20:00-00:45:00[Africa/Monrovia]"} | ${"1960-01-01T01:05:00Z"} | ${"an offset with seconds is matched exactly"}
    ${"1960-01-01T00:20:00-00:44[Africa/Monrovia]"}    | ${"1960-01-01T01:04:00Z"} | ${"an offset that is not the zone's rounded offset"}
    ${"1960-01-01T00:20:00-00:45[Not/AZone]"}          | ${"1960-01-01T01:05:00Z"} | ${"a zone that does not exist"}
    ${"1960-01-01T00:20:00-00:45[Europe/London]"}      | ${"1960-01-01T01:05:00Z"} | ${"a zone the offset contradicts"}
    ${"1960-01-01T00:20:00-00:45[-00:45]"}             | ${"1960-01-01T01:05:00Z"} | ${"an offset zone"}
    ${"2024-06-15T10:00:00-04:00[America/New_York]"}   | ${"2024-06-15T14:00:00Z"} | ${"a whole-minute zone"}
    ${"2024-06-15T10:00:00-05:00[America/New_York]"}   | ${"2024-06-15T15:00:00Z"} | ${"a whole-minute zone the offset contradicts"}
  `("read $value as $instant ($why)", ({ value, instant }) => {
    expect(scheduleDeviation(instant, value)).toBe("PT0S");
    expect(
      classifyPunctuality(instant, value, { late: "PT1S", early: "PT1S" }),
    ).toBe("onTime");
    expect(timeToCutoff(instant, value)).toBe("PT0S");
    expect(etaAtZone(value, "UTC")).toBe(`${instant.slice(0, -1)}+00:00[UTC]`);
    expect(
      estimateDrift([
        { classifier: "EST", at: instant, recordedAt: "2000-01-01T00:00:00Z" },
        { classifier: "EST", at: value, recordedAt: "2000-01-02T00:00:00Z" },
      ])?.drift,
    ).toBe("PT0S");
  });
});
