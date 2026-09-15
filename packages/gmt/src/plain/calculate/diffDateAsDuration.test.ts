import { diffDateAsDuration } from "./diffDateAsDuration";

describe("diffDateAsDuration", () => {
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
    ${"2024-02-29T12:00:00"}
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
    ${"day"}
    ${"month"}
    ${"year"}
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
        "5784-06-15[u-ca=hebrew]",
        "5784-07-15[u-ca=hebrew]",
        "months",
      ),
    ).toBe("P1M");
  });

  // CORE-6 D6: the Intl era/monthCode proposal's NonISODateSurpasses compares the un-constrained
  // day, so a month-end start does not count a month when the target month is shorter
  // (test262 intl402/Temporal/PlainDate/prototype/until/wrapping-at-end-of-month-*.js).
  // D7: a leap-year Adar I start must not throw "mixed-sign" (tc39/proposal-temporal#3159).
  // D1-U: the polyfill throws within about a year of the maximum.
  // Expected values: Chromium 152 native Temporal (q2-grid-chromium152.json "grid", and
  // q2-xscan-chromium152.json "xscan max[n]"), test262, or the spec algorithm where named.
  it.each`
    date1                                          | date2                                          | unit        | expected             | reason
    ${"2566-08-31[u-ca=buddhist]"}                 | ${"2566-09-30[u-ca=buddhist]"}                 | ${"months"} | ${"P30D"}            | ${"D6: Aug 31 + 1 month is Sep 31, past Sep 30 (grid 2023-08-31 +30 d)"}
    ${"2566-08-31[u-ca=buddhist]"}                 | ${"2566-09-30[u-ca=buddhist]"}                 | ${"years"}  | ${"P30D"}            | ${"D6 with largestUnit years (grid 2023-08-31 +30 d)"}
    ${"2566-09-30[u-ca=buddhist]"}                 | ${"2566-08-31[u-ca=buddhist]"}                 | ${"months"} | ${"-P30D"}           | ${"D6 negated: Sep 30 - 1 month is Aug 30, not past Aug 31 (grid reverse column)"}
    ${"0005-08-31[u-ca=japanese;era=reiwa]"}       | ${"0005-09-30[u-ca=japanese;era=reiwa]"}       | ${"months"} | ${"P30D"}            | ${"D6 japanese (grid 2023-08-31 +30 d)"}
    ${"0112-08-31[u-ca=taiwan]"}                   | ${"0112-09-30[u-ca=taiwan]"}                   | ${"months"} | ${"P30D"}            | ${"D6 taiwan/roc (grid 2023-08-31 +30 d)"}
    ${"1446-01-30[u-ca=islamic-civil]"}            | ${"1446-02-29[u-ca=islamic-civil]"}            | ${"months"} | ${"P29D"}            | ${"D6 islamic-civil: Muharram 30 + 1 month is Safar 30, past Safar 29 (29-day Safar)"}
    ${"1444-11-30[u-ca=islamic-civil]"}            | ${"1444-12-29[u-ca=islamic-civil]"}            | ${"months"} | ${"P29D"}            | ${"D6 islamic-civil (grid 2023-06-19 +29 d)"}
    ${"1444-11-30[u-ca=islamic-tabular]"}          | ${"1444-12-29[u-ca=islamic-tabular]"}          | ${"months"} | ${"P29D"}            | ${"D6 islamic-tbla (grid 2023-06-18 +29 d)"}
    ${"1444-12-30[u-ca=islamic-umalqura]"}         | ${"1445-01-29[u-ca=islamic-umalqura]"}         | ${"years"}  | ${"P29D"}            | ${"D6 islamic-umalqura across a year end (grid 2023-07-18 +29 d)"}
    ${"1402-06-31[u-ca=persian]"}                  | ${"1402-07-30[u-ca=persian]"}                  | ${"months"} | ${"P30D"}            | ${"D6 persian (grid 2023-09-22 +30 d)"}
    ${"1402-07-30[u-ca=persian]"}                  | ${"1402-06-31[u-ca=persian]"}                  | ${"years"}  | ${"-P30D"}           | ${"D6 persian negated (grid reverse column)"}
    ${"1945-06-31[u-ca=indian]"}                   | ${"1945-07-30[u-ca=indian]"}                   | ${"months"} | ${"P30D"}            | ${"D6 indian (grid 2023-09-22 +30 d)"}
    ${"5783-09-30[u-ca=hebrew]"}                   | ${"5783-10-29[u-ca=hebrew]"}                   | ${"months"} | ${"P29D"}            | ${"D6 hebrew Sivan 30 -> Tammuz 29 (grid 2023-06-19 +29 d)"}
    ${"5783-07-30[u-ca=hebrew]"}                   | ${"5783-08-29[u-ca=hebrew]"}                   | ${"months"} | ${"P29D"}            | ${"D6 hebrew Nisan 30 -> Iyar 29 (test262 wrapping-at-end-of-month-hebrew.js)"}
    ${"7515-12-07[u-ca=ethiopic-amete-alem]"}      | ${"7515-13-06[u-ca=ethiopic-amete-alem]"}      | ${"months"} | ${"P29D"}            | ${"D6 ethioaa into the 6-day Pagumen (grid 2023-08-13 +29 d)"}
    ${"7515-11-30[u-ca=ethiopic-amete-alem]"}      | ${"7516-13-05[u-ca=ethiopic-amete-alem]"}      | ${"years"}  | ${"P1Y1M5D"}         | ${"D6: Hamle 30 + 1Y2M is Pagumen 30, past Pagumen 5 (spec NonISODateSurpasses)"}
    ${"1739-11-30[u-ca=coptic]"}                   | ${"1740-13-05[u-ca=coptic]"}                   | ${"years"}  | ${"P1Y1M5D"}         | ${"D6 coptic: same ISO dates as the ethioaa row (coptic = ethioaa - 5776)"}
    ${"2015-11-30[u-ca=ethiopic;era=ethiopic]"}    | ${"2016-13-05[u-ca=ethiopic;era=ethiopic]"}    | ${"years"}  | ${"P1Y1M5D"}         | ${"D6 ethiopic: same ISO dates as the ethioaa row (ethiopic era year = ethioaa - 5500)"}
    ${"5784-06-02[u-ca=hebrew]"}                   | ${"5785-06-01[u-ca=hebrew]"}                   | ${"years"}  | ${"P12M29D"}         | ${"D7: Adar I 2 + 1 year is Adar 2, past Adar 1 (grid 2024-02-11 +384 d)"}
    ${"5785-06-01[u-ca=hebrew]"}                   | ${"5784-06-02[u-ca=hebrew]"}                   | ${"years"}  | ${"-P1Y29D"}         | ${"D7 negated: Adar 1 - 1 year is Adar I 1, not past Adar I 2 (grid reverse column)"}
    ${"5784-06-02[u-ca=hebrew]"}                   | ${"5785-06-01[u-ca=hebrew]"}                   | ${"months"} | ${"P12M29D"}         | ${"D7 row with largestUnit months (grid 2024-02-11 +384 d)"}
    ${"279517-08-01[u-ca=hebrew]"}                 | ${"279517-10-11[u-ca=hebrew]"}                 | ${"months"} | ${"P2M10D"}          | ${"D1-U hebrew up to the maximum (xscan max[69])"}
    ${"276303-07-01[u-ca=buddhist]"}               | ${"276303-09-13[u-ca=buddhist]"}               | ${"months"} | ${"P2M12D"}          | ${"D1-U buddhist up to the maximum (xscan max[74])"}
    ${"281247-03-01[u-ca=ethiopic-amete-alem]"}    | ${"281247-05-22[u-ca=ethiopic-amete-alem]"}    | ${"months"} | ${"P2M21D"}          | ${"D1-U ethioaa up to the maximum (xscan max[81])"}
    ${"283583-03-08[u-ca=islamic-civil]"}          | ${"283583-05-23[u-ca=islamic-civil]"}          | ${"months"} | ${"P2M15D"}          | ${"D1-U islamic-civil up to the maximum (xscan max[74])"}
    ${"275139-04-31[u-ca=persian]"}                | ${"275139-07-12[u-ca=persian]"}                | ${"months"} | ${"P2M12D"}          | ${"D1-U persian up to the maximum (xscan max[74])"}
    ${"5785-01-01[u-ca=hebrew]"}                   | ${"279517-10-11[u-ca=hebrew]"}                 | ${"years"}  | ${"P273732Y9M10D"}   | ${"D1-U long span: 279517 is leap, so Tishri + 9 months is ordinal month 10 (spec NonISODateUntil)"}
    ${"-280804-03-21[u-ca=islamic-civil]"}         | ${"-280804-05-07[u-ca=islamic-civil]"}         | ${"months"} | ${"P1M15D"}          | ${"D1-U from the minimum (xscan islamic-civil min[45])"}
    ${"-271275-01-13[u-ca=buddhist]"}              | ${"-271274-02-17[u-ca=buddhist]"}              | ${"years"}  | ${"P1Y1M4D"}         | ${"D2 buddhist (stride k=0, +400 d)"}
    ${"-261967-01-30[u-ca=buddhist]"}              | ${"-261966-03-06[u-ca=buddhist]"}              | ${"years"}  | ${"P1Y1M6D"}         | ${"D2 buddhist month end (stride k=34, +400 d)"}
    ${"1943-07-25[u-ca=buddhist]"}                 | ${"1944-08-29[u-ca=buddhist]"}                 | ${"years"}  | ${"P1Y1M4D"}         | ${"D2 buddhist ISO 1400 (stride k=998, +400 d)"}
    ${"-271278-04-19[u-ca=buddhist]"}              | ${"-271277-05-23[u-ca=buddhist]"}              | ${"months"} | ${"P13M4D"}          | ${"D2 buddhist from the minimum (xscan min[400])"}
    ${"-268055-07-30[u-ca=hebrew]"}                | ${"-268054-09-15[u-ca=hebrew]"}                | ${"years"}  | ${"P1Y15D"}          | ${"D3/D4 hebrew (stride k=0, +400 d)"}
    ${"-178808-03-15[u-ca=hebrew]"}                | ${"-178807-05-01[u-ca=hebrew]"}                | ${"years"}  | ${"P1Y1M15D"}        | ${"D3/D4 hebrew (stride k=326, +400 d)"}
    ${"-000041-05-16[u-ca=hebrew]"}                | ${"-000040-07-03[u-ca=hebrew]"}                | ${"years"}  | ${"P1Y1M17D"}        | ${"D3/D4 hebrew (stride k=979, +400 d)"}
    ${"-266686-06-03[u-ca=hebrew]"}                | ${"-266685-06-18[u-ca=hebrew]"}                | ${"years"}  | ${"P1Y15D"}          | ${"D3/D4 hebrew Adar I start (stride k=5, +400 d)"}
    ${"-268058-11-04[u-ca=hebrew]"}                | ${"-268057-12-21[u-ca=hebrew]"}                | ${"months"} | ${"P13M17D"}         | ${"D3/D4 hebrew from the minimum (xscan min[400])"}
    ${"-271897-10-23[u-ca=indian]"}                | ${"-271896-11-28[u-ca=indian]"}                | ${"years"}  | ${"P1Y1M5D"}         | ${"D5 indian (stride k=0, +400 d)"}
    ${"-090664-12-12[u-ca=indian]"}                | ${"-090662-01-17[u-ca=indian]"}                | ${"years"}  | ${"P1Y1M5D"}         | ${"D5 indian across a Saka year end (stride k=662, +400 d)"}
    ${"-261767-02-30[u-ca=indian]"}                | ${"-261766-04-02[u-ca=indian]"}                | ${"years"}  | ${"P1Y1M3D"}         | ${"D5 indian (stride k=37, +400 d)"}
    ${"-271899-01-29[u-ca=indian]"}                | ${"-271898-03-02[u-ca=indian]"}                | ${"months"} | ${"P13M4D"}          | ${"D5 indian from the minimum (xscan min[400])"}
  `(
    "returns $expected for $unit from $date1 to $date2 ($reason)",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );

  it('returns "" for a datetime/zoned string instead of silently truncating to its date portion (parseCalendarDateValue regression, E5)', () => {
    expect(
      diffDateAsDuration("2024-03-10T14:30:00", "2024-03-15", "days"),
    ).toBe("");
  });

  // CORE-6 modern grid subset (spec §4.4): every calendar, from a mid-month start and two
  // calendar month-end starts, across 29, 30, 59 and 384 days. Expected values: Chromium 152 native
  // Temporal (q2-grid-chromium152.json, base 2023-06-01 + i days); gregory rows are bare ISO.
  it.each`
    date1                                     | date2                                     | unit        | expected      | source
    ${"2566-06-01[u-ca=buddhist]"}            | ${"2566-06-30[u-ca=buddhist]"}            | ${"months"} | ${"P29D"}     | ${"grid buddhist i=0 +29 d"}
    ${"2566-06-01[u-ca=buddhist]"}            | ${"2566-06-30[u-ca=buddhist]"}            | ${"years"}  | ${"P29D"}     | ${"grid buddhist i=0 +29 d"}
    ${"2566-06-01[u-ca=buddhist]"}            | ${"2566-07-01[u-ca=buddhist]"}            | ${"months"} | ${"P1M"}      | ${"grid buddhist i=0 +30 d"}
    ${"2566-06-01[u-ca=buddhist]"}            | ${"2566-07-01[u-ca=buddhist]"}            | ${"years"}  | ${"P1M"}      | ${"grid buddhist i=0 +30 d"}
    ${"2566-06-01[u-ca=buddhist]"}            | ${"2566-07-30[u-ca=buddhist]"}            | ${"months"} | ${"P1M29D"}   | ${"grid buddhist i=0 +59 d"}
    ${"2566-06-01[u-ca=buddhist]"}            | ${"2566-07-30[u-ca=buddhist]"}            | ${"years"}  | ${"P1M29D"}   | ${"grid buddhist i=0 +59 d"}
    ${"2566-06-01[u-ca=buddhist]"}            | ${"2567-06-19[u-ca=buddhist]"}            | ${"months"} | ${"P12M18D"}  | ${"grid buddhist i=0 +384 d"}
    ${"2566-06-01[u-ca=buddhist]"}            | ${"2567-06-19[u-ca=buddhist]"}            | ${"years"}  | ${"P1Y18D"}   | ${"grid buddhist i=0 +384 d"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${"2566-07-29[u-ca=buddhist]"}            | ${"months"} | ${"P29D"}     | ${"grid buddhist i=29 +29 d"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${"2566-07-29[u-ca=buddhist]"}            | ${"years"}  | ${"P29D"}     | ${"grid buddhist i=29 +29 d"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${"2566-07-30[u-ca=buddhist]"}            | ${"months"} | ${"P1M"}      | ${"grid buddhist i=29 +30 d"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${"2566-07-30[u-ca=buddhist]"}            | ${"years"}  | ${"P1M"}      | ${"grid buddhist i=29 +30 d"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${"2566-08-28[u-ca=buddhist]"}            | ${"months"} | ${"P1M29D"}   | ${"grid buddhist i=29 +59 d"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${"2566-08-28[u-ca=buddhist]"}            | ${"years"}  | ${"P1M29D"}   | ${"grid buddhist i=29 +59 d"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${"2567-07-18[u-ca=buddhist]"}            | ${"months"} | ${"P12M18D"}  | ${"grid buddhist i=29 +384 d"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${"2567-07-18[u-ca=buddhist]"}            | ${"years"}  | ${"P1Y18D"}   | ${"grid buddhist i=29 +384 d"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${"2566-10-29[u-ca=buddhist]"}            | ${"months"} | ${"P29D"}     | ${"grid buddhist i=121 +29 d"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${"2566-10-29[u-ca=buddhist]"}            | ${"years"}  | ${"P29D"}     | ${"grid buddhist i=121 +29 d"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${"2566-10-30[u-ca=buddhist]"}            | ${"months"} | ${"P1M"}      | ${"grid buddhist i=121 +30 d"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${"2566-10-30[u-ca=buddhist]"}            | ${"years"}  | ${"P1M"}      | ${"grid buddhist i=121 +30 d"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${"2566-11-28[u-ca=buddhist]"}            | ${"months"} | ${"P1M29D"}   | ${"grid buddhist i=121 +59 d"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${"2566-11-28[u-ca=buddhist]"}            | ${"years"}  | ${"P1M29D"}   | ${"grid buddhist i=121 +59 d"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${"2567-10-18[u-ca=buddhist]"}            | ${"months"} | ${"P12M18D"}  | ${"grid buddhist i=121 +384 d"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${"2567-10-18[u-ca=buddhist]"}            | ${"years"}  | ${"P1Y18D"}   | ${"grid buddhist i=121 +384 d"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${"5783-10-11[u-ca=hebrew]"}              | ${"months"} | ${"P29D"}     | ${"grid hebrew i=0 +29 d"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${"5783-10-11[u-ca=hebrew]"}              | ${"years"}  | ${"P29D"}     | ${"grid hebrew i=0 +29 d"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${"5783-10-12[u-ca=hebrew]"}              | ${"months"} | ${"P1M"}      | ${"grid hebrew i=0 +30 d"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${"5783-10-12[u-ca=hebrew]"}              | ${"years"}  | ${"P1M"}      | ${"grid hebrew i=0 +30 d"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${"5783-11-12[u-ca=hebrew]"}              | ${"months"} | ${"P2M"}      | ${"grid hebrew i=0 +59 d"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${"5783-11-12[u-ca=hebrew]"}              | ${"years"}  | ${"P2M"}      | ${"grid hebrew i=0 +59 d"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${"5784-10-13[u-ca=hebrew]"}              | ${"months"} | ${"P13M1D"}   | ${"grid hebrew i=0 +384 d"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${"5784-10-13[u-ca=hebrew]"}              | ${"years"}  | ${"P1Y1D"}    | ${"grid hebrew i=0 +384 d"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${"5783-10-29[u-ca=hebrew]"}              | ${"months"} | ${"P29D"}     | ${"grid hebrew i=18 +29 d"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${"5783-10-29[u-ca=hebrew]"}              | ${"years"}  | ${"P29D"}     | ${"grid hebrew i=18 +29 d"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${"5783-11-01[u-ca=hebrew]"}              | ${"months"} | ${"P1M1D"}    | ${"grid hebrew i=18 +30 d"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${"5783-11-01[u-ca=hebrew]"}              | ${"years"}  | ${"P1M1D"}    | ${"grid hebrew i=18 +30 d"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${"5783-11-30[u-ca=hebrew]"}              | ${"months"} | ${"P2M"}      | ${"grid hebrew i=18 +59 d"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${"5783-11-30[u-ca=hebrew]"}              | ${"years"}  | ${"P2M"}      | ${"grid hebrew i=18 +59 d"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${"5784-11-01[u-ca=hebrew]"}              | ${"months"} | ${"P13M1D"}   | ${"grid hebrew i=18 +384 d"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${"5784-11-01[u-ca=hebrew]"}              | ${"years"}  | ${"P1Y1D"}    | ${"grid hebrew i=18 +384 d"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${"5784-01-29[u-ca=hebrew]"}              | ${"months"} | ${"P1M"}      | ${"grid hebrew i=106 +29 d"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${"5784-01-29[u-ca=hebrew]"}              | ${"years"}  | ${"P1M"}      | ${"grid hebrew i=106 +29 d"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${"5784-01-30[u-ca=hebrew]"}              | ${"months"} | ${"P1M1D"}    | ${"grid hebrew i=106 +30 d"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${"5784-01-30[u-ca=hebrew]"}              | ${"years"}  | ${"P1M1D"}    | ${"grid hebrew i=106 +30 d"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${"5784-02-29[u-ca=hebrew]"}              | ${"months"} | ${"P2M"}      | ${"grid hebrew i=106 +59 d"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${"5784-02-29[u-ca=hebrew]"}              | ${"years"}  | ${"P2M"}      | ${"grid hebrew i=106 +59 d"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${"5785-01-01[u-ca=hebrew]"}              | ${"months"} | ${"P13M1D"}   | ${"grid hebrew i=106 +384 d"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${"5785-01-01[u-ca=hebrew]"}              | ${"years"}  | ${"P1Y1D"}    | ${"grid hebrew i=106 +384 d"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${"1444-12-11[u-ca=islamic-civil]"}       | ${"months"} | ${"P29D"}     | ${"grid islamic-civil i=0 +29 d"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${"1444-12-11[u-ca=islamic-civil]"}       | ${"years"}  | ${"P29D"}     | ${"grid islamic-civil i=0 +29 d"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${"1444-12-12[u-ca=islamic-civil]"}       | ${"months"} | ${"P1M"}      | ${"grid islamic-civil i=0 +30 d"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${"1444-12-12[u-ca=islamic-civil]"}       | ${"years"}  | ${"P1M"}      | ${"grid islamic-civil i=0 +30 d"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${"1445-01-12[u-ca=islamic-civil]"}       | ${"months"} | ${"P2M"}      | ${"grid islamic-civil i=0 +59 d"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${"1445-01-12[u-ca=islamic-civil]"}       | ${"years"}  | ${"P2M"}      | ${"grid islamic-civil i=0 +59 d"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${"1445-12-12[u-ca=islamic-civil]"}       | ${"months"} | ${"P13M"}     | ${"grid islamic-civil i=0 +384 d"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${"1445-12-12[u-ca=islamic-civil]"}       | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-civil i=0 +384 d"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${"1444-12-29[u-ca=islamic-civil]"}       | ${"months"} | ${"P29D"}     | ${"grid islamic-civil i=18 +29 d"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${"1444-12-29[u-ca=islamic-civil]"}       | ${"years"}  | ${"P29D"}     | ${"grid islamic-civil i=18 +29 d"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${"1445-01-01[u-ca=islamic-civil]"}       | ${"months"} | ${"P1M1D"}    | ${"grid islamic-civil i=18 +30 d"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${"1445-01-01[u-ca=islamic-civil]"}       | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-civil i=18 +30 d"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${"1445-01-30[u-ca=islamic-civil]"}       | ${"months"} | ${"P2M"}      | ${"grid islamic-civil i=18 +59 d"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${"1445-01-30[u-ca=islamic-civil]"}       | ${"years"}  | ${"P2M"}      | ${"grid islamic-civil i=18 +59 d"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${"1445-12-30[u-ca=islamic-civil]"}       | ${"months"} | ${"P13M"}     | ${"grid islamic-civil i=18 +384 d"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${"1445-12-30[u-ca=islamic-civil]"}       | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-civil i=18 +384 d"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${"1445-03-29[u-ca=islamic-civil]"}       | ${"months"} | ${"P1M"}      | ${"grid islamic-civil i=106 +29 d"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${"1445-03-29[u-ca=islamic-civil]"}       | ${"years"}  | ${"P1M"}      | ${"grid islamic-civil i=106 +29 d"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${"1445-03-30[u-ca=islamic-civil]"}       | ${"months"} | ${"P1M1D"}    | ${"grid islamic-civil i=106 +30 d"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${"1445-03-30[u-ca=islamic-civil]"}       | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-civil i=106 +30 d"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${"1445-04-29[u-ca=islamic-civil]"}       | ${"months"} | ${"P2M"}      | ${"grid islamic-civil i=106 +59 d"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${"1445-04-29[u-ca=islamic-civil]"}       | ${"years"}  | ${"P2M"}      | ${"grid islamic-civil i=106 +59 d"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${"1446-03-29[u-ca=islamic-civil]"}       | ${"months"} | ${"P13M"}     | ${"grid islamic-civil i=106 +384 d"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${"1446-03-29[u-ca=islamic-civil]"}       | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-civil i=106 +384 d"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${"1444-12-12[u-ca=islamic-tabular]"}     | ${"months"} | ${"P29D"}     | ${"grid islamic-tbla i=0 +29 d"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${"1444-12-12[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P29D"}     | ${"grid islamic-tbla i=0 +29 d"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${"1444-12-13[u-ca=islamic-tabular]"}     | ${"months"} | ${"P1M"}      | ${"grid islamic-tbla i=0 +30 d"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${"1444-12-13[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P1M"}      | ${"grid islamic-tbla i=0 +30 d"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${"1445-01-13[u-ca=islamic-tabular]"}     | ${"months"} | ${"P2M"}      | ${"grid islamic-tbla i=0 +59 d"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${"1445-01-13[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P2M"}      | ${"grid islamic-tbla i=0 +59 d"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${"1445-12-13[u-ca=islamic-tabular]"}     | ${"months"} | ${"P13M"}     | ${"grid islamic-tbla i=0 +384 d"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${"1445-12-13[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-tbla i=0 +384 d"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${"1444-12-29[u-ca=islamic-tabular]"}     | ${"months"} | ${"P29D"}     | ${"grid islamic-tbla i=17 +29 d"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${"1444-12-29[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P29D"}     | ${"grid islamic-tbla i=17 +29 d"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${"1445-01-01[u-ca=islamic-tabular]"}     | ${"months"} | ${"P1M1D"}    | ${"grid islamic-tbla i=17 +30 d"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${"1445-01-01[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-tbla i=17 +30 d"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${"1445-01-30[u-ca=islamic-tabular]"}     | ${"months"} | ${"P2M"}      | ${"grid islamic-tbla i=17 +59 d"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${"1445-01-30[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P2M"}      | ${"grid islamic-tbla i=17 +59 d"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${"1445-12-30[u-ca=islamic-tabular]"}     | ${"months"} | ${"P13M"}     | ${"grid islamic-tbla i=17 +384 d"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${"1445-12-30[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-tbla i=17 +384 d"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${"1445-03-29[u-ca=islamic-tabular]"}     | ${"months"} | ${"P1M"}      | ${"grid islamic-tbla i=105 +29 d"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${"1445-03-29[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P1M"}      | ${"grid islamic-tbla i=105 +29 d"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${"1445-03-30[u-ca=islamic-tabular]"}     | ${"months"} | ${"P1M1D"}    | ${"grid islamic-tbla i=105 +30 d"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${"1445-03-30[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-tbla i=105 +30 d"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${"1445-04-29[u-ca=islamic-tabular]"}     | ${"months"} | ${"P2M"}      | ${"grid islamic-tbla i=105 +59 d"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${"1445-04-29[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P2M"}      | ${"grid islamic-tbla i=105 +59 d"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${"1446-03-29[u-ca=islamic-tabular]"}     | ${"months"} | ${"P13M"}     | ${"grid islamic-tbla i=105 +384 d"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${"1446-03-29[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-tbla i=105 +384 d"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${"1444-12-12[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P1M"}      | ${"grid islamic-umalqura i=0 +29 d"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${"1444-12-12[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1M"}      | ${"grid islamic-umalqura i=0 +29 d"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${"1444-12-13[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P1M1D"}    | ${"grid islamic-umalqura i=0 +30 d"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${"1444-12-13[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-umalqura i=0 +30 d"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${"1445-01-12[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P2M"}      | ${"grid islamic-umalqura i=0 +59 d"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${"1445-01-12[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P2M"}      | ${"grid islamic-umalqura i=0 +59 d"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${"1445-12-13[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P13M1D"}   | ${"grid islamic-umalqura i=0 +384 d"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${"1445-12-13[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1Y1M1D"}  | ${"grid islamic-umalqura i=0 +384 d"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${"1444-12-29[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P1M"}      | ${"grid islamic-umalqura i=17 +29 d"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${"1444-12-29[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1M"}      | ${"grid islamic-umalqura i=17 +29 d"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${"1444-12-30[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P1M1D"}    | ${"grid islamic-umalqura i=17 +30 d"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${"1444-12-30[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-umalqura i=17 +30 d"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${"1445-01-29[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P2M"}      | ${"grid islamic-umalqura i=17 +59 d"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${"1445-01-29[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P2M"}      | ${"grid islamic-umalqura i=17 +59 d"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${"1445-12-30[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P13M1D"}   | ${"grid islamic-umalqura i=17 +384 d"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${"1445-12-30[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1Y1M1D"}  | ${"grid islamic-umalqura i=17 +384 d"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${"1445-03-29[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P29D"}     | ${"grid islamic-umalqura i=106 +29 d"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${"1445-03-29[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P29D"}     | ${"grid islamic-umalqura i=106 +29 d"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${"1445-03-30[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P1M"}      | ${"grid islamic-umalqura i=106 +30 d"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${"1445-03-30[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1M"}      | ${"grid islamic-umalqura i=106 +30 d"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${"1445-04-29[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P1M29D"}   | ${"grid islamic-umalqura i=106 +59 d"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${"1445-04-29[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1M29D"}   | ${"grid islamic-umalqura i=106 +59 d"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${"1446-03-30[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P13M"}     | ${"grid islamic-umalqura i=106 +384 d"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${"1446-03-30[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-umalqura i=106 +384 d"}
    ${"1402-03-11[u-ca=persian]"}             | ${"1402-04-09[u-ca=persian]"}             | ${"months"} | ${"P29D"}     | ${"grid persian i=0 +29 d"}
    ${"1402-03-11[u-ca=persian]"}             | ${"1402-04-09[u-ca=persian]"}             | ${"years"}  | ${"P29D"}     | ${"grid persian i=0 +29 d"}
    ${"1402-03-11[u-ca=persian]"}             | ${"1402-04-10[u-ca=persian]"}             | ${"months"} | ${"P30D"}     | ${"grid persian i=0 +30 d"}
    ${"1402-03-11[u-ca=persian]"}             | ${"1402-04-10[u-ca=persian]"}             | ${"years"}  | ${"P30D"}     | ${"grid persian i=0 +30 d"}
    ${"1402-03-11[u-ca=persian]"}             | ${"1402-05-08[u-ca=persian]"}             | ${"months"} | ${"P1M28D"}   | ${"grid persian i=0 +59 d"}
    ${"1402-03-11[u-ca=persian]"}             | ${"1402-05-08[u-ca=persian]"}             | ${"years"}  | ${"P1M28D"}   | ${"grid persian i=0 +59 d"}
    ${"1402-03-11[u-ca=persian]"}             | ${"1403-03-30[u-ca=persian]"}             | ${"months"} | ${"P12M19D"}  | ${"grid persian i=0 +384 d"}
    ${"1402-03-11[u-ca=persian]"}             | ${"1403-03-30[u-ca=persian]"}             | ${"years"}  | ${"P1Y19D"}   | ${"grid persian i=0 +384 d"}
    ${"1402-03-31[u-ca=persian]"}             | ${"1402-04-29[u-ca=persian]"}             | ${"months"} | ${"P29D"}     | ${"grid persian i=20 +29 d"}
    ${"1402-03-31[u-ca=persian]"}             | ${"1402-04-29[u-ca=persian]"}             | ${"years"}  | ${"P29D"}     | ${"grid persian i=20 +29 d"}
    ${"1402-03-31[u-ca=persian]"}             | ${"1402-04-30[u-ca=persian]"}             | ${"months"} | ${"P30D"}     | ${"grid persian i=20 +30 d"}
    ${"1402-03-31[u-ca=persian]"}             | ${"1402-04-30[u-ca=persian]"}             | ${"years"}  | ${"P30D"}     | ${"grid persian i=20 +30 d"}
    ${"1402-03-31[u-ca=persian]"}             | ${"1402-05-28[u-ca=persian]"}             | ${"months"} | ${"P1M28D"}   | ${"grid persian i=20 +59 d"}
    ${"1402-03-31[u-ca=persian]"}             | ${"1402-05-28[u-ca=persian]"}             | ${"years"}  | ${"P1M28D"}   | ${"grid persian i=20 +59 d"}
    ${"1402-03-31[u-ca=persian]"}             | ${"1403-04-19[u-ca=persian]"}             | ${"months"} | ${"P12M19D"}  | ${"grid persian i=20 +384 d"}
    ${"1402-03-31[u-ca=persian]"}             | ${"1403-04-19[u-ca=persian]"}             | ${"years"}  | ${"P1Y19D"}   | ${"grid persian i=20 +384 d"}
    ${"1402-06-31[u-ca=persian]"}             | ${"1402-07-29[u-ca=persian]"}             | ${"months"} | ${"P29D"}     | ${"grid persian i=113 +29 d"}
    ${"1402-06-31[u-ca=persian]"}             | ${"1402-07-29[u-ca=persian]"}             | ${"years"}  | ${"P29D"}     | ${"grid persian i=113 +29 d"}
    ${"1402-06-31[u-ca=persian]"}             | ${"1402-07-30[u-ca=persian]"}             | ${"months"} | ${"P30D"}     | ${"grid persian i=113 +30 d"}
    ${"1402-06-31[u-ca=persian]"}             | ${"1402-07-30[u-ca=persian]"}             | ${"years"}  | ${"P30D"}     | ${"grid persian i=113 +30 d"}
    ${"1402-06-31[u-ca=persian]"}             | ${"1402-08-29[u-ca=persian]"}             | ${"months"} | ${"P1M29D"}   | ${"grid persian i=113 +59 d"}
    ${"1402-06-31[u-ca=persian]"}             | ${"1402-08-29[u-ca=persian]"}             | ${"years"}  | ${"P1M29D"}   | ${"grid persian i=113 +59 d"}
    ${"1402-06-31[u-ca=persian]"}             | ${"1403-07-19[u-ca=persian]"}             | ${"months"} | ${"P12M19D"}  | ${"grid persian i=113 +384 d"}
    ${"1402-06-31[u-ca=persian]"}             | ${"1403-07-19[u-ca=persian]"}             | ${"years"}  | ${"P1Y19D"}   | ${"grid persian i=113 +384 d"}
    ${"1945-03-11[u-ca=indian]"}              | ${"1945-04-09[u-ca=indian]"}              | ${"months"} | ${"P29D"}     | ${"grid indian i=0 +29 d"}
    ${"1945-03-11[u-ca=indian]"}              | ${"1945-04-09[u-ca=indian]"}              | ${"years"}  | ${"P29D"}     | ${"grid indian i=0 +29 d"}
    ${"1945-03-11[u-ca=indian]"}              | ${"1945-04-10[u-ca=indian]"}              | ${"months"} | ${"P30D"}     | ${"grid indian i=0 +30 d"}
    ${"1945-03-11[u-ca=indian]"}              | ${"1945-04-10[u-ca=indian]"}              | ${"years"}  | ${"P30D"}     | ${"grid indian i=0 +30 d"}
    ${"1945-03-11[u-ca=indian]"}              | ${"1945-05-08[u-ca=indian]"}              | ${"months"} | ${"P1M28D"}   | ${"grid indian i=0 +59 d"}
    ${"1945-03-11[u-ca=indian]"}              | ${"1945-05-08[u-ca=indian]"}              | ${"years"}  | ${"P1M28D"}   | ${"grid indian i=0 +59 d"}
    ${"1945-03-11[u-ca=indian]"}              | ${"1946-03-29[u-ca=indian]"}              | ${"months"} | ${"P12M18D"}  | ${"grid indian i=0 +384 d"}
    ${"1945-03-11[u-ca=indian]"}              | ${"1946-03-29[u-ca=indian]"}              | ${"years"}  | ${"P1Y18D"}   | ${"grid indian i=0 +384 d"}
    ${"1945-03-31[u-ca=indian]"}              | ${"1945-04-29[u-ca=indian]"}              | ${"months"} | ${"P29D"}     | ${"grid indian i=20 +29 d"}
    ${"1945-03-31[u-ca=indian]"}              | ${"1945-04-29[u-ca=indian]"}              | ${"years"}  | ${"P29D"}     | ${"grid indian i=20 +29 d"}
    ${"1945-03-31[u-ca=indian]"}              | ${"1945-04-30[u-ca=indian]"}              | ${"months"} | ${"P30D"}     | ${"grid indian i=20 +30 d"}
    ${"1945-03-31[u-ca=indian]"}              | ${"1945-04-30[u-ca=indian]"}              | ${"years"}  | ${"P30D"}     | ${"grid indian i=20 +30 d"}
    ${"1945-03-31[u-ca=indian]"}              | ${"1945-05-28[u-ca=indian]"}              | ${"months"} | ${"P1M28D"}   | ${"grid indian i=20 +59 d"}
    ${"1945-03-31[u-ca=indian]"}              | ${"1945-05-28[u-ca=indian]"}              | ${"years"}  | ${"P1M28D"}   | ${"grid indian i=20 +59 d"}
    ${"1945-03-31[u-ca=indian]"}              | ${"1946-04-18[u-ca=indian]"}              | ${"months"} | ${"P12M18D"}  | ${"grid indian i=20 +384 d"}
    ${"1945-03-31[u-ca=indian]"}              | ${"1946-04-18[u-ca=indian]"}              | ${"years"}  | ${"P1Y18D"}   | ${"grid indian i=20 +384 d"}
    ${"1945-06-31[u-ca=indian]"}              | ${"1945-07-29[u-ca=indian]"}              | ${"months"} | ${"P29D"}     | ${"grid indian i=113 +29 d"}
    ${"1945-06-31[u-ca=indian]"}              | ${"1945-07-29[u-ca=indian]"}              | ${"years"}  | ${"P29D"}     | ${"grid indian i=113 +29 d"}
    ${"1945-06-31[u-ca=indian]"}              | ${"1945-07-30[u-ca=indian]"}              | ${"months"} | ${"P30D"}     | ${"grid indian i=113 +30 d"}
    ${"1945-06-31[u-ca=indian]"}              | ${"1945-07-30[u-ca=indian]"}              | ${"years"}  | ${"P30D"}     | ${"grid indian i=113 +30 d"}
    ${"1945-06-31[u-ca=indian]"}              | ${"1945-08-29[u-ca=indian]"}              | ${"months"} | ${"P1M29D"}   | ${"grid indian i=113 +59 d"}
    ${"1945-06-31[u-ca=indian]"}              | ${"1945-08-29[u-ca=indian]"}              | ${"years"}  | ${"P1M29D"}   | ${"grid indian i=113 +59 d"}
    ${"1945-06-31[u-ca=indian]"}              | ${"1946-07-18[u-ca=indian]"}              | ${"months"} | ${"P12M18D"}  | ${"grid indian i=113 +384 d"}
    ${"1945-06-31[u-ca=indian]"}              | ${"1946-07-18[u-ca=indian]"}              | ${"years"}  | ${"P1Y18D"}   | ${"grid indian i=113 +384 d"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${"7515-10-23[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P29D"}     | ${"grid ethioaa i=0 +29 d"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${"7515-10-23[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P29D"}     | ${"grid ethioaa i=0 +29 d"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${"7515-10-24[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P1M"}      | ${"grid ethioaa i=0 +30 d"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${"7515-10-24[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P1M"}      | ${"grid ethioaa i=0 +30 d"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${"7515-11-23[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P1M29D"}   | ${"grid ethioaa i=0 +59 d"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${"7515-11-23[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P1M29D"}   | ${"grid ethioaa i=0 +59 d"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${"7516-10-12[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P13M18D"}  | ${"grid ethioaa i=0 +384 d"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${"7516-10-12[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P1Y18D"}   | ${"grid ethioaa i=0 +384 d"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${"7515-10-29[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P29D"}     | ${"grid ethioaa i=6 +29 d"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${"7515-10-29[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P29D"}     | ${"grid ethioaa i=6 +29 d"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${"7515-10-30[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P1M"}      | ${"grid ethioaa i=6 +30 d"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${"7515-10-30[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P1M"}      | ${"grid ethioaa i=6 +30 d"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${"7515-11-29[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P1M29D"}   | ${"grid ethioaa i=6 +59 d"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${"7515-11-29[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P1M29D"}   | ${"grid ethioaa i=6 +59 d"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${"7516-10-18[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P13M18D"}  | ${"grid ethioaa i=6 +384 d"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${"7516-10-18[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P1Y18D"}   | ${"grid ethioaa i=6 +384 d"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${"7516-01-23[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P1M23D"}   | ${"grid ethioaa i=96 +29 d"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${"7516-01-23[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P1M23D"}   | ${"grid ethioaa i=96 +29 d"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${"7516-01-24[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P1M24D"}   | ${"grid ethioaa i=96 +30 d"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${"7516-01-24[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P1M24D"}   | ${"grid ethioaa i=96 +30 d"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${"7516-02-23[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P2M23D"}   | ${"grid ethioaa i=96 +59 d"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${"7516-02-23[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P2M23D"}   | ${"grid ethioaa i=96 +59 d"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${"7517-01-13[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P14M13D"}  | ${"grid ethioaa i=96 +384 d"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${"7517-01-13[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P1Y1M13D"} | ${"grid ethioaa i=96 +384 d"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P29D"}     | ${"grid japanese i=0 +29 d"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P29D"}     | ${"grid japanese i=0 +29 d"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${"0005-07-01[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P1M"}      | ${"grid japanese i=0 +30 d"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${"0005-07-01[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P1M"}      | ${"grid japanese i=0 +30 d"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${"0005-07-30[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P1M29D"}   | ${"grid japanese i=0 +59 d"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${"0005-07-30[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P1M29D"}   | ${"grid japanese i=0 +59 d"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${"0006-06-19[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P12M18D"}  | ${"grid japanese i=0 +384 d"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${"0006-06-19[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P1Y18D"}   | ${"grid japanese i=0 +384 d"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${"0005-07-29[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P29D"}     | ${"grid japanese i=29 +29 d"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${"0005-07-29[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P29D"}     | ${"grid japanese i=29 +29 d"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${"0005-07-30[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P1M"}      | ${"grid japanese i=29 +30 d"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${"0005-07-30[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P1M"}      | ${"grid japanese i=29 +30 d"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${"0005-08-28[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P1M29D"}   | ${"grid japanese i=29 +59 d"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${"0005-08-28[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P1M29D"}   | ${"grid japanese i=29 +59 d"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${"0006-07-18[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P12M18D"}  | ${"grid japanese i=29 +384 d"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${"0006-07-18[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P1Y18D"}   | ${"grid japanese i=29 +384 d"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${"0005-10-29[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P29D"}     | ${"grid japanese i=121 +29 d"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${"0005-10-29[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P29D"}     | ${"grid japanese i=121 +29 d"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${"0005-10-30[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P1M"}      | ${"grid japanese i=121 +30 d"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${"0005-10-30[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P1M"}      | ${"grid japanese i=121 +30 d"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${"0005-11-28[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P1M29D"}   | ${"grid japanese i=121 +59 d"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${"0005-11-28[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P1M29D"}   | ${"grid japanese i=121 +59 d"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${"0006-10-18[u-ca=japanese;era=reiwa]"}  | ${"months"} | ${"P12M18D"}  | ${"grid japanese i=121 +384 d"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${"0006-10-18[u-ca=japanese;era=reiwa]"}  | ${"years"}  | ${"P1Y18D"}   | ${"grid japanese i=121 +384 d"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${"0112-06-30[u-ca=taiwan]"}              | ${"months"} | ${"P29D"}     | ${"grid roc i=0 +29 d"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${"0112-06-30[u-ca=taiwan]"}              | ${"years"}  | ${"P29D"}     | ${"grid roc i=0 +29 d"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${"0112-07-01[u-ca=taiwan]"}              | ${"months"} | ${"P1M"}      | ${"grid roc i=0 +30 d"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${"0112-07-01[u-ca=taiwan]"}              | ${"years"}  | ${"P1M"}      | ${"grid roc i=0 +30 d"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${"0112-07-30[u-ca=taiwan]"}              | ${"months"} | ${"P1M29D"}   | ${"grid roc i=0 +59 d"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${"0112-07-30[u-ca=taiwan]"}              | ${"years"}  | ${"P1M29D"}   | ${"grid roc i=0 +59 d"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${"0113-06-19[u-ca=taiwan]"}              | ${"months"} | ${"P12M18D"}  | ${"grid roc i=0 +384 d"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${"0113-06-19[u-ca=taiwan]"}              | ${"years"}  | ${"P1Y18D"}   | ${"grid roc i=0 +384 d"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${"0112-07-29[u-ca=taiwan]"}              | ${"months"} | ${"P29D"}     | ${"grid roc i=29 +29 d"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${"0112-07-29[u-ca=taiwan]"}              | ${"years"}  | ${"P29D"}     | ${"grid roc i=29 +29 d"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${"0112-07-30[u-ca=taiwan]"}              | ${"months"} | ${"P1M"}      | ${"grid roc i=29 +30 d"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${"0112-07-30[u-ca=taiwan]"}              | ${"years"}  | ${"P1M"}      | ${"grid roc i=29 +30 d"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${"0112-08-28[u-ca=taiwan]"}              | ${"months"} | ${"P1M29D"}   | ${"grid roc i=29 +59 d"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${"0112-08-28[u-ca=taiwan]"}              | ${"years"}  | ${"P1M29D"}   | ${"grid roc i=29 +59 d"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${"0113-07-18[u-ca=taiwan]"}              | ${"months"} | ${"P12M18D"}  | ${"grid roc i=29 +384 d"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${"0113-07-18[u-ca=taiwan]"}              | ${"years"}  | ${"P1Y18D"}   | ${"grid roc i=29 +384 d"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${"0112-10-29[u-ca=taiwan]"}              | ${"months"} | ${"P29D"}     | ${"grid roc i=121 +29 d"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${"0112-10-29[u-ca=taiwan]"}              | ${"years"}  | ${"P29D"}     | ${"grid roc i=121 +29 d"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${"0112-10-30[u-ca=taiwan]"}              | ${"months"} | ${"P1M"}      | ${"grid roc i=121 +30 d"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${"0112-10-30[u-ca=taiwan]"}              | ${"years"}  | ${"P1M"}      | ${"grid roc i=121 +30 d"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${"0112-11-28[u-ca=taiwan]"}              | ${"months"} | ${"P1M29D"}   | ${"grid roc i=121 +59 d"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${"0112-11-28[u-ca=taiwan]"}              | ${"years"}  | ${"P1M29D"}   | ${"grid roc i=121 +59 d"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${"0113-10-18[u-ca=taiwan]"}              | ${"months"} | ${"P12M18D"}  | ${"grid roc i=121 +384 d"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${"0113-10-18[u-ca=taiwan]"}              | ${"years"}  | ${"P1Y18D"}   | ${"grid roc i=121 +384 d"}
    ${"2023-06-01"}                           | ${"2023-06-30"}                           | ${"months"} | ${"P29D"}     | ${"grid gregory i=0 +29 d"}
    ${"2023-06-01"}                           | ${"2023-06-30"}                           | ${"years"}  | ${"P29D"}     | ${"grid gregory i=0 +29 d"}
    ${"2023-06-01"}                           | ${"2023-07-01"}                           | ${"months"} | ${"P1M"}      | ${"grid gregory i=0 +30 d"}
    ${"2023-06-01"}                           | ${"2023-07-01"}                           | ${"years"}  | ${"P1M"}      | ${"grid gregory i=0 +30 d"}
    ${"2023-06-01"}                           | ${"2023-07-30"}                           | ${"months"} | ${"P1M29D"}   | ${"grid gregory i=0 +59 d"}
    ${"2023-06-01"}                           | ${"2023-07-30"}                           | ${"years"}  | ${"P1M29D"}   | ${"grid gregory i=0 +59 d"}
    ${"2023-06-01"}                           | ${"2024-06-19"}                           | ${"months"} | ${"P12M18D"}  | ${"grid gregory i=0 +384 d"}
    ${"2023-06-01"}                           | ${"2024-06-19"}                           | ${"years"}  | ${"P1Y18D"}   | ${"grid gregory i=0 +384 d"}
    ${"2023-06-30"}                           | ${"2023-07-29"}                           | ${"months"} | ${"P29D"}     | ${"grid gregory i=29 +29 d"}
    ${"2023-06-30"}                           | ${"2023-07-29"}                           | ${"years"}  | ${"P29D"}     | ${"grid gregory i=29 +29 d"}
    ${"2023-06-30"}                           | ${"2023-07-30"}                           | ${"months"} | ${"P1M"}      | ${"grid gregory i=29 +30 d"}
    ${"2023-06-30"}                           | ${"2023-07-30"}                           | ${"years"}  | ${"P1M"}      | ${"grid gregory i=29 +30 d"}
    ${"2023-06-30"}                           | ${"2023-08-28"}                           | ${"months"} | ${"P1M29D"}   | ${"grid gregory i=29 +59 d"}
    ${"2023-06-30"}                           | ${"2023-08-28"}                           | ${"years"}  | ${"P1M29D"}   | ${"grid gregory i=29 +59 d"}
    ${"2023-06-30"}                           | ${"2024-07-18"}                           | ${"months"} | ${"P12M18D"}  | ${"grid gregory i=29 +384 d"}
    ${"2023-06-30"}                           | ${"2024-07-18"}                           | ${"years"}  | ${"P1Y18D"}   | ${"grid gregory i=29 +384 d"}
    ${"2023-09-30"}                           | ${"2023-10-29"}                           | ${"months"} | ${"P29D"}     | ${"grid gregory i=121 +29 d"}
    ${"2023-09-30"}                           | ${"2023-10-29"}                           | ${"years"}  | ${"P29D"}     | ${"grid gregory i=121 +29 d"}
    ${"2023-09-30"}                           | ${"2023-10-30"}                           | ${"months"} | ${"P1M"}      | ${"grid gregory i=121 +30 d"}
    ${"2023-09-30"}                           | ${"2023-10-30"}                           | ${"years"}  | ${"P1M"}      | ${"grid gregory i=121 +30 d"}
    ${"2023-09-30"}                           | ${"2023-11-28"}                           | ${"months"} | ${"P1M29D"}   | ${"grid gregory i=121 +59 d"}
    ${"2023-09-30"}                           | ${"2023-11-28"}                           | ${"years"}  | ${"P1M29D"}   | ${"grid gregory i=121 +59 d"}
    ${"2023-09-30"}                           | ${"2024-10-18"}                           | ${"months"} | ${"P12M18D"}  | ${"grid gregory i=121 +384 d"}
    ${"2023-09-30"}                           | ${"2024-10-18"}                           | ${"years"}  | ${"P1Y18D"}   | ${"grid gregory i=121 +384 d"}
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
    start                          | end                            | unit        | options                                                  | expected     | reason
    ${"2566-08-31[u-ca=buddhist]"} | ${"2566-09-30[u-ca=buddhist]"} | ${"months"} | ${{ smallestUnit: "days" }}                              | ${"P30D"}    | ${"D6: smallestUnit day with increment 1 does not round"}
    ${"2566-08-31[u-ca=buddhist]"} | ${"2566-09-30[u-ca=buddhist]"} | ${"months"} | ${{ smallestUnit: "months", roundingMode: "trunc" }}     | ${"P1M"}     | ${"D6 rounded to months: the 1-month window ends exactly on the end date"}
    ${"5784-06-02[u-ca=hebrew]"}   | ${"5785-06-01[u-ca=hebrew]"}   | ${"years"}  | ${{ smallestUnit: "days" }}                              | ${"P12M29D"} | ${"D7: smallestUnit day with increment 1 does not round"}
    ${"5784-06-02[u-ca=hebrew]"}   | ${"5785-06-01[u-ca=hebrew]"}   | ${"years"}  | ${{ smallestUnit: "months", roundingMode: "trunc" }}     | ${"P12M"}    | ${"D7 truncated to months"}
    ${"5784-06-02[u-ca=hebrew]"}   | ${"5785-06-01[u-ca=hebrew]"}   | ${"years"}  | ${{ smallestUnit: "months", roundingMode: "halfExpand" }} | ${"P1Y"}     | ${"D7 half-expanded to months, then bubbled to a year"}
    ${"279517-08-01[u-ca=hebrew]"} | ${"279517-10-11[u-ca=hebrew]"} | ${"months"} | ${{ smallestUnit: "days" }}                              | ${"P2M10D"}  | ${"D1 up to the maximum"}
    ${"279517-08-01[u-ca=hebrew]"} | ${"279517-10-11[u-ca=hebrew]"} | ${"months"} | ${{ smallestUnit: "months" }}                            | ${""}        | ${"D1: the 3-month window ends past the maximum, so Temporal throws"}
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
      diffDateAsDuration("5784-06-02[u-ca=hebrew]", "5785-06-01[u-ca=hebrew]", "years", {
        smallestUnit: "months",
        roundingMode: "halfExpand",
      }),
    ).toBe("P1Y");
  });
});
