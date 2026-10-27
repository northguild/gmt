/**
 * The behaviour-matrix cases (M1, M2, M3, M3b and so on).
 *
 * Each case names one input, the Temporal call that defines the expected value, the GMT call, and
 * one call per library. `run.mjs` runs all of them and writes `apps/dox/src/data/behaviour-matrix.json`.
 *
 * Shape of a case:
 *   id        "M1" and so on. The page anchor is the lower-case id.
 *   title     Plain words, one line.
 *   input     The input as the reader would type it.
 *   compare   The comparable form, e.g. "local time and offset". Every result is reduced to this form
 *             (see `normalise` in run.mjs), so two results are "the same" only when the strings match.
 *   norm      How a result is reduced: "offset" keeps the local time and offset, "instant" writes UTC as Z,
 *             "plain" leaves the string alone.
 *   clauses   The spec clauses that decide the answer. Hosts are limited to tc39.es, www.rfc-editor.org,
 *             www.unicode.org and www.iso.org.
 *   temporal  `(T) => string`, run on the polyfill and on native Temporal. Null when Temporal has no call;
 *             then `expected` is the stated result the other rows are compared with.
 *   gmt       `{ fn, call, run(g) }`: the main function, the call as the page prints it, and the call.
 *   gmtNote   Optional. Why GMT's row differs on purpose.
 *   libs      Per library `{ call, run(L) }`, or `{ none: "reason" }` when the library has no such operation.
 *   issues    Per library the open upstream issues. Only issues that match a measured difference are kept.
 *
 * A call that throws, an invalid object, and GMT's empty-string sentinel all reduce to "rejected".
 *
 * Every library call runs once under each host zone in `HOST_ZONES` (see `run.mjs`), so a call must
 * not pass the host zone in by hand: a library that reads it shows up as "varies".
 *
 * No native `Date` is named in this file: date-fns gets `parseISO` and `TZDate`, the others get strings.
 */

export const REJECTED = "rejected";

const TEMPORAL = "https://tc39.es/proposal-temporal/#";
const tc = (label, id) => ({ label, url: `${TEMPORAL}${id}` });
const rfc = (label, n, section) => ({
  label,
  url: `https://www.rfc-editor.org/rfc/rfc${n}${section ? `#section-${section}` : ""}`,
});

const pad = (n) => String(n).padStart(2, "0");

/** The plain date of a valid date-fns value, or "rejected". */
const dfDate = (L, d) =>
  Number.isNaN(d.getTime())
    ? REJECTED
    : L.df.formatISO(d, { representation: "date" });
const lxDate = (d) => (d.isValid ? d.toISODate() : REJECTED);
const jsDate = (d) => (d.isValid() ? d.format("YYYY-MM-DD") : REJECTED);

const BERLIN = "Europe/Berlin";

/** M10c: a string with a calendar annotation, and the instant every reader must give for it. */
const ANNOTATED = "2024-03-31T03:30:00+02:00[Europe/Berlin][u-ca=japanese]";
const ANNOTATED_INSTANT = "2024-03-31T01:30:00Z";

/** "accepted" when the instant is the right one, else says which instant the reader gave. */
const acceptedAt = (iso) => {
  const written = iso.replace(/\.0+Z$/, "Z");
  return written === ANNOTATED_INSTANT
    ? "accepted"
    : `accepted, reads ${written}`;
};

/** The same operation in the five libraries, for "add one day to this zoned time". */
function addDayLibs(isoLocal, tz, tzDateArgs) {
  return {
    "date-fns": {
      call: `addDays(new TZDate(${tzDateArgs}, "${tz}"), 1)`,
      run: (L) =>
        L.df
          .addDays(new L.TZDate(...tzDateArgs.split(", ").map(Number), tz), 1)
          .toISOString(),
    },
    luxon: {
      call: `DateTime.fromISO("${isoLocal}", { zone: "${tz}" }).plus({ days: 1 }).toISO()`,
      run: (L) =>
        L.DateTime.fromISO(isoLocal, { zone: tz }).plus({ days: 1 }).toISO(),
    },
    dayjs: {
      call: `dayjs.tz("${isoLocal}", "${tz}").add(1, "day").format()`,
      run: (L) => L.dayjs.tz(isoLocal, tz).add(1, "day").format(),
    },
    moment: {
      call: `moment.tz("${isoLocal}", "${tz}").add(1, "day").format()`,
      run: (L) => L.moment.tz(isoLocal, tz).add(1, "day").format(),
    },
    "internationalized-date": {
      call: `parseZonedDateTime("${isoLocal}[${tz}]").add({ days: 1 }).toString()`,
      run: (L) =>
        L.intl
          .parseZonedDateTime(`${isoLocal}[${tz}]`)
          .add({ days: 1 })
          .toString(),
    },
  };
}

export const cases = [
  {
    id: "M1",
    title: "Add one calendar day across a DST gap",
    input:
      "2024-03-30T02:30:00+01:00[Europe/Berlin], plus 1 day (02:30 does not exist on 2024-03-31)",
    compare: "local time and offset",
    norm: "offset",
    clauses: [
      tc("AddZonedDateTime (6.5.5)", "sec-temporal-addzoneddatetime"),
      tc(
        "DisambiguatePossibleEpochNanoseconds (11.1.12)",
        "sec-temporal-disambiguatepossibleepochnanoseconds",
      ),
      rfc("RFC 5545 section 3.3.6", 5545, "3.3.6"),
    ],
    temporal: (T) =>
      T.ZonedDateTime.from("2024-03-30T02:30:00+01:00[Europe/Berlin]")
        .add({ days: 1 })
        .toString(),
    gmt: {
      fn: "addZoned",
      call: 'addZoned("2024-03-30T02:30:00+01:00[Europe/Berlin]", { days: 1 })',
      run: (g) =>
        g.addZoned("2024-03-30T02:30:00+01:00[Europe/Berlin]", { days: 1 }),
    },
    libs: addDayLibs("2024-03-30T02:30", BERLIN, "2024, 2, 30, 2, 30"),
    issues: {
      dayjs: ["iamkun/dayjs#1271", "iamkun/dayjs#1260", "iamkun/dayjs#1827"],
    },
  },
  {
    id: "M2",
    title: "Add one calendar day, not 24 hours",
    input:
      "2024-03-30T12:00:00+01:00[Europe/Berlin], plus 1 day (the day of 2024-03-31 has 23 hours)",
    compare: "local time and offset",
    norm: "offset",
    clauses: [
      tc("AddZonedDateTime (6.5.5)", "sec-temporal-addzoneddatetime"),
      tc(
        "hoursInDay (6.3.23)",
        "sec-get-temporal.zoneddatetime.prototype.hoursinday",
      ),
      rfc("RFC 5545 section 3.3.6", 5545, "3.3.6"),
    ],
    temporal: (T) =>
      T.ZonedDateTime.from("2024-03-30T12:00:00+01:00[Europe/Berlin]")
        .add({ days: 1 })
        .toString(),
    gmt: {
      fn: "addZoned",
      call: 'addZoned("2024-03-30T12:00:00+01:00[Europe/Berlin]", { days: 1 })',
      run: (g) =>
        g.addZoned("2024-03-30T12:00:00+01:00[Europe/Berlin]", { days: 1 }),
    },
    libs: addDayLibs("2024-03-30T12:00", BERLIN, "2024, 2, 30, 12, 0"),
    issues: { dayjs: ["iamkun/dayjs#1271"] },
  },
  {
    id: "M3",
    title: "Add one day into a repeated hour",
    input:
      "2024-10-26T02:30:00+02:00[Europe/Berlin], plus 1 day (02:30 happens twice on 2024-10-27)",
    compare: "local time and offset",
    norm: "offset",
    clauses: [
      tc(
        "DisambiguatePossibleEpochNanoseconds (11.1.12)",
        "sec-temporal-disambiguatepossibleepochnanoseconds",
      ),
      tc("AddZonedDateTime (6.5.5)", "sec-temporal-addzoneddatetime"),
    ],
    temporal: (T) =>
      T.ZonedDateTime.from("2024-10-26T02:30:00+02:00[Europe/Berlin]")
        .add({ days: 1 })
        .toString(),
    gmt: {
      fn: "addZoned",
      call: 'addZoned("2024-10-26T02:30:00+02:00[Europe/Berlin]", { days: 1 })',
      run: (g) =>
        g.addZoned("2024-10-26T02:30:00+02:00[Europe/Berlin]", { days: 1 }),
    },
    libs: addDayLibs("2024-10-26T02:30", BERLIN, "2024, 9, 26, 2, 30"),
    issues: {},
  },
  {
    id: "M3b",
    title: "Two readings of 02:30 on the repeated-hour day: equal or not",
    input:
      "2024-10-27T02:30:00+02:00[Europe/Berlin] and 2024-10-27T02:30:00+01:00[Europe/Berlin]",
    compare: "equal (true or false)",
    norm: "plain",
    clauses: [
      tc(
        "ZonedDateTime.prototype.equals (6.3.40)",
        "sec-temporal.zoneddatetime.prototype.equals",
      ),
    ],
    temporal: (T) =>
      String(
        T.ZonedDateTime.from("2024-10-27T02:30:00+02:00[Europe/Berlin]").equals(
          T.ZonedDateTime.from("2024-10-27T02:30:00+01:00[Europe/Berlin]"),
        ),
      ),
    gmt: {
      fn: "areZonedEqual",
      call: 'areZonedEqual("2024-10-27T02:30:00+02:00[Europe/Berlin]", "2024-10-27T02:30:00+01:00[Europe/Berlin]")',
      run: (g) =>
        String(
          g.areZonedEqual(
            "2024-10-27T02:30:00+02:00[Europe/Berlin]",
            "2024-10-27T02:30:00+01:00[Europe/Berlin]",
          ),
        ),
    },
    libs: {
      "date-fns": {
        call: 'isEqual(parseISO("2024-10-27T02:30:00+02:00"), parseISO("2024-10-27T02:30:00+01:00"))',
        run: (L) =>
          String(
            L.df.isEqual(
              L.df.parseISO("2024-10-27T02:30:00+02:00"),
              L.df.parseISO("2024-10-27T02:30:00+01:00"),
            ),
          ),
      },
      luxon: {
        call: 'DateTime.fromISO(a, { zone: "Europe/Berlin" }).equals(DateTime.fromISO(b, { zone: "Europe/Berlin" }))',
        run: (L) =>
          String(
            L.DateTime.fromISO("2024-10-27T02:30:00+02:00", {
              zone: BERLIN,
            }).equals(
              L.DateTime.fromISO("2024-10-27T02:30:00+01:00", { zone: BERLIN }),
            ),
          ),
      },
      dayjs: {
        call: "dayjs(a).isSame(dayjs(b))",
        run: (L) =>
          String(
            L.dayjs("2024-10-27T02:30:00+02:00").isSame(
              L.dayjs("2024-10-27T02:30:00+01:00"),
            ),
          ),
      },
      moment: {
        call: "moment.parseZone(a).isSame(moment.parseZone(b))",
        run: (L) =>
          String(
            L.moment
              .parseZone("2024-10-27T02:30:00+02:00")
              .isSame(L.moment.parseZone("2024-10-27T02:30:00+01:00")),
          ),
      },
      "internationalized-date": {
        call: "parseZonedDateTime(a).compare(parseZonedDateTime(b)) === 0",
        run: (L) =>
          String(
            L.intl
              .parseZonedDateTime("2024-10-27T02:30:00+02:00[Europe/Berlin]")
              .compare(
                L.intl.parseZonedDateTime(
                  "2024-10-27T02:30:00+01:00[Europe/Berlin]",
                ),
              ) === 0,
          ),
      },
    },
    issues: {},
  },
  {
    id: "M4",
    title: "Resolve a wall time that does not exist",
    input:
      "2024-03-31T02:30:00 in Europe/Berlin (the clocks skip from 02:00 to 03:00)",
    compare: "UTC instant",
    norm: "instant",
    clauses: [
      tc(
        "GetEpochNanosecondsFor (11.1.11)",
        "sec-temporal-getepochnanosecondsfor",
      ),
      tc(
        "DisambiguatePossibleEpochNanoseconds (11.1.12)",
        "sec-temporal-disambiguatepossibleepochnanoseconds",
      ),
      tc(
        "GetPossibleEpochNanoseconds (11.1.13)",
        "sec-temporal-getpossibleepochnanoseconds",
      ),
    ],
    temporal: (T) =>
      T.PlainDateTime.from("2024-03-31T02:30")
        .toZonedDateTime(BERLIN)
        .toInstant()
        .toString(),
    gmt: {
      fn: "resolveLocal",
      call: 'resolveLocal("2024-03-31T02:30:00", "Europe/Berlin")',
      run: (g) => g.resolveLocal("2024-03-31T02:30:00", BERLIN),
    },
    libs: {
      "date-fns": {
        call: 'new TZDate(2024, 2, 31, 2, 30, "Europe/Berlin")',
        run: (L) =>
          new L.TZDate(
            new L.TZDate(2024, 2, 31, 2, 30, BERLIN).getTime(),
            "UTC",
          ).toISOString(),
      },
      luxon: {
        call: 'DateTime.fromISO("2024-03-31T02:30", { zone: "Europe/Berlin" }).toUTC().toISO()',
        run: (L) =>
          L.DateTime.fromISO("2024-03-31T02:30", { zone: BERLIN })
            .toUTC()
            .toISO(),
      },
      dayjs: {
        call: 'dayjs.tz("2024-03-31T02:30", "Europe/Berlin").utc().format()',
        run: (L) => L.dayjs.tz("2024-03-31T02:30", BERLIN).utc().format(),
      },
      moment: {
        call: 'moment.tz("2024-03-31T02:30", "Europe/Berlin").utc().format()',
        run: (L) => L.moment.tz("2024-03-31T02:30", BERLIN).utc().format(),
      },
      "internationalized-date": {
        call: 'parseZonedDateTime("2024-03-31T02:30[Europe/Berlin]").toAbsoluteString()',
        run: (L) =>
          L.intl
            .parseZonedDateTime("2024-03-31T02:30[Europe/Berlin]")
            .toAbsoluteString(),
      },
    },
    issues: {},
  },
  {
    id: "M4b",
    title: "Reject a wall time that does not exist",
    input:
      "2024-03-31T02:30:00 in Europe/Berlin, asking for an error instead of a shifted time",
    compare: "UTC instant, or rejected",
    norm: "instant",
    clauses: [
      tc(
        "DisambiguatePossibleEpochNanoseconds (11.1.12)",
        "sec-temporal-disambiguatepossibleepochnanoseconds",
      ),
      tc(
        "GetTemporalDisambiguationOption (13.7)",
        "sec-temporal-gettemporaldisambiguationoption",
      ),
    ],
    temporal: (T) =>
      T.PlainDateTime.from("2024-03-31T02:30")
        .toZonedDateTime(BERLIN, { disambiguation: "reject" })
        .toInstant()
        .toString(),
    gmt: {
      fn: "resolveLocal",
      call: 'resolveLocal("2024-03-31T02:30:00", "Europe/Berlin", { disambiguation: "reject" })',
      run: (g) =>
        g.resolveLocal("2024-03-31T02:30:00", BERLIN, {
          disambiguation: "reject",
        }),
    },
    libs: {
      "date-fns": {
        none: "TZDate always resolves a skipped wall time; it has no option to reject it",
      },
      luxon: {
        none: "fromISO always resolves a skipped wall time; it has no option to reject it",
      },
      dayjs: {
        none: "dayjs.tz always resolves a skipped wall time; it has no option to reject it",
      },
      moment: {
        none: "moment.tz always resolves a skipped wall time; it has no option to reject it",
      },
      "internationalized-date": {
        call: 'parseZonedDateTime("2024-03-31T02:30[Europe/Berlin]", "reject")',
        run: (L) =>
          L.intl
            .parseZonedDateTime("2024-03-31T02:30[Europe/Berlin]", "reject")
            .toAbsoluteString(),
      },
    },
    issues: {},
  },
  {
    id: "M5",
    title: "Add one day across a 30-minute DST change",
    input:
      "2024-10-05T02:15:00+10:30[Australia/Lord_Howe], plus 1 day (the clocks move 30 minutes on 2024-10-06)",
    compare: "local time and offset",
    norm: "offset",
    clauses: [
      tc("AddZonedDateTime (6.5.5)", "sec-temporal-addzoneddatetime"),
      tc(
        "hoursInDay (6.3.23)",
        "sec-get-temporal.zoneddatetime.prototype.hoursinday",
      ),
    ],
    temporal: (T) =>
      T.ZonedDateTime.from("2024-10-05T02:15:00+10:30[Australia/Lord_Howe]")
        .add({ days: 1 })
        .toString(),
    gmt: {
      fn: "addZoned",
      call: 'addZoned("2024-10-05T02:15:00+10:30[Australia/Lord_Howe]", { days: 1 })',
      run: (g) =>
        g.addZoned("2024-10-05T02:15:00+10:30[Australia/Lord_Howe]", {
          days: 1,
        }),
    },
    libs: addDayLibs(
      "2024-10-05T02:15",
      "Australia/Lord_Howe",
      "2024, 9, 5, 2, 15",
    ),
    issues: {},
  },
  {
    id: "M6",
    title: "Start of a day whose midnight does not exist",
    input:
      "2024-09-08T12:00:00-03:00[America/Santiago], start of day (the clocks skip from 00:00 to 01:00)",
    compare: "local time and offset",
    norm: "offset",
    clauses: [
      tc("GetStartOfDay (11.1.14)", "sec-temporal-getstartofday"),
      tc(
        "startOfDay (6.3.45)",
        "sec-temporal.zoneddatetime.prototype.startofday",
      ),
    ],
    temporal: (T) =>
      T.ZonedDateTime.from("2024-09-08T12:00:00-03:00[America/Santiago]")
        .startOfDay()
        .toString(),
    gmt: {
      fn: "startOfZoned",
      call: 'startOfZoned("2024-09-08T12:00:00-03:00[America/Santiago]", "day")',
      run: (g) =>
        g.startOfZoned("2024-09-08T12:00:00-03:00[America/Santiago]", "day"),
    },
    libs: {
      "date-fns": {
        call: 'startOfDay(new TZDate(2024, 8, 8, 12, 0, "America/Santiago"))',
        run: (L) =>
          L.df
            .startOfDay(new L.TZDate(2024, 8, 8, 12, 0, "America/Santiago"))
            .toISOString(),
      },
      luxon: {
        call: 'DateTime.fromISO("2024-09-08T12:00", { zone: "America/Santiago" }).startOf("day").toISO()',
        run: (L) =>
          L.DateTime.fromISO("2024-09-08T12:00", { zone: "America/Santiago" })
            .startOf("day")
            .toISO(),
      },
      dayjs: {
        call: 'dayjs.tz("2024-09-08T12:00", "America/Santiago").startOf("day").format()',
        run: (L) =>
          L.dayjs
            .tz("2024-09-08T12:00", "America/Santiago")
            .startOf("day")
            .format(),
      },
      moment: {
        call: 'moment.tz("2024-09-08T12:00", "America/Santiago").startOf("day").format()',
        run: (L) =>
          L.moment
            .tz("2024-09-08T12:00", "America/Santiago")
            .startOf("day")
            .format(),
      },
      "internationalized-date": {
        call: 'toZoned(toCalendarDate(parseZonedDateTime("2024-09-08T12:00[America/Santiago]")), "America/Santiago")',
        run: (L) =>
          L.intl
            .toZoned(
              L.intl.toCalendarDate(
                L.intl.parseZonedDateTime("2024-09-08T12:00[America/Santiago]"),
              ),
              "America/Santiago",
            )
            .toString(),
      },
    },
    issues: {
      dayjs: ["iamkun/dayjs#1437", "iamkun/dayjs#2553", "iamkun/dayjs#2057"],
    },
  },
  {
    id: "M7",
    title: "Add one month to January 31",
    input: "2024-01-31, plus 1 month",
    compare: "date",
    norm: "plain",
    clauses: [
      tc("RegulateISODate (3.5.7)", "sec-temporal-regulateisodate"),
      tc("CalendarDateAdd (12.3.7)", "sec-temporal-calendardateadd"),
    ],
    temporal: (T) =>
      T.PlainDate.from("2024-01-31").add({ months: 1 }).toString(),
    gmt: {
      fn: "addDate",
      call: 'addDate("2024-01-31", { months: 1 })',
      run: (g) => g.addDate("2024-01-31", { months: 1 }),
    },
    libs: {
      "date-fns": {
        call: 'addMonths(parseISO("2024-01-31"), 1)',
        run: (L) => dfDate(L, L.df.addMonths(L.df.parseISO("2024-01-31"), 1)),
      },
      luxon: {
        call: 'DateTime.fromISO("2024-01-31").plus({ months: 1 }).toISODate()',
        run: (L) =>
          lxDate(L.DateTime.fromISO("2024-01-31").plus({ months: 1 })),
      },
      dayjs: {
        call: 'dayjs("2024-01-31").add(1, "month").format("YYYY-MM-DD")',
        run: (L) => jsDate(L.dayjs("2024-01-31").add(1, "month")),
      },
      moment: {
        call: 'moment("2024-01-31").add(1, "month").format("YYYY-MM-DD")',
        run: (L) => jsDate(L.moment("2024-01-31").add(1, "month")),
      },
      "internationalized-date": {
        call: 'parseDate("2024-01-31").add({ months: 1 }).toString()',
        run: (L) =>
          L.intl.parseDate("2024-01-31").add({ months: 1 }).toString(),
      },
    },
    issues: {},
  },
  {
    id: "M8",
    title: "Whole months between January 31 and February 29",
    input: "2024-01-31 until 2024-02-29",
    compare: "whole months",
    norm: "plain",
    clauses: [
      tc("CompareSurpasses (3.5.5)", "sec-temporal-comparesurpasses"),
      tc("CalendarDateUntil (12.3.9)", "sec-temporal-calendardateuntil"),
    ],
    temporal: (T) =>
      String(
        T.PlainDate.from("2024-01-31").until("2024-02-29", {
          largestUnit: "months",
        }).months,
      ),
    gmt: {
      fn: "diffDate",
      call: 'diffDate("2024-01-31", "2024-02-29", "months")',
      run: (g) => String(g.diffDate("2024-01-31", "2024-02-29", "months")),
    },
    libs: {
      "date-fns": {
        call: 'differenceInMonths(parseISO("2024-02-29"), parseISO("2024-01-31"))',
        run: (L) =>
          String(
            L.df.differenceInMonths(
              L.df.parseISO("2024-02-29"),
              L.df.parseISO("2024-01-31"),
            ),
          ),
      },
      luxon: {
        call: 'DateTime.fromISO("2024-02-29").diff(DateTime.fromISO("2024-01-31"), "months").months',
        run: (L) =>
          String(
            L.DateTime.fromISO("2024-02-29").diff(
              L.DateTime.fromISO("2024-01-31"),
              "months",
            ).months,
          ),
      },
      dayjs: {
        call: 'dayjs("2024-02-29").diff(dayjs("2024-01-31"), "month")',
        run: (L) =>
          String(L.dayjs("2024-02-29").diff(L.dayjs("2024-01-31"), "month")),
      },
      moment: {
        call: 'moment("2024-02-29").diff(moment("2024-01-31"), "months")',
        run: (L) =>
          String(L.moment("2024-02-29").diff(L.moment("2024-01-31"), "months")),
      },
      "internationalized-date": {
        none: "it has no month difference; compare() returns a count of days",
      },
    },
    issues: {},
  },
  {
    id: "M9",
    title: "Parse a date whose year has one digit",
    input: '"2-12-12" read as an ISO 8601 date',
    compare: "date, or rejected",
    norm: "plain",
    clauses: [
      tc("ISO 8601 grammar (13.31)", "sec-temporal-iso8601grammar"),
      rfc("RFC 3339 section 5.6", 3339, "5.6"),
    ],
    temporal: (T) => T.PlainDate.from("2-12-12").toString(),
    gmt: {
      fn: "isValidDate",
      call: 'isValidDate("2-12-12")',
      run: (g) => (g.isValidDate("2-12-12") ? "2-12-12" : REJECTED),
    },
    libs: {
      "date-fns": {
        call: 'parseISO("2-12-12")',
        run: (L) => dfDate(L, L.df.parseISO("2-12-12")),
      },
      luxon: {
        call: 'DateTime.fromISO("2-12-12")',
        run: (L) => lxDate(L.DateTime.fromISO("2-12-12")),
      },
      dayjs: {
        call: 'dayjs("2-12-12")',
        run: (L) => jsDate(L.dayjs("2-12-12")),
      },
      moment: {
        call: 'moment("2-12-12", moment.ISO_8601, true)',
        run: (L) => jsDate(L.moment("2-12-12", L.moment.ISO_8601, true)),
      },
      "internationalized-date": {
        call: 'parseDate("2-12-12")',
        run: (L) => L.intl.parseDate("2-12-12").toString(),
      },
    },
    issues: {},
  },
  {
    id: "M9d",
    title: "Read a year of one digit with a pattern",
    input: '"2-12-12" read with the pattern year-month-day',
    compare: "date, or rejected",
    norm: "plain",
    clauses: [
      {
        label: "UTS #35 Date Format Patterns",
        url: "https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Format_Patterns",
      },
      tc("ISO 8601 grammar (13.31)", "sec-temporal-iso8601grammar"),
    ],
    temporal: null,
    expected: "rejected",
    gmt: {
      fn: "parseDateWithPattern",
      call: 'parseDateWithPattern("2-12-12", "yyyy-MM-dd")',
      run: (g) => g.parseDateWithPattern("2-12-12", "yyyy-MM-dd"),
    },
    gmtNote:
      "Temporal reads no patterns, so the stated result is GMT's choice: `yyyy` is four digits, as the year is in the ISO 8601 grammar. UTS #35 recommends lenient pattern parsing, so a library that reads `2` as year 2 follows it. The rows show the difference and make no claim about which is right.",
    libs: {
      "date-fns": {
        call: 'parse("2-12-12", "yyyy-MM-dd", parseISO("2000-01-01"))',
        run: (L) =>
          dfDate(
            L,
            L.df.parse("2-12-12", "yyyy-MM-dd", L.df.parseISO("2000-01-01")),
          ),
      },
      luxon: {
        call: 'DateTime.fromFormat("2-12-12", "yyyy-MM-dd")',
        run: (L) => lxDate(L.DateTime.fromFormat("2-12-12", "yyyy-MM-dd")),
      },
      dayjs: {
        call: 'dayjs("2-12-12", "YYYY-MM-DD", true)',
        run: (L) => jsDate(L.dayjs("2-12-12", "YYYY-MM-DD", true)),
      },
      moment: {
        call: 'moment("2-12-12", "YYYY-MM-DD", true)',
        run: (L) => jsDate(L.moment("2-12-12", "YYYY-MM-DD", true)),
      },
      "internationalized-date": {
        none: "it has no pattern parser; parseDate reads ISO 8601 only",
      },
    },
    issues: { "date-fns": ["date-fns/date-fns#942", "date-fns/date-fns#1569"] },
  },
  {
    id: "M9b",
    title: "Parse a date that is not on the calendar",
    input: '"2024-02-30"',
    compare: "date, or rejected",
    norm: "plain",
    clauses: [
      tc(
        "IsValidDate (13.31.2)",
        "sec-temporal-iso8601grammar-static-semantics-isvaliddate",
      ),
      tc("IsValidISODate (3.5.8)", "sec-temporal-isvalidisodate"),
    ],
    temporal: (T) => T.PlainDate.from("2024-02-30").toString(),
    gmt: {
      fn: "isValidDate",
      call: 'isValidDate("2024-02-30")',
      run: (g) => (g.isValidDate("2024-02-30") ? "2024-02-30" : REJECTED),
    },
    libs: {
      "date-fns": {
        call: 'parseISO("2024-02-30")',
        run: (L) => dfDate(L, L.df.parseISO("2024-02-30")),
      },
      luxon: {
        call: 'DateTime.fromISO("2024-02-30")',
        run: (L) => lxDate(L.DateTime.fromISO("2024-02-30")),
      },
      dayjs: {
        call: 'dayjs("2024-02-30")',
        run: (L) => jsDate(L.dayjs("2024-02-30")),
      },
      moment: {
        call: 'moment("2024-02-30", moment.ISO_8601, true)',
        run: (L) => jsDate(L.moment("2024-02-30", L.moment.ISO_8601, true)),
      },
      "internationalized-date": {
        call: 'parseDate("2024-02-30")',
        run: (L) => L.intl.parseDate("2024-02-30").toString(),
      },
    },
    issues: {},
  },
  {
    id: "M9c",
    title: "Parse a date in basic format",
    input: '"20240212"',
    compare: "date, or rejected",
    norm: "plain",
    clauses: [
      rfc("RFC 3339 section 5.6", 3339, "5.6"),
      tc("ISO 8601 grammar (13.31)", "sec-temporal-iso8601grammar"),
    ],
    temporal: (T) => T.PlainDate.from("20240212").toString(),
    gmt: {
      fn: "isValidDate",
      call: 'isValidDate("20240212")',
      run: (g) => (g.isValidDate("20240212") ? "2024-02-12" : REJECTED),
    },
    gmtNote:
      "GMT validators take the extended form of RFC 3339 section 5.6 only, so `20240212` is rejected on purpose. Temporal accepts the basic form.",
    libs: {
      "date-fns": {
        call: 'parseISO("20240212")',
        run: (L) => dfDate(L, L.df.parseISO("20240212")),
      },
      luxon: {
        call: 'DateTime.fromISO("20240212")',
        run: (L) => lxDate(L.DateTime.fromISO("20240212")),
      },
      dayjs: {
        call: 'dayjs("20240212")',
        run: (L) => jsDate(L.dayjs("20240212")),
      },
      moment: {
        call: 'moment("20240212", moment.ISO_8601, true)',
        run: (L) => jsDate(L.moment("20240212", L.moment.ISO_8601, true)),
      },
      "internationalized-date": {
        call: 'parseDate("20240212")',
        run: (L) => L.intl.parseDate("20240212").toString(),
      },
    },
    issues: {},
  },
  {
    id: "M10",
    title: "Read a string with a bracketed time zone",
    input: "2024-03-31T03:30:00+02:00[Europe/Berlin]",
    compare: "UTC instant",
    norm: "instant",
    clauses: [
      rfc("RFC 9557 section 4.1", 9557, "4.1"),
      tc(
        "InterpretISODateTimeOffset (6.5.1)",
        "sec-temporal-interpretisodatetimeoffset",
      ),
    ],
    temporal: (T) =>
      T.ZonedDateTime.from("2024-03-31T03:30:00+02:00[Europe/Berlin]")
        .toInstant()
        .toString(),
    gmt: {
      fn: "convertZonedToUtc",
      call: 'convertZonedToUtc("2024-03-31T03:30:00+02:00[Europe/Berlin]")',
      run: (g) =>
        g.convertZonedToUtc("2024-03-31T03:30:00+02:00[Europe/Berlin]"),
    },
    libs: {
      "date-fns": {
        call: 'parseISO("2024-03-31T03:30:00+02:00[Europe/Berlin]").toISOString()',
        run: (L) =>
          L.df
            .parseISO("2024-03-31T03:30:00+02:00[Europe/Berlin]")
            .toISOString(),
      },
      luxon: {
        call: 'DateTime.fromISO("2024-03-31T03:30:00+02:00[Europe/Berlin]").toUTC().toISO()',
        run: (L) =>
          L.DateTime.fromISO("2024-03-31T03:30:00+02:00[Europe/Berlin]")
            .toUTC()
            .toISO(),
      },
      dayjs: {
        call: 'dayjs("2024-03-31T03:30:00+02:00[Europe/Berlin]").toISOString()',
        run: (L) => {
          const d = L.dayjs("2024-03-31T03:30:00+02:00[Europe/Berlin]");
          return d.isValid() ? d.toISOString() : REJECTED;
        },
      },
      moment: {
        call: 'moment("2024-03-31T03:30:00+02:00[Europe/Berlin]", moment.ISO_8601, true)',
        run: (L) => {
          const d = L.moment(
            "2024-03-31T03:30:00+02:00[Europe/Berlin]",
            L.moment.ISO_8601,
            true,
          );
          return d.isValid() ? d.toISOString() : REJECTED;
        },
      },
      "internationalized-date": {
        call: 'parseZonedDateTime("2024-03-31T03:30:00+02:00[Europe/Berlin]").toAbsoluteString()',
        run: (L) =>
          L.intl
            .parseZonedDateTime("2024-03-31T03:30:00+02:00[Europe/Berlin]")
            .toAbsoluteString(),
      },
    },
    issues: {},
  },
  {
    id: "M10b",
    title: "Time zone name after reading a bracketed time zone",
    input: "2024-03-31T03:30:00+02:00[Europe/Berlin]",
    compare: "time zone name",
    norm: "plain",
    clauses: [
      rfc("RFC 9557 section 4.1", 9557, "4.1"),
      tc(
        "ToTemporalZonedDateTime (6.5.2)",
        "sec-temporal-totemporalzoneddatetime",
      ),
    ],
    temporal: (T) =>
      T.ZonedDateTime.from("2024-03-31T03:30:00+02:00[Europe/Berlin]")
        .timeZoneId,
    gmt: {
      fn: "parseTimeZoneFromZoned",
      call: 'parseTimeZoneFromZoned("2024-03-31T03:30:00+02:00[Europe/Berlin]")',
      run: (g) =>
        g.parseTimeZoneFromZoned("2024-03-31T03:30:00+02:00[Europe/Berlin]"),
    },
    libs: {
      "date-fns": {
        none: "parseISO returns a Date; it keeps no time zone name",
      },
      luxon: {
        call: 'DateTime.fromISO("2024-03-31T03:30:00+02:00[Europe/Berlin]", { setZone: true }).zoneName',
        run: (L) =>
          L.DateTime.fromISO("2024-03-31T03:30:00+02:00[Europe/Berlin]", {
            setZone: true,
          }).zoneName,
      },
      dayjs: {
        none: "it rejects the bracketed string, so there is no time zone to read",
      },
      moment: {
        none: "strict ISO 8601 parsing rejects the bracketed string, so there is no time zone to read",
      },
      "internationalized-date": {
        call: 'parseZonedDateTime("2024-03-31T03:30:00+02:00[Europe/Berlin]").timeZone',
        run: (L) =>
          L.intl.parseZonedDateTime("2024-03-31T03:30:00+02:00[Europe/Berlin]")
            .timeZone,
      },
    },
    issues: {},
  },
  {
    id: "M10c",
    title: "Read a string with a calendar annotation",
    input: "2024-03-31T03:30:00+02:00[Europe/Berlin][u-ca=japanese]",
    compare: "accepted or rejected, and for an accepted string the UTC instant",
    norm: "plain",
    clauses: [
      rfc("RFC 9557 section 3.3", 9557, "3.3"),
      rfc("RFC 9557 section 4.1", 9557, "4.1"),
      tc(
        "ToTemporalZonedDateTime (6.5.2)",
        "sec-temporal-totemporalzoneddatetime",
      ),
      tc("ParseISODateTime (13.35)", "sec-temporal-parseisodatetime"),
    ],
    temporal: (T) =>
      acceptedAt(T.ZonedDateTime.from(ANNOTATED).toInstant().toString()),
    gmt: {
      fn: "isValidCalendarZonedDateTime",
      call: `isValidCalendarZonedDateTime("${ANNOTATED}")`,
      run: (g) =>
        g.isValidCalendarZonedDateTime(ANNOTATED)
          ? acceptedAt(
              g.convertZonedToUtc(ANNOTATED.replace(/\[u-ca=[^\]]*\]/, "")),
            )
          : REJECTED,
    },
    gmtNote:
      "GMT's validator reports whether the string is accepted. The run also reads the instant with `convertZonedToUtc` from the string without its annotation, which that function does not take.",
    libs: {
      "date-fns": {
        call: `parseISO("${ANNOTATED}").toISOString()`,
        run: (L) => {
          const d = L.df.parseISO(ANNOTATED);
          return Number.isNaN(d.getTime())
            ? REJECTED
            : acceptedAt(d.toISOString());
        },
      },
      luxon: {
        call: `DateTime.fromISO("${ANNOTATED}").toUTC().toISO()`,
        run: (L) => {
          const d = L.DateTime.fromISO(ANNOTATED);
          return d.isValid ? acceptedAt(d.toUTC().toISO()) : REJECTED;
        },
      },
      dayjs: {
        call: `dayjs("${ANNOTATED}").toISOString()`,
        run: (L) => {
          const d = L.dayjs(ANNOTATED);
          return d.isValid() ? acceptedAt(d.toISOString()) : REJECTED;
        },
      },
      moment: {
        call: `moment("${ANNOTATED}", moment.ISO_8601, true).toISOString()`,
        run: (L) => {
          const d = L.moment(ANNOTATED, L.moment.ISO_8601, true);
          return d.isValid() ? acceptedAt(d.toISOString()) : REJECTED;
        },
      },
      "internationalized-date": {
        call: `parseZonedDateTime("${ANNOTATED}").toAbsoluteString()`,
        run: (L) =>
          acceptedAt(L.intl.parseZonedDateTime(ANNOTATED).toAbsoluteString()),
      },
    },
    issues: { luxon: ["moment/luxon#1621"] },
  },
  {
    id: "M10d",
    title: "Read a string whose offset does not match its time zone",
    input:
      "2022-07-08T00:14:07+01:00[Europe/Paris] (Paris is at +02:00 on that date)",
    compare: "UTC instant, or rejected",
    norm: "instant",
    clauses: [
      rfc("RFC 9557 section 3.4", 9557, "3.4"),
      tc(
        "InterpretISODateTimeOffset (6.5.1)",
        "sec-temporal-interpretisodatetimeoffset",
      ),
      tc(
        "GetTemporalOffsetOption (13.9)",
        "sec-temporal-gettemporaloffsetoption",
      ),
    ],
    temporal: (T) =>
      T.ZonedDateTime.from("2022-07-08T00:14:07+01:00[Europe/Paris]")
        .toInstant()
        .toString(),
    gmt: {
      fn: "convertZonedToUtc",
      call: 'convertZonedToUtc("2022-07-08T00:14:07+01:00[Europe/Paris]")',
      run: (g) =>
        g.convertZonedToUtc("2022-07-08T00:14:07+01:00[Europe/Paris]"),
    },
    libs: {
      "date-fns": {
        call: 'parseISO("2022-07-08T00:14:07+01:00[Europe/Paris]").toISOString()',
        run: (L) =>
          L.df
            .parseISO("2022-07-08T00:14:07+01:00[Europe/Paris]")
            .toISOString(),
      },
      luxon: {
        call: 'DateTime.fromISO("2022-07-08T00:14:07+01:00[Europe/Paris]").toUTC().toISO()',
        run: (L) =>
          L.DateTime.fromISO("2022-07-08T00:14:07+01:00[Europe/Paris]")
            .toUTC()
            .toISO(),
      },
      dayjs: { none: "it rejects the bracketed string" },
      moment: { none: "strict ISO 8601 parsing rejects the bracketed string" },
      "internationalized-date": {
        call: 'parseZonedDateTime("2022-07-08T00:14:07+01:00[Europe/Paris]").toAbsoluteString()',
        run: (L) =>
          L.intl
            .parseZonedDateTime("2022-07-08T00:14:07+01:00[Europe/Paris]")
            .toAbsoluteString(),
      },
    },
    issues: {},
  },
  {
    id: "M11",
    title: "Read an offset with minutes before UTC",
    input: "2024-01-15T12:00:00-03:30",
    compare: "UTC instant",
    norm: "instant",
    clauses: [
      rfc("RFC 3339 section 4.2", 3339, "4.2"),
      tc("ParseDateTimeUTCOffset (14.6.11)", "sec-parsedatetimeutcoffset"),
    ],
    temporal: (T) => T.Instant.from("2024-01-15T12:00:00-03:30").toString(),
    gmt: {
      fn: "toOffsetInstant",
      call: 'toOffsetInstant("2024-01-15T12:00:00-03:30").instant',
      run: (g) => g.toOffsetInstant("2024-01-15T12:00:00-03:30")?.instant,
    },
    libs: {
      "date-fns": {
        call: 'parseISO("2024-01-15T12:00:00-03:30").toISOString()',
        run: (L) => L.df.parseISO("2024-01-15T12:00:00-03:30").toISOString(),
      },
      luxon: {
        call: 'DateTime.fromISO("2024-01-15T12:00:00-03:30").toUTC().toISO()',
        run: (L) =>
          L.DateTime.fromISO("2024-01-15T12:00:00-03:30").toUTC().toISO(),
      },
      dayjs: {
        call: 'dayjs("2024-01-15T12:00:00-03:30").toISOString()',
        run: (L) => L.dayjs("2024-01-15T12:00:00-03:30").toISOString(),
      },
      moment: {
        call: 'moment("2024-01-15T12:00:00-03:30").toISOString()',
        run: (L) => L.moment("2024-01-15T12:00:00-03:30").toISOString(),
      },
      "internationalized-date": {
        call: 'parseAbsolute("2024-01-15T12:00:00-03:30", "UTC").toAbsoluteString()',
        run: (L) =>
          L.intl
            .parseAbsolute("2024-01-15T12:00:00-03:30", "UTC")
            .toAbsoluteString(),
      },
    },
    issues: { "internationalized-date": ["adobe/react-spectrum#10809"] },
  },
  {
    id: "M12",
    title: "ISO week and week-year at a year boundary",
    input: "2024-12-30",
    compare: "ISO week-year and week",
    norm: "plain",
    clauses: [
      tc("ISOWeekOfYear (12.3.18)", "sec-temporal-isoweekofyear"),
      {
        label: "ISO 8601-1 (week calendar)",
        url: "https://www.iso.org/standard/70907.html",
      },
    ],
    temporal: (T) => {
      const d = T.PlainDate.from("2024-12-30");
      return `${d.yearOfWeek}-W${pad(d.weekOfYear)}`;
    },
    gmt: {
      fn: "getIsoWeekDate",
      call: 'getIsoWeekDate("2024-12-30")',
      run: (g) => {
        const w = g.getIsoWeekDate("2024-12-30");
        return w === null ? REJECTED : `${w.year}-W${pad(w.week)}`;
      },
    },
    libs: {
      "date-fns": {
        call: 'getISOWeekYear(parseISO("2024-12-30")), getISOWeek(parseISO("2024-12-30"))',
        run: (L) => {
          const d = L.df.parseISO("2024-12-30");
          return `${L.df.getISOWeekYear(d)}-W${pad(L.df.getISOWeek(d))}`;
        },
      },
      luxon: {
        call: 'DateTime.fromISO("2024-12-30").weekYear, .weekNumber',
        run: (L) => {
          const d = L.DateTime.fromISO("2024-12-30");
          return `${d.weekYear}-W${pad(d.weekNumber)}`;
        },
      },
      dayjs: {
        call: 'dayjs("2024-12-30").isoWeekYear(), .isoWeek()',
        run: (L) => {
          const d = L.dayjs("2024-12-30");
          return `${d.isoWeekYear()}-W${pad(d.isoWeek())}`;
        },
      },
      moment: {
        call: 'moment("2024-12-30").isoWeekYear(), .isoWeek()',
        run: (L) => {
          const d = L.moment("2024-12-30");
          return `${d.isoWeekYear()}-W${pad(d.isoWeek())}`;
        },
      },
      "internationalized-date": { none: "it has no ISO week call" },
    },
    issues: {},
  },
  {
    id: "M13",
    title: "Time zone name kept for Etc/UTC",
    input: "2024-01-01T00:00:00Z shown in Etc/UTC",
    compare: "time zone name",
    norm: "plain",
    clauses: [
      tc("Time Zone Identifiers (14.6.2)", "sec-time-zone-identifiers"),
    ],
    temporal: (T) =>
      T.Instant.from("2024-01-01T00:00:00Z").toZonedDateTimeISO("Etc/UTC")
        .timeZoneId,
    gmt: {
      fn: "parseTimeZoneFromZoned",
      call: 'parseTimeZoneFromZoned(convertUtcToZoned("2024-01-01T00:00:00Z", "Etc/UTC"))',
      run: (g) =>
        g.parseTimeZoneFromZoned(
          g.convertUtcToZoned("2024-01-01T00:00:00Z", "Etc/UTC"),
        ),
    },
    libs: {
      "date-fns": {
        call: 'new TZDate(parseISO("2024-01-01T00:00:00Z").getTime(), "Etc/UTC").timeZone',
        run: (L) =>
          new L.TZDate(
            L.df.parseISO("2024-01-01T00:00:00Z").getTime(),
            "Etc/UTC",
          ).timeZone,
      },
      luxon: {
        call: 'DateTime.fromISO("2024-01-01T00:00:00Z").setZone("Etc/UTC").zoneName',
        run: (L) =>
          L.DateTime.fromISO("2024-01-01T00:00:00Z").setZone("Etc/UTC")
            .zoneName,
      },
      dayjs: { none: "it has no public accessor for the zone name after tz()" },
      moment: {
        call: 'moment.tz("2024-01-01T00:00:00Z", "Etc/UTC").tz()',
        run: (L) => L.moment.tz("2024-01-01T00:00:00Z", "Etc/UTC").tz(),
      },
      "internationalized-date": {
        call: 'parseAbsolute("2024-01-01T00:00:00Z", "Etc/UTC").timeZone',
        run: (L) =>
          L.intl.parseAbsolute("2024-01-01T00:00:00Z", "Etc/UTC").timeZone,
      },
    },
    issues: {},
  },
  {
    id: "M13b",
    title: "UTC and Etc/UTC: same time zone or not",
    input:
      "2024-01-01T00:00:00+00:00[UTC] and 2024-01-01T00:00:00+00:00[Etc/UTC]",
    compare: "equal (true or false)",
    norm: "plain",
    clauses: [
      tc("TimeZoneEquals (11.1.15)", "sec-temporal-timezoneequals"),
      tc(
        "ZonedDateTime.prototype.equals (6.3.40)",
        "sec-temporal.zoneddatetime.prototype.equals",
      ),
    ],
    temporal: (T) =>
      String(
        T.ZonedDateTime.from("2024-01-01T00:00:00+00:00[UTC]").equals(
          T.ZonedDateTime.from("2024-01-01T00:00:00+00:00[Etc/UTC]"),
        ),
      ),
    gmt: {
      fn: "areZonedEqual",
      call: 'areZonedEqual("2024-01-01T00:00:00+00:00[UTC]", "2024-01-01T00:00:00+00:00[Etc/UTC]")',
      run: (g) =>
        String(
          g.areZonedEqual(
            "2024-01-01T00:00:00+00:00[UTC]",
            "2024-01-01T00:00:00+00:00[Etc/UTC]",
          ),
        ),
    },
    libs: {
      "date-fns": {
        none: "isEqual compares instants; no call compares time zone names",
      },
      luxon: {
        call: 'DateTime.fromISO(s, { zone: "UTC" }).equals(DateTime.fromISO(s, { zone: "Etc/UTC" }))',
        run: (L) =>
          String(
            L.DateTime.fromISO("2024-01-01T00:00:00Z", { zone: "UTC" }).equals(
              L.DateTime.fromISO("2024-01-01T00:00:00Z", { zone: "Etc/UTC" }),
            ),
          ),
      },
      dayjs: {
        none: "isSame compares instants; no call compares time zone names",
      },
      moment: {
        none: "isSame compares instants; no call compares time zone names",
      },
      "internationalized-date": {
        none: "compare() orders instants; no call compares time zone names",
      },
    },
    issues: { luxon: ["moment/luxon#1358"] },
  },
  {
    id: "M13c",
    title: "Europe/Kiev and Europe/Kyiv: same time zone or not",
    input:
      "2024-01-01T00:00:00+02:00[Europe/Kiev] and 2024-01-01T00:00:00+02:00[Europe/Kyiv]",
    compare: "equal (true or false)",
    norm: "plain",
    clauses: [tc("TimeZoneEquals (11.1.15)", "sec-temporal-timezoneequals")],
    temporal: (T) =>
      String(
        T.ZonedDateTime.from("2024-01-01T00:00:00+02:00[Europe/Kiev]").equals(
          T.ZonedDateTime.from("2024-01-01T00:00:00+02:00[Europe/Kyiv]"),
        ),
      ),
    gmt: {
      fn: "areZonedEqual",
      call: 'areZonedEqual("2024-01-01T00:00:00+02:00[Europe/Kiev]", "2024-01-01T00:00:00+02:00[Europe/Kyiv]")',
      run: (g) =>
        String(
          g.areZonedEqual(
            "2024-01-01T00:00:00+02:00[Europe/Kiev]",
            "2024-01-01T00:00:00+02:00[Europe/Kyiv]",
          ),
        ),
    },
    libs: {
      "date-fns": {
        none: "isEqual compares instants; no call compares time zone names",
      },
      luxon: {
        call: 'DateTime.fromISO(s, { zone: "Europe/Kiev" }).equals(DateTime.fromISO(s, { zone: "Europe/Kyiv" }))',
        run: (L) =>
          String(
            L.DateTime.fromISO("2024-01-01T00:00:00+02:00", {
              zone: "Europe/Kiev",
            }).equals(
              L.DateTime.fromISO("2024-01-01T00:00:00+02:00", {
                zone: "Europe/Kyiv",
              }),
            ),
          ),
      },
      dayjs: {
        none: "isSame compares instants; no call compares time zone names",
      },
      moment: {
        none: "isSame compares instants; no call compares time zone names",
      },
      "internationalized-date": {
        none: "compare() orders instants; no call compares time zone names",
      },
    },
    issues: {},
  },
  {
    id: "M14",
    title: "Offset written for a UTC instant",
    input:
      "2024-03-31T01:30:00Z, written back as ISO 8601 with each library's default writer",
    compare: "the text written: the local time and offset, or Z",
    norm: "instant",
    clauses: [
      tc(
        "Temporal.Instant.prototype.toString (8.3.11)",
        "sec-temporal.instant.prototype.tostring",
      ),
      rfc("RFC 9557 section 2", 9557, "2"),
    ],
    temporal: (T) => T.Instant.from("2024-03-31T01:30:00Z").toString(),
    gmt: {
      fn: "toOffsetInstant",
      call: 'toOffsetInstant("2024-03-31T01:30:00Z").instant',
      run: (g) => g.toOffsetInstant("2024-03-31T01:30:00Z")?.instant,
    },
    libs: {
      "date-fns": {
        call: 'formatISO(parseISO("2024-03-31T01:30:00Z"))',
        run: (L) => L.df.formatISO(L.df.parseISO("2024-03-31T01:30:00Z")),
      },
      luxon: {
        call: 'DateTime.fromISO("2024-03-31T01:30:00Z").toISO()',
        run: (L) => L.DateTime.fromISO("2024-03-31T01:30:00Z").toISO(),
      },
      dayjs: {
        call: 'dayjs("2024-03-31T01:30:00Z").format()',
        run: (L) => L.dayjs("2024-03-31T01:30:00Z").format(),
      },
      moment: {
        call: 'moment("2024-03-31T01:30:00Z").format()',
        run: (L) => L.moment("2024-03-31T01:30:00Z").format(),
      },
      "internationalized-date": {
        call: 'parseAbsolute("2024-03-31T01:30:00Z", "UTC").toAbsoluteString()',
        run: (L) =>
          L.intl
            .parseAbsolute("2024-03-31T01:30:00Z", "UTC")
            .toAbsoluteString(),
      },
    },
    issues: { "date-fns": ["date-fns/date-fns#2151"] },
  },
  {
    id: "M15",
    title: "Add one business day with a Friday and Saturday weekend",
    input:
      "2024-07-04 (a Thursday), plus 1 business day, weekend on Friday and Saturday (ISO weekdays 5 and 6)",
    compare: "date",
    norm: "plain",
    clauses: [
      {
        label: "ISO 8601-1 (week calendar)",
        url: "https://www.iso.org/standard/70907.html",
      },
      {
        label: "UTS #35 Week Data",
        url: "https://www.unicode.org/reports/tr35/tr35-dates.html#Week_Data",
      },
    ],
    temporal: null,
    expected: "2024-07-07",
    gmt: {
      fn: "addBusinessDays",
      call: 'addBusinessDays("2024-07-04", 1, { weekend: [5, 6], holidays: [], timeZone: "Asia/Riyadh" })',
      run: (g) =>
        g.addBusinessDays("2024-07-04", 1, {
          weekend: [5, 6],
          holidays: [],
          timeZone: "Asia/Riyadh",
        }),
    },
    libs: {
      "date-fns": {
        none: "the weekend is fixed to Saturday and Sunday; addBusinessDays has no weekend option",
      },
      luxon: { none: "it has no business-day call" },
      dayjs: { none: "it has no business-day call" },
      moment: { none: "it has no business-day call" },
      "internationalized-date": { none: "it has no business-day call" },
    },
    issues: {},
  },
  {
    id: "M16",
    title: "Show the same instant in another time zone",
    input:
      "2024-07-15T12:00:00+02:00[Europe/Berlin], shown in America/St_Johns",
    compare: "local time and offset",
    norm: "offset",
    clauses: [
      tc(
        "withTimeZone (6.3.33)",
        "sec-temporal.zoneddatetime.prototype.withtimezone",
      ),
    ],
    temporal: (T) =>
      T.ZonedDateTime.from("2024-07-15T12:00:00+02:00[Europe/Berlin]")
        .withTimeZone("America/St_Johns")
        .toString(),
    gmt: {
      fn: "convertZonedToZoned",
      call: 'convertZonedToZoned("2024-07-15T12:00:00+02:00[Europe/Berlin]", "America/St_Johns")',
      run: (g) =>
        g.convertZonedToZoned(
          "2024-07-15T12:00:00+02:00[Europe/Berlin]",
          "America/St_Johns",
        ),
    },
    libs: {
      "date-fns": {
        call: 'new TZDate(parseISO("2024-07-15T12:00:00+02:00").getTime(), "America/St_Johns").toISOString()',
        run: (L) =>
          new L.TZDate(
            L.df.parseISO("2024-07-15T12:00:00+02:00").getTime(),
            "America/St_Johns",
          ).toISOString(),
      },
      luxon: {
        call: 'DateTime.fromISO("2024-07-15T12:00:00+02:00").setZone("America/St_Johns").toISO()',
        run: (L) =>
          L.DateTime.fromISO("2024-07-15T12:00:00+02:00")
            .setZone("America/St_Johns")
            .toISO(),
      },
      dayjs: {
        call: 'dayjs("2024-07-15T12:00:00+02:00").tz("America/St_Johns").format()',
        run: (L) =>
          L.dayjs("2024-07-15T12:00:00+02:00").tz("America/St_Johns").format(),
      },
      moment: {
        call: 'moment.parseZone("2024-07-15T12:00:00+02:00").tz("America/St_Johns").format()',
        run: (L) =>
          L.moment
            .parseZone("2024-07-15T12:00:00+02:00")
            .tz("America/St_Johns")
            .format(),
      },
      "internationalized-date": {
        call: 'toTimeZone(parseZonedDateTime("2024-07-15T12:00:00+02:00[Europe/Berlin]"), "America/St_Johns")',
        run: (L) =>
          L.intl
            .toTimeZone(
              L.intl.parseZonedDateTime(
                "2024-07-15T12:00:00+02:00[Europe/Berlin]",
              ),
              "America/St_Johns",
            )
            .toString(),
      },
    },
    issues: {},
  },
];
