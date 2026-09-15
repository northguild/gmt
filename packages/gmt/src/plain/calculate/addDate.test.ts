import {
  ethiopicPagumenFixture,
  hebrewLeapYear5784,
  islamicVariantDivergence,
  japaneseEraBoundary,
  persianLeapYearFixture,
} from "../../test";
import { addDate } from "./addDate";

describe("addDate", () => {
  it.each`
    value           | units                                         | expected
    ${"2024-02-29"} | ${{ days: 1 }}                                | ${"2024-03-01"}
    ${"2024-02-29"} | ${{ weeks: 1 }}                               | ${"2024-03-07"}
    ${"2024-01-31"} | ${{ months: 1 }}                              | ${"2024-02-29"}
    ${"2024-02-29"} | ${{ years: 1 }}                               | ${"2025-02-28"}
    ${"2024-02-29"} | ${{ years: 1, months: 1, weeks: 1, days: 1 }} | ${"2025-04-06"}
  `("returns $expected for $value + $units", ({ value, units, expected }) => {
    expect(addDate(value, units)).toBe(expected);
  });

  it.each`
    negativeAmount                                    | expectedDate
    ${{ years: -1 }}                                  | ${"2023-02-28"}
    ${{ months: -1 }}                                 | ${"2024-01-29"}
    ${{ weeks: -1 }}                                  | ${"2024-02-22"}
    ${{ days: -1 }}                                   | ${"2024-02-28"}
    ${{ years: -1, months: -1, weeks: -1, days: -1 }} | ${"2023-01-21"}
  `(
    "returns the correct date when adding a negative amount: $negativeAmount",
    ({ negativeAmount, expectedDate }) => {
      expect(addDate("2024-02-29", negativeAmount)).toEqual(expectedDate);
    },
  );

  it.each`
    value           | units                      | expected
    ${"2024-01-01"} | ${{ days: 0 }}             | ${"2024-01-01"}
    ${"2024-02-29"} | ${{ days: 0 }}             | ${"2024-02-29"}
    ${"2024-01-01"} | ${{ months: 0, years: 0 }} | ${"2024-01-01"}
  `(
    "returns $expected for zero-unit $value + $units",
    ({ value, units, expected }) => {
      expect(addDate(value, units)).toBe(expected);
    },
  );

  it.each`
    invalidDate
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
  `(
    "returns an empty string for an invalid date $invalidDate",
    ({ invalidDate }) => {
      expect(addDate(invalidDate, { days: 1 })).toEqual("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `("returns an empty string for an invalid unit", ({ invalidUnit }) => {
    expect(addDate("2024-02-29", { [invalidUnit as never]: 1 })).toEqual("");
  });

  it.each`
    invalidAmount
    ${"not-a-number"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
  `(
    "returns an empty string for an invalid amount: $invalidAmount",
    ({ invalidAmount }) => {
      expect(
        addDate("2024-02-29", { days: invalidAmount as never } as never),
      ).toEqual("");
    },
  );

  it.each`
    value           | units             | overflow       | expected
    ${"2024-01-31"} | ${{ months: 1 }}  | ${undefined}   | ${"2024-02-29"}
    ${"2024-01-31"} | ${{ months: 1 }}  | ${"constrain"} | ${"2024-02-29"}
    ${"2024-01-31"} | ${{ months: 1 }}  | ${"reject"}    | ${""}
    ${"2024-01-31"} | ${{ months: 13 }} | ${undefined}   | ${"2025-02-28"}
    ${"2024-01-31"} | ${{ months: 13 }} | ${"constrain"} | ${"2025-02-28"}
    ${"2024-01-31"} | ${{ months: 13 }} | ${"reject"}    | ${""}
    ${"2024-02-29"} | ${{ years: 1 }}   | ${undefined}   | ${"2025-02-28"}
    ${"2024-02-29"} | ${{ years: 1 }}   | ${"constrain"} | ${"2025-02-28"}
    ${"2024-02-29"} | ${{ years: 1 }}   | ${"reject"}    | ${""}
    ${"2024-01-15"} | ${{ months: 1 }}  | ${"reject"}    | ${"2024-02-15"}
    ${"2024-01-15"} | ${{ days: 1 }}    | ${"reject"}    | ${"2024-01-16"}
    ${"2024-03-31"} | ${{ months: -1 }} | ${undefined}   | ${"2024-02-29"}
    ${"2024-03-31"} | ${{ months: -1 }} | ${"constrain"} | ${"2024-02-29"}
    ${"2024-03-31"} | ${{ months: -1 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for $value + $units with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(
        addDate(
          value,
          units,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  // E5 (issue #78): addDate accepts a GMT calendar-annotated PlainDate string, resolves
  // calendar-unit arithmetic in that calendar, and re-derives the output tag (never copies
  // it) since arithmetic can cross a leap-month or era boundary. All goldens verified
  // directly against @js-temporal/polyfill during E5 research.
  it.each`
    value                                       | units            | options                      | expected                                | note
    ${hebrewLeapYear5784.adarI15}               | ${{ months: 1 }} | ${undefined}                 | ${hebrewLeapYear5784.adar15}            | ${"Adar I -> Adar (Hebrew leap month)"}
    ${japaneseEraBoundary.heisei31_0430}        | ${{ days: 1 }}   | ${undefined}                 | ${japaneseEraBoundary.reiwa1_0501}      | ${"Heisei -> Reiwa era transition"}
    ${islamicVariantDivergence.civil}           | ${{ months: 1 }} | ${undefined}                 | ${"1441-07-29[u-ca=islamic-civil]"}     | ${"islamic-civil variant"}
    ${islamicVariantDivergence.tabular}         | ${{ months: 1 }} | ${undefined}                 | ${"1441-08-01[u-ca=islamic-tabular]"}   | ${"islamic-tabular variant"}
    ${islamicVariantDivergence.umalqura}        | ${{ months: 1 }} | ${undefined}                 | ${"1441-07-29[u-ca=islamic-umalqura]"}  | ${"islamic-umalqura variant"}
    ${persianLeapYearFixture.month12day30_1403} | ${{ years: 1 }}  | ${undefined}                 | ${"1404-12-29[u-ca=persian]"}           | ${"Persian leap year -> non-leap (30 -> 29 day month 12)"}
    ${ethiopicPagumenFixture.m12d30_7515}       | ${{ months: 1 }} | ${{ overflow: "constrain" }} | ${ethiopicPagumenFixture.pagumen6_7515} | ${"30-day month 12 constrains into the 6-day leap Pagumen"}
  `(
    "returns $expected for calendar-annotated $value + $units ($note)",
    ({ value, units, options, expected }) => {
      expect(addDate(value, units, options)).toBe(expected);
    },
  );

  // CORE-6 D1-A: the polyfill's calendar add probes outside the legacy Date range within about a
  // year of a limit and throws. Expected values: Chromium 152 native Temporal
  // (q2-xscan-chromium152.json edge rows `[n]`). A result past the maximum must stay "" (TC39
  // ISODateWithinLimits): the workaround never clamps.
  it.each`
    value                           | units            | expected                         | reason
    ${"276302-09-13[u-ca=buddhist]"} | ${{ years: 1 }}  | ${"276303-09-13[u-ca=buddhist]"} | ${"D1-A: lands exactly on the maximum (xscan buddhist max[366])"}
    ${"279517-09-11[u-ca=hebrew]"}  | ${{ months: 1 }} | ${"279517-10-11[u-ca=hebrew]"}   | ${"lands exactly on the maximum (xscan hebrew max[29])"}
    ${"279517-09-12[u-ca=hebrew]"}  | ${{ months: 1 }} | ${""}                            | ${"one day past the maximum is a RangeError, not clamped (xscan hebrew max[28] ERR)"}
  `(
    "returns $expected for $value + $units ($reason)",
    ({ value, units, expected }) => {
      expect(addDate(value, units)).toBe(expected);
    },
  );

  // CORE-6 D1-A windows the polyfill throws in, away from the exact limit (read-model path).
  // Chromium 152 edge rows: result ISO dates are read back from the same scan's rows.
  it.each`
    value                                    | units            | expected                                 | reason
    ${"-280804-03-30[u-ca=islamic-civil]"}   | ${{ months: 1 }} | ${"-280804-04-29[u-ca=islamic-civil]"}   | ${"xscan islamic-civil min[9]: Rabi I 30 constrains to the 29-day Rabi II"}
    ${"-280804-05-30[u-ca=islamic-civil]"}   | ${{ months: 1 }} | ${"-280804-06-29[u-ca=islamic-civil]"}   | ${"xscan islamic-civil min[68]"}
    ${"-280804-05-30[u-ca=islamic-tabular]"} | ${{ months: 1 }} | ${"-280804-06-29[u-ca=islamic-tabular]"} | ${"xscan islamic-tbla min[67]"}
    ${"-280804-09-30[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"-280804-10-29[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura min[186]"}
    ${"-272442-11-30[u-ca=persian]"}         | ${{ months: 1 }} | ${"-272442-12-29[u-ca=persian]"}         | ${"xscan persian min[327]: into the 29-day Esfand"}
    ${"279516-09-11[u-ca=hebrew]"}           | ${{ years: 1 }}  | ${"279517-10-11[u-ca=hebrew]"}           | ${"xscan hebrew max[383]: Iyar 11 into leap 279517 is ordinal month 10, the maximum"}
    ${"279516-09-05[u-ca=hebrew]"}           | ${{ years: 1 }}  | ${"279517-10-05[u-ca=hebrew]"}           | ${"xscan hebrew max[389]"}
    ${"283582-05-23[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"283583-05-23[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura max[354]: lands on the maximum"}
  `(
    "returns $expected for $value + $units ($reason)",
    ({ value, units, expected }) => {
      expect(addDate(value, units)).toBe(expected);
    },
  );

  // CORE-6 corrected calendars, where polyfill 0.5.1 reads (and so adds) wrongly or throws:
  // buddhist before 1582-10-15 (D2), Hebrew years <= 0 (D3 + D4), Indian before ISO year 1 (D5).
  // Expected values: Chromium 152 stride and edge rows (q2-xscan-chromium152.json). Result ISO
  // dates become calendar strings through independent oracles (buddhist ISO year + 543;
  // Dershowitz–Reingold Hebrew; the Saka rule), each agreeing with every Chromium read of the
  // corrected-range samples; edge results are Chromium's own reads.
  it.each`
    value                             | units            | expected                          | reason
    ${"-271275-01-13[u-ca=buddhist]"} | ${{ months: 1 }} | ${"-271275-02-13[u-ca=buddhist]"} | ${"stride buddhist k=0"}
    ${"-271275-01-13[u-ca=buddhist]"} | ${{ years: 1 }}  | ${"-271274-01-13[u-ca=buddhist]"} | ${"stride buddhist k=0"}
    ${"-261967-01-30[u-ca=buddhist]"} | ${{ months: 1 }} | ${"-261967-02-28[u-ca=buddhist]"} | ${"stride buddhist k=34: constrains to the 28-day February"}
    ${"1943-07-25[u-ca=buddhist]"}    | ${{ years: 1 }}  | ${"1944-07-25[u-ca=buddhist]"}    | ${"stride buddhist k=998 (ISO 1400)"}
    ${"-271278-04-19[u-ca=buddhist]"} | ${{ years: 1 }}  | ${"-271277-04-19[u-ca=buddhist]"} | ${"xscan buddhist min[0]"}
    ${"-268055-07-30[u-ca=hebrew]"}   | ${{ months: 1 }} | ${"-268055-08-29[u-ca=hebrew]"}   | ${"stride hebrew k=0: Nisan 30 constrains to Iyar 29"}
    ${"-268055-07-30[u-ca=hebrew]"}   | ${{ years: 1 }}  | ${"-268054-08-30[u-ca=hebrew]"}   | ${"stride hebrew k=0: Nisan is ordinal 8 in leap -268054"}
    ${"-178808-03-15[u-ca=hebrew]"}   | ${{ years: 1 }}  | ${"-178807-03-15[u-ca=hebrew]"}   | ${"stride hebrew k=326"}
    ${"-000041-05-16[u-ca=hebrew]"}   | ${{ months: 1 }} | ${"-000041-06-16[u-ca=hebrew]"}   | ${"stride hebrew k=979, the last Hebrew year <= 0 sample"}
    ${"-266686-06-03[u-ca=hebrew]"}   | ${{ years: 1 }}  | ${"-266685-06-03[u-ca=hebrew]"}   | ${"stride hebrew k=5: Adar I (M05L) of leap -266686 constrains to Adar (M06) of common -266685"}
    ${"-266686-06-03[u-ca=hebrew]"}   | ${{ months: 1 }} | ${"-266686-07-03[u-ca=hebrew]"}   | ${"stride hebrew k=5: Adar I -> Adar"}
    ${"-268058-12-14[u-ca=hebrew]"}   | ${{ years: 1 }}  | ${"-268057-13-14[u-ca=hebrew]"}   | ${"xscan hebrew min[40]: Adar into leap -268057 is ordinal 13's predecessor code"}
    ${"-268057-12-21[u-ca=hebrew]"}   | ${{ months: 1 }} | ${"-268057-13-21[u-ca=hebrew]"}   | ${"xscan hebrew min[400]"}
    ${"0000-01-13[u-ca=hebrew]"}      | ${{ years: 2 }}  | ${"0002-01-13[u-ca=hebrew]"}      | ${"from the corrected range into year 2: Tishri 13 exists every year (spec NonISODateAdd)"}
    ${"-271897-10-23[u-ca=indian]"}   | ${{ months: 1 }} | ${"-271897-11-23[u-ca=indian]"}   | ${"stride indian k=0"}
    ${"-090664-12-12[u-ca=indian]"}   | ${{ months: 1 }} | ${"-090663-01-12[u-ca=indian]"}   | ${"stride indian k=662: across the Saka year end"}
    ${"-261767-02-30[u-ca=indian]"}   | ${{ years: 1 }}  | ${"-261766-02-30[u-ca=indian]"}   | ${"stride indian k=37"}
    ${"-000321-09-28[u-ca=indian]"}   | ${{ years: 1 }}  | ${"-000320-09-28[u-ca=indian]"}   | ${"stride indian k=992 (ISO -243)"}
    ${"-271899-01-29[u-ca=indian]"}   | ${{ months: 1 }} | ${"-271899-02-29[u-ca=indian]"}   | ${"xscan indian min[0]"}
  `(
    "returns $expected for $value + $units ($reason)",
    ({ value, units, expected }) => {
      expect(addDate(value, units)).toBe(expected);
    },
  );

  it('returns "" when overflow: "reject" hits the Ethiopic Pagumen boundary (the sharpest overflow case in the library)', () => {
    expect(
      addDate(
        ethiopicPagumenFixture.m12d30_7515,
        { months: 1 },
        { overflow: "reject" },
      ),
    ).toBe("");
  });

  it('returns "" for a datetime/zoned string instead of silently truncating to its date portion (parseCalendarDateValue regression, E5)', () => {
    expect(addDate("2024-03-10T14:30:00", { days: 1 })).toBe("");
  });

  // CORE-6 modern grid subset (spec §4.4): +1 month (constrain and reject), +1 year and -13 months
  // from the same starts as diffDateAsDuration.test.ts. Expected values: Chromium 152 native
  // Temporal (q2-grid-chromium152.json); "" where Chromium throws.
  it.each`
    value                                     | units              | overflow       | expected                                  | source
    ${"2566-06-01[u-ca=buddhist]"}            | ${{ months: 1 }}   | ${"constrain"} | ${"2566-07-01[u-ca=buddhist]"}            | ${"grid buddhist i=0"}
    ${"2566-06-01[u-ca=buddhist]"}            | ${{ months: 1 }}   | ${"reject"}    | ${"2566-07-01[u-ca=buddhist]"}            | ${"grid buddhist i=0"}
    ${"2566-06-01[u-ca=buddhist]"}            | ${{ years: 1 }}    | ${"constrain"} | ${"2567-06-01[u-ca=buddhist]"}            | ${"grid buddhist i=0"}
    ${"2566-06-01[u-ca=buddhist]"}            | ${{ months: -13 }} | ${"constrain"} | ${"2565-05-01[u-ca=buddhist]"}            | ${"grid buddhist i=0"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${{ months: 1 }}   | ${"constrain"} | ${"2566-07-30[u-ca=buddhist]"}            | ${"grid buddhist i=29"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${{ months: 1 }}   | ${"reject"}    | ${"2566-07-30[u-ca=buddhist]"}            | ${"grid buddhist i=29"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${{ years: 1 }}    | ${"constrain"} | ${"2567-06-30[u-ca=buddhist]"}            | ${"grid buddhist i=29"}
    ${"2566-06-30[u-ca=buddhist]"}            | ${{ months: -13 }} | ${"constrain"} | ${"2565-05-30[u-ca=buddhist]"}            | ${"grid buddhist i=29"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${{ months: 1 }}   | ${"constrain"} | ${"2566-10-30[u-ca=buddhist]"}            | ${"grid buddhist i=121"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${{ months: 1 }}   | ${"reject"}    | ${"2566-10-30[u-ca=buddhist]"}            | ${"grid buddhist i=121"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${{ years: 1 }}    | ${"constrain"} | ${"2567-09-30[u-ca=buddhist]"}            | ${"grid buddhist i=121"}
    ${"2566-09-30[u-ca=buddhist]"}            | ${{ months: -13 }} | ${"constrain"} | ${"2565-08-30[u-ca=buddhist]"}            | ${"grid buddhist i=121"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"5783-10-12[u-ca=hebrew]"}              | ${"grid hebrew i=0"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${{ months: 1 }}   | ${"reject"}    | ${"5783-10-12[u-ca=hebrew]"}              | ${"grid hebrew i=0"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"5784-10-12[u-ca=hebrew]"}              | ${"grid hebrew i=0"}
    ${"5783-09-12[u-ca=hebrew]"}              | ${{ months: -13 }} | ${"constrain"} | ${"5782-09-12[u-ca=hebrew]"}              | ${"grid hebrew i=0"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"5783-10-29[u-ca=hebrew]"}              | ${"grid hebrew i=18"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${{ months: 1 }}   | ${"reject"}    | ${""}                                     | ${"grid hebrew i=18"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"5784-10-30[u-ca=hebrew]"}              | ${"grid hebrew i=18"}
    ${"5783-09-30[u-ca=hebrew]"}              | ${{ months: -13 }} | ${"constrain"} | ${"5782-09-29[u-ca=hebrew]"}              | ${"grid hebrew i=18"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"5784-01-29[u-ca=hebrew]"}              | ${"grid hebrew i=106"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${{ months: 1 }}   | ${"reject"}    | ${"5784-01-29[u-ca=hebrew]"}              | ${"grid hebrew i=106"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"5784-13-29[u-ca=hebrew]"}              | ${"grid hebrew i=106"}
    ${"5783-12-29[u-ca=hebrew]"}              | ${{ months: -13 }} | ${"constrain"} | ${"5782-12-29[u-ca=hebrew]"}              | ${"grid hebrew i=106"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${{ months: 1 }}   | ${"constrain"} | ${"1444-12-12[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=0"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${{ months: 1 }}   | ${"reject"}    | ${"1444-12-12[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=0"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${{ years: 1 }}    | ${"constrain"} | ${"1445-11-12[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=0"}
    ${"1444-11-12[u-ca=islamic-civil]"}       | ${{ months: -13 }} | ${"constrain"} | ${"1443-10-12[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=0"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${{ months: 1 }}   | ${"constrain"} | ${"1444-12-29[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=18"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${{ months: 1 }}   | ${"reject"}    | ${""}                                     | ${"grid islamic-civil i=18"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${{ years: 1 }}    | ${"constrain"} | ${"1445-11-30[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=18"}
    ${"1444-11-30[u-ca=islamic-civil]"}       | ${{ months: -13 }} | ${"constrain"} | ${"1443-10-29[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=18"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${{ months: 1 }}   | ${"constrain"} | ${"1445-03-29[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=106"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${{ months: 1 }}   | ${"reject"}    | ${"1445-03-29[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=106"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${{ years: 1 }}    | ${"constrain"} | ${"1446-02-29[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=106"}
    ${"1445-02-29[u-ca=islamic-civil]"}       | ${{ months: -13 }} | ${"constrain"} | ${"1444-01-29[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=106"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${{ months: 1 }}   | ${"constrain"} | ${"1444-12-13[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=0"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${{ months: 1 }}   | ${"reject"}    | ${"1444-12-13[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=0"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${{ years: 1 }}    | ${"constrain"} | ${"1445-11-13[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=0"}
    ${"1444-11-13[u-ca=islamic-tabular]"}     | ${{ months: -13 }} | ${"constrain"} | ${"1443-10-13[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=0"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${{ months: 1 }}   | ${"constrain"} | ${"1444-12-29[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=17"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${{ months: 1 }}   | ${"reject"}    | ${""}                                     | ${"grid islamic-tbla i=17"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${{ years: 1 }}    | ${"constrain"} | ${"1445-11-30[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=17"}
    ${"1444-11-30[u-ca=islamic-tabular]"}     | ${{ months: -13 }} | ${"constrain"} | ${"1443-10-29[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=17"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${{ months: 1 }}   | ${"constrain"} | ${"1445-03-29[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=105"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${{ months: 1 }}   | ${"reject"}    | ${"1445-03-29[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=105"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${{ years: 1 }}    | ${"constrain"} | ${"1446-02-29[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=105"}
    ${"1445-02-29[u-ca=islamic-tabular]"}     | ${{ months: -13 }} | ${"constrain"} | ${"1444-01-29[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=105"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${{ months: 1 }}   | ${"constrain"} | ${"1444-12-12[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=0"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${{ months: 1 }}   | ${"reject"}    | ${"1444-12-12[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=0"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${{ years: 1 }}    | ${"constrain"} | ${"1445-11-12[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=0"}
    ${"1444-11-12[u-ca=islamic-umalqura]"}    | ${{ months: -13 }} | ${"constrain"} | ${"1443-10-12[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=0"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${{ months: 1 }}   | ${"constrain"} | ${"1444-12-29[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=17"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${{ months: 1 }}   | ${"reject"}    | ${"1444-12-29[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=17"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${{ years: 1 }}    | ${"constrain"} | ${"1445-11-29[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=17"}
    ${"1444-11-29[u-ca=islamic-umalqura]"}    | ${{ months: -13 }} | ${"constrain"} | ${"1443-10-29[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=17"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${{ months: 1 }}   | ${"constrain"} | ${"1445-03-30[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=106"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${{ months: 1 }}   | ${"reject"}    | ${"1445-03-30[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=106"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${{ years: 1 }}    | ${"constrain"} | ${"1446-02-30[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=106"}
    ${"1445-02-30[u-ca=islamic-umalqura]"}    | ${{ months: -13 }} | ${"constrain"} | ${"1444-01-29[u-ca=islamic-umalqura]"}    | ${"grid islamic-umalqura i=106"}
    ${"1402-03-11[u-ca=persian]"}             | ${{ months: 1 }}   | ${"constrain"} | ${"1402-04-11[u-ca=persian]"}             | ${"grid persian i=0"}
    ${"1402-03-11[u-ca=persian]"}             | ${{ months: 1 }}   | ${"reject"}    | ${"1402-04-11[u-ca=persian]"}             | ${"grid persian i=0"}
    ${"1402-03-11[u-ca=persian]"}             | ${{ years: 1 }}    | ${"constrain"} | ${"1403-03-11[u-ca=persian]"}             | ${"grid persian i=0"}
    ${"1402-03-11[u-ca=persian]"}             | ${{ months: -13 }} | ${"constrain"} | ${"1401-02-11[u-ca=persian]"}             | ${"grid persian i=0"}
    ${"1402-03-31[u-ca=persian]"}             | ${{ months: 1 }}   | ${"constrain"} | ${"1402-04-31[u-ca=persian]"}             | ${"grid persian i=20"}
    ${"1402-03-31[u-ca=persian]"}             | ${{ months: 1 }}   | ${"reject"}    | ${"1402-04-31[u-ca=persian]"}             | ${"grid persian i=20"}
    ${"1402-03-31[u-ca=persian]"}             | ${{ years: 1 }}    | ${"constrain"} | ${"1403-03-31[u-ca=persian]"}             | ${"grid persian i=20"}
    ${"1402-03-31[u-ca=persian]"}             | ${{ months: -13 }} | ${"constrain"} | ${"1401-02-31[u-ca=persian]"}             | ${"grid persian i=20"}
    ${"1402-06-31[u-ca=persian]"}             | ${{ months: 1 }}   | ${"constrain"} | ${"1402-07-30[u-ca=persian]"}             | ${"grid persian i=113"}
    ${"1402-06-31[u-ca=persian]"}             | ${{ months: 1 }}   | ${"reject"}    | ${""}                                     | ${"grid persian i=113"}
    ${"1402-06-31[u-ca=persian]"}             | ${{ years: 1 }}    | ${"constrain"} | ${"1403-06-31[u-ca=persian]"}             | ${"grid persian i=113"}
    ${"1402-06-31[u-ca=persian]"}             | ${{ months: -13 }} | ${"constrain"} | ${"1401-05-31[u-ca=persian]"}             | ${"grid persian i=113"}
    ${"1945-03-11[u-ca=indian]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"1945-04-11[u-ca=indian]"}              | ${"grid indian i=0"}
    ${"1945-03-11[u-ca=indian]"}              | ${{ months: 1 }}   | ${"reject"}    | ${"1945-04-11[u-ca=indian]"}              | ${"grid indian i=0"}
    ${"1945-03-11[u-ca=indian]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"1946-03-11[u-ca=indian]"}              | ${"grid indian i=0"}
    ${"1945-03-11[u-ca=indian]"}              | ${{ months: -13 }} | ${"constrain"} | ${"1944-02-11[u-ca=indian]"}              | ${"grid indian i=0"}
    ${"1945-03-31[u-ca=indian]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"1945-04-31[u-ca=indian]"}              | ${"grid indian i=20"}
    ${"1945-03-31[u-ca=indian]"}              | ${{ months: 1 }}   | ${"reject"}    | ${"1945-04-31[u-ca=indian]"}              | ${"grid indian i=20"}
    ${"1945-03-31[u-ca=indian]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"1946-03-31[u-ca=indian]"}              | ${"grid indian i=20"}
    ${"1945-03-31[u-ca=indian]"}              | ${{ months: -13 }} | ${"constrain"} | ${"1944-02-31[u-ca=indian]"}              | ${"grid indian i=20"}
    ${"1945-06-31[u-ca=indian]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"1945-07-30[u-ca=indian]"}              | ${"grid indian i=113"}
    ${"1945-06-31[u-ca=indian]"}              | ${{ months: 1 }}   | ${"reject"}    | ${""}                                     | ${"grid indian i=113"}
    ${"1945-06-31[u-ca=indian]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"1946-06-31[u-ca=indian]"}              | ${"grid indian i=113"}
    ${"1945-06-31[u-ca=indian]"}              | ${{ months: -13 }} | ${"constrain"} | ${"1944-05-31[u-ca=indian]"}              | ${"grid indian i=113"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }}   | ${"constrain"} | ${"7515-10-24[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=0"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }}   | ${"reject"}    | ${"7515-10-24[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=0"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${{ years: 1 }}    | ${"constrain"} | ${"7516-09-24[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=0"}
    ${"7515-09-24[u-ca=ethiopic-amete-alem]"} | ${{ months: -13 }} | ${"constrain"} | ${"7514-09-24[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=0"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }}   | ${"constrain"} | ${"7515-10-30[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=6"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }}   | ${"reject"}    | ${"7515-10-30[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=6"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${{ years: 1 }}    | ${"constrain"} | ${"7516-09-30[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=6"}
    ${"7515-09-30[u-ca=ethiopic-amete-alem]"} | ${{ months: -13 }} | ${"constrain"} | ${"7514-09-30[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=6"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }}   | ${"constrain"} | ${"7515-13-06[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=96"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }}   | ${"reject"}    | ${""}                                     | ${"grid ethioaa i=96"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${{ years: 1 }}    | ${"constrain"} | ${"7516-12-30[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=96"}
    ${"7515-12-30[u-ca=ethiopic-amete-alem]"} | ${{ months: -13 }} | ${"constrain"} | ${"7514-12-30[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=96"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }}   | ${"constrain"} | ${"0005-07-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=0"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }}   | ${"reject"}    | ${"0005-07-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=0"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${{ years: 1 }}    | ${"constrain"} | ${"0006-06-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=0"}
    ${"0005-06-01[u-ca=japanese;era=reiwa]"}  | ${{ months: -13 }} | ${"constrain"} | ${"0004-05-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=0"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }}   | ${"constrain"} | ${"0005-07-30[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=29"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }}   | ${"reject"}    | ${"0005-07-30[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=29"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${{ years: 1 }}    | ${"constrain"} | ${"0006-06-30[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=29"}
    ${"0005-06-30[u-ca=japanese;era=reiwa]"}  | ${{ months: -13 }} | ${"constrain"} | ${"0004-05-30[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=29"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }}   | ${"constrain"} | ${"0005-10-30[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=121"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }}   | ${"reject"}    | ${"0005-10-30[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=121"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${{ years: 1 }}    | ${"constrain"} | ${"0006-09-30[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=121"}
    ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${{ months: -13 }} | ${"constrain"} | ${"0004-08-30[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=121"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"0112-07-01[u-ca=taiwan]"}              | ${"grid roc i=0"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${{ months: 1 }}   | ${"reject"}    | ${"0112-07-01[u-ca=taiwan]"}              | ${"grid roc i=0"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"0113-06-01[u-ca=taiwan]"}              | ${"grid roc i=0"}
    ${"0112-06-01[u-ca=taiwan]"}              | ${{ months: -13 }} | ${"constrain"} | ${"0111-05-01[u-ca=taiwan]"}              | ${"grid roc i=0"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"0112-07-30[u-ca=taiwan]"}              | ${"grid roc i=29"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${{ months: 1 }}   | ${"reject"}    | ${"0112-07-30[u-ca=taiwan]"}              | ${"grid roc i=29"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"0113-06-30[u-ca=taiwan]"}              | ${"grid roc i=29"}
    ${"0112-06-30[u-ca=taiwan]"}              | ${{ months: -13 }} | ${"constrain"} | ${"0111-05-30[u-ca=taiwan]"}              | ${"grid roc i=29"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"0112-10-30[u-ca=taiwan]"}              | ${"grid roc i=121"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${{ months: 1 }}   | ${"reject"}    | ${"0112-10-30[u-ca=taiwan]"}              | ${"grid roc i=121"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"0113-09-30[u-ca=taiwan]"}              | ${"grid roc i=121"}
    ${"0112-09-30[u-ca=taiwan]"}              | ${{ months: -13 }} | ${"constrain"} | ${"0111-08-30[u-ca=taiwan]"}              | ${"grid roc i=121"}
    ${"2023-06-01"}                           | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-01"}                           | ${"grid gregory i=0"}
    ${"2023-06-01"}                           | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-01"}                           | ${"grid gregory i=0"}
    ${"2023-06-01"}                           | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-01"}                           | ${"grid gregory i=0"}
    ${"2023-06-01"}                           | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-01"}                           | ${"grid gregory i=0"}
    ${"2023-06-30"}                           | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-30"}                           | ${"grid gregory i=29"}
    ${"2023-06-30"}                           | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-30"}                           | ${"grid gregory i=29"}
    ${"2023-06-30"}                           | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-30"}                           | ${"grid gregory i=29"}
    ${"2023-06-30"}                           | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-30"}                           | ${"grid gregory i=29"}
    ${"2023-09-30"}                           | ${{ months: 1 }}   | ${"constrain"} | ${"2023-10-30"}                           | ${"grid gregory i=121"}
    ${"2023-09-30"}                           | ${{ months: 1 }}   | ${"reject"}    | ${"2023-10-30"}                           | ${"grid gregory i=121"}
    ${"2023-09-30"}                           | ${{ years: 1 }}    | ${"constrain"} | ${"2024-09-30"}                           | ${"grid gregory i=121"}
    ${"2023-09-30"}                           | ${{ months: -13 }} | ${"constrain"} | ${"2022-08-30"}                           | ${"grid gregory i=121"}
  `(
    "returns $expected for $value + $units with overflow $overflow ($source)",
    ({ value, units, overflow, expected }) => {
      expect(addDate(value, units, { overflow })).toBe(expected);
    },
  );
});
