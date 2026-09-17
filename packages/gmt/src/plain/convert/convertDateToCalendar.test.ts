import { Temporal } from "@js-temporal/polyfill";
import { calendarFieldsOf } from "../../internal/temporalCompat";
import { MustTestCalendars } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { convertDateToCalendar } from "./convertDateToCalendar";

describe("convertDateToCalendar", () => {
  // RFC 9557 conversions (CORE-8). Expected values: native Temporal, Chromium 153.0.8010.12,
  // `Temporal.PlainDate.from(value).withCalendar(calendar).toString()`.
  it.each`
    value                                     | calendar      | expected                          | note
    ${"2024-10-03"}                           | ${"hebrew"}   | ${"2024-10-03[u-ca=hebrew]"}      | ${"ISO digits, calendar in the annotation"}
    ${"2024-10-03"}                           | ${"japanese"} | ${"2024-10-03[u-ca=japanese]"}    | ${"no era in the string"}
    ${"2024-10-03"}                           | ${"ethiopic"} | ${"2024-10-03[u-ca=ethiopic]"}    | ${"no era in the string"}
    ${"1000-01-01"}                           | ${"roc"}      | ${"1000-01-01[u-ca=roc]"}         | ${"ROC year -911 is still ISO year 1000"}
    ${"+275760-09-13"}                        | ${"hebrew"}   | ${"+275760-09-13[u-ca=hebrew]"}   | ${"PadISOYear at the maximum"}
    ${"5785-01-01[u-ca=hebrew]"}              | ${"iso8601"}  | ${"5785-01-01"}                   | ${"the digits are ISO year 5785"}
    ${"2024-10-03[u-ca=hebrew]"}              | ${"iso8601"}  | ${"2024-10-03"}                   | ${"back to the ISO calendar, no annotation"}
    ${"2024-10-03"}                           | ${"gregory"}  | ${"2024-10-03[u-ca=gregory]"}     | ${"gregory is annotated; only iso8601 is not"}
    ${"2024-10-03[u-ca=hebrew]"}              | ${"persian"}  | ${"2024-10-03[u-ca=persian]"}     | ${"calendar to calendar keeps the date"}
    ${"2024-10-03[!u-ca=hebrew]"}             | ${"hebrew"}   | ${"2024-10-03[u-ca=hebrew]"}      | ${"critical flag accepted, not written"}
    ${"2024-10-03[u-ca=HEBREW]"}              | ${"iso8601"}  | ${"2024-10-03"}                   | ${"CanonicalizeCalendar folds case"}
    ${"2024-10-03[u-ca=ethiopic-amete-alem]"} | ${"ethioaa"}  | ${"2024-10-03[u-ca=ethioaa]"}     | ${"alias read, canonical id written"}
    ${"+002024-10-03"}                        | ${"roc"}      | ${"2024-10-03[u-ca=roc]"}         | ${"signed four-digit year written with four digits"}
    ${"-000001-12-31"}                        | ${"japanese"} | ${"-000001-12-31[u-ca=japanese]"} | ${"negative ISO year"}
  `(
    "converts $value to $calendar as $expected ($note)",
    ({ value, calendar, expected }) => {
      expect(convertDateToCalendar(value, calendar)).toBe(expected);
    },
  );

  // For every supported calendar, the output is exactly Temporal's own toString of the same date
  // in that calendar (TemporalDateToString, calendarName "auto"), and it reads back to the date.
  const isoDates = [
    "-271821-04-19",
    "-271821-04-20",
    "-100000-01-01",
    "-003761-09-01",
    "-000001-01-01",
    "0000-01-01",
    "0622-07-18",
    "1000-01-01",
    "1582-10-04",
    "1872-12-31",
    "1873-01-01",
    "2019-04-30",
    "2019-05-01",
    "2024-02-29",
    "2024-10-03",
    "9999-12-31",
    "+010000-01-01",
    "+275760-09-12",
    "+275760-09-13",
  ];
  it.each(
    Object.values(MustTestCalendars).flatMap((calendar) =>
      isoDates.map((iso) => ({ iso, calendar })),
    ),
  )(
    "writes $iso in $calendar exactly as Temporal.PlainDate#toString and reads it back",
    ({ iso, calendar }) => {
      const expected = Temporal.PlainDate.from(iso)
        .withCalendar(calendar)
        .toString();
      const converted = convertDateToCalendar(iso, calendar);
      expect(converted).toBe(expected);
      expect(convertDateToCalendar(converted, "iso8601")).toBe(iso);
    },
  );

  // test262 intl402/Temporal/PlainDate/from/extreme-dates.js: both TC39 limits in every calendar.
  // The string round-trips, and the date it names reads back the test262 fields. "ethiopic" and
  // "coptic" compute in "ethioaa", so their row reads the ethioaa year of the same date.
  it.each`
    calendar              | minYear    | minMonthCode | minDay | maxYear   | maxMonthCode | maxDay
    ${"buddhist"}         | ${-271278} | ${"M04"}     | ${19}  | ${276303} | ${"M09"}     | ${13}
    ${"coptic"}           | ${-266323} | ${"M03"}     | ${23}  | ${281247} | ${"M05"}     | ${22}
    ${"ethioaa"}          | ${-266323} | ${"M03"}     | ${23}  | ${281247} | ${"M05"}     | ${22}
    ${"ethiopic"}         | ${-266323} | ${"M03"}     | ${23}  | ${281247} | ${"M05"}     | ${22}
    ${"gregory"}          | ${-271821} | ${"M04"}     | ${19}  | ${275760} | ${"M09"}     | ${13}
    ${"hebrew"}           | ${-268058} | ${"M11"}     | ${4}   | ${279517} | ${"M09"}     | ${11}
    ${"indian"}           | ${-271899} | ${"M01"}     | ${29}  | ${275682} | ${"M06"}     | ${22}
    ${"islamic-civil"}    | ${-280804} | ${"M03"}     | ${21}  | ${283583} | ${"M05"}     | ${23}
    ${"islamic-tbla"}     | ${-280804} | ${"M03"}     | ${22}  | ${283583} | ${"M05"}     | ${24}
    ${"islamic-umalqura"} | ${-280804} | ${"M03"}     | ${21}  | ${283583} | ${"M05"}     | ${23}
    ${"japanese"}         | ${-271821} | ${"M04"}     | ${19}  | ${275760} | ${"M09"}     | ${13}
    ${"persian"}          | ${-272442} | ${"M01"}     | ${9}   | ${275139} | ${"M07"}     | ${12}
    ${"roc"}              | ${-273732} | ${"M04"}     | ${19}  | ${273849} | ${"M09"}     | ${13}
  `(
    "round-trips both limits in $calendar (min $minYear-$minMonthCode-$minDay, max $maxYear-$maxMonthCode-$maxDay)",
    ({
      calendar,
      minYear,
      minMonthCode,
      minDay,
      maxYear,
      maxMonthCode,
      maxDay,
    }) => {
      const readId =
        calendar === "ethiopic" || calendar === "coptic" ? "ethioaa" : calendar;
      for (const [iso, year, monthCode, day] of [
        ["-271821-04-19", minYear, minMonthCode, minDay],
        ["+275760-09-13", maxYear, maxMonthCode, maxDay],
      ]) {
        const converted = convertDateToCalendar(iso, calendar);
        expect(converted).toBe(`${iso}[u-ca=${calendar}]`);
        expect(convertDateToCalendar(converted, "iso8601")).toBe(iso);
        const fields = calendarFieldsOf(
          Temporal.PlainDate.from(converted.slice(0, iso.length)),
          readId,
        );
        expect([fields.year, fields.monthCode, fields.day]).toEqual([
          year,
          monthCode,
          day,
        ]);
      }
    },
  );

  it.each`
    value                                    | calendar       | reason
    ${"invalid"}                             | ${"hebrew"}    | ${"not a date"}
    ${"2024-02-30"}                          | ${"hebrew"}    | ${"invalid ISO date"}
    ${""}                                    | ${"hebrew"}    | ${"empty"}
    ${null}                                  | ${"hebrew"}    | ${"not a string"}
    ${123}                                   | ${"hebrew"}    | ${"not a string"}
    ${"0006-10-03[u-ca=japanese;era=reiwa]"} | ${"iso8601"}   | ${"';era=' is not RFC 9557 syntax"}
    ${"279517-10-11[u-ca=hebrew]"}           | ${"iso8601"}   | ${"six-digit unsigned year"}
    ${"-0911-01-01[u-ca=roc]"}               | ${"iso8601"}   | ${"four-digit signed year"}
    ${"+275760-09-14"}                       | ${"hebrew"}    | ${"past the maximum"}
    ${"-271821-04-18"}                       | ${"hebrew"}    | ${"before the minimum"}
    ${"2024-10-03[u-ca=martian]"}            | ${"hebrew"}    | ${"unknown annotation calendar"}
    ${"2024-10-03[u-ca=taiwan]"}             | ${"hebrew"}    | ${"pre-1.16.0 GMT id in the annotation"}
    ${"2024-10-03[u-ca=chinese]"}            | ${"hebrew"}    | ${"calendar GMT does not support"}
    ${"2024-10-03"}                          | ${"martian"}   | ${"unknown target calendar"}
    ${"2024-10-03"}                          | ${"gregorian"} | ${"CLDR alias Temporal rejects"}
    ${"2024-10-03"}                          | ${"taiwan"}    | ${"pre-1.16.0 GMT id as the target"}
    ${"2024-10-03"}                          | ${"islamic"}   | ${"calendar GMT does not support"}
  `(
    "returns empty string for $value to $calendar ($reason)",
    ({ value, calendar }) => {
      expect(convertDateToCalendar(value, calendar)).toBe("");
    },
  );

  it.each`
    calendar                 | expected
    ${"ethiopic-amete-alem"} | ${"2024-10-03[u-ca=ethioaa]"}
    ${"islamicc"}            | ${"2024-10-03[u-ca=islamic-civil]"}
    ${"HEBREW"}              | ${"2024-10-03[u-ca=hebrew]"}
  `(
    "canonicalizes the target calendar $calendar as Temporal's withCalendar does: $expected",
    ({ calendar, expected }) => {
      expect(convertDateToCalendar("2024-10-03", calendar)).toBe(expected);
    },
  );

  it("returns empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(convertDateToCalendar("2024-10-03", "hebrew")).toBe("");
  });
});

// Strict-shape rule (see coding-standards): the part before the first `[` must be GMT's strict extended date (or
// date-time), as `isValidDate`/`isValidDateTime` require. Native Chromium 153
// `Temporal.PlainDate.from` reads each of these as 2024-10-03; GMT rejects them.
describe("convertDateToCalendar rejects strings outside GMT's strict shape", () => {
  it.each`
    value                                    | reason
    ${"20241003"}                            | ${"basic format"}
    ${"2024-10-03 14:30[u-ca=hebrew]"}       | ${"space separator"}
    ${"2024-10-03T14:30+01:00[u-ca=hebrew]"} | ${"UTC offset"}
  `('returns "" for $value ($reason)', ({ value }) => {
    expect(convertDateToCalendar(value, "iso8601")).toBe("");
  });
});
