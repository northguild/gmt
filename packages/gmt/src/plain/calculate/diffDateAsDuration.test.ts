import { diffDateAsDuration } from "./diffDateAsDuration";

describe("diffDateAsDuration", () => {
  // gregory: months, days and the arithmetic year are ISO's (Intl Era and Month Code
  // proposal, table-calendar-types). Expected: native Temporal, Chromium 153.0.8010.12.
  it.each`
    date1                            | date2                            | unit        | expected
    ${"-271821-04-19[u-ca=gregory]"} | ${"+275760-09-13[u-ca=gregory]"} | ${"years"}  | ${"P547581Y4M25D"}
    ${"2023-08-31[u-ca=gregory]"}    | ${"2023-09-30[u-ca=gregory]"}    | ${"months"} | ${"P30D"}
  `(
    "returns $expected from $date1 to $date2 in $unit (gregory)",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );

  it.each`
    date1           | date2           | unit        | expected
    ${"2023-01-01"} | ${"2024-01-01"} | ${"years"}  | ${"P1Y"}
    ${"2023-01-01"} | ${"2023-02-01"} | ${"months"} | ${"P1M"}
    ${"2023-01-01"} | ${"2023-01-08"} | ${"weeks"}  | ${"P1W"}
    ${"2023-01-01"} | ${"2023-01-02"} | ${"days"}   | ${"P1D"}
    ${"2024-03-10"} | ${"2024-04-05"} | ${"days"}   | ${"P26D"}
    ${"2024-03-10"} | ${"2024-04-05"} | ${"weeks"}  | ${"P3W5D"}
  `(
    "returns $expected for $unit comparing $date1, $date2",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );

  it.each`
    date1           | date2           | expected
    ${"2024-01-01"} | ${"2023-01-01"} | ${"-P365D"}
    ${"2024-01-31"} | ${"2024-01-01"} | ${"-P30D"}
    ${"2024-02-29"} | ${"2024-01-31"} | ${"-P29D"}
  `(
    "returns negative duration for date1 after date2: $date1, $date2",
    ({ date1, date2, expected }) => {
      expect(diffDateAsDuration(date1, date2, "days")).toBe(expected);
    },
  );

  it("returns PT0S for a zero-length diff", () => {
    expect(diffDateAsDuration("2024-01-01", "2024-01-01", "days")).toBe("PT0S");
  });

  it.each`
    nonStringInput
    ${"2024-02-30"}
    ${"not-a-date"}
    ${"2024-13-01"}
    ${"2024-00-10"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"12"}
    ${"2024"}
    ${"2024-02"}
    ${"2024-02-29T12:00:00Z"}
    ${"2024-02-29T12:00:00Z"}
  `('returns "" for non-string input $nonStringInput', ({ nonStringInput }) => {
    expect(
      diffDateAsDuration(nonStringInput as never, "2024-01-01", "days"),
    ).toBe("");
  });

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
    ${"hour"}
    ${"hours"}
    ${"dayss"}
    ${["days"]}
  `('returns "" for invalid unit $invalidUnit', ({ invalidUnit }) => {
    expect(
      diffDateAsDuration("2024-01-01", "2024-01-02", invalidUnit as never),
    ).toBe("");
  });

  it.each`
    roundingMode    | expected
    ${"ceil"}       | ${"P4D"}
    ${"floor"}      | ${"P2D"}
    ${"trunc"}      | ${"P2D"}
    ${"halfExpand"} | ${"P4D"}
    ${"halfCeil"}   | ${"P4D"}
    ${"halfFloor"}  | ${"P2D"}
    ${"halfTrunc"}  | ${"P2D"}
    ${"halfEven"}   | ${"P4D"}
    ${"expand"}     | ${"P4D"}
  `(
    "rounds a 3-day span to $expected with smallestUnit day, roundingIncrement 2, roundingMode $roundingMode",
    ({ roundingMode, expected }) => {
      expect(
        diffDateAsDuration("2023-01-01", "2023-01-04", "days", {
          smallestUnit: "days",
          roundingIncrement: 2,
          roundingMode,
        }),
      ).toBe(expected);
    },
  );

  it("returns the unrounded result when no options are provided", () => {
    expect(diffDateAsDuration("2023-01-01", "2023-01-10", "days")).toBe("P9D");
  });

  it('returns "" when roundingIncrement is invalid (negative)', () => {
    expect(
      diffDateAsDuration("2023-01-01", "2023-01-10", "days", {
        smallestUnit: "days",
        roundingIncrement: -1,
        roundingMode: "trunc",
      }),
    ).toBe("");
  });

  it('returns "" when smallestUnit is coarser than largestUnit', () => {
    expect(
      diffDateAsDuration("2023-01-01", "2024-01-10", "days", {
        smallestUnit: "years",
      }),
    ).toBe("");
  });

  it.each`
    toStringSmallestUnit | fractionalSecondDigits | toStringRoundingMode | expected
    ${undefined}         | ${undefined}           | ${undefined}         | ${"P1D"}
    ${"second"}          | ${undefined}           | ${undefined}         | ${"P1DT0S"}
    ${undefined}         | ${3}                   | ${undefined}         | ${"P1DT0.000S"}
  `(
    "applies toString precision options: toStringSmallestUnit=$toStringSmallestUnit fractionalSecondDigits=$fractionalSecondDigits -> $expected",
    ({
      toStringSmallestUnit,
      fractionalSecondDigits,
      toStringRoundingMode,
      expected,
    }) => {
      expect(
        diffDateAsDuration("2023-01-01", "2023-01-02", "days", {
          toStringSmallestUnit,
          fractionalSecondDigits,
          toStringRoundingMode,
        }),
      ).toBe(expected);
    },
  );

  // E5 (issue #78): same shared-calendar rule as diffDate — see its test file. Golden
  // verified directly against @js-temporal/polyfill.
  it("measures in the shared calendar when both endpoints carry the same tag (Hebrew Adar I -> Adar)", () => {
    expect(
      diffDateAsDuration(
        "2024-02-24[u-ca=hebrew]",
        "2024-03-25[u-ca=hebrew]",
        "months",
      ),
    ).toBe("P1M");
  });

  // Different calendars return "" (TC39 DifferenceTemporalPlainDate CalendarEquals);
  // native Temporal (Chromium 153) until throws "Mismatched calendars." for each pair.
  it.each`
    date1                          | date2                         | reason
    ${"2024-10-03[u-ca=hebrew]"}   | ${"2024-11-03"}               | ${"hebrew and bare ISO"}
    ${"2024-10-03"}                | ${"2024-11-02[u-ca=hebrew]"}  | ${"bare ISO and hebrew"}
    ${"2024-10-03"}                | ${"2024-11-02[u-ca=gregory]"} | ${"iso8601 and gregory"}
    ${"2024-10-03[u-ca=ethiopic]"} | ${"2024-11-02[u-ca=ethioaa]"} | ${"ethiopic and ethioaa"}
  `(
    'returns "" for $date1 to $date2 ($reason: different calendars)',
    ({ date1, date2 }) => {
      expect(diffDateAsDuration(date1, date2, "days")).toBe("");
    },
  );

  // CORE-6 D6: the Intl era/monthCode proposal's NonISODateSurpasses compares the un-constrained
  // day, so a month-end start does not count a month when the target month is shorter
  // (test262 intl402/Temporal/PlainDate/prototype/until/wrapping-at-end-of-month-*.js).
  // D7: a leap-year Adar I start must not throw "mixed-sign" (tc39/proposal-temporal#3159).
  // D1-U: the polyfill throws within about a year of the maximum.
  // Expected values: Chromium 152 native Temporal (q2-grid-chromium152.json "grid", and
  // q2-xscan-chromium152.json "xscan max[n]"), test262, or the spec algorithm where named.
  it.each`
    date1                                  | date2                                  | unit        | expected           | reason
    ${"2023-08-31[u-ca=buddhist]"}         | ${"2023-09-30[u-ca=buddhist]"}         | ${"months"} | ${"P30D"}          | ${"D6: Aug 31 + 1 month is Sep 31, past Sep 30 (grid 2023-08-31 +30 d)"}
    ${"2023-08-31[u-ca=buddhist]"}         | ${"2023-09-30[u-ca=buddhist]"}         | ${"years"}  | ${"P30D"}          | ${"D6 with largestUnit years (grid 2023-08-31 +30 d)"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${"2023-08-31[u-ca=buddhist]"}         | ${"months"} | ${"-P30D"}         | ${"D6 negated: Sep 30 - 1 month is Aug 30, not past Aug 31 (grid reverse column)"}
    ${"2023-08-31[u-ca=japanese]"}         | ${"2023-09-30[u-ca=japanese]"}         | ${"months"} | ${"P30D"}          | ${"D6 japanese (grid 2023-08-31 +30 d)"}
    ${"2023-08-31[u-ca=roc]"}              | ${"2023-09-30[u-ca=roc]"}              | ${"months"} | ${"P30D"}          | ${"D6 roc (grid 2023-08-31 +30 d)"}
    ${"2024-08-06[u-ca=islamic-civil]"}    | ${"2024-09-04[u-ca=islamic-civil]"}    | ${"months"} | ${"P29D"}          | ${"D6 islamic-civil: Muharram 30 + 1 month is Safar 30, past Safar 29 (29-day Safar)"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${"2023-07-18[u-ca=islamic-civil]"}    | ${"months"} | ${"P29D"}          | ${"D6 islamic-civil (grid 2023-06-19 +29 d)"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${"2023-07-17[u-ca=islamic-tbla]"}     | ${"months"} | ${"P29D"}          | ${"D6 islamic-tbla (grid 2023-06-18 +29 d)"}
    ${"2023-07-18[u-ca=islamic-umalqura]"} | ${"2023-08-16[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P29D"}          | ${"D6 islamic-umalqura across a year end (grid 2023-07-18 +29 d)"}
    ${"2023-09-22[u-ca=persian]"}          | ${"2023-10-22[u-ca=persian]"}          | ${"months"} | ${"P30D"}          | ${"D6 persian (grid 2023-09-22 +30 d)"}
    ${"2023-10-22[u-ca=persian]"}          | ${"2023-09-22[u-ca=persian]"}          | ${"years"}  | ${"-P30D"}         | ${"D6 persian negated (grid reverse column)"}
    ${"2023-09-22[u-ca=indian]"}           | ${"2023-10-22[u-ca=indian]"}           | ${"months"} | ${"P30D"}          | ${"D6 indian (grid 2023-09-22 +30 d)"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${"2023-07-18[u-ca=hebrew]"}           | ${"months"} | ${"P29D"}          | ${"D6 hebrew Sivan 30 -> Tammuz 29 (grid 2023-06-19 +29 d)"}
    ${"2023-04-21[u-ca=hebrew]"}           | ${"2023-05-20[u-ca=hebrew]"}           | ${"months"} | ${"P29D"}          | ${"D6 hebrew Nisan 30 -> Iyar 29 (test262 wrapping-at-end-of-month-hebrew.js)"}
    ${"2023-08-13[u-ca=ethioaa]"}          | ${"2023-09-11[u-ca=ethioaa]"}          | ${"months"} | ${"P29D"}          | ${"D6 ethioaa into the 6-day Pagumen (grid 2023-08-13 +29 d)"}
    ${"2023-08-06[u-ca=ethioaa]"}          | ${"2024-09-10[u-ca=ethioaa]"}          | ${"years"}  | ${"P1Y1M5D"}       | ${"D6: Hamle 30 + 1Y2M is Pagumen 30, past Pagumen 5 (spec NonISODateSurpasses)"}
    ${"2023-08-06[u-ca=coptic]"}           | ${"2024-09-10[u-ca=coptic]"}           | ${"years"}  | ${"P1Y1M5D"}       | ${"D6 coptic: same ISO dates as the ethioaa row (coptic = ethioaa - 5776)"}
    ${"2023-08-06[u-ca=ethiopic]"}         | ${"2024-09-10[u-ca=ethiopic]"}         | ${"years"}  | ${"P1Y1M5D"}       | ${"D6 ethiopic: same ISO dates as the ethioaa row (ethiopic era year = ethioaa - 5500)"}
    ${"2024-02-11[u-ca=hebrew]"}           | ${"2025-03-01[u-ca=hebrew]"}           | ${"years"}  | ${"P12M29D"}       | ${"D7: Adar I 2 + 1 year is Adar 2, past Adar 1 (grid 2024-02-11 +384 d)"}
    ${"2025-03-01[u-ca=hebrew]"}           | ${"2024-02-11[u-ca=hebrew]"}           | ${"years"}  | ${"-P1Y29D"}       | ${"D7 negated: Adar 1 - 1 year is Adar I 1, not past Adar I 2 (grid reverse column)"}
    ${"2024-02-11[u-ca=hebrew]"}           | ${"2025-03-01[u-ca=hebrew]"}           | ${"months"} | ${"P12M29D"}       | ${"D7 row with largestUnit months (grid 2024-02-11 +384 d)"}
    ${"+275760-07-06[u-ca=hebrew]"}        | ${"+275760-09-13[u-ca=hebrew]"}        | ${"months"} | ${"P2M10D"}        | ${"D1-U hebrew up to the maximum (xscan max[69])"}
    ${"+275760-07-01[u-ca=buddhist]"}      | ${"+275760-09-13[u-ca=buddhist]"}      | ${"months"} | ${"P2M12D"}        | ${"D1-U buddhist up to the maximum (xscan max[74])"}
    ${"+275760-06-24[u-ca=ethioaa]"}       | ${"+275760-09-13[u-ca=ethioaa]"}       | ${"months"} | ${"P2M21D"}        | ${"D1-U ethioaa up to the maximum (xscan max[81])"}
    ${"+275760-07-01[u-ca=islamic-civil]"} | ${"+275760-09-13[u-ca=islamic-civil]"} | ${"months"} | ${"P2M15D"}        | ${"D1-U islamic-civil up to the maximum (xscan max[74])"}
    ${"+275760-07-01[u-ca=persian]"}       | ${"+275760-09-13[u-ca=persian]"}       | ${"months"} | ${"P2M12D"}        | ${"D1-U persian up to the maximum (xscan max[74])"}
    ${"2024-10-03[u-ca=hebrew]"}           | ${"+275760-09-13[u-ca=hebrew]"}        | ${"years"}  | ${"P273732Y9M10D"} | ${"D1-U long span: 279517 is leap, so Tishri + 9 months is ordinal month 10 (spec NonISODateUntil)"}
    ${"-271821-04-19[u-ca=islamic-civil]"} | ${"-271821-06-03[u-ca=islamic-civil]"} | ${"months"} | ${"P1M15D"}        | ${"D1-U from the minimum (xscan islamic-civil min[45])"}
    ${"-271818-01-13[u-ca=buddhist]"}      | ${"-271817-02-17[u-ca=buddhist]"}      | ${"years"}  | ${"P1Y1M4D"}       | ${"D2 buddhist (stride k=0, +400 d)"}
    ${"-262510-01-30[u-ca=buddhist]"}      | ${"-262509-03-06[u-ca=buddhist]"}      | ${"years"}  | ${"P1Y1M6D"}       | ${"D2 buddhist month end (stride k=34, +400 d)"}
    ${"1400-07-25[u-ca=buddhist]"}         | ${"1401-08-29[u-ca=buddhist]"}         | ${"years"}  | ${"P1Y1M4D"}       | ${"D2 buddhist ISO 1400 (stride k=998, +400 d)"}
    ${"-271821-04-19[u-ca=buddhist]"}      | ${"-271820-05-23[u-ca=buddhist]"}      | ${"months"} | ${"P13M4D"}        | ${"D2 buddhist from the minimum (xscan min[400])"}
    ${"-271818-01-13[u-ca=hebrew]"}        | ${"-271817-02-17[u-ca=hebrew]"}        | ${"years"}  | ${"P1Y15D"}        | ${"D3/D4 hebrew (stride k=0, +400 d)"}
    ${"-182571-10-09[u-ca=hebrew]"}        | ${"-182570-11-13[u-ca=hebrew]"}        | ${"years"}  | ${"P1Y1M15D"}      | ${"D3/D4 hebrew (stride k=326, +400 d)"}
    ${"-003801-01-03[u-ca=hebrew]"}        | ${"-003800-02-07[u-ca=hebrew]"}        | ${"years"}  | ${"P1Y1M17D"}      | ${"D3/D4 hebrew (stride k=979, +400 d)"}
    ${"-270450-11-13[u-ca=hebrew]"}        | ${"-270449-12-18[u-ca=hebrew]"}        | ${"years"}  | ${"P1Y15D"}        | ${"D3/D4 hebrew Adar I start (stride k=5, +400 d)"}
    ${"-271821-04-19[u-ca=hebrew]"}        | ${"-271820-05-23[u-ca=hebrew]"}        | ${"months"} | ${"P13M17D"}       | ${"D3/D4 hebrew from the minimum (xscan min[400])"}
    ${"-271818-01-13[u-ca=indian]"}        | ${"-271817-02-17[u-ca=indian]"}        | ${"years"}  | ${"P1Y1M5D"}       | ${"D5 indian (stride k=0, +400 d)"}
    ${"-090585-03-03[u-ca=indian]"}        | ${"-090584-04-06[u-ca=indian]"}        | ${"years"}  | ${"P1Y1M5D"}       | ${"D5 indian across a Saka year end (stride k=662, +400 d)"}
    ${"-261689-05-20[u-ca=indian]"}        | ${"-261688-06-23[u-ca=indian]"}        | ${"years"}  | ${"P1Y1M3D"}       | ${"D5 indian (stride k=37, +400 d)"}
    ${"-271821-04-19[u-ca=indian]"}        | ${"-271820-05-23[u-ca=indian]"}        | ${"months"} | ${"P13M4D"}        | ${"D5 indian from the minimum (xscan min[400])"}
  `(
    "returns $expected for $unit from $date1 to $date2 ($reason)",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );

  // A date-time is read as its date, as Temporal.PlainDate.from reads it (decided
  // 2026-09-17; before 1.16.0 the sentinel). Expected values from native Chromium 153.
  it("returns P5D from the date-time 2024-03-10T14:30:00 to 2024-03-15", () => {
    expect(
      diffDateAsDuration("2024-03-10T14:30:00", "2024-03-15", "days"),
    ).toBe("P5D");
  });

  // CORE-6 modern grid subset (spec §4.4): every calendar, from a mid-month start and two
  // calendar month-end starts, across 29, 30, 59 and 384 days. Expected values: Chromium 152 native
  // Temporal (q2-grid-chromium152.json, base 2023-06-01 + i days); gregory rows are bare ISO.
  it.each`
    date1                                  | date2                                  | unit        | expected      | source
    ${"2023-06-01[u-ca=buddhist]"}         | ${"2023-06-30[u-ca=buddhist]"}         | ${"months"} | ${"P29D"}     | ${"grid buddhist i=0 +29 d"}
    ${"2023-06-01[u-ca=buddhist]"}         | ${"2023-06-30[u-ca=buddhist]"}         | ${"years"}  | ${"P29D"}     | ${"grid buddhist i=0 +29 d"}
    ${"2023-06-01[u-ca=buddhist]"}         | ${"2023-07-01[u-ca=buddhist]"}         | ${"months"} | ${"P1M"}      | ${"grid buddhist i=0 +30 d"}
    ${"2023-06-01[u-ca=buddhist]"}         | ${"2023-07-01[u-ca=buddhist]"}         | ${"years"}  | ${"P1M"}      | ${"grid buddhist i=0 +30 d"}
    ${"2023-06-01[u-ca=buddhist]"}         | ${"2023-07-30[u-ca=buddhist]"}         | ${"months"} | ${"P1M29D"}   | ${"grid buddhist i=0 +59 d"}
    ${"2023-06-01[u-ca=buddhist]"}         | ${"2023-07-30[u-ca=buddhist]"}         | ${"years"}  | ${"P1M29D"}   | ${"grid buddhist i=0 +59 d"}
    ${"2023-06-01[u-ca=buddhist]"}         | ${"2024-06-19[u-ca=buddhist]"}         | ${"months"} | ${"P12M18D"}  | ${"grid buddhist i=0 +384 d"}
    ${"2023-06-01[u-ca=buddhist]"}         | ${"2024-06-19[u-ca=buddhist]"}         | ${"years"}  | ${"P1Y18D"}   | ${"grid buddhist i=0 +384 d"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${"2023-07-29[u-ca=buddhist]"}         | ${"months"} | ${"P29D"}     | ${"grid buddhist i=29 +29 d"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${"2023-07-29[u-ca=buddhist]"}         | ${"years"}  | ${"P29D"}     | ${"grid buddhist i=29 +29 d"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${"2023-07-30[u-ca=buddhist]"}         | ${"months"} | ${"P1M"}      | ${"grid buddhist i=29 +30 d"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${"2023-07-30[u-ca=buddhist]"}         | ${"years"}  | ${"P1M"}      | ${"grid buddhist i=29 +30 d"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${"2023-08-28[u-ca=buddhist]"}         | ${"months"} | ${"P1M29D"}   | ${"grid buddhist i=29 +59 d"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${"2023-08-28[u-ca=buddhist]"}         | ${"years"}  | ${"P1M29D"}   | ${"grid buddhist i=29 +59 d"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${"2024-07-18[u-ca=buddhist]"}         | ${"months"} | ${"P12M18D"}  | ${"grid buddhist i=29 +384 d"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${"2024-07-18[u-ca=buddhist]"}         | ${"years"}  | ${"P1Y18D"}   | ${"grid buddhist i=29 +384 d"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${"2023-10-29[u-ca=buddhist]"}         | ${"months"} | ${"P29D"}     | ${"grid buddhist i=121 +29 d"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${"2023-10-29[u-ca=buddhist]"}         | ${"years"}  | ${"P29D"}     | ${"grid buddhist i=121 +29 d"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${"2023-10-30[u-ca=buddhist]"}         | ${"months"} | ${"P1M"}      | ${"grid buddhist i=121 +30 d"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${"2023-10-30[u-ca=buddhist]"}         | ${"years"}  | ${"P1M"}      | ${"grid buddhist i=121 +30 d"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${"2023-11-28[u-ca=buddhist]"}         | ${"months"} | ${"P1M29D"}   | ${"grid buddhist i=121 +59 d"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${"2023-11-28[u-ca=buddhist]"}         | ${"years"}  | ${"P1M29D"}   | ${"grid buddhist i=121 +59 d"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${"2024-10-18[u-ca=buddhist]"}         | ${"months"} | ${"P12M18D"}  | ${"grid buddhist i=121 +384 d"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${"2024-10-18[u-ca=buddhist]"}         | ${"years"}  | ${"P1Y18D"}   | ${"grid buddhist i=121 +384 d"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${"2023-06-30[u-ca=hebrew]"}           | ${"months"} | ${"P29D"}     | ${"grid hebrew i=0 +29 d"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${"2023-06-30[u-ca=hebrew]"}           | ${"years"}  | ${"P29D"}     | ${"grid hebrew i=0 +29 d"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${"2023-07-01[u-ca=hebrew]"}           | ${"months"} | ${"P1M"}      | ${"grid hebrew i=0 +30 d"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${"2023-07-01[u-ca=hebrew]"}           | ${"years"}  | ${"P1M"}      | ${"grid hebrew i=0 +30 d"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${"2023-07-30[u-ca=hebrew]"}           | ${"months"} | ${"P2M"}      | ${"grid hebrew i=0 +59 d"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${"2023-07-30[u-ca=hebrew]"}           | ${"years"}  | ${"P2M"}      | ${"grid hebrew i=0 +59 d"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${"2024-06-19[u-ca=hebrew]"}           | ${"months"} | ${"P13M1D"}   | ${"grid hebrew i=0 +384 d"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${"2024-06-19[u-ca=hebrew]"}           | ${"years"}  | ${"P1Y1D"}    | ${"grid hebrew i=0 +384 d"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${"2023-07-18[u-ca=hebrew]"}           | ${"months"} | ${"P29D"}     | ${"grid hebrew i=18 +29 d"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${"2023-07-18[u-ca=hebrew]"}           | ${"years"}  | ${"P29D"}     | ${"grid hebrew i=18 +29 d"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${"2023-07-19[u-ca=hebrew]"}           | ${"months"} | ${"P1M1D"}    | ${"grid hebrew i=18 +30 d"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${"2023-07-19[u-ca=hebrew]"}           | ${"years"}  | ${"P1M1D"}    | ${"grid hebrew i=18 +30 d"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${"2023-08-17[u-ca=hebrew]"}           | ${"months"} | ${"P2M"}      | ${"grid hebrew i=18 +59 d"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${"2023-08-17[u-ca=hebrew]"}           | ${"years"}  | ${"P2M"}      | ${"grid hebrew i=18 +59 d"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${"2024-07-07[u-ca=hebrew]"}           | ${"months"} | ${"P13M1D"}   | ${"grid hebrew i=18 +384 d"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${"2024-07-07[u-ca=hebrew]"}           | ${"years"}  | ${"P1Y1D"}    | ${"grid hebrew i=18 +384 d"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${"2023-10-14[u-ca=hebrew]"}           | ${"months"} | ${"P1M"}      | ${"grid hebrew i=106 +29 d"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${"2023-10-14[u-ca=hebrew]"}           | ${"years"}  | ${"P1M"}      | ${"grid hebrew i=106 +29 d"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${"2023-10-15[u-ca=hebrew]"}           | ${"months"} | ${"P1M1D"}    | ${"grid hebrew i=106 +30 d"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${"2023-10-15[u-ca=hebrew]"}           | ${"years"}  | ${"P1M1D"}    | ${"grid hebrew i=106 +30 d"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${"2023-11-13[u-ca=hebrew]"}           | ${"months"} | ${"P2M"}      | ${"grid hebrew i=106 +59 d"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${"2023-11-13[u-ca=hebrew]"}           | ${"years"}  | ${"P2M"}      | ${"grid hebrew i=106 +59 d"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${"2024-10-03[u-ca=hebrew]"}           | ${"months"} | ${"P13M1D"}   | ${"grid hebrew i=106 +384 d"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${"2024-10-03[u-ca=hebrew]"}           | ${"years"}  | ${"P1Y1D"}    | ${"grid hebrew i=106 +384 d"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${"2023-06-30[u-ca=islamic-civil]"}    | ${"months"} | ${"P29D"}     | ${"grid islamic-civil i=0 +29 d"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${"2023-06-30[u-ca=islamic-civil]"}    | ${"years"}  | ${"P29D"}     | ${"grid islamic-civil i=0 +29 d"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${"2023-07-01[u-ca=islamic-civil]"}    | ${"months"} | ${"P1M"}      | ${"grid islamic-civil i=0 +30 d"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${"2023-07-01[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1M"}      | ${"grid islamic-civil i=0 +30 d"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${"2023-07-30[u-ca=islamic-civil]"}    | ${"months"} | ${"P2M"}      | ${"grid islamic-civil i=0 +59 d"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${"2023-07-30[u-ca=islamic-civil]"}    | ${"years"}  | ${"P2M"}      | ${"grid islamic-civil i=0 +59 d"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${"2024-06-19[u-ca=islamic-civil]"}    | ${"months"} | ${"P13M"}     | ${"grid islamic-civil i=0 +384 d"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${"2024-06-19[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-civil i=0 +384 d"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${"2023-07-18[u-ca=islamic-civil]"}    | ${"months"} | ${"P29D"}     | ${"grid islamic-civil i=18 +29 d"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${"2023-07-18[u-ca=islamic-civil]"}    | ${"years"}  | ${"P29D"}     | ${"grid islamic-civil i=18 +29 d"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${"2023-07-19[u-ca=islamic-civil]"}    | ${"months"} | ${"P1M1D"}    | ${"grid islamic-civil i=18 +30 d"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${"2023-07-19[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-civil i=18 +30 d"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${"2023-08-17[u-ca=islamic-civil]"}    | ${"months"} | ${"P2M"}      | ${"grid islamic-civil i=18 +59 d"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${"2023-08-17[u-ca=islamic-civil]"}    | ${"years"}  | ${"P2M"}      | ${"grid islamic-civil i=18 +59 d"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${"2024-07-07[u-ca=islamic-civil]"}    | ${"months"} | ${"P13M"}     | ${"grid islamic-civil i=18 +384 d"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${"2024-07-07[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-civil i=18 +384 d"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${"2023-10-14[u-ca=islamic-civil]"}    | ${"months"} | ${"P1M"}      | ${"grid islamic-civil i=106 +29 d"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${"2023-10-14[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1M"}      | ${"grid islamic-civil i=106 +29 d"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${"2023-10-15[u-ca=islamic-civil]"}    | ${"months"} | ${"P1M1D"}    | ${"grid islamic-civil i=106 +30 d"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${"2023-10-15[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-civil i=106 +30 d"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${"2023-11-13[u-ca=islamic-civil]"}    | ${"months"} | ${"P2M"}      | ${"grid islamic-civil i=106 +59 d"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${"2023-11-13[u-ca=islamic-civil]"}    | ${"years"}  | ${"P2M"}      | ${"grid islamic-civil i=106 +59 d"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${"2024-10-03[u-ca=islamic-civil]"}    | ${"months"} | ${"P13M"}     | ${"grid islamic-civil i=106 +384 d"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${"2024-10-03[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-civil i=106 +384 d"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${"2023-06-30[u-ca=islamic-tbla]"}     | ${"months"} | ${"P29D"}     | ${"grid islamic-tbla i=0 +29 d"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${"2023-06-30[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P29D"}     | ${"grid islamic-tbla i=0 +29 d"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${"2023-07-01[u-ca=islamic-tbla]"}     | ${"months"} | ${"P1M"}      | ${"grid islamic-tbla i=0 +30 d"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${"2023-07-01[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1M"}      | ${"grid islamic-tbla i=0 +30 d"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${"2023-07-30[u-ca=islamic-tbla]"}     | ${"months"} | ${"P2M"}      | ${"grid islamic-tbla i=0 +59 d"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${"2023-07-30[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P2M"}      | ${"grid islamic-tbla i=0 +59 d"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${"2024-06-19[u-ca=islamic-tbla]"}     | ${"months"} | ${"P13M"}     | ${"grid islamic-tbla i=0 +384 d"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${"2024-06-19[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-tbla i=0 +384 d"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${"2023-07-17[u-ca=islamic-tbla]"}     | ${"months"} | ${"P29D"}     | ${"grid islamic-tbla i=17 +29 d"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${"2023-07-17[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P29D"}     | ${"grid islamic-tbla i=17 +29 d"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${"2023-07-18[u-ca=islamic-tbla]"}     | ${"months"} | ${"P1M1D"}    | ${"grid islamic-tbla i=17 +30 d"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${"2023-07-18[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-tbla i=17 +30 d"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${"2023-08-16[u-ca=islamic-tbla]"}     | ${"months"} | ${"P2M"}      | ${"grid islamic-tbla i=17 +59 d"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${"2023-08-16[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P2M"}      | ${"grid islamic-tbla i=17 +59 d"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${"2024-07-06[u-ca=islamic-tbla]"}     | ${"months"} | ${"P13M"}     | ${"grid islamic-tbla i=17 +384 d"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${"2024-07-06[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-tbla i=17 +384 d"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${"2023-10-13[u-ca=islamic-tbla]"}     | ${"months"} | ${"P1M"}      | ${"grid islamic-tbla i=105 +29 d"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${"2023-10-13[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1M"}      | ${"grid islamic-tbla i=105 +29 d"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${"2023-10-14[u-ca=islamic-tbla]"}     | ${"months"} | ${"P1M1D"}    | ${"grid islamic-tbla i=105 +30 d"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${"2023-10-14[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-tbla i=105 +30 d"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${"2023-11-12[u-ca=islamic-tbla]"}     | ${"months"} | ${"P2M"}      | ${"grid islamic-tbla i=105 +59 d"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${"2023-11-12[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P2M"}      | ${"grid islamic-tbla i=105 +59 d"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${"2024-10-02[u-ca=islamic-tbla]"}     | ${"months"} | ${"P13M"}     | ${"grid islamic-tbla i=105 +384 d"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${"2024-10-02[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-tbla i=105 +384 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-06-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M"}      | ${"grid islamic-umalqura i=0 +29 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-06-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M"}      | ${"grid islamic-umalqura i=0 +29 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-07-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M1D"}    | ${"grid islamic-umalqura i=0 +30 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-07-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-umalqura i=0 +30 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-07-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M"}      | ${"grid islamic-umalqura i=0 +59 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-07-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M"}      | ${"grid islamic-umalqura i=0 +59 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-06-19[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M1D"}   | ${"grid islamic-umalqura i=0 +384 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-06-19[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M1D"}  | ${"grid islamic-umalqura i=0 +384 d"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${"2023-07-17[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M"}      | ${"grid islamic-umalqura i=17 +29 d"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${"2023-07-17[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M"}      | ${"grid islamic-umalqura i=17 +29 d"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${"2023-07-18[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M1D"}    | ${"grid islamic-umalqura i=17 +30 d"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${"2023-07-18[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-umalqura i=17 +30 d"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${"2023-08-16[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M"}      | ${"grid islamic-umalqura i=17 +59 d"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${"2023-08-16[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M"}      | ${"grid islamic-umalqura i=17 +59 d"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${"2024-07-06[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M1D"}   | ${"grid islamic-umalqura i=17 +384 d"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${"2024-07-06[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M1D"}  | ${"grid islamic-umalqura i=17 +384 d"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${"2023-10-14[u-ca=islamic-umalqura]"} | ${"months"} | ${"P29D"}     | ${"grid islamic-umalqura i=106 +29 d"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${"2023-10-14[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P29D"}     | ${"grid islamic-umalqura i=106 +29 d"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${"2023-10-15[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M"}      | ${"grid islamic-umalqura i=106 +30 d"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${"2023-10-15[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M"}      | ${"grid islamic-umalqura i=106 +30 d"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${"2023-11-13[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M29D"}   | ${"grid islamic-umalqura i=106 +59 d"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${"2023-11-13[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M29D"}   | ${"grid islamic-umalqura i=106 +59 d"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${"2024-10-03[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M"}     | ${"grid islamic-umalqura i=106 +384 d"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${"2024-10-03[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-umalqura i=106 +384 d"}
    ${"2023-06-01[u-ca=persian]"}          | ${"2023-06-30[u-ca=persian]"}          | ${"months"} | ${"P29D"}     | ${"grid persian i=0 +29 d"}
    ${"2023-06-01[u-ca=persian]"}          | ${"2023-06-30[u-ca=persian]"}          | ${"years"}  | ${"P29D"}     | ${"grid persian i=0 +29 d"}
    ${"2023-06-01[u-ca=persian]"}          | ${"2023-07-01[u-ca=persian]"}          | ${"months"} | ${"P30D"}     | ${"grid persian i=0 +30 d"}
    ${"2023-06-01[u-ca=persian]"}          | ${"2023-07-01[u-ca=persian]"}          | ${"years"}  | ${"P30D"}     | ${"grid persian i=0 +30 d"}
    ${"2023-06-01[u-ca=persian]"}          | ${"2023-07-30[u-ca=persian]"}          | ${"months"} | ${"P1M28D"}   | ${"grid persian i=0 +59 d"}
    ${"2023-06-01[u-ca=persian]"}          | ${"2023-07-30[u-ca=persian]"}          | ${"years"}  | ${"P1M28D"}   | ${"grid persian i=0 +59 d"}
    ${"2023-06-01[u-ca=persian]"}          | ${"2024-06-19[u-ca=persian]"}          | ${"months"} | ${"P12M19D"}  | ${"grid persian i=0 +384 d"}
    ${"2023-06-01[u-ca=persian]"}          | ${"2024-06-19[u-ca=persian]"}          | ${"years"}  | ${"P1Y19D"}   | ${"grid persian i=0 +384 d"}
    ${"2023-06-21[u-ca=persian]"}          | ${"2023-07-20[u-ca=persian]"}          | ${"months"} | ${"P29D"}     | ${"grid persian i=20 +29 d"}
    ${"2023-06-21[u-ca=persian]"}          | ${"2023-07-20[u-ca=persian]"}          | ${"years"}  | ${"P29D"}     | ${"grid persian i=20 +29 d"}
    ${"2023-06-21[u-ca=persian]"}          | ${"2023-07-21[u-ca=persian]"}          | ${"months"} | ${"P30D"}     | ${"grid persian i=20 +30 d"}
    ${"2023-06-21[u-ca=persian]"}          | ${"2023-07-21[u-ca=persian]"}          | ${"years"}  | ${"P30D"}     | ${"grid persian i=20 +30 d"}
    ${"2023-06-21[u-ca=persian]"}          | ${"2023-08-19[u-ca=persian]"}          | ${"months"} | ${"P1M28D"}   | ${"grid persian i=20 +59 d"}
    ${"2023-06-21[u-ca=persian]"}          | ${"2023-08-19[u-ca=persian]"}          | ${"years"}  | ${"P1M28D"}   | ${"grid persian i=20 +59 d"}
    ${"2023-06-21[u-ca=persian]"}          | ${"2024-07-09[u-ca=persian]"}          | ${"months"} | ${"P12M19D"}  | ${"grid persian i=20 +384 d"}
    ${"2023-06-21[u-ca=persian]"}          | ${"2024-07-09[u-ca=persian]"}          | ${"years"}  | ${"P1Y19D"}   | ${"grid persian i=20 +384 d"}
    ${"2023-09-22[u-ca=persian]"}          | ${"2023-10-21[u-ca=persian]"}          | ${"months"} | ${"P29D"}     | ${"grid persian i=113 +29 d"}
    ${"2023-09-22[u-ca=persian]"}          | ${"2023-10-21[u-ca=persian]"}          | ${"years"}  | ${"P29D"}     | ${"grid persian i=113 +29 d"}
    ${"2023-09-22[u-ca=persian]"}          | ${"2023-10-22[u-ca=persian]"}          | ${"months"} | ${"P30D"}     | ${"grid persian i=113 +30 d"}
    ${"2023-09-22[u-ca=persian]"}          | ${"2023-10-22[u-ca=persian]"}          | ${"years"}  | ${"P30D"}     | ${"grid persian i=113 +30 d"}
    ${"2023-09-22[u-ca=persian]"}          | ${"2023-11-20[u-ca=persian]"}          | ${"months"} | ${"P1M29D"}   | ${"grid persian i=113 +59 d"}
    ${"2023-09-22[u-ca=persian]"}          | ${"2023-11-20[u-ca=persian]"}          | ${"years"}  | ${"P1M29D"}   | ${"grid persian i=113 +59 d"}
    ${"2023-09-22[u-ca=persian]"}          | ${"2024-10-10[u-ca=persian]"}          | ${"months"} | ${"P12M19D"}  | ${"grid persian i=113 +384 d"}
    ${"2023-09-22[u-ca=persian]"}          | ${"2024-10-10[u-ca=persian]"}          | ${"years"}  | ${"P1Y19D"}   | ${"grid persian i=113 +384 d"}
    ${"2023-06-01[u-ca=indian]"}           | ${"2023-06-30[u-ca=indian]"}           | ${"months"} | ${"P29D"}     | ${"grid indian i=0 +29 d"}
    ${"2023-06-01[u-ca=indian]"}           | ${"2023-06-30[u-ca=indian]"}           | ${"years"}  | ${"P29D"}     | ${"grid indian i=0 +29 d"}
    ${"2023-06-01[u-ca=indian]"}           | ${"2023-07-01[u-ca=indian]"}           | ${"months"} | ${"P30D"}     | ${"grid indian i=0 +30 d"}
    ${"2023-06-01[u-ca=indian]"}           | ${"2023-07-01[u-ca=indian]"}           | ${"years"}  | ${"P30D"}     | ${"grid indian i=0 +30 d"}
    ${"2023-06-01[u-ca=indian]"}           | ${"2023-07-30[u-ca=indian]"}           | ${"months"} | ${"P1M28D"}   | ${"grid indian i=0 +59 d"}
    ${"2023-06-01[u-ca=indian]"}           | ${"2023-07-30[u-ca=indian]"}           | ${"years"}  | ${"P1M28D"}   | ${"grid indian i=0 +59 d"}
    ${"2023-06-01[u-ca=indian]"}           | ${"2024-06-19[u-ca=indian]"}           | ${"months"} | ${"P12M18D"}  | ${"grid indian i=0 +384 d"}
    ${"2023-06-01[u-ca=indian]"}           | ${"2024-06-19[u-ca=indian]"}           | ${"years"}  | ${"P1Y18D"}   | ${"grid indian i=0 +384 d"}
    ${"2023-06-21[u-ca=indian]"}           | ${"2023-07-20[u-ca=indian]"}           | ${"months"} | ${"P29D"}     | ${"grid indian i=20 +29 d"}
    ${"2023-06-21[u-ca=indian]"}           | ${"2023-07-20[u-ca=indian]"}           | ${"years"}  | ${"P29D"}     | ${"grid indian i=20 +29 d"}
    ${"2023-06-21[u-ca=indian]"}           | ${"2023-07-21[u-ca=indian]"}           | ${"months"} | ${"P30D"}     | ${"grid indian i=20 +30 d"}
    ${"2023-06-21[u-ca=indian]"}           | ${"2023-07-21[u-ca=indian]"}           | ${"years"}  | ${"P30D"}     | ${"grid indian i=20 +30 d"}
    ${"2023-06-21[u-ca=indian]"}           | ${"2023-08-19[u-ca=indian]"}           | ${"months"} | ${"P1M28D"}   | ${"grid indian i=20 +59 d"}
    ${"2023-06-21[u-ca=indian]"}           | ${"2023-08-19[u-ca=indian]"}           | ${"years"}  | ${"P1M28D"}   | ${"grid indian i=20 +59 d"}
    ${"2023-06-21[u-ca=indian]"}           | ${"2024-07-09[u-ca=indian]"}           | ${"months"} | ${"P12M18D"}  | ${"grid indian i=20 +384 d"}
    ${"2023-06-21[u-ca=indian]"}           | ${"2024-07-09[u-ca=indian]"}           | ${"years"}  | ${"P1Y18D"}   | ${"grid indian i=20 +384 d"}
    ${"2023-09-22[u-ca=indian]"}           | ${"2023-10-21[u-ca=indian]"}           | ${"months"} | ${"P29D"}     | ${"grid indian i=113 +29 d"}
    ${"2023-09-22[u-ca=indian]"}           | ${"2023-10-21[u-ca=indian]"}           | ${"years"}  | ${"P29D"}     | ${"grid indian i=113 +29 d"}
    ${"2023-09-22[u-ca=indian]"}           | ${"2023-10-22[u-ca=indian]"}           | ${"months"} | ${"P30D"}     | ${"grid indian i=113 +30 d"}
    ${"2023-09-22[u-ca=indian]"}           | ${"2023-10-22[u-ca=indian]"}           | ${"years"}  | ${"P30D"}     | ${"grid indian i=113 +30 d"}
    ${"2023-09-22[u-ca=indian]"}           | ${"2023-11-20[u-ca=indian]"}           | ${"months"} | ${"P1M29D"}   | ${"grid indian i=113 +59 d"}
    ${"2023-09-22[u-ca=indian]"}           | ${"2023-11-20[u-ca=indian]"}           | ${"years"}  | ${"P1M29D"}   | ${"grid indian i=113 +59 d"}
    ${"2023-09-22[u-ca=indian]"}           | ${"2024-10-10[u-ca=indian]"}           | ${"months"} | ${"P12M18D"}  | ${"grid indian i=113 +384 d"}
    ${"2023-09-22[u-ca=indian]"}           | ${"2024-10-10[u-ca=indian]"}           | ${"years"}  | ${"P1Y18D"}   | ${"grid indian i=113 +384 d"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${"2023-06-30[u-ca=ethioaa]"}          | ${"months"} | ${"P29D"}     | ${"grid ethioaa i=0 +29 d"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${"2023-06-30[u-ca=ethioaa]"}          | ${"years"}  | ${"P29D"}     | ${"grid ethioaa i=0 +29 d"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${"2023-07-01[u-ca=ethioaa]"}          | ${"months"} | ${"P1M"}      | ${"grid ethioaa i=0 +30 d"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${"2023-07-01[u-ca=ethioaa]"}          | ${"years"}  | ${"P1M"}      | ${"grid ethioaa i=0 +30 d"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${"2023-07-30[u-ca=ethioaa]"}          | ${"months"} | ${"P1M29D"}   | ${"grid ethioaa i=0 +59 d"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${"2023-07-30[u-ca=ethioaa]"}          | ${"years"}  | ${"P1M29D"}   | ${"grid ethioaa i=0 +59 d"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${"2024-06-19[u-ca=ethioaa]"}          | ${"months"} | ${"P13M18D"}  | ${"grid ethioaa i=0 +384 d"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${"2024-06-19[u-ca=ethioaa]"}          | ${"years"}  | ${"P1Y18D"}   | ${"grid ethioaa i=0 +384 d"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${"2023-07-06[u-ca=ethioaa]"}          | ${"months"} | ${"P29D"}     | ${"grid ethioaa i=6 +29 d"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${"2023-07-06[u-ca=ethioaa]"}          | ${"years"}  | ${"P29D"}     | ${"grid ethioaa i=6 +29 d"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${"2023-07-07[u-ca=ethioaa]"}          | ${"months"} | ${"P1M"}      | ${"grid ethioaa i=6 +30 d"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${"2023-07-07[u-ca=ethioaa]"}          | ${"years"}  | ${"P1M"}      | ${"grid ethioaa i=6 +30 d"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${"2023-08-05[u-ca=ethioaa]"}          | ${"months"} | ${"P1M29D"}   | ${"grid ethioaa i=6 +59 d"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${"2023-08-05[u-ca=ethioaa]"}          | ${"years"}  | ${"P1M29D"}   | ${"grid ethioaa i=6 +59 d"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${"2024-06-25[u-ca=ethioaa]"}          | ${"months"} | ${"P13M18D"}  | ${"grid ethioaa i=6 +384 d"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${"2024-06-25[u-ca=ethioaa]"}          | ${"years"}  | ${"P1Y18D"}   | ${"grid ethioaa i=6 +384 d"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${"2023-10-04[u-ca=ethioaa]"}          | ${"months"} | ${"P1M23D"}   | ${"grid ethioaa i=96 +29 d"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${"2023-10-04[u-ca=ethioaa]"}          | ${"years"}  | ${"P1M23D"}   | ${"grid ethioaa i=96 +29 d"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${"2023-10-05[u-ca=ethioaa]"}          | ${"months"} | ${"P1M24D"}   | ${"grid ethioaa i=96 +30 d"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${"2023-10-05[u-ca=ethioaa]"}          | ${"years"}  | ${"P1M24D"}   | ${"grid ethioaa i=96 +30 d"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${"2023-11-03[u-ca=ethioaa]"}          | ${"months"} | ${"P2M23D"}   | ${"grid ethioaa i=96 +59 d"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${"2023-11-03[u-ca=ethioaa]"}          | ${"years"}  | ${"P2M23D"}   | ${"grid ethioaa i=96 +59 d"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${"2024-09-23[u-ca=ethioaa]"}          | ${"months"} | ${"P14M13D"}  | ${"grid ethioaa i=96 +384 d"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${"2024-09-23[u-ca=ethioaa]"}          | ${"years"}  | ${"P1Y1M13D"} | ${"grid ethioaa i=96 +384 d"}
    ${"2023-06-01[u-ca=japanese]"}         | ${"2023-06-30[u-ca=japanese]"}         | ${"months"} | ${"P29D"}     | ${"grid japanese i=0 +29 d"}
    ${"2023-06-01[u-ca=japanese]"}         | ${"2023-06-30[u-ca=japanese]"}         | ${"years"}  | ${"P29D"}     | ${"grid japanese i=0 +29 d"}
    ${"2023-06-01[u-ca=japanese]"}         | ${"2023-07-01[u-ca=japanese]"}         | ${"months"} | ${"P1M"}      | ${"grid japanese i=0 +30 d"}
    ${"2023-06-01[u-ca=japanese]"}         | ${"2023-07-01[u-ca=japanese]"}         | ${"years"}  | ${"P1M"}      | ${"grid japanese i=0 +30 d"}
    ${"2023-06-01[u-ca=japanese]"}         | ${"2023-07-30[u-ca=japanese]"}         | ${"months"} | ${"P1M29D"}   | ${"grid japanese i=0 +59 d"}
    ${"2023-06-01[u-ca=japanese]"}         | ${"2023-07-30[u-ca=japanese]"}         | ${"years"}  | ${"P1M29D"}   | ${"grid japanese i=0 +59 d"}
    ${"2023-06-01[u-ca=japanese]"}         | ${"2024-06-19[u-ca=japanese]"}         | ${"months"} | ${"P12M18D"}  | ${"grid japanese i=0 +384 d"}
    ${"2023-06-01[u-ca=japanese]"}         | ${"2024-06-19[u-ca=japanese]"}         | ${"years"}  | ${"P1Y18D"}   | ${"grid japanese i=0 +384 d"}
    ${"2023-06-30[u-ca=japanese]"}         | ${"2023-07-29[u-ca=japanese]"}         | ${"months"} | ${"P29D"}     | ${"grid japanese i=29 +29 d"}
    ${"2023-06-30[u-ca=japanese]"}         | ${"2023-07-29[u-ca=japanese]"}         | ${"years"}  | ${"P29D"}     | ${"grid japanese i=29 +29 d"}
    ${"2023-06-30[u-ca=japanese]"}         | ${"2023-07-30[u-ca=japanese]"}         | ${"months"} | ${"P1M"}      | ${"grid japanese i=29 +30 d"}
    ${"2023-06-30[u-ca=japanese]"}         | ${"2023-07-30[u-ca=japanese]"}         | ${"years"}  | ${"P1M"}      | ${"grid japanese i=29 +30 d"}
    ${"2023-06-30[u-ca=japanese]"}         | ${"2023-08-28[u-ca=japanese]"}         | ${"months"} | ${"P1M29D"}   | ${"grid japanese i=29 +59 d"}
    ${"2023-06-30[u-ca=japanese]"}         | ${"2023-08-28[u-ca=japanese]"}         | ${"years"}  | ${"P1M29D"}   | ${"grid japanese i=29 +59 d"}
    ${"2023-06-30[u-ca=japanese]"}         | ${"2024-07-18[u-ca=japanese]"}         | ${"months"} | ${"P12M18D"}  | ${"grid japanese i=29 +384 d"}
    ${"2023-06-30[u-ca=japanese]"}         | ${"2024-07-18[u-ca=japanese]"}         | ${"years"}  | ${"P1Y18D"}   | ${"grid japanese i=29 +384 d"}
    ${"2023-09-30[u-ca=japanese]"}         | ${"2023-10-29[u-ca=japanese]"}         | ${"months"} | ${"P29D"}     | ${"grid japanese i=121 +29 d"}
    ${"2023-09-30[u-ca=japanese]"}         | ${"2023-10-29[u-ca=japanese]"}         | ${"years"}  | ${"P29D"}     | ${"grid japanese i=121 +29 d"}
    ${"2023-09-30[u-ca=japanese]"}         | ${"2023-10-30[u-ca=japanese]"}         | ${"months"} | ${"P1M"}      | ${"grid japanese i=121 +30 d"}
    ${"2023-09-30[u-ca=japanese]"}         | ${"2023-10-30[u-ca=japanese]"}         | ${"years"}  | ${"P1M"}      | ${"grid japanese i=121 +30 d"}
    ${"2023-09-30[u-ca=japanese]"}         | ${"2023-11-28[u-ca=japanese]"}         | ${"months"} | ${"P1M29D"}   | ${"grid japanese i=121 +59 d"}
    ${"2023-09-30[u-ca=japanese]"}         | ${"2023-11-28[u-ca=japanese]"}         | ${"years"}  | ${"P1M29D"}   | ${"grid japanese i=121 +59 d"}
    ${"2023-09-30[u-ca=japanese]"}         | ${"2024-10-18[u-ca=japanese]"}         | ${"months"} | ${"P12M18D"}  | ${"grid japanese i=121 +384 d"}
    ${"2023-09-30[u-ca=japanese]"}         | ${"2024-10-18[u-ca=japanese]"}         | ${"years"}  | ${"P1Y18D"}   | ${"grid japanese i=121 +384 d"}
    ${"2023-06-01[u-ca=roc]"}              | ${"2023-06-30[u-ca=roc]"}              | ${"months"} | ${"P29D"}     | ${"grid roc i=0 +29 d"}
    ${"2023-06-01[u-ca=roc]"}              | ${"2023-06-30[u-ca=roc]"}              | ${"years"}  | ${"P29D"}     | ${"grid roc i=0 +29 d"}
    ${"2023-06-01[u-ca=roc]"}              | ${"2023-07-01[u-ca=roc]"}              | ${"months"} | ${"P1M"}      | ${"grid roc i=0 +30 d"}
    ${"2023-06-01[u-ca=roc]"}              | ${"2023-07-01[u-ca=roc]"}              | ${"years"}  | ${"P1M"}      | ${"grid roc i=0 +30 d"}
    ${"2023-06-01[u-ca=roc]"}              | ${"2023-07-30[u-ca=roc]"}              | ${"months"} | ${"P1M29D"}   | ${"grid roc i=0 +59 d"}
    ${"2023-06-01[u-ca=roc]"}              | ${"2023-07-30[u-ca=roc]"}              | ${"years"}  | ${"P1M29D"}   | ${"grid roc i=0 +59 d"}
    ${"2023-06-01[u-ca=roc]"}              | ${"2024-06-19[u-ca=roc]"}              | ${"months"} | ${"P12M18D"}  | ${"grid roc i=0 +384 d"}
    ${"2023-06-01[u-ca=roc]"}              | ${"2024-06-19[u-ca=roc]"}              | ${"years"}  | ${"P1Y18D"}   | ${"grid roc i=0 +384 d"}
    ${"2023-06-30[u-ca=roc]"}              | ${"2023-07-29[u-ca=roc]"}              | ${"months"} | ${"P29D"}     | ${"grid roc i=29 +29 d"}
    ${"2023-06-30[u-ca=roc]"}              | ${"2023-07-29[u-ca=roc]"}              | ${"years"}  | ${"P29D"}     | ${"grid roc i=29 +29 d"}
    ${"2023-06-30[u-ca=roc]"}              | ${"2023-07-30[u-ca=roc]"}              | ${"months"} | ${"P1M"}      | ${"grid roc i=29 +30 d"}
    ${"2023-06-30[u-ca=roc]"}              | ${"2023-07-30[u-ca=roc]"}              | ${"years"}  | ${"P1M"}      | ${"grid roc i=29 +30 d"}
    ${"2023-06-30[u-ca=roc]"}              | ${"2023-08-28[u-ca=roc]"}              | ${"months"} | ${"P1M29D"}   | ${"grid roc i=29 +59 d"}
    ${"2023-06-30[u-ca=roc]"}              | ${"2023-08-28[u-ca=roc]"}              | ${"years"}  | ${"P1M29D"}   | ${"grid roc i=29 +59 d"}
    ${"2023-06-30[u-ca=roc]"}              | ${"2024-07-18[u-ca=roc]"}              | ${"months"} | ${"P12M18D"}  | ${"grid roc i=29 +384 d"}
    ${"2023-06-30[u-ca=roc]"}              | ${"2024-07-18[u-ca=roc]"}              | ${"years"}  | ${"P1Y18D"}   | ${"grid roc i=29 +384 d"}
    ${"2023-09-30[u-ca=roc]"}              | ${"2023-10-29[u-ca=roc]"}              | ${"months"} | ${"P29D"}     | ${"grid roc i=121 +29 d"}
    ${"2023-09-30[u-ca=roc]"}              | ${"2023-10-29[u-ca=roc]"}              | ${"years"}  | ${"P29D"}     | ${"grid roc i=121 +29 d"}
    ${"2023-09-30[u-ca=roc]"}              | ${"2023-10-30[u-ca=roc]"}              | ${"months"} | ${"P1M"}      | ${"grid roc i=121 +30 d"}
    ${"2023-09-30[u-ca=roc]"}              | ${"2023-10-30[u-ca=roc]"}              | ${"years"}  | ${"P1M"}      | ${"grid roc i=121 +30 d"}
    ${"2023-09-30[u-ca=roc]"}              | ${"2023-11-28[u-ca=roc]"}              | ${"months"} | ${"P1M29D"}   | ${"grid roc i=121 +59 d"}
    ${"2023-09-30[u-ca=roc]"}              | ${"2023-11-28[u-ca=roc]"}              | ${"years"}  | ${"P1M29D"}   | ${"grid roc i=121 +59 d"}
    ${"2023-09-30[u-ca=roc]"}              | ${"2024-10-18[u-ca=roc]"}              | ${"months"} | ${"P12M18D"}  | ${"grid roc i=121 +384 d"}
    ${"2023-09-30[u-ca=roc]"}              | ${"2024-10-18[u-ca=roc]"}              | ${"years"}  | ${"P1Y18D"}   | ${"grid roc i=121 +384 d"}
    ${"2023-06-01"}                        | ${"2023-06-30"}                        | ${"months"} | ${"P29D"}     | ${"grid gregory i=0 +29 d"}
    ${"2023-06-01"}                        | ${"2023-06-30"}                        | ${"years"}  | ${"P29D"}     | ${"grid gregory i=0 +29 d"}
    ${"2023-06-01"}                        | ${"2023-07-01"}                        | ${"months"} | ${"P1M"}      | ${"grid gregory i=0 +30 d"}
    ${"2023-06-01"}                        | ${"2023-07-01"}                        | ${"years"}  | ${"P1M"}      | ${"grid gregory i=0 +30 d"}
    ${"2023-06-01"}                        | ${"2023-07-30"}                        | ${"months"} | ${"P1M29D"}   | ${"grid gregory i=0 +59 d"}
    ${"2023-06-01"}                        | ${"2023-07-30"}                        | ${"years"}  | ${"P1M29D"}   | ${"grid gregory i=0 +59 d"}
    ${"2023-06-01"}                        | ${"2024-06-19"}                        | ${"months"} | ${"P12M18D"}  | ${"grid gregory i=0 +384 d"}
    ${"2023-06-01"}                        | ${"2024-06-19"}                        | ${"years"}  | ${"P1Y18D"}   | ${"grid gregory i=0 +384 d"}
    ${"2023-06-30"}                        | ${"2023-07-29"}                        | ${"months"} | ${"P29D"}     | ${"grid gregory i=29 +29 d"}
    ${"2023-06-30"}                        | ${"2023-07-29"}                        | ${"years"}  | ${"P29D"}     | ${"grid gregory i=29 +29 d"}
    ${"2023-06-30"}                        | ${"2023-07-30"}                        | ${"months"} | ${"P1M"}      | ${"grid gregory i=29 +30 d"}
    ${"2023-06-30"}                        | ${"2023-07-30"}                        | ${"years"}  | ${"P1M"}      | ${"grid gregory i=29 +30 d"}
    ${"2023-06-30"}                        | ${"2023-08-28"}                        | ${"months"} | ${"P1M29D"}   | ${"grid gregory i=29 +59 d"}
    ${"2023-06-30"}                        | ${"2023-08-28"}                        | ${"years"}  | ${"P1M29D"}   | ${"grid gregory i=29 +59 d"}
    ${"2023-06-30"}                        | ${"2024-07-18"}                        | ${"months"} | ${"P12M18D"}  | ${"grid gregory i=29 +384 d"}
    ${"2023-06-30"}                        | ${"2024-07-18"}                        | ${"years"}  | ${"P1Y18D"}   | ${"grid gregory i=29 +384 d"}
    ${"2023-09-30"}                        | ${"2023-10-29"}                        | ${"months"} | ${"P29D"}     | ${"grid gregory i=121 +29 d"}
    ${"2023-09-30"}                        | ${"2023-10-29"}                        | ${"years"}  | ${"P29D"}     | ${"grid gregory i=121 +29 d"}
    ${"2023-09-30"}                        | ${"2023-10-30"}                        | ${"months"} | ${"P1M"}      | ${"grid gregory i=121 +30 d"}
    ${"2023-09-30"}                        | ${"2023-10-30"}                        | ${"years"}  | ${"P1M"}      | ${"grid gregory i=121 +30 d"}
    ${"2023-09-30"}                        | ${"2023-11-28"}                        | ${"months"} | ${"P1M29D"}   | ${"grid gregory i=121 +59 d"}
    ${"2023-09-30"}                        | ${"2023-11-28"}                        | ${"years"}  | ${"P1M29D"}   | ${"grid gregory i=121 +59 d"}
    ${"2023-09-30"}                        | ${"2024-10-18"}                        | ${"months"} | ${"P12M18D"}  | ${"grid gregory i=121 +384 d"}
    ${"2023-09-30"}                        | ${"2024-10-18"}                        | ${"years"}  | ${"P1Y18D"}   | ${"grid gregory i=121 +384 d"}
  `(
    "returns $expected for $unit from $date1 to $date2 ($source)",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );
});

// CORE-6 S6: with rounding options a non-ISO difference is TC39 DifferenceTemporalPlainDate: the
// NonISODateUntil result, then RoundRelativeDuration with GetUTCEpochNanoseconds (no time zone).
// A day-1 increment is no rounding at all. Values: Chromium 153 native Temporal
// (`PlainDate.withCalendar(c).until(…, { largestUnit, smallestUnit, roundingMode })`).
describe("diffDateAsDuration with rounding options in non-ISO calendars (CORE-6)", () => {
  it.each`
    start                           | end                             | unit        | options                                                   | expected     | reason
    ${"2023-08-31[u-ca=buddhist]"}  | ${"2023-09-30[u-ca=buddhist]"}  | ${"months"} | ${{ smallestUnit: "days" }}                               | ${"P30D"}    | ${"D6: smallestUnit day with increment 1 does not round"}
    ${"2023-08-31[u-ca=buddhist]"}  | ${"2023-09-30[u-ca=buddhist]"}  | ${"months"} | ${{ smallestUnit: "months", roundingMode: "trunc" }}      | ${"P1M"}     | ${"D6 rounded to months: the 1-month window ends exactly on the end date"}
    ${"2024-02-11[u-ca=hebrew]"}    | ${"2025-03-01[u-ca=hebrew]"}    | ${"years"}  | ${{ smallestUnit: "days" }}                               | ${"P12M29D"} | ${"D7: smallestUnit day with increment 1 does not round"}
    ${"2024-02-11[u-ca=hebrew]"}    | ${"2025-03-01[u-ca=hebrew]"}    | ${"years"}  | ${{ smallestUnit: "months", roundingMode: "trunc" }}      | ${"P12M"}    | ${"D7 truncated to months"}
    ${"2024-02-11[u-ca=hebrew]"}    | ${"2025-03-01[u-ca=hebrew]"}    | ${"years"}  | ${{ smallestUnit: "months", roundingMode: "halfExpand" }} | ${"P1Y"}     | ${"D7 half-expanded to months, then bubbled to a year"}
    ${"+275760-07-06[u-ca=hebrew]"} | ${"+275760-09-13[u-ca=hebrew]"} | ${"months"} | ${{ smallestUnit: "days" }}                               | ${"P2M10D"}  | ${"D1 up to the maximum"}
    ${"+275760-07-06[u-ca=hebrew]"} | ${"+275760-09-13[u-ca=hebrew]"} | ${"months"} | ${{ smallestUnit: "months" }}                             | ${""}        | ${"D1: the 3-month window ends past the maximum, so Temporal throws"}
  `(
    "returns $expected from $start to $end in $unit with $options ($reason)",
    ({ start, end, unit, options, expected }) => {
      expect(diffDateAsDuration(start, end, unit, options)).toBe(expected);
    },
  );

  // The halfExpand row, derived from the TC39 algorithm step by step:
  // 1. DifferenceISODateTime → CalendarDateUntil(5784-06-02, 5785-06-01, year) = 0 years 12 months
  //    29 days (the D7 row above).
  // 2. NudgeToCalendarUnit(month): r1 = 12, r2 = 13 months.
  //    start = 5784-06-02 + 12 months = 5785-05-02 (ISO 2025-01-31);
  //    end = 5784-06-02 + 13 months = 5785-06-02 (ISO 2025-03-02); destination = 5785-06-01.
  //    5785 M05 (Shevat) has 30 days, so progress = 29 days and span = 30 days.
  // 3. halfExpand: 2 × 29 > 30, so the result rounds up to r2 = 13 months and expands the unit
  //    (trunc keeps r1 = 12 months: P12M).
  // 4. BubbleRelativeDuration(year): 5784-06-02 + 1 year constrains M05L to M06 in the common
  //    year 5785, giving 5785-06-02 — the nudged end itself, not past it — so 13 months become
  //    1 year: P1Y. Chromium 153 agrees.
  it("rounds 5784-06-02 to 5785-06-01 in hebrew to P1Y with smallestUnit month and halfExpand", () => {
    expect(
      diffDateAsDuration(
        "2024-02-11[u-ca=hebrew]",
        "2025-03-01[u-ca=hebrew]",
        "years",
        {
          smallestUnit: "months",
          roundingMode: "halfExpand",
        },
      ),
    ).toBe("P1Y");
  });
});

// Temporal §13.17 GetTemporalUnitValuedOption: a singular unit name is the same unit as its plural.
// Values from native Temporal (Chromium 153).
describe("diffDateAsDuration with singular unit names", () => {
  it.each`
    end             | unit       | expected
    ${"2024-01-08"} | ${"week"}  | ${"P1W"}
    ${"2024-01-08"} | ${"day"}   | ${"P7D"}
    ${"2025-03-01"} | ${"month"} | ${"P14M"}
    ${"2025-03-01"} | ${"year"}  | ${"P1Y2M"}
  `(
    "returns $expected for singular unit $unit from 2024-01-01 to $end",
    ({ end, unit, expected }) => {
      expect(diffDateAsDuration("2024-01-01", end, unit)).toBe(expected);
    },
  );
});

// Temporal GetOptionsObject: an options argument that is not an object or undefined throws
// TypeError (native Chromium 153: `until(other, null)`, `"x"`, `5` and `true` all throw), so each is
// invalid input. Omitted options measure normally (P31D).
describe("diffDateAsDuration with a non-object options argument", () => {
  it.each`
    options      | expected
    ${null}      | ${""}
    ${"x"}       | ${""}
    ${5}         | ${""}
    ${true}      | ${""}
    ${undefined} | ${"P31D"}
  `("returns $expected for options $options", ({ options, expected }) => {
    expect(
      diffDateAsDuration("2024-01-01", "2024-02-01", "days", options),
    ).toBe(expected);
  });
});
