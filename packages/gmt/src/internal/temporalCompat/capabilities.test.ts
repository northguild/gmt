import {
  anyReproFails,
  isCalendarArithmeticCompatNeeded,
  isDefectPresent,
  isIsoCalendarCaseCompatNeeded,
  isRangeDayPeriodCompatNeeded,
  isRangeZoneNameCompatNeeded,
  isTimeZoneEqualsCompatNeeded,
  reproPasses,
  runRepro,
} from "./capabilities";
import {
  calendarFieldsOf,
  polyfillCannotReturn,
  polyfillMisreadsIslamicEra,
} from "./calendarFields";
import { Temporal } from "../temporal";
import { probeRepros } from "./probeRepros";
import { type DefectId, findRepro, repros } from "./repros";

// Probe tests never assert the probe's outcome against the installed polyfill: that would fail CI
// the day upstream ships the fix, which is the canary's job (temporalCompat README, "Canary and native oracle"). They pin the
// spec-correct expected constants to their quoted sources, and show that the output polyfill 0.5.1
// was recorded producing (`q2-spec-probe*-0.5.1.txt`) reads as "defect present".
describe("repros", () => {
  // test262 intl402/Temporal/PlainDate/from/extreme-dates.js rows, as ISO dates.
  it.each`
    calendar              | name           | expected
    ${"hebrew"}           | ${"fieldsMax"} | ${"+275760-09-13"}
    ${"hebrew"}           | ${"fieldsMin"} | ${"-271821-04-19"}
    ${"buddhist"}         | ${"fieldsMax"} | ${"+275760-09-13"}
    ${"buddhist"}         | ${"fieldsMin"} | ${"-271821-04-19"}
    ${"islamic-civil"}    | ${"fieldsMax"} | ${"+275760-09-13"}
    ${"islamic-civil"}    | ${"fieldsMin"} | ${"-271821-04-19"}
    ${"islamic-tbla"}     | ${"fieldsMax"} | ${"+275760-09-13"}
    ${"islamic-tbla"}     | ${"fieldsMin"} | ${"-271821-04-19"}
    ${"islamic-umalqura"} | ${"fieldsMax"} | ${"+275760-09-13"}
    ${"islamic-umalqura"} | ${"fieldsMin"} | ${"-271821-04-19"}
    ${"persian"}          | ${"fieldsMax"} | ${"+275760-09-13"}
    ${"persian"}          | ${"fieldsMin"} | ${"-271821-04-19"}
    ${"indian"}           | ${"fieldsMax"} | ${"+275760-09-13"}
    ${"indian"}           | ${"fieldsMin"} | ${"-271821-04-19"}
    ${"ethioaa"}          | ${"fieldsMax"} | ${"+275760-09-13"}
    ${"ethioaa"}          | ${"fieldsMin"} | ${"-271821-04-19"}
  `(
    "D1 $name for $calendar expects the test262 edge $expected",
    ({ calendar, name, expected }) => {
      expect(findRepro("D1", calendar, name)?.expected).toBe(expected);
    },
  );

  // D10 (tc39/proposal-temporal#3329): fields -> ISO across a 5-day month 13 in a far year, where
  // a fixed 8-day search step skips the month. Chromium 153 native Temporal: ethioaa 18196 (coptic
  // 12420 + 5776) month 13 day 1 is +012704-11-26, and month 12 day 30 the day before.
  it.each`
    calendar     | name                  | expected
    ${"ethioaa"} | ${"fieldsFarMonth13"} | ${"+012704-11-26"}
    ${"ethioaa"} | ${"fieldsFarMonth12"} | ${"+012704-11-25"}
  `(
    "D10 $name for $calendar expects Chromium's $expected",
    ({ calendar, name, expected }) => {
      expect(findRepro("D10", calendar, name)?.expected).toBe(expected);
    },
  );

  // Reads are `year|monthCode|day` (D8: `era|eraYear`; D3: `monthsInYear`).
  it.each`
    defect  | calendar      | name               | expected            | source
    ${"D2"} | ${"buddhist"} | ${"1000-01-01"}    | ${"1543|M01|1"}     | ${"Intl era/monthCode proposal: buddhist is proleptic, ISO year + 543; Chromium 152"}
    ${"D2"} | ${"buddhist"} | ${"1582-10-04"}    | ${"2125|M10|4"}     | ${"same; a day ICU4C's Julian cutover moves"}
    ${"D3"} | ${"hebrew"}   | ${"-100000-01-01"} | ${"12"}             | ${"year -96239: (7*-96239+1) mod 19 = 11 >= 7, common"}
    ${"D4"} | ${"hebrew"}   | ${"-271821-11-05"} | ${"-268057|M05|28"} | ${"Chromium 152 + Dershowitz-Reingold oracle"}
    ${"D4"} | ${"hebrew"}   | ${"-003761-09-01"} | ${"0|M01|13"}       | ${"Chromium 152"}
    ${"D5"} | ${"indian"}   | ${"-000500-06-15"} | ${"-578|M03|25"}    | ${"Chromium 152"}
    ${"D8"} | ${"japanese"} | ${"1800-01-01"}    | ${"ce|1800"}        | ${"test262 japanese-pre-meiji.js; Chromium 152"}
    ${"D8"} | ${"japanese"} | ${"1872-12-31"}    | ${"ce|1872"}        | ${"proposal table-eras: ce ends 1872; Chromium 152"}
    ${"D8"} | ${"japanese"} | ${"0000-12-31"}    | ${"bce|1"}          | ${"proposal table-eras; Chromium 152"}
  `(
    "$defect $name for $calendar expects $expected ($source)",
    ({ defect, calendar, name, expected }) => {
      expect(findRepro(defect as DefectId, calendar, name)?.expected).toBe(
        expected,
      );
    },
  );

  // D1 in arithmetic: Chromium 152 (q2-xscan-chromium152.json). until(+275760-07-01, max) in
  // months is edge.max[74][6]; add/subtract are edge.buddhist.max[366][3] and
  // edge["islamic-civil"].min[400][5].
  it.each`
    calendar              | name                 | expected
    ${"hebrew"}           | ${"untilNearMax"}    | ${"P2M15D"}
    ${"buddhist"}         | ${"untilNearMax"}    | ${"P2M12D"}
    ${"islamic-civil"}    | ${"untilNearMax"}    | ${"P2M15D"}
    ${"islamic-tbla"}     | ${"untilNearMax"}    | ${"P2M15D"}
    ${"islamic-umalqura"} | ${"untilNearMax"}    | ${"P2M15D"}
    ${"persian"}          | ${"untilNearMax"}    | ${"P2M12D"}
    ${"indian"}           | ${"untilNearMax"}    | ${"P2M12D"}
    ${"ethioaa"}          | ${"untilNearMax"}    | ${"P2M14D"}
    ${"buddhist"}         | ${"addNearMax"}      | ${"+275760-09-13"}
    ${"islamic-civil"}    | ${"subtractNearMin"} | ${"-271821-06-03"}
    ${"hebrew"}           | ${"relativeTo"}      | ${"P1M10D"}
  `(
    "D1 $name for $calendar expects Chromium's $expected",
    ({ calendar, name, expected }) => {
      expect(findRepro("D1", calendar, name)?.expected).toBe(expected);
    },
  );

  // D6: test262 wrapping-at-end-of-month-{hebrew,ethioaa}.js; the others are Chromium 152 grid rows,
  // and gregory is Chromium 153 (gregory joined CalendarSystem in CORE-8).
  // D7 mixedSign: Chromium 152 grid, ISO 2024-02-11 + 384 days by years.
  // D7 leapMonthEnd: Chromium and NonISODateSurpasses (unconstrained day 30 > 29), per
  // js-temporal-polyfill-bugs.md § C (C-D7b).
  it.each`
    defect  | calendar              | name              | expected
    ${"D6"} | ${"buddhist"}         | ${"monthEnd"}     | ${"P30D"}
    ${"D6"} | ${"gregory"}          | ${"monthEnd"}     | ${"P30D"}
    ${"D6"} | ${"japanese"}         | ${"monthEnd"}     | ${"P30D"}
    ${"D6"} | ${"roc"}              | ${"monthEnd"}     | ${"P30D"}
    ${"D6"} | ${"persian"}          | ${"monthEnd"}     | ${"P30D"}
    ${"D6"} | ${"indian"}           | ${"monthEnd"}     | ${"P30D"}
    ${"D6"} | ${"islamic-civil"}    | ${"monthEnd"}     | ${"P29D"}
    ${"D6"} | ${"islamic-tbla"}     | ${"monthEnd"}     | ${"P29D"}
    ${"D6"} | ${"islamic-umalqura"} | ${"monthEnd"}     | ${"P29D"}
    ${"D6"} | ${"hebrew"}           | ${"monthEnd"}     | ${"P29D"}
    ${"D6"} | ${"ethioaa"}          | ${"monthEnd"}     | ${"P7D"}
    ${"D7"} | ${"hebrew"}           | ${"mixedSign"}    | ${"P12M29D"}
    ${"D7"} | ${"hebrew"}           | ${"leapMonthEnd"} | ${"P12M29D"}
  `(
    "$defect $name for $calendar expects $expected",
    ({ defect, calendar, name, expected }) => {
      expect(findRepro(defect as DefectId, calendar, name)?.expected).toBe(
        expected,
      );
    },
  );

  // Zoned repros (upstream-issue drafts A, B, D; zoned.E is js-temporal#372). Chromium 153 native
  // Temporal; the min.* rows are the minimum edge that polyfill 05ce7a3 does not fix.
  it.each`
    defect       | name                            | expected
    ${"zoned.A"} | ${"max.parseSydney"}            | ${"+275760-09-13T09:00:00+10:00[Australia/Sydney]"}
    ${"zoned.A"} | ${"max.untilSydney"}            | ${"P1D"}
    ${"zoned.A"} | ${"max.sinceSydneyYears"}       | ${"-P3DT5H"}
    ${"zoned.A"} | ${"max.untilKiritimati"}        | ${"P1D"}
    ${"zoned.A"} | ${"max.totalSydney"}            | ${"2.0416666666666665"}
    ${"zoned.A"} | ${"max.compareSydney"}          | ${"-1"}
    ${"zoned.A"} | ${"min.parseNewYork"}           | ${"-271821-04-19T20:00:00-04:56[America/New_York]"}
    ${"zoned.A"} | ${"min.toZonedDateTimeNewYork"} | ${"-271821-04-19T20:00:00-04:56[America/New_York]"}
    ${"zoned.A"} | ${"min.untilNewYork"}           | ${"-P1D"}
    ${"zoned.A"} | ${"min.untilHonolulu"}          | ${"-P1D"}
    ${"zoned.B"} | ${"max.nextTransition"}         | ${"+275760-09-07T01:00:00-03:00[America/Santiago]"}
    ${"zoned.B"} | ${"max.startOfDaySantiago"}     | ${"+275760-09-07T01:00:00-03:00[America/Santiago]"}
    ${"zoned.B"} | ${"max.hoursInDaySantiago"}     | ${"23"}
    ${"zoned.D"} | ${"max.untilUtcRounded"}        | ${"RangeError"}
    ${"zoned.D"} | ${"max.totalUtc"}               | ${"RangeError"}
    ${"zoned.E"} | ${"pre1847.nextManila"}         | ${"1845-01-01T00:00:00+08:04[Asia/Manila]"}
    ${"zoned.E"} | ${"pre1847.previousManila"}     | ${"1845-01-01T00:00:00+08:04[Asia/Manila]"}
    ${"zoned.E"} | ${"pre1847.previousGuam"}       | ${"1845-01-01T00:00:00+09:39[Pacific/Guam]"}
    ${"zoned.E"} | ${"pre1847.hoursInDayManila"}   | ${"24"}
    ${"zoned.E"} | ${"pre1847.startOfDayManila"}   | ${"1845-01-01T00:00:00+08:04[Asia/Manila]"}
  `(
    "$defect $name expects Chromium's $expected",
    ({ defect, name, expected }) => {
      expect(findRepro(defect, "iso8601", name)?.expected).toBe(expected);
    },
  );

  // D13: TC39 `GetNamedTimeZoneNextTransition` / `…PreviousTransition` and `GetStartOfDay`, as
  // Node 26.10.0's native Temporal and `zdump -v` (tz 2026c) give them. America/Boa_Vista changes
  // at 2000-10-08T04:00Z and 2000-10-15T03:00Z; Europe/Riga at 1944-10-02T01:00Z; Europe/Simferopol
  // at 1944-04-03T01:00Z.
  it.each`
    name                         | expected
    ${"skip.nextBoaVista"}       | ${"2000-10-08T01:00:00-03:00[America/Boa_Vista]"}
    ${"skip.previousBoaVista"}   | ${"2000-10-14T23:00:00-04:00[America/Boa_Vista]"}
    ${"skip.startOfDayBoaVista"} | ${"2000-10-08T01:00:00-03:00[America/Boa_Vista]"}
    ${"skip.hoursInDayNoronha"}  | ${"23"}
    ${"stall.nextRiga"}          | ${"1944-10-02T02:00:00+01:00[Europe/Riga]"}
    ${"stall.nextSimferopol"}    | ${"1944-04-03T03:00:00+02:00[Europe/Simferopol]"}
  `("D13 $name expects native Temporal's $expected", ({ name, expected }) => {
    expect(findRepro("D13", "iso8601", name)?.expected).toBe(expected);
  });

  // Both alignments of Africa/El_Aaiun 1976: −01:00 → +00:00 at 1976-04-14T01:00:00Z, then
  // +00:00 → +01:00 at 1976-05-01T00:00:00Z (zdump and Node 26.10.0's native Temporal).
  it.each`
    name
    ${"stall.nextElAaiun 1976-04-14T00:30:00Z"}
    ${"stall.nextElAaiun 1976-03-28T00:30:00Z"}
  `("D13 $name expects native Temporal's first 1976 change", ({ name }) => {
    expect(findRepro("D13", "iso8601", name)?.expected).toBe(
      "1976-04-14T01:00:00+00:00[Africa/El_Aaiun]",
    );
  });

  // A runtime that fixes every other D13 case and still stalls in Africa/El_Aaiun (js-temporal
  // main with a79c6a1 alone). The other repros are made to return their expected value, and the
  // El_Aaiun ones the bounded-read error a stalled search gives.
  it.each`
    failing                                       | expected | label
    ${[]}                                         | ${false} | ${"no repro"}
    ${["stall.nextElAaiun 1976-04-14T00:30:00Z"]} | ${true}  | ${"El_Aaiun 1976-04-14"}
    ${["stall.nextElAaiun 1976-03-28T00:30:00Z"]} | ${true}  | ${"El_Aaiun 1976-03-28"}
    ${["skip.nextBoaVista"]}                      | ${true}  | ${"skip.nextBoaVista"}
  `(
    "reports D13 present: $expected when only $label fail",
    ({ failing, expected }) => {
      const candidates = repros
        .filter((repro) => repro.defect === "D13")
        .map((repro) => ({
          ...repro,
          run: () =>
            (failing as string[]).includes(repro.name)
              ? "ERR RangeError: more than 20000 offset reads"
              : repro.expected,
        }));

      expect(candidates).toHaveLength(8);
      expect(anyReproFails(candidates, "D13", "iso8601")).toBe(expected);
    },
  );

  it("puts every D13 repro that cannot stall before the ones that can", () => {
    const names = repros
      .filter((repro) => repro.defect === "D13")
      .map((repro) => repro.name);
    const firstStall = names.findIndex((name) => name.startsWith("stall."));

    expect(firstStall).toBeGreaterThan(0);
    expect(
      names.slice(firstStall).every((name) => name.startsWith("stall.")),
    ).toBe(true);
  });

  // D12: test262 intl402/Temporal/ZonedDateTime/from/zoneddatetime-sub-minute-offset.js. "rounded
  // HH:MM:SS not accepted in string offset (offset=reject)" for -00:45:00[Africa/Monrovia], and
  // "-11:20:00 is accepted as -11:20:00 in the Pacific/Niue edge case": reference
  // -543069621_000_000_000n plus 20_000_000_000n.
  it.each`
    name                        | expected
    ${"roundedSecondsRejected"} | ${"RangeError"}
    ${"exactSecondsSecondPass"} | ${"-543069601000000000"}
  `("D12 $name expects test262's $expected", ({ name, expected }) => {
    expect(findRepro("D12", "iso8601", name)?.expected).toBe(expected);
  });

  // D14: test262 intl402/Temporal/ZonedDateTime/prototype/round/same-date-starts-twice.js: with
  // trunc, 2010-03-04T23:10+08:00 (the second pass of that date) gives the date's first midnight.
  it("D14 dayRoundClamp expects test262's first midnight of the date", () => {
    expect(findRepro("D14", "iso8601", "dayRoundClamp")?.expected).toBe(
      "2010-03-04T00:00:00+11:00[Antarctica/Casey]",
    );
  });

  // D15: ToTemporalZonedDateTime sets offsetBehaviour ~exact~ for a UTC designator and
  // InterpretISODateTimeOffset applies "ignore" only to ~option~, so the Z string's own instant
  // survives offset: "ignore" (2022-07-08T00:14:07Z is the string's instant).
  it("D15 zIgnoreIsExact expects the string's own instant", () => {
    expect(findRepro("D15", "iso8601", "zIgnoreIsExact")?.expected).toBe(
      "2022-07-08T00:14:07Z",
    );
  });

  // D9: 1,200 months from M03 day 5. Persian: 12 months in every year (Intl era/monthCode proposal
  // §4.1.4 Table 3), so 100 years. Hebrew: the Dershowitz–Reingold count floor((235y − 234) / 19)
  // lands on 5881 ordinal 3, a common year.
  it.each`
    calendar     | name             | expected
    ${"persian"} | ${"addMonths"}   | ${"1502|M03|5"}
    ${"persian"} | ${"untilMonths"} | ${"P1200M"}
    ${"hebrew"}  | ${"addMonths"}   | ${"5881|M03|5"}
    ${"hebrew"}  | ${"untilMonths"} | ${"P1200M"}
  `(
    "D9 $name for $calendar expects $expected",
    ({ calendar, name, expected }) => {
      expect(findRepro("D9", calendar, name)?.expected).toBe(expected);
    },
  );

  it("keeps a minimum-edge zoned.A probe, which polyfill 05ce7a3 alone does not fix", () => {
    const zonedA = repros.filter((repro) => repro.defect === "zoned.A");
    expect(zonedA.some((repro) => repro.name.startsWith("min."))).toBe(true);
    expect(zonedA.some((repro) => repro.name.startsWith("max."))).toBe(true);
  });

  it("has exactly one repro per defect, calendar and name", () => {
    const keys = repros.map((r) => `${r.defect}/${r.calendar}/${r.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("reproPasses", () => {
  // The recorded polyfill 0.5.1 + Node ICU 78.3 output for each repro reads as "defect present".
  it.each`
    defect       | calendar           | name                          | recorded
    ${"D1"}      | ${"hebrew"}        | ${"fieldsMax"}                | ${"ERR RangeError: Invalid ISO date: +275760-09-19T00:00Z"}
    ${"D1"}      | ${"islamic-civil"} | ${"fieldsMin"}                | ${"ERR RangeError: Invalid ISO date: -271821-01-01T00:00Z"}
    ${"D1"}      | ${"persian"}       | ${"fieldsMin"}                | ${"ERR RangeError: Invalid ISO date: -271821-01-01T00:00Z"}
    ${"D2"}      | ${"buddhist"}      | ${"1000-01-01"}               | ${"1542|M12|27"}
    ${"D2"}      | ${"buddhist"}      | ${"1582-10-04"}               | ${"2125|M09|24"}
    ${"D3"}      | ${"hebrew"}        | ${"-100000-01-01"}            | ${"ERR RangeError: Missing month converting"}
    ${"D4"}      | ${"hebrew"}        | ${"-271821-11-05"}            | ${"-268057|M05|27"}
    ${"D4"}      | ${"hebrew"}        | ${"-003761-09-01"}            | ${"0|M01|12"}
    ${"D5"}      | ${"indian"}        | ${"-000500-06-15"}            | ${"ERR RangeError: calendar 'indian' is broken"}
    ${"D8"}      | ${"japanese"}      | ${"1800-01-01"}               | ${"japanese|1800"}
    ${"D8"}      | ${"japanese"}      | ${"1872-12-31"}               | ${"meiji|5"}
    ${"D8"}      | ${"japanese"}      | ${"0000-12-31"}               | ${"japanese-inverse|1"}
    ${"D1"}      | ${"hebrew"}        | ${"untilNearMax"}             | ${"ERR RangeError: Invalid ISO date: +275760-09-27T00:00Z"}
    ${"D1"}      | ${"buddhist"}      | ${"addNearMax"}               | ${"ERR RangeError: Invalid ISO date: +275760-10-14T00:00Z"}
    ${"D1"}      | ${"islamic-civil"} | ${"subtractNearMin"}          | ${"ERR RangeError: Invalid ISO date: -271821-01-01T00:00Z"}
    ${"D1"}      | ${"hebrew"}        | ${"relativeTo"}               | ${"ERR RangeError: Invalid ISO date: +275760-09-17T00:00Z"}
    ${"D6"}      | ${"buddhist"}      | ${"monthEnd"}                 | ${"P1M"}
    ${"D6"}      | ${"hebrew"}        | ${"monthEnd"}                 | ${"P1M"}
    ${"D6"}      | ${"ethioaa"}       | ${"monthEnd"}                 | ${"P1M"}
    ${"D7"}      | ${"hebrew"}        | ${"mixedSign"}                | ${"ERR RangeError: mixed-sign values not allowed as duration fields"}
    ${"D7"}      | ${"hebrew"}        | ${"leapMonthEnd"}             | ${"P1Y"}
    ${"zoned.A"} | ${"iso8601"}       | ${"max.untilSydney"}          | ${"ERR RangeError: Invalid time value"}
    ${"zoned.A"} | ${"iso8601"}       | ${"min.untilNewYork"}         | ${"ERR RangeError: date/time value is outside the supported range"}
    ${"zoned.B"} | ${"iso8601"}       | ${"max.nextTransition"}       | ${"null"}
    ${"zoned.B"} | ${"iso8601"}       | ${"max.hoursInDaySantiago"}   | ${"ERR TypeError: Cannot read properties of null (reading 'sign')"}
    ${"zoned.D"} | ${"iso8601"}       | ${"max.untilUtcRounded"}      | ${"returned P3DT5H"}
    ${"zoned.D"} | ${"iso8601"}       | ${"max.totalUtc"}             | ${"returned 2.0416666666666665"}
    ${"zoned.E"} | ${"iso8601"}       | ${"pre1847.nextManila"}       | ${"1899-09-06T12:00:00+08:00[Asia/Manila]"}
    ${"zoned.E"} | ${"iso8601"}       | ${"pre1847.previousManila"}   | ${"null"}
    ${"zoned.E"} | ${"iso8601"}       | ${"pre1847.previousGuam"}     | ${"null"}
    ${"zoned.E"} | ${"iso8601"}       | ${"pre1847.hoursInDayManila"} | ${"479340.06444444443"}
    ${"zoned.E"} | ${"iso8601"}       | ${"pre1847.startOfDayManila"} | ${"1899-09-06T12:00:00+08:00[Asia/Manila]"}
    ${"D12"}     | ${"iso8601"}       | ${"roundedSecondsRejected"}   | ${"45870000000000"}
    ${"D12"}     | ${"iso8601"}       | ${"exactSecondsSecondPass"}   | ${"-543069621000000000"}
    ${"D13"}     | ${"iso8601"}       | ${"skip.nextBoaVista"}        | ${"null"}
    ${"D13"}     | ${"iso8601"}       | ${"skip.startOfDayBoaVista"}  | ${"ERR TypeError: Cannot read properties of null (reading 'sign')"}
    ${"D13"}     | ${"iso8601"}       | ${"skip.hoursInDayNoronha"}   | ${"-8881"}
    ${"D13"}     | ${"iso8601"}       | ${"stall.nextRiga"}           | ${"ERR RangeError: more than 20000 offset reads"}
    ${"D14"}     | ${"iso8601"}       | ${"dayRoundClamp"}            | ${"2010-03-05T00:00:00+11:00[Antarctica/Casey]"}
    ${"D15"}     | ${"iso8601"}       | ${"zIgnoreIsExact"}           | ${"2022-07-07T23:14:07Z"}
    ${"D9"}      | ${"persian"}       | ${"addMonths"}                | ${"1328 Intl reads for 1200 months"}
    ${"D9"}      | ${"hebrew"}        | ${"untilMonths"}              | ${"1518 Intl reads for 1200 months"}
  `(
    "reads the recorded 0.5.1 output $recorded for $defect $name ($calendar) as the defect",
    ({ defect, calendar, name, recorded }) => {
      const repro = findRepro(defect, calendar, name);
      expect(repro).toBeDefined();
      expect(reproPasses(repro!, recorded)).toBe(false);
      expect(reproPasses(repro!, repro!.expected)).toBe(true);
    },
  );
});

describe("runRepro", () => {
  it("turns a throwing repro into an ERR line instead of propagating", () => {
    const output = runRepro({
      run: () => {
        throw new RangeError("boom");
      },
    });
    expect(output).toBe("ERR RangeError: boom");
    expect(reproPasses({ expected: "+275760-09-13" }, output)).toBe(false);
  });
});

describe("isDefectPresent", () => {
  it("reports no defect for a calendar that has no repro", () => {
    expect(isDefectPresent("D2", "hebrew")).toBe(false);
  });
});

// Only the outcomes that hold on every runtime are pinned: whether a non-ISO calendar
// needs the compat layer is the installed polyfill's business.
describe("isCalendarArithmeticCompatNeeded", () => {
  it.each`
    calendar     | reason
    ${"iso8601"} | ${"iso8601 never takes the compat layer"}
    ${"chinese"} | ${"a calendar id with no repro has no defect to work around"}
  `("returns false for $calendar ($reason)", ({ calendar }) => {
    expect(isCalendarArithmeticCompatNeeded(calendar)).toBe(false);
  });
});

describe("repro split", () => {
  // DefectId (D1-D8, D10-D20) is the type the shipped probes can ask about; the canary-only
  // groups are ZonedDefectId (zoned.*) and BoundedWorkDefectId (D9, D21).
  const probeDefects = new Set([
    "D1",
    "D2",
    "D3",
    "D4",
    "D5",
    "D6",
    "D7",
    "D8",
    "D10",
    "D11",
    "D12",
    "D13",
    "D14",
    "D15",
    "D16",
    "D17",
    "D18",
    "D19",
    "D20",
  ]);

  it("holds every probe-defect repro of the full table in probeRepros", () => {
    const expected = repros.filter((repro) => probeDefects.has(repro.defect));

    expect(expected.length).toBeGreaterThan(0);
    expect(probeRepros).toHaveLength(expected.length);
    const probes = new Set<unknown>(probeRepros);
    expect(expected.every((repro) => probes.has(repro))).toBe(true);
  });

  it("holds no zoned.*, D9 or D21 repro in probeRepros", () => {
    const canaryOnly = probeRepros.filter(
      (repro) => !probeDefects.has(repro.defect),
    );

    expect(canaryOnly).toEqual([]);
  });
});

// D16: UTS #35 (Matching Skeletons) expects the skeleton and pattern fields to be adjusted in
// parallel, so a range keeps the requested zone name width. The probe compares the engine's range zone part with its own single format, so it owns no
// CLDR string; ICU-20548 is the reason V8 and JSC fail it for every style but short.
describe("D16 range zone name probe", () => {
  const styles = [
    "short",
    "long",
    "shortGeneric",
    "longGeneric",
    "shortOffset",
    "longOffset",
  ] as const;

  it.each(styles.map((style) => ({ style })))(
    "has a range.$style repro that returns same or names both parts",
    ({ style }) => {
      const repro = findRepro("D16", "iso8601", `range.${style}`);
      expect(repro?.expected).toBe("same");
      expect(runRepro(repro!)).toMatch(/^same$|^range .* vs single /);
    },
  );

  it("returns same for range.short on every host", () => {
    expect(runRepro(findRepro("D16", "iso8601", "range.short")!)).toBe("same");
  });

  it("reports false for a style it has no repro for", () => {
    expect(isRangeZoneNameCompatNeeded("not-a-style")).toBe(false);
  });

  it("answers the same on a second call without running the repro again", () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "formatRangeToParts");
    try {
      const first = isRangeZoneNameCompatNeeded("longOffset");
      const runs = spy.mock.calls.length;
      expect(isRangeZoneNameCompatNeeded("longOffset")).toBe(first);
      expect(spy.mock.calls.length).toBe(runs);
    } finally {
      spy.mockRestore();
    }
  });
});

// D17: ECMA-402 §11.5.8 picks the range pattern by the resolved [[HourCycle]] only, so a range
// with and without an explicit h12 cannot differ in the day period it prints; the flexible day
// periods of a range ("in the morning", "noon") are expected to equal the two single formats'.
// Firefox 155 prints AM and PM in the range when the hour cycle is omitted.
describe("D17 range day period probe", () => {
  it("expects the range's day period parts to equal the single formats'", () => {
    expect(findRepro("D17", "iso8601", "range.dayPeriod")?.expected).toBe(
      "same",
    );
  });

  it("returns same or names both sides", () => {
    expect(runRepro(findRepro("D17", "iso8601", "range.dayPeriod")!)).toMatch(
      /^same$|^range .* vs single /,
    );
  });

  it("reads the recorded Firefox 155 output as the defect", () => {
    const repro = findRepro("D17", "iso8601", "range.dayPeriod")!;
    expect(
      reproPasses(
        repro,
        'range ["AM","PM"] vs single ["in the morning","noon"]',
      ),
    ).toBe(false);
  });

  it("answers the same on a second call", () => {
    expect(isRangeDayPeriodCompatNeeded()).toBe(isRangeDayPeriodCompatNeeded());
  });
});

// D18: the Intl era/monthCode proposal numbers an Islamic calendar's years through the epoch
// (`bh` era year n is year 1 - n), and Temporal's `year` is that number. WebKit prints a date
// before the Hijra as a positive year in a second era and polyfill 0.5.1 takes it as printed,
// so ISO 0621-01-01 reads as year 2. Expected values are Node 26.12.1's native Temporal.
describe("D18 Islamic era probe", () => {
  it.each`
    calendar              | iso             | expected
    ${"islamic-civil"}    | ${"0621-01-01"} | ${"-1|M05|28"}
    ${"islamic-civil"}    | ${"0500-01-01"} | ${"-126|M09|12"}
    ${"islamic-tbla"}     | ${"0621-01-01"} | ${"-1|M05|29"}
    ${"islamic-tbla"}     | ${"0500-01-01"} | ${"-126|M09|13"}
    ${"islamic-umalqura"} | ${"0621-01-01"} | ${"-1|M05|28"}
    ${"islamic-umalqura"} | ${"0500-01-01"} | ${"-126|M09|12"}
  `(
    "expects $calendar $iso to read $expected",
    ({ calendar, iso, expected }) => {
      const repro = findRepro("D18", calendar, iso);
      expect(repro?.expected).toBe(expected);
      expect(runRepro(repro!)).toMatch(/^-?\d+\|M\d\d\|\d+$/);
    },
  );

  // WebKit prints the epoch day itself (1 Muharram of year 1) as year 0 in the earlier era, so a
  // read of it is corrected to 1 - 0. The day before it is the last day of year 0 on every engine.
  // Only the four shared fields are compared: a native engine also reads `era` and `eraYear`.
  it.each`
    calendar              | epochDay        | dayBefore
    ${"islamic-civil"}    | ${"0622-07-19"} | ${"0622-07-18"}
    ${"islamic-tbla"}     | ${"0622-07-18"} | ${"0622-07-17"}
    ${"islamic-umalqura"} | ${"0622-07-19"} | ${"0622-07-18"}
  `(
    "reads the $calendar epoch day $epochDay as 1 Muharram of year 1 on every engine",
    ({ calendar, epochDay, dayBefore }) => {
      expect(
        calendarFieldsOf(Temporal.PlainDate.from(epochDay), calendar),
      ).toMatchObject({ year: 1, month: 1, monthCode: "M01", day: 1 });
      expect(
        calendarFieldsOf(Temporal.PlainDate.from(dayBefore), calendar),
      ).toMatchObject({ year: 0, month: 12, monthCode: "M12", day: 29 });
    },
  );

  it("reads the recorded WebKit 26.6 output as the defect", () => {
    const repro = findRepro("D18", "islamic-civil", "0621-01-01")!;
    expect(reproPasses(repro, "2|M05|28")).toBe(false);
    expect(reproPasses(repro, "-1|M05|28")).toBe(true);
  });

  it("reads only: no D18 repro asks the polyfill to convert fields or count months", () => {
    // Every row is a readRepro of an ISO date, so its name parses as an ISO date.
    for (const repro of probeRepros.filter((row) => row.defect === "D18")) {
      expect(() => Temporal.PlainDate.from(repro.name)).not.toThrow();
    }
  });

  it("never withholds the polyfill for an Islamic year above 1 or for another calendar", () => {
    expect(polyfillCannotReturn("islamic-civil", 2)).toBe(false);
    expect(polyfillCannotReturn("islamic-tbla", 1000)).toBe(false);
    expect(polyfillCannotReturn("hebrew", -5)).toBe(false);
    expect(polyfillCannotReturn("persian", 0)).toBe(false);
    expect(polyfillMisreadsIslamicEra("persian")).toBe(false);
    expect(polyfillMisreadsIslamicEra("iso8601")).toBe(false);
  });

  it("withholds every year up to 1 together, or none", () => {
    for (const calendar of [
      "islamic-civil",
      "islamic-tbla",
      "islamic-umalqura",
    ]) {
      const misreads = polyfillMisreadsIslamicEra(calendar);
      expect(misreads).toBe(isDefectPresent("D18", calendar));
      for (const year of [1, 0, -1, -280804]) {
        expect(polyfillCannotReturn(calendar, year)).toBe(misreads);
      }
    }
  });
});

// D19: ECMA-402 §6.5 fixes "UTC" as a primary time zone identifier and "Etc/UTC" as a non-primary
// one that resolves to it, and ECMA-262 TimeZoneEquals compares primary identifiers, so the two
// are one zone on every host. The polyfill reads a non-primary identifier's primary from
// `Intl.DateTimeFormat#resolvedOptions`, which JavaScriptCore (WebKit 26.6) returns as written.
describe("D19 time zone equals probe", () => {
  it("expects Etc/UTC to equal UTC", () => {
    expect(findRepro("D19", "iso8601", "etcUtcEqualsUtc")?.expected).toBe(
      "true",
    );
  });

  it("returns true or false", () => {
    expect(runRepro(findRepro("D19", "iso8601", "etcUtcEqualsUtc")!)).toMatch(
      /^(true|false)$/,
    );
  });

  it("reads the recorded WebKit 26.6 output as the defect", () => {
    const repro = findRepro("D19", "iso8601", "etcUtcEqualsUtc")!;
    expect(reproPasses(repro, "false")).toBe(false);
  });

  it("answers the same on a second call", () => {
    expect(isTimeZoneEqualsCompatNeeded()).toBe(isTimeZoneEqualsCompatNeeded());
  });
});

// D20: Temporal ParseISODateTime, goal TemporalMonthDayString with no DateYear and goal
// TemporalYearMonthString with no DateDay, throws only "If calendar is not empty and the
// ASCII-lowercase of calendar is not "iso8601"", so an upper-case value is read. Polyfill 0.5.1
// compares it as written and throws "MM-DD format is only valid with iso8601 calendar" or "YYYY-MM
// format is only valid with iso8601 calendar".
describe("D20 ISO calendar case probe", () => {
  it("expects the month-day 12-25", () => {
    expect(
      findRepro("D20", "iso8601", "upperCaseIsoCalendarOnMonthDay")?.expected,
    ).toBe("12-25");
  });

  it("reads the recorded polyfill 0.5.1 throw as the defect", () => {
    const repro = findRepro(
      "D20",
      "iso8601",
      "upperCaseIsoCalendarOnMonthDay",
    )!;
    expect(
      reproPasses(
        repro,
        "ERR RangeError: MM-DD format is only valid with iso8601 calendar",
      ),
    ).toBe(false);
  });

  it("expects the year-month 2026-10", () => {
    expect(
      findRepro("D20", "iso8601", "upperCaseIsoCalendarOnYearMonth")?.expected,
    ).toBe("2026-10");
  });

  it("reads the recorded polyfill 0.5.1 year-month throw as the defect", () => {
    const repro = findRepro(
      "D20",
      "iso8601",
      "upperCaseIsoCalendarOnYearMonth",
    )!;
    expect(
      reproPasses(
        repro,
        "ERR RangeError: YYYY-MM format is only valid with iso8601 calendar",
      ),
    ).toBe(false);
  });

  it("answers the same on a second call", () => {
    expect(isIsoCalendarCaseCompatNeeded()).toBe(
      isIsoCalendarCaseCompatNeeded(),
    );
  });
});
