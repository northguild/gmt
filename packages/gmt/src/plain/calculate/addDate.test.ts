import {
  ethiopicPagumenFixture,
  hebrewLeapYear5784,
  islamicVariantDivergence,
  japaneseEraBoundary,
  persianLeapYearFixture,
} from "../../test";
import { addDate } from "./addDate";

describe("addDate", () => {
  // An RFC 9557 string's digits are ISO, so "5784-06-15[u-ca=hebrew]" is ISO
  // 5784-06-15 read in the Hebrew calendar (Hebrew 9544). Expected: native Temporal, Chromium
  // 153.0.8010.12, `Temporal.PlainDate.from(value).add(units).toString()`.
  it.each`
    value                                    | units             | expected
    ${"5784-06-15[u-ca=hebrew]"}             | ${{ months: 1 }}  | ${"5784-07-14[u-ca=hebrew]"}
    ${"2024-02-24[u-ca=hebrew]"}             | ${{ months: 1 }}  | ${"2024-03-25[u-ca=hebrew]"}
    ${"2024-02-24[!u-ca=HEBREW]"}            | ${{ months: 1 }}  | ${"2024-03-25[u-ca=hebrew]"}
    ${"2024-10-03[u-ca=japanese;era=reiwa]"} | ${{ days: 1 }}    | ${""}
    ${"+275759-09-13[u-ca=gregory]"}         | ${{ years: 1 }}   | ${"+275760-09-13[u-ca=gregory]"}
    ${"-271821-05-19[u-ca=gregory]"}         | ${{ months: -1 }} | ${"-271821-04-19[u-ca=gregory]"}
    ${"-000001-02-28[u-ca=gregory]"}         | ${{ days: 1 }}    | ${"-000001-03-01[u-ca=gregory]"}
    ${"+275760-09-13[u-ca=gregory]"}         | ${{ days: 1 }}    | ${""}
  `(
    "adds $units to $value as $expected (RFC 9557 input)",
    ({ value, units, expected }) => {
      expect(addDate(value, units)).toBe(expected);
    },
  );

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
    ${"2024-02-29T12:00:00Z"}
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
    ${islamicVariantDivergence.civil}           | ${{ months: 1 }} | ${undefined}                 | ${"2020-03-24[u-ca=islamic-civil]"}     | ${"islamic-civil variant"}
    ${islamicVariantDivergence.tabular}         | ${{ months: 1 }} | ${undefined}                 | ${"2020-03-25[u-ca=islamic-tbla]"}      | ${"islamic-tbla variant"}
    ${islamicVariantDivergence.umalqura}        | ${{ months: 1 }} | ${undefined}                 | ${"2020-03-24[u-ca=islamic-umalqura]"}  | ${"islamic-umalqura variant"}
    ${persianLeapYearFixture.month12day30_1403} | ${{ years: 1 }}  | ${undefined}                 | ${"2026-03-20[u-ca=persian]"}           | ${"Persian leap year -> non-leap (30 -> 29 day month 12)"}
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
    value                             | units            | expected                          | reason
    ${"+275759-09-13[u-ca=buddhist]"} | ${{ years: 1 }}  | ${"+275760-09-13[u-ca=buddhist]"} | ${"D1-A: lands exactly on the maximum (xscan buddhist max[366])"}
    ${"+275760-08-15[u-ca=hebrew]"}   | ${{ months: 1 }} | ${"+275760-09-13[u-ca=hebrew]"}   | ${"lands exactly on the maximum (xscan hebrew max[29])"}
    ${"+275760-08-16[u-ca=hebrew]"}   | ${{ months: 1 }} | ${""}                             | ${"one day past the maximum is a RangeError, not clamped (xscan hebrew max[28] ERR)"}
  `(
    "returns $expected for $value + $units ($reason)",
    ({ value, units, expected }) => {
      expect(addDate(value, units)).toBe(expected);
    },
  );

  // CORE-6 D1-A windows the polyfill throws in, away from the exact limit (read-model path).
  // Chromium 152 edge rows: result ISO dates are read back from the same scan's rows.
  it.each`
    value                                     | units            | expected                                  | reason
    ${"-271821-04-28[u-ca=islamic-civil]"}    | ${{ months: 1 }} | ${"-271821-05-27[u-ca=islamic-civil]"}    | ${"xscan islamic-civil min[9]: Rabi I 30 constrains to the 29-day Rabi II"}
    ${"-271821-06-26[u-ca=islamic-civil]"}    | ${{ months: 1 }} | ${"-271821-07-25[u-ca=islamic-civil]"}    | ${"xscan islamic-civil min[68]"}
    ${"-271821-06-25[u-ca=islamic-tbla]"}     | ${{ months: 1 }} | ${"-271821-07-24[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla min[67]"}
    ${"-271821-10-22[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"-271821-11-20[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura min[186]"}
    ${"-271820-03-11[u-ca=persian]"}          | ${{ months: 1 }} | ${"-271820-04-09[u-ca=persian]"}          | ${"xscan persian min[327]: into the 29-day Esfand"}
    ${"+275759-08-27[u-ca=hebrew]"}           | ${{ years: 1 }}  | ${"+275760-09-13[u-ca=hebrew]"}           | ${"xscan hebrew max[383]: Iyar 11 into leap 279517 is ordinal month 10, the maximum"}
    ${"+275759-08-21[u-ca=hebrew]"}           | ${{ years: 1 }}  | ${"+275760-09-07[u-ca=hebrew]"}           | ${"xscan hebrew max[389]"}
    ${"+275759-09-25[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura max[354]: lands on the maximum"}
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
    ${"-271818-01-13[u-ca=buddhist]"} | ${{ months: 1 }} | ${"-271818-02-13[u-ca=buddhist]"} | ${"stride buddhist k=0"}
    ${"-271818-01-13[u-ca=buddhist]"} | ${{ years: 1 }}  | ${"-271817-01-13[u-ca=buddhist]"} | ${"stride buddhist k=0"}
    ${"-262510-01-30[u-ca=buddhist]"} | ${{ months: 1 }} | ${"-262510-02-28[u-ca=buddhist]"} | ${"stride buddhist k=34: constrains to the 28-day February"}
    ${"1400-07-25[u-ca=buddhist]"}    | ${{ years: 1 }}  | ${"1401-07-25[u-ca=buddhist]"}    | ${"stride buddhist k=998 (ISO 1400)"}
    ${"-271821-04-19[u-ca=buddhist]"} | ${{ years: 1 }}  | ${"-271820-04-19[u-ca=buddhist]"} | ${"xscan buddhist min[0]"}
    ${"-271818-01-13[u-ca=hebrew]"}   | ${{ months: 1 }} | ${"-271818-02-11[u-ca=hebrew]"}   | ${"stride hebrew k=0: Nisan 30 constrains to Iyar 29"}
    ${"-271818-01-13[u-ca=hebrew]"}   | ${{ years: 1 }}  | ${"-271817-02-02[u-ca=hebrew]"}   | ${"stride hebrew k=0: Nisan is ordinal 8 in leap -268054"}
    ${"-182571-10-09[u-ca=hebrew]"}   | ${{ years: 1 }}  | ${"-182570-09-29[u-ca=hebrew]"}   | ${"stride hebrew k=326"}
    ${"-003801-01-03[u-ca=hebrew]"}   | ${{ months: 1 }} | ${"-003801-02-02[u-ca=hebrew]"}   | ${"stride hebrew k=979, the last Hebrew year <= 0 sample"}
    ${"-270450-11-13[u-ca=hebrew]"}   | ${{ years: 1 }}  | ${"-270449-12-03[u-ca=hebrew]"}   | ${"stride hebrew k=5: Adar I (M05L) of leap -266686 constrains to Adar (M06) of common -266685"}
    ${"-270450-11-13[u-ca=hebrew]"}   | ${{ months: 1 }} | ${"-270450-12-13[u-ca=hebrew]"}   | ${"stride hebrew k=5: Adar I -> Adar"}
    ${"-271821-05-29[u-ca=hebrew]"}   | ${{ years: 1 }}  | ${"-271820-06-15[u-ca=hebrew]"}   | ${"xscan hebrew min[40]: Adar into leap -268057 is ordinal 13's predecessor code"}
    ${"-271820-05-23[u-ca=hebrew]"}   | ${{ months: 1 }} | ${"-271820-06-22[u-ca=hebrew]"}   | ${"xscan hebrew min[400]"}
    ${"-003761-09-01[u-ca=hebrew]"}   | ${{ years: 2 }}  | ${"-003759-09-09[u-ca=hebrew]"}   | ${"from the corrected range into year 2: Tishri 13 exists every year (spec NonISODateAdd)"}
    ${"-271818-01-13[u-ca=indian]"}   | ${{ months: 1 }} | ${"-271818-02-12[u-ca=indian]"}   | ${"stride indian k=0"}
    ${"-090585-03-03[u-ca=indian]"}   | ${{ months: 1 }} | ${"-090585-04-02[u-ca=indian]"}   | ${"stride indian k=662: across the Saka year end"}
    ${"-261689-05-20[u-ca=indian]"}   | ${{ years: 1 }}  | ${"-261688-05-20[u-ca=indian]"}   | ${"stride indian k=37"}
    ${"-000243-12-19[u-ca=indian]"}   | ${{ years: 1 }}  | ${"-000242-12-19[u-ca=indian]"}   | ${"stride indian k=992 (ISO -243)"}
    ${"-271821-04-19[u-ca=indian]"}   | ${{ months: 1 }} | ${"-271821-05-19[u-ca=indian]"}   | ${"xscan indian min[0]"}
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

  // A date-time is read as its date, as Temporal.PlainDate.from reads it (decided
  // 2026-09-17; before 1.16.0 the sentinel). Expected values from native Chromium 153.
  it.each`
    value                              | units            | expected
    ${"2024-03-10T14:30:00"}           | ${{ days: 1 }}   | ${"2024-03-11"}
    ${"2024-10-03T14:30[u-ca=hebrew]"} | ${{ months: 1 }} | ${"2024-11-02[u-ca=hebrew]"}
  `(
    "returns $expected for the date-time $value plus $units",
    ({ value, units, expected }) => {
      expect(addDate(value, units)).toBe(expected);
    },
  );

  // CORE-6 modern grid subset (spec §4.4): +1 month (constrain and reject), +1 year and -13 months
  // from the same starts as diffDateAsDuration.test.ts. Expected values: Chromium 152 native
  // Temporal (q2-grid-chromium152.json); "" where Chromium throws.
  it.each`
    value                                  | units              | overflow       | expected                               | source
    ${"2023-06-01[u-ca=buddhist]"}         | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-01[u-ca=buddhist]"}         | ${"grid buddhist i=0"}
    ${"2023-06-01[u-ca=buddhist]"}         | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-01[u-ca=buddhist]"}         | ${"grid buddhist i=0"}
    ${"2023-06-01[u-ca=buddhist]"}         | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-01[u-ca=buddhist]"}         | ${"grid buddhist i=0"}
    ${"2023-06-01[u-ca=buddhist]"}         | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-01[u-ca=buddhist]"}         | ${"grid buddhist i=0"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-30[u-ca=buddhist]"}         | ${"grid buddhist i=29"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-30[u-ca=buddhist]"}         | ${"grid buddhist i=29"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-30[u-ca=buddhist]"}         | ${"grid buddhist i=29"}
    ${"2023-06-30[u-ca=buddhist]"}         | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-30[u-ca=buddhist]"}         | ${"grid buddhist i=29"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${{ months: 1 }}   | ${"constrain"} | ${"2023-10-30[u-ca=buddhist]"}         | ${"grid buddhist i=121"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${{ months: 1 }}   | ${"reject"}    | ${"2023-10-30[u-ca=buddhist]"}         | ${"grid buddhist i=121"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${{ years: 1 }}    | ${"constrain"} | ${"2024-09-30[u-ca=buddhist]"}         | ${"grid buddhist i=121"}
    ${"2023-09-30[u-ca=buddhist]"}         | ${{ months: -13 }} | ${"constrain"} | ${"2022-08-30[u-ca=buddhist]"}         | ${"grid buddhist i=121"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-01[u-ca=hebrew]"}           | ${"grid hebrew i=0"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-01[u-ca=hebrew]"}           | ${"grid hebrew i=0"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-18[u-ca=hebrew]"}           | ${"grid hebrew i=0"}
    ${"2023-06-01[u-ca=hebrew]"}           | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-13[u-ca=hebrew]"}           | ${"grid hebrew i=0"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-18[u-ca=hebrew]"}           | ${"grid hebrew i=18"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${{ months: 1 }}   | ${"reject"}    | ${""}                                  | ${"grid hebrew i=18"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${{ years: 1 }}    | ${"constrain"} | ${"2024-07-06[u-ca=hebrew]"}           | ${"grid hebrew i=18"}
    ${"2023-06-19[u-ca=hebrew]"}           | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-30[u-ca=hebrew]"}           | ${"grid hebrew i=18"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${{ months: 1 }}   | ${"constrain"} | ${"2023-10-14[u-ca=hebrew]"}           | ${"grid hebrew i=106"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${{ months: 1 }}   | ${"reject"}    | ${"2023-10-14[u-ca=hebrew]"}           | ${"grid hebrew i=106"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${{ years: 1 }}    | ${"constrain"} | ${"2024-10-02[u-ca=hebrew]"}           | ${"grid hebrew i=106"}
    ${"2023-09-15[u-ca=hebrew]"}           | ${{ months: -13 }} | ${"constrain"} | ${"2022-08-26[u-ca=hebrew]"}           | ${"grid hebrew i=106"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-01[u-ca=islamic-civil]"}    | ${"grid islamic-civil i=0"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-01[u-ca=islamic-civil]"}    | ${"grid islamic-civil i=0"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${{ years: 1 }}    | ${"constrain"} | ${"2024-05-20[u-ca=islamic-civil]"}    | ${"grid islamic-civil i=0"}
    ${"2023-06-01[u-ca=islamic-civil]"}    | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-14[u-ca=islamic-civil]"}    | ${"grid islamic-civil i=0"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-18[u-ca=islamic-civil]"}    | ${"grid islamic-civil i=18"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${{ months: 1 }}   | ${"reject"}    | ${""}                                  | ${"grid islamic-civil i=18"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-07[u-ca=islamic-civil]"}    | ${"grid islamic-civil i=18"}
    ${"2023-06-19[u-ca=islamic-civil]"}    | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-31[u-ca=islamic-civil]"}    | ${"grid islamic-civil i=18"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${{ months: 1 }}   | ${"constrain"} | ${"2023-10-14[u-ca=islamic-civil]"}    | ${"grid islamic-civil i=106"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${{ months: 1 }}   | ${"reject"}    | ${"2023-10-14[u-ca=islamic-civil]"}    | ${"grid islamic-civil i=106"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${{ years: 1 }}    | ${"constrain"} | ${"2024-09-04[u-ca=islamic-civil]"}    | ${"grid islamic-civil i=106"}
    ${"2023-09-15[u-ca=islamic-civil]"}    | ${{ months: -13 }} | ${"constrain"} | ${"2022-08-27[u-ca=islamic-civil]"}    | ${"grid islamic-civil i=106"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-01[u-ca=islamic-tbla]"}     | ${"grid islamic-tbla i=0"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-01[u-ca=islamic-tbla]"}     | ${"grid islamic-tbla i=0"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${{ years: 1 }}    | ${"constrain"} | ${"2024-05-20[u-ca=islamic-tbla]"}     | ${"grid islamic-tbla i=0"}
    ${"2023-06-01[u-ca=islamic-tbla]"}     | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-14[u-ca=islamic-tbla]"}     | ${"grid islamic-tbla i=0"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-17[u-ca=islamic-tbla]"}     | ${"grid islamic-tbla i=17"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${{ months: 1 }}   | ${"reject"}    | ${""}                                  | ${"grid islamic-tbla i=17"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-06[u-ca=islamic-tbla]"}     | ${"grid islamic-tbla i=17"}
    ${"2023-06-18[u-ca=islamic-tbla]"}     | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-30[u-ca=islamic-tbla]"}     | ${"grid islamic-tbla i=17"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${{ months: 1 }}   | ${"constrain"} | ${"2023-10-13[u-ca=islamic-tbla]"}     | ${"grid islamic-tbla i=105"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${{ months: 1 }}   | ${"reject"}    | ${"2023-10-13[u-ca=islamic-tbla]"}     | ${"grid islamic-tbla i=105"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${{ years: 1 }}    | ${"constrain"} | ${"2024-09-03[u-ca=islamic-tbla]"}     | ${"grid islamic-tbla i=105"}
    ${"2023-09-14[u-ca=islamic-tbla]"}     | ${{ months: -13 }} | ${"constrain"} | ${"2022-08-26[u-ca=islamic-tbla]"}     | ${"grid islamic-tbla i=105"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${{ months: 1 }}   | ${"constrain"} | ${"2023-06-30[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=0"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${{ months: 1 }}   | ${"reject"}    | ${"2023-06-30[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=0"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${{ years: 1 }}    | ${"constrain"} | ${"2024-05-20[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=0"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-13[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=0"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-17[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=17"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-17[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=17"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-06[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=17"}
    ${"2023-06-18[u-ca=islamic-umalqura]"} | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-30[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=17"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${{ months: 1 }}   | ${"constrain"} | ${"2023-10-15[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=106"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${{ months: 1 }}   | ${"reject"}    | ${"2023-10-15[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=106"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${{ years: 1 }}    | ${"constrain"} | ${"2024-09-03[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=106"}
    ${"2023-09-15[u-ca=islamic-umalqura]"} | ${{ months: -13 }} | ${"constrain"} | ${"2022-08-27[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=106"}
    ${"2023-06-01[u-ca=persian]"}          | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-02[u-ca=persian]"}          | ${"grid persian i=0"}
    ${"2023-06-01[u-ca=persian]"}          | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-02[u-ca=persian]"}          | ${"grid persian i=0"}
    ${"2023-06-01[u-ca=persian]"}          | ${{ years: 1 }}    | ${"constrain"} | ${"2024-05-31[u-ca=persian]"}          | ${"grid persian i=0"}
    ${"2023-06-01[u-ca=persian]"}          | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-01[u-ca=persian]"}          | ${"grid persian i=0"}
    ${"2023-06-21[u-ca=persian]"}          | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-22[u-ca=persian]"}          | ${"grid persian i=20"}
    ${"2023-06-21[u-ca=persian]"}          | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-22[u-ca=persian]"}          | ${"grid persian i=20"}
    ${"2023-06-21[u-ca=persian]"}          | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-20[u-ca=persian]"}          | ${"grid persian i=20"}
    ${"2023-06-21[u-ca=persian]"}          | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-21[u-ca=persian]"}          | ${"grid persian i=20"}
    ${"2023-09-22[u-ca=persian]"}          | ${{ months: 1 }}   | ${"constrain"} | ${"2023-10-22[u-ca=persian]"}          | ${"grid persian i=113"}
    ${"2023-09-22[u-ca=persian]"}          | ${{ months: 1 }}   | ${"reject"}    | ${""}                                  | ${"grid persian i=113"}
    ${"2023-09-22[u-ca=persian]"}          | ${{ years: 1 }}    | ${"constrain"} | ${"2024-09-21[u-ca=persian]"}          | ${"grid persian i=113"}
    ${"2023-09-22[u-ca=persian]"}          | ${{ months: -13 }} | ${"constrain"} | ${"2022-08-22[u-ca=persian]"}          | ${"grid persian i=113"}
    ${"2023-06-01[u-ca=indian]"}           | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-02[u-ca=indian]"}           | ${"grid indian i=0"}
    ${"2023-06-01[u-ca=indian]"}           | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-02[u-ca=indian]"}           | ${"grid indian i=0"}
    ${"2023-06-01[u-ca=indian]"}           | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-01[u-ca=indian]"}           | ${"grid indian i=0"}
    ${"2023-06-01[u-ca=indian]"}           | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-01[u-ca=indian]"}           | ${"grid indian i=0"}
    ${"2023-06-21[u-ca=indian]"}           | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-22[u-ca=indian]"}           | ${"grid indian i=20"}
    ${"2023-06-21[u-ca=indian]"}           | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-22[u-ca=indian]"}           | ${"grid indian i=20"}
    ${"2023-06-21[u-ca=indian]"}           | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-21[u-ca=indian]"}           | ${"grid indian i=20"}
    ${"2023-06-21[u-ca=indian]"}           | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-21[u-ca=indian]"}           | ${"grid indian i=20"}
    ${"2023-09-22[u-ca=indian]"}           | ${{ months: 1 }}   | ${"constrain"} | ${"2023-10-22[u-ca=indian]"}           | ${"grid indian i=113"}
    ${"2023-09-22[u-ca=indian]"}           | ${{ months: 1 }}   | ${"reject"}    | ${""}                                  | ${"grid indian i=113"}
    ${"2023-09-22[u-ca=indian]"}           | ${{ years: 1 }}    | ${"constrain"} | ${"2024-09-22[u-ca=indian]"}           | ${"grid indian i=113"}
    ${"2023-09-22[u-ca=indian]"}           | ${{ months: -13 }} | ${"constrain"} | ${"2022-08-22[u-ca=indian]"}           | ${"grid indian i=113"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-01[u-ca=ethioaa]"}          | ${"grid ethioaa i=0"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-01[u-ca=ethioaa]"}          | ${"grid ethioaa i=0"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-01[u-ca=ethioaa]"}          | ${"grid ethioaa i=0"}
    ${"2023-06-01[u-ca=ethioaa]"}          | ${{ months: -13 }} | ${"constrain"} | ${"2022-06-01[u-ca=ethioaa]"}          | ${"grid ethioaa i=0"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-07[u-ca=ethioaa]"}          | ${"grid ethioaa i=6"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-07[u-ca=ethioaa]"}          | ${"grid ethioaa i=6"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-07[u-ca=ethioaa]"}          | ${"grid ethioaa i=6"}
    ${"2023-06-07[u-ca=ethioaa]"}          | ${{ months: -13 }} | ${"constrain"} | ${"2022-06-07[u-ca=ethioaa]"}          | ${"grid ethioaa i=6"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${{ months: 1 }}   | ${"constrain"} | ${"2023-09-11[u-ca=ethioaa]"}          | ${"grid ethioaa i=96"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${{ months: 1 }}   | ${"reject"}    | ${""}                                  | ${"grid ethioaa i=96"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${{ years: 1 }}    | ${"constrain"} | ${"2024-09-05[u-ca=ethioaa]"}          | ${"grid ethioaa i=96"}
    ${"2023-09-05[u-ca=ethioaa]"}          | ${{ months: -13 }} | ${"constrain"} | ${"2022-09-05[u-ca=ethioaa]"}          | ${"grid ethioaa i=96"}
    ${"2023-06-01[u-ca=japanese]"}         | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-01[u-ca=japanese]"}         | ${"grid japanese i=0"}
    ${"2023-06-01[u-ca=japanese]"}         | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-01[u-ca=japanese]"}         | ${"grid japanese i=0"}
    ${"2023-06-01[u-ca=japanese]"}         | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-01[u-ca=japanese]"}         | ${"grid japanese i=0"}
    ${"2023-06-01[u-ca=japanese]"}         | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-01[u-ca=japanese]"}         | ${"grid japanese i=0"}
    ${"2023-06-30[u-ca=japanese]"}         | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-30[u-ca=japanese]"}         | ${"grid japanese i=29"}
    ${"2023-06-30[u-ca=japanese]"}         | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-30[u-ca=japanese]"}         | ${"grid japanese i=29"}
    ${"2023-06-30[u-ca=japanese]"}         | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-30[u-ca=japanese]"}         | ${"grid japanese i=29"}
    ${"2023-06-30[u-ca=japanese]"}         | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-30[u-ca=japanese]"}         | ${"grid japanese i=29"}
    ${"2023-09-30[u-ca=japanese]"}         | ${{ months: 1 }}   | ${"constrain"} | ${"2023-10-30[u-ca=japanese]"}         | ${"grid japanese i=121"}
    ${"2023-09-30[u-ca=japanese]"}         | ${{ months: 1 }}   | ${"reject"}    | ${"2023-10-30[u-ca=japanese]"}         | ${"grid japanese i=121"}
    ${"2023-09-30[u-ca=japanese]"}         | ${{ years: 1 }}    | ${"constrain"} | ${"2024-09-30[u-ca=japanese]"}         | ${"grid japanese i=121"}
    ${"2023-09-30[u-ca=japanese]"}         | ${{ months: -13 }} | ${"constrain"} | ${"2022-08-30[u-ca=japanese]"}         | ${"grid japanese i=121"}
    ${"2023-06-01[u-ca=roc]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-01[u-ca=roc]"}              | ${"grid roc i=0"}
    ${"2023-06-01[u-ca=roc]"}              | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-01[u-ca=roc]"}              | ${"grid roc i=0"}
    ${"2023-06-01[u-ca=roc]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-01[u-ca=roc]"}              | ${"grid roc i=0"}
    ${"2023-06-01[u-ca=roc]"}              | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-01[u-ca=roc]"}              | ${"grid roc i=0"}
    ${"2023-06-30[u-ca=roc]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-30[u-ca=roc]"}              | ${"grid roc i=29"}
    ${"2023-06-30[u-ca=roc]"}              | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-30[u-ca=roc]"}              | ${"grid roc i=29"}
    ${"2023-06-30[u-ca=roc]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-30[u-ca=roc]"}              | ${"grid roc i=29"}
    ${"2023-06-30[u-ca=roc]"}              | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-30[u-ca=roc]"}              | ${"grid roc i=29"}
    ${"2023-09-30[u-ca=roc]"}              | ${{ months: 1 }}   | ${"constrain"} | ${"2023-10-30[u-ca=roc]"}              | ${"grid roc i=121"}
    ${"2023-09-30[u-ca=roc]"}              | ${{ months: 1 }}   | ${"reject"}    | ${"2023-10-30[u-ca=roc]"}              | ${"grid roc i=121"}
    ${"2023-09-30[u-ca=roc]"}              | ${{ years: 1 }}    | ${"constrain"} | ${"2024-09-30[u-ca=roc]"}              | ${"grid roc i=121"}
    ${"2023-09-30[u-ca=roc]"}              | ${{ months: -13 }} | ${"constrain"} | ${"2022-08-30[u-ca=roc]"}              | ${"grid roc i=121"}
    ${"2023-06-01"}                        | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-01"}                        | ${"grid gregory i=0"}
    ${"2023-06-01"}                        | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-01"}                        | ${"grid gregory i=0"}
    ${"2023-06-01"}                        | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-01"}                        | ${"grid gregory i=0"}
    ${"2023-06-01"}                        | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-01"}                        | ${"grid gregory i=0"}
    ${"2023-06-30"}                        | ${{ months: 1 }}   | ${"constrain"} | ${"2023-07-30"}                        | ${"grid gregory i=29"}
    ${"2023-06-30"}                        | ${{ months: 1 }}   | ${"reject"}    | ${"2023-07-30"}                        | ${"grid gregory i=29"}
    ${"2023-06-30"}                        | ${{ years: 1 }}    | ${"constrain"} | ${"2024-06-30"}                        | ${"grid gregory i=29"}
    ${"2023-06-30"}                        | ${{ months: -13 }} | ${"constrain"} | ${"2022-05-30"}                        | ${"grid gregory i=29"}
    ${"2023-09-30"}                        | ${{ months: 1 }}   | ${"constrain"} | ${"2023-10-30"}                        | ${"grid gregory i=121"}
    ${"2023-09-30"}                        | ${{ months: 1 }}   | ${"reject"}    | ${"2023-10-30"}                        | ${"grid gregory i=121"}
    ${"2023-09-30"}                        | ${{ years: 1 }}    | ${"constrain"} | ${"2024-09-30"}                        | ${"grid gregory i=121"}
    ${"2023-09-30"}                        | ${{ months: -13 }} | ${"constrain"} | ${"2022-08-30"}                        | ${"grid gregory i=121"}
  `(
    "returns $expected for $value + $units with overflow $overflow ($source)",
    ({ value, units, overflow, expected }) => {
      expect(addDate(value, units, { overflow })).toBe(expected);
    },
  );
});

// Strict-shape rule (see coding-standards): the part before the first `[` must be GMT's strict extended date (or
// date-time), as `isValidDate`/`isValidDateTime` require. Native Chromium 153
// `Temporal.PlainDate.from` reads each of these as 2024-10-03; GMT rejects them.
describe("addDate rejects calendar strings outside GMT's strict shape", () => {
  it.each`
    value                                    | reason
    ${"20241003[u-ca=hebrew]"}               | ${"basic format"}
    ${"2024-10-03 14:30[u-ca=hebrew]"}       | ${"space separator"}
    ${"2024-10-03T14:30+01:00[u-ca=hebrew]"} | ${"UTC offset"}
  `('returns "" for $value ($reason)', ({ value }) => {
    expect(addDate(value, { days: 1 })).toBe("");
  });
});
