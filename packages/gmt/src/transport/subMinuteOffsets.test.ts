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
 * A moment in a zone with a sub-minute UTC offset, read by every transport function.
 *
 * `Temporal.ZonedDateTime.prototype.toString` writes the offset rounded to the minute
 * (FormatDateTimeUTCOffsetRounded), so a zoned string GMT writes for such a zone carries an
 * offset up to 30 seconds from the real one. TC39 `ToTemporalZonedDateTime` reads it back with
 * match-minutes: an offset written without seconds matches a candidate whose real offset rounds
 * to it (`InterpretISODateTimeOffset`), so the string names the instant it was written from (the
 * one exception, a repeated wall time inside a sub-minute offset change, is pinned in
 * `test/minuteRoundedOffsets.test.ts`).
 *
 * The functions that keep a zone (`dwellTime`, `nextDeparture`, `transitTime`,
 * `scheduleDelivery`) read that zoned string. The instant readers read `…Z` or `…±HH:MM[:SS]`
 * and nothing after it, so a sub-minute offset is written in full there and a bracketed string
 * is rejected.
 *
 * Every expected value below is derived from the zone's real offset in the IANA database and
 * checked against a plain `Temporal.ZonedDateTime.from(zoned).toInstant()`:
 *
 * - Africa/Monrovia stood at −00:44:30 until 7 January 1972, written `-00:45`:
 *   00:20:00 local is 01:04:30Z.
 * - America/New_York stood at −04:56:02 until noon on 18 November 1883, written `-04:56`:
 *   09:00:00 local is 13:56:02Z.
 *
 * `between` is an instant strictly between the real moment and the minute-rounded reading.
 */
describe("transport functions read a minute-rounded offset as its zone's real offset", () => {
  const cases = it.each`
    zone                  | zoned                                            | exact                             | instant                   | utc                                 | gap        | earlierZoned                                     | earlierInstant            | laterInstant              | laterZoned                                       | laterUtc                            | between
    ${"Africa/Monrovia"}  | ${"1960-01-01T00:20:00-00:45[Africa/Monrovia]"}  | ${"1960-01-01T00:20:00-00:44:30"} | ${"1960-01-01T01:04:30Z"} | ${"1960-01-01T01:04:30+00:00[UTC]"} | ${"PT20M"} | ${"1960-01-01T00:00:00-00:45[Africa/Monrovia]"}  | ${"1960-01-01T00:44:30Z"} | ${"1960-01-01T01:24:30Z"} | ${"1960-01-01T00:40:00-00:45[Africa/Monrovia]"}  | ${"1960-01-01T01:24:30+00:00[UTC]"} | ${"1960-01-01T01:04:45Z"}
    ${"America/New_York"} | ${"1883-11-18T09:00:00-04:56[America/New_York]"} | ${"1883-11-18T09:00:00-04:56:02"} | ${"1883-11-18T13:56:02Z"} | ${"1883-11-18T13:56:02+00:00[UTC]"} | ${"PT1H"}  | ${"1883-11-18T08:00:00-04:56[America/New_York]"} | ${"1883-11-18T12:56:02Z"} | ${"1883-11-18T14:56:02Z"} | ${"1883-11-18T10:00:00-04:56[America/New_York]"} | ${"1883-11-18T14:56:02+00:00[UTC]"} | ${"1883-11-18T13:56:01Z"}
  `;

  cases(
    "scheduleDeviation measures $exact from its real instant $instant",
    ({ exact, instant, gap, earlierInstant }) => {
      expect(scheduleDeviation(instant, exact)).toBe("PT0S");
      expect(scheduleDeviation(exact, instant)).toBe("PT0S");
      expect(scheduleDeviation(earlierInstant, exact)).toBe(gap);
    },
  );

  cases(
    "classifyPunctuality calls $exact on time against $instant under a one-second tolerance",
    ({ exact, instant }) => {
      const tolerance = { late: "PT1S", early: "PT1S" };
      expect(classifyPunctuality(instant, exact, tolerance)).toBe("onTime");
      expect(classifyPunctuality(exact, instant, tolerance)).toBe("onTime");
    },
  );

  cases(
    "punctualityRate counts $exact against $instant as on time",
    ({ exact, instant }) => {
      expect(
        punctualityRate(
          [
            { planned: instant, actual: exact },
            { planned: exact, actual: instant },
          ],
          { late: "PT1S", early: "PT1S" },
        ),
      ).toEqual({ onTime: 2, total: 2, rate: 1 });
    },
  );

  cases(
    "bestAvailable orders a record at $exact against one at $between by the real instant",
    ({ exact, instant, between }) => {
      const atZoned = "2000-01-01T00:00:00Z";
      const atBetween = "2000-01-02T00:00:00Z";
      // The newest record wins: whichever of the real instant and `between` is later.
      const newest = instant > between ? atZoned : atBetween;
      expect(
        bestAvailable([
          { classifier: "ACT", at: atZoned, recordedAt: exact },
          { classifier: "ACT", at: atBetween, recordedAt: between },
        ]),
      ).toEqual({ at: newest, classifier: "ACT" });
      expect(
        bestAvailable([
          { classifier: "ACT", at: atBetween, recordedAt: between },
          { classifier: "ACT", at: atZoned, recordedAt: exact },
        ]),
      ).toEqual({ at: newest, classifier: "ACT" });
    },
  );

  cases(
    "estimateDrift measures an estimate revised from $earlierInstant to $exact as $gap",
    ({ exact, gap, earlierInstant }) => {
      expect(
        estimateDrift([
          {
            classifier: "EST",
            at: earlierInstant,
            recordedAt: "2000-01-01T00:00:00Z",
          },
          { classifier: "EST", at: exact, recordedAt: "2000-01-02T00:00:00Z" },
        ]),
      ).toEqual({
        first: earlierInstant,
        last: exact,
        drift: gap,
        revisions: 2,
        exceedsTolerance: null,
      });
    },
  );

  cases(
    "timeToCutoff and isPastCutoff read a cut-off at $zoned as $instant",
    ({ zoned, exact, instant, gap, earlierInstant, between }) => {
      expect(timeToCutoff(earlierInstant, zoned)).toBe(gap);
      expect(timeToCutoff(instant, zoned)).toBe("PT0S");
      // Half-open: at the cut-off itself the window has closed.
      expect(isPastCutoff(instant, zoned)).toBe(true);
      expect(isPastCutoff(exact, zoned)).toBe(true);
      // `between` is past the cut-off exactly when it is after the real instant.
      expect(isPastCutoff(between, zoned)).toBe(between > instant);
      // A cut-off is zoned only: the same moment written as a bare offset is refused.
      expect(timeToCutoff(earlierInstant, exact)).toBe("");
      expect(isPastCutoff(instant, exact)).toBe(false);
    },
  );

  cases(
    "etaAtZone renders $exact as $utc, and in $zone as $zoned",
    ({ zone, zoned, exact, utc }) => {
      expect(etaAtZone(exact, "UTC")).toBe(utc);
      expect(etaAtZone(exact, zone)).toBe(zoned);
    },
  );

  cases(
    "crossingTime measures $exact to $laterInstant as $gap",
    ({ exact, utc, gap, laterInstant, laterUtc }) => {
      expect(crossingTime(exact, laterInstant, "UTC")).toEqual({
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
    "cutoffAt and cutoffSchedule count $gap back from $exact to $earlierZoned",
    ({ zone, exact, gap, earlierZoned }) => {
      expect(cutoffAt(exact, gap, { timeZone: zone })).toBe(earlierZoned);
      expect(
        cutoffSchedule(exact, [{ name: "gate-in", offset: gap }], {
          timeZone: zone,
        }),
      ).toEqual([{ name: "gate-in", at: earlierZoned }]);
    },
  );

  // GMT's own output is the next GMT function's input: the string one function writes must name
  // the same instant in each function that keeps a zone. `from` is written with the zone's exact offset, so its instant
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

      // The instant readers take no bracket, so the written string is not theirs to read
      // (a cutoff, below, takes a bracket and nothing else).
      expect(scheduleDeviation(instant, next)).toBe("");
      expect(classifyPunctuality(instant, next, { late: "PT1S" })).toBeNull();
      // A cutoff keeps its zone, so `cutoffAt`'s own output reads: the same instant, no time left.
      expect(timeToCutoff(instant, next)).toBe("PT0S");
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
 * The instant readers take the written offset literally, and nothing after it.
 *
 * - No bracket: nothing names a zone, so `-00:45` is −00:45:00 (01:05:00Z).
 * - An offset written with seconds is that offset: `-00:44:30` is 01:04:30Z and `-00:45:00` is
 *   01:05:00Z.
 * - Any bracket, a real zone or not, is rejected, with the rounded offset of a sub-minute zone
 *   as with any other.
 */
describe("transport instant readers keep the written offset and reject a bracket", () => {
  it.each`
    value                             | instant                   | why
    ${"1960-01-01T00:20:00-00:45"}    | ${"1960-01-01T01:05:00Z"} | ${"no bracket"}
    ${"1960-01-01T00:20:00-00:44:30"} | ${"1960-01-01T01:04:30Z"} | ${"the zone's exact offset"}
    ${"1960-01-01T00:20:00-00:45:00"} | ${"1960-01-01T01:05:00Z"} | ${"an offset with seconds"}
    ${"1960-01-01T00:20:00-00:44"}    | ${"1960-01-01T01:04:00Z"} | ${"a whole-minute offset"}
    ${"2024-06-15T10:00:00-04:00"}    | ${"2024-06-15T14:00:00Z"} | ${"a whole-minute zone's offset"}
  `("read $value as $instant ($why)", ({ value, instant }) => {
    expect(scheduleDeviation(instant, value)).toBe("PT0S");
    expect(
      classifyPunctuality(instant, value, { late: "PT1S", early: "PT1S" }),
    ).toBe("onTime");
    // A cut-off is zoned only, so a bare offset is not one.
    expect(timeToCutoff(instant, value)).toBe("");
    expect(etaAtZone(value, "UTC")).toBe(`${instant.slice(0, -1)}+00:00[UTC]`);
    expect(
      estimateDrift([
        { classifier: "EST", at: instant, recordedAt: "2000-01-01T00:00:00Z" },
        { classifier: "EST", at: value, recordedAt: "2000-01-02T00:00:00Z" },
      ])?.drift,
    ).toBe("PT0S");
  });

  it.each`
    value
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia]"}
    ${"1960-01-01T00:20:00-00:44:30[Africa/Monrovia]"}
    ${"1960-01-01T00:20:00-00:45[Not/AZone]"}
    ${"1960-01-01T00:20:00-00:45[-00:45]"}
    ${"2024-06-15T10:00:00-04:00[America/New_York]"}
  `("reject $value because of its bracket", ({ value }) => {
    const instant = "1960-01-01T01:05:00Z";
    expect(scheduleDeviation(instant, value)).toBe("");
    expect(classifyPunctuality(instant, value, { late: "PT1S" })).toBeNull();
    expect(timeToCutoff(value, instant)).toBe("");
    expect(isPastCutoff(value, instant)).toBe(false);
    expect(etaAtZone(value, "UTC")).toBe("");
  });
});
