import {
  isCalendarArithmeticCompatNeeded,
  isDefectPresent,
  reproPasses,
  runRepro,
} from "./capabilities";
import { type DefectId, findRepro, repros } from "./repros";

// Probe tests never assert the probe's outcome against the installed polyfill: that would fail CI
// the day upstream ships the fix, which is the canary's job (CORE-6 spec §4.5, §6.3). They pin the
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

  // Zoned range-limit repros (upstream-issue drafts A, B, D). Chromium 153 native Temporal; the
  // min.* rows are the minimum edge that polyfill 05ce7a3 does not fix.
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
  `(
    "$defect $name expects Chromium's $expected",
    ({ defect, name, expected }) => {
      expect(findRepro(defect, "iso8601", name)?.expected).toBe(expected);
    },
  );

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
    defect       | calendar           | name                        | recorded
    ${"D1"}      | ${"hebrew"}        | ${"fieldsMax"}              | ${"ERR RangeError: Invalid ISO date: +275760-09-19T00:00Z"}
    ${"D1"}      | ${"islamic-civil"} | ${"fieldsMin"}              | ${"ERR RangeError: Invalid ISO date: -271821-01-01T00:00Z"}
    ${"D1"}      | ${"persian"}       | ${"fieldsMin"}              | ${"ERR RangeError: Invalid ISO date: -271821-01-01T00:00Z"}
    ${"D2"}      | ${"buddhist"}      | ${"1000-01-01"}             | ${"1542|M12|27"}
    ${"D2"}      | ${"buddhist"}      | ${"1582-10-04"}             | ${"2125|M09|24"}
    ${"D3"}      | ${"hebrew"}        | ${"-100000-01-01"}          | ${"ERR RangeError: Missing month converting"}
    ${"D4"}      | ${"hebrew"}        | ${"-271821-11-05"}          | ${"-268057|M05|27"}
    ${"D4"}      | ${"hebrew"}        | ${"-003761-09-01"}          | ${"0|M01|12"}
    ${"D5"}      | ${"indian"}        | ${"-000500-06-15"}          | ${"ERR RangeError: calendar 'indian' is broken"}
    ${"D8"}      | ${"japanese"}      | ${"1800-01-01"}             | ${"japanese|1800"}
    ${"D8"}      | ${"japanese"}      | ${"1872-12-31"}             | ${"meiji|5"}
    ${"D8"}      | ${"japanese"}      | ${"0000-12-31"}             | ${"japanese-inverse|1"}
    ${"D1"}      | ${"hebrew"}        | ${"untilNearMax"}           | ${"ERR RangeError: Invalid ISO date: +275760-09-27T00:00Z"}
    ${"D1"}      | ${"buddhist"}      | ${"addNearMax"}             | ${"ERR RangeError: Invalid ISO date: +275760-10-14T00:00Z"}
    ${"D1"}      | ${"islamic-civil"} | ${"subtractNearMin"}        | ${"ERR RangeError: Invalid ISO date: -271821-01-01T00:00Z"}
    ${"D1"}      | ${"hebrew"}        | ${"relativeTo"}             | ${"ERR RangeError: Invalid ISO date: +275760-09-17T00:00Z"}
    ${"D6"}      | ${"buddhist"}      | ${"monthEnd"}               | ${"P1M"}
    ${"D6"}      | ${"hebrew"}        | ${"monthEnd"}               | ${"P1M"}
    ${"D6"}      | ${"ethioaa"}       | ${"monthEnd"}               | ${"P1M"}
    ${"D7"}      | ${"hebrew"}        | ${"mixedSign"}              | ${"ERR RangeError: mixed-sign values not allowed as duration fields"}
    ${"D7"}      | ${"hebrew"}        | ${"leapMonthEnd"}           | ${"P1Y"}
    ${"zoned.A"} | ${"iso8601"}       | ${"max.untilSydney"}        | ${"ERR RangeError: Invalid time value"}
    ${"zoned.A"} | ${"iso8601"}       | ${"min.untilNewYork"}       | ${"ERR RangeError: date/time value is outside the supported range"}
    ${"zoned.B"} | ${"iso8601"}       | ${"max.nextTransition"}     | ${"null"}
    ${"zoned.B"} | ${"iso8601"}       | ${"max.hoursInDaySantiago"} | ${"ERR TypeError: Cannot read properties of null (reading 'sign')"}
    ${"zoned.D"} | ${"iso8601"}       | ${"max.untilUtcRounded"}    | ${"returned P3DT5H"}
    ${"zoned.D"} | ${"iso8601"}       | ${"max.totalUtc"}           | ${"returned 2.0416666666666665"}
    ${"D9"}      | ${"persian"}       | ${"addMonths"}              | ${"1328 Intl reads for 1200 months"}
    ${"D9"}      | ${"hebrew"}        | ${"untilMonths"}            | ${"1518 Intl reads for 1200 months"}
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

// Only the outcomes that hold on every runtime are pinned (spec §4.5): whether a non-ISO calendar
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
