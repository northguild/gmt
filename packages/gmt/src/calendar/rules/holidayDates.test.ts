import { Temporal } from "../../internal/temporal";
import { holidayDates } from "./holidayDates";

const UTC = { weekend: [6, 7], holidays: [], timeZone: "UTC" };
const MON_FRI = { 4: { next: 1 } };
// A dates list whose index 0 is a hole, not undefined.
const HOLEY: string[] = [];
HOLEY[1] = "2026-03-20";

// Calendar values are named events (1 Shawwal, 15 Nisan, Nowruz, Pagume 6 of an Ethiopian leap
// year) checked against PlainDate.from({ calendar, year, monthCode, day }, { overflow: "reject" }).
// Easter dates: 2024-03-31, 2025-04-20, 2026-04-05, 2027-03-28; Julian Easter 2024 is 2024-05-05.
// Weekdays: 2028-01-01 Saturday, 2027-01-01 Friday, 2024-02-29 Thursday, 2026-04-02 Thursday,
// 2026-06-17 Wednesday, 2026-12-25 Friday, 2026-01-19 Monday.
describe("holidayDates", () => {
  it.each`
    rule                                                                                           | year    | expected                        | why
    ${{ kind: "calendarFixed", calendar: "islamic-umalqura", monthCode: "M10", day: 1 }}           | ${2026} | ${["2026-03-20"]}               | ${"1 Shawwal 1447"}
    ${{ kind: "calendarFixed", calendar: "islamic-civil", monthCode: "M10", day: 1 }}              | ${2026} | ${["2026-03-20"]}               | ${"1 Shawwal 1447, civil"}
    ${{ kind: "calendarFixed", calendar: "islamic-civil", monthCode: "M10", day: 1 }}              | ${2000} | ${["2000-01-08", "2000-12-28"]} | ${"two Islamic years start Shawwal in one ISO year"}
    ${{ kind: "calendarFixed", calendar: "islamicc", monthCode: "M10", day: 1 }}                   | ${2026} | ${["2026-03-20"]}               | ${"alias islamicc"}
    ${{ kind: "calendarFixed", calendar: "islamic-umalqura", monthCode: "M12", day: 30 }}          | ${2026} | ${[]}                           | ${"month 12 of 1447 has 29 days"}
    ${{ kind: "calendarFixed", calendar: "hebrew", monthCode: "M07", day: 15 }}                    | ${2026} | ${["2026-04-02"]}               | ${"15 Nisan 5786"}
    ${{ kind: "calendarFixed", calendar: "hebrew", monthCode: "M07", day: 15, observed: MON_FRI }} | ${2026} | ${["2026-04-06"]}               | ${"Thursday moves to Monday, original not returned"}
    ${{ kind: "calendarFixed", calendar: "hebrew", monthCode: "M05L", day: 1 }}                    | ${2024} | ${["2024-02-10"]}               | ${"1 Adar I 5784"}
    ${{ kind: "calendarFixed", calendar: "hebrew", monthCode: "M05L", day: 1 }}                    | ${2025} | ${[]}                           | ${"5785 and 5786 have no leap month"}
    ${{ kind: "calendarFixed", calendar: "persian", monthCode: "M01", day: 1 }}                    | ${2026} | ${["2026-03-21"]}               | ${"1 Farvardin 1405"}
    ${{ kind: "calendarFixed", calendar: "ethioaa", monthCode: "M13", day: 6 }}                    | ${2026} | ${[]}                           | ${"Pagume has 5 days in 2018 EC"}
    ${{ kind: "calendarFixed", calendar: "ethioaa", monthCode: "M13", day: 6 }}                    | ${2027} | ${["2027-09-11"]}               | ${"Pagume 6 of 2019 EC"}
    ${{ kind: "calendarFixed", calendar: "chinese", monthCode: "M01", day: 1 }}                    | ${2026} | ${[]}                           | ${"chinese is not supported"}
    ${{ kind: "fixed", month: 2, day: 29 }}                                                        | ${2026} | ${[]}                           | ${"common year skips 29 February"}
    ${{ kind: "fixed", month: 2, day: 29 }}                                                        | ${2024} | ${["2024-02-29"]}               | ${"leap year"}
    ${{ kind: "fixed", month: 2, day: 29, observed: MON_FRI }}                                     | ${2024} | ${["2024-03-04"]}               | ${"Thursday 29 February moves to Monday 4 March"}
    ${{ kind: "fixed", month: 1, day: 1, observed: { 6: { previous: 5 } } }}                       | ${2028} | ${["2027-12-31"]}               | ${"observed date crosses into the previous year"}
    ${{ kind: "fixed", month: 1, day: 1, observed: { 6: { previous: 5 } } }}                       | ${2027} | ${["2027-01-01"]}               | ${"Friday is not moved"}
    ${{ kind: "fixed", month: 6, day: 17, observed: { 2: { previous: 1 }, 3: { previous: 1 } } }}  | ${2026} | ${["2026-06-15"]}               | ${"Wednesday moves to Monday; Wednesday not returned"}
    ${{ kind: "fixed", month: 12, day: 25, observed: { 6: "nextWorkingDay" } }}                    | ${2026} | ${[]}                           | ${"policy needs a calendar, none given"}
    ${{ kind: "fixed", month: 12, day: 25 }}                                                       | ${2026} | ${["2026-12-25"]}               | ${"no observed: not shifted"}
    ${{ kind: "nthWeekday", month: 1, weekday: 1, n: 3 }}                                          | ${2026} | ${["2026-01-19"]}               | ${"third Monday of January"}
    ${{ kind: "nthWeekday", month: 2, weekday: 5, n: 5 }}                                          | ${2026} | ${[]}                           | ${"no fifth Friday in February 2026"}
    ${{ kind: "easterRelative", offsetDays: -2 }}                                                  | ${2024} | ${["2024-03-29"]}               | ${"Easter minus 2"}
    ${{ kind: "easterRelative", offsetDays: 1 }}                                                   | ${2024} | ${["2024-04-01"]}               | ${"Easter plus 1"}
    ${{ kind: "easterRelative", offsetDays: 49 }}                                                  | ${2026} | ${["2026-05-24"]}               | ${"Easter plus 49"}
    ${{ kind: "easterRelative", offsetDays: -48 }}                                                 | ${2026} | ${["2026-02-16"]}               | ${"Easter minus 48"}
    ${{ kind: "easterRelative", offsetDays: -100 }}                                                | ${2026} | ${["2026-12-18"]}               | ${"Easter 2027 minus 100"}
    ${{ kind: "easterRelative", offsetDays: 280 }}                                                 | ${2026} | ${["2026-01-25"]}               | ${"Easter 2025 plus 280"}
    ${{ kind: "easterRelative", offsetDays: 260 }}                                                 | ${2026} | ${["2026-01-05", "2026-12-21"]} | ${"Easters 2025 and 2026 plus 260"}
    ${{ kind: "easterRelative", offsetDays: 0, computus: "julian" }}                               | ${2024} | ${["2024-05-05"]}               | ${"Julian Easter 2024"}
    ${{ kind: "easterRelative", offsetDays: Number.MAX_SAFE_INTEGER }}                             | ${2026} | ${[]}                           | ${"offset beyond Temporal's range"}
    ${{ kind: "easterRelative", offsetDays: -Number.MAX_SAFE_INTEGER, computus: "julian" }}        | ${2026} | ${[]}                           | ${"negative offset beyond Temporal's range"}
    ${{ kind: "dates", dates: ["2026-03-20", "2027-03-09"] }}                                      | ${2026} | ${["2026-03-20"]}               | ${"only dates inside the year"}
    ${{ kind: "dates", dates: ["2026-12-31", "2026-01-01", "2026-12-31"] }}                        | ${2026} | ${["2026-01-01", "2026-12-31"]} | ${"sorted, no repeats"}
    ${{ kind: "dates", dates: [] }}                                                                | ${2026} | ${[]}                           | ${"empty list"}
  `("$why: year $year gives $expected", ({ rule, year, expected }) => {
    expect(holidayDates({ name: "x", ...rule }, year)).toEqual(expected);
  });

  it.each`
    rule                                                                        | calendar                                | expected          | why
    ${{ kind: "fixed", month: 12, day: 25, observed: { 6: "nextWorkingDay" } }} | ${{ ...UTC, holidays: ["2026-12-28"] }} | ${["2026-12-25"]} | ${"Friday not shifted"}
    ${{ kind: "fixed", month: 12, day: 25, observed: { 5: "nextWorkingDay" } }} | ${{ ...UTC, holidays: ["2026-12-28"] }} | ${["2026-12-29"]} | ${"Monday 28 is closed, so Tuesday"}
    ${{ kind: "fixed", month: 12, day: 25, observed: { 5: "nextWorkingDay" } }} | ${UTC}                                  | ${["2026-12-28"]} | ${"next open day"}
  `("calendar: $why", ({ rule, calendar, expected }) => {
    expect(holidayDates({ name: "x", ...rule }, 2026, { calendar })).toEqual(
      expected,
    );
  });

  it("accepts an explicit undefined options and calendar", () => {
    const rule = { name: "x", kind: "fixed", month: 12, day: 25 } as const;

    expect(holidayDates(rule, 2026, undefined)).toEqual(["2026-12-25"]);
    expect(holidayDates(rule, 2026, { calendar: undefined })).toEqual([
      "2026-12-25",
    ]);
  });

  it("does not read the name", () => {
    expect(
      holidayDates({ name: "", kind: "fixed", month: 1, day: 1 }, 2026),
    ).toEqual(["2026-01-01"]);
  });

  it("ignores properties a kind does not define", () => {
    expect(
      holidayDates(
        {
          name: "x",
          kind: "nthWeekday",
          month: 1,
          weekday: 1,
          n: 3,
          day: 99,
        } as never,
        2026,
      ),
    ).toEqual(["2026-01-19"]);
  });

  it.each`
    year       | rule                                                                         | expected
    ${-271821} | ${{ kind: "fixed", month: 1, day: 1 }}                                       | ${[]}
    ${-271821} | ${{ kind: "fixed", month: 12, day: 25 }}                                     | ${["-271821-12-25"]}
    ${275760}  | ${{ kind: "fixed", month: 12, day: 25 }}                                     | ${[]}
    ${275760}  | ${{ kind: "fixed", month: 9, day: 13 }}                                      | ${["+275760-09-13"]}
    ${275760}  | ${{ kind: "fixed", month: 9, day: 14 }}                                      | ${[]}
    ${-271821} | ${{ kind: "fixed", month: 4, day: 19 }}                                      | ${["-271821-04-19"]}
    ${-271821} | ${{ kind: "fixed", month: 4, day: 18 }}                                      | ${[]}
    ${-271821} | ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M04", day: 19 }} | ${["-271821-04-19"]}
    ${-271821} | ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M04", day: 30 }} | ${["-271821-04-30"]}
    ${-271821} | ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M04", day: 18 }} | ${[]}
    ${-271821} | ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M03", day: 31 }} | ${[]}
    ${275760}  | ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M08", day: 31 }} | ${["+275760-08-31"]}
    ${275760}  | ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M09", day: 14 }} | ${[]}
    ${275760}  | ${{ kind: "calendarFixed", calendar: "roc", monthCode: "M09", day: 13 }}     | ${["+275760-09-13"]}
  `(
    "range edge: $rule in year $year gives $expected",
    ({ year, rule, expected }) => {
      expect(holidayDates({ name: "x", ...rule }, year)).toEqual(expected);
    },
  );

  it("returns [] for a shift that leaves Temporal's range", () => {
    expect(
      holidayDates(
        {
          name: "x",
          kind: "fixed",
          month: 9,
          day: 13,
          observed: { 6: { next: 1 } },
        },
        275760,
      ),
    ).toEqual([]);
  });

  const valid = { name: "x", kind: "fixed", month: 1, day: 1 };

  it.each`
    year
    ${2026.5}
    ${NaN}
    ${Infinity}
    ${-Infinity}
    ${-271822}
    ${275761}
    ${1e306}
    ${-1e306}
    ${Number.MAX_VALUE}
    ${-Number.MAX_VALUE}
    ${"2026"}
    ${null}
    ${undefined}
  `("returns [] for year $year", ({ year }) => {
    expect(holidayDates(valid as never, year)).toEqual([]);
  });

  it.each`
    options
    ${"x"}
    ${null}
    ${1}
    ${{ calendar: "x" }}
    ${{ calendar: null }}
    ${{ calendar: { weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: "UTC" } }}
    ${{ calendar: { weekend: [6, 7], holidays: [], timeZone: "Not/AZone" } }}
  `("returns [] for options $options", ({ options }) => {
    expect(holidayDates(valid as never, 2026, options)).toEqual([]);
  });

  it.each`
    rule
    ${null}
    ${undefined}
    ${[]}
    ${"rule"}
    ${{ kind: "fixed", month: 1, day: 1 }}
    ${{ name: 1, kind: "fixed", month: 1, day: 1 }}
    ${{ name: "x", kind: "weekly" }}
    ${{ name: "x", kind: "fixed", month: 13, day: 1 }}
    ${{ name: "x", kind: "fixed", month: 1, day: 0 }}
    ${{ name: "x", kind: "fixed", month: 2, day: 30 }}
    ${{ name: "x", kind: "fixed", month: 4, day: 31 }}
    ${{ name: "x", kind: "fixed", month: 1, day: 1.5 }}
    ${{ name: "x", kind: "calendarFixed", calendar: "hebrew", monthCode: "M5", day: 1 }}
    ${{ name: "x", kind: "calendarFixed", calendar: "hebrew", monthCode: "M14", day: 1 }}
    ${{ name: "x", kind: "calendarFixed", calendar: "islamic-civil", monthCode: "M13", day: 1 }}
    ${{ name: "x", kind: "calendarFixed", calendar: "persian", monthCode: "M05L", day: 1 }}
    ${{ name: "x", kind: "calendarFixed", calendar: "hebrew", monthCode: "M07", day: 32 }}
    ${{ name: "x", kind: "nthWeekday", month: 1, weekday: 1, n: 0 }}
    ${{ name: "x", kind: "nthWeekday", month: 1, weekday: 1, n: "first" }}
    ${{ name: "x", kind: "nthWeekday", month: 1, weekday: 8, n: 1 }}
    ${{ name: "x", kind: "easterRelative", offsetDays: 1.5 }}
    ${{ name: "x", kind: "easterRelative", offsetDays: 2 ** 53 }}
    ${{ name: "x", kind: "easterRelative", offsetDays: 0, computus: "orthodox" }}
    ${{ name: "x", kind: "dates", dates: ["2026-02-30"] }}
    ${{ name: "x", kind: "dates", dates: "2026-01-01" }}
    ${{ name: "x", kind: "fixed", month: 1, day: 1, observed: { 6: "none" } }}
  `("returns [] for rule $rule", ({ rule }) => {
    expect(holidayDates(rule, 2026)).toEqual([]);
  });

  it("returns [] for a throwing getter instead of throwing", () => {
    const rule = {
      name: "x",
      kind: "fixed",
      month: 1,
      get day(): number {
        throw new Error("boom");
      },
    };

    expect(holidayDates(rule as never, 2026)).toEqual([]);
  });

  // Calendar values below: Indian Chaitra 1 is 22 March (21 March in a Gregorian leap year) and
  // Chaitra 31 exists only then; Nayrouz and Enkutatash are 11 September (12 September in the year
  // before a Gregorian leap year); Esfand 30 exists only in a Persian leap year (1403 ended on
  // 2025-03-20); Heshvan and Kislev have 30 days only in a complete Hebrew year (5785: Hanukkah's
  // 25 Kislev was 2024-12-26); Adar I always has 30 days and Adar (M06) always 29; Islamic tabular
  // dates differ by the epoch: islamic-tbla is islamic-civil minus one day. Each was read with
  // PlainDate.from({ calendar, year, monthCode, day }, { overflow: "reject" }).
  it.each`
    calendar                 | monthCode | day   | year    | expected                        | why
    ${"iso8601"}             | ${"M02"}  | ${29} | ${2024} | ${["2024-02-29"]}               | ${"leap day"}
    ${"iso8601"}             | ${"M02"}  | ${29} | ${2026} | ${[]}                           | ${"no leap day, skipped"}
    ${"gregory"}             | ${"M01"}  | ${1}  | ${2026} | ${["2026-01-01"]}               | ${"1 January"}
    ${"buddhist"}            | ${"M12"}  | ${25} | ${2026} | ${["2026-12-25"]}               | ${"month and day match the Gregorian ones"}
    ${"buddhist"}            | ${"M02"}  | ${29} | ${2024} | ${["2024-02-29"]}               | ${"BE 2567 is a leap year"}
    ${"roc"}                 | ${"M01"}  | ${1}  | ${2026} | ${["2026-01-01"]}               | ${"1 January"}
    ${"roc"}                 | ${"M02"}  | ${29} | ${2026} | ${[]}                           | ${"no leap day, skipped"}
    ${"japanese"}            | ${"M02"}  | ${29} | ${2024} | ${["2024-02-29"]}               | ${"leap day"}
    ${"japanese"}            | ${"M02"}  | ${29} | ${2026} | ${[]}                           | ${"no leap day, skipped"}
    ${"indian"}              | ${"M01"}  | ${1}  | ${2026} | ${["2026-03-22"]}               | ${"1 Chaitra in a common year"}
    ${"indian"}              | ${"M01"}  | ${1}  | ${2024} | ${["2024-03-21"]}               | ${"1 Chaitra in a leap year"}
    ${"indian"}              | ${"M01"}  | ${31} | ${2024} | ${["2024-04-20"]}               | ${"Chaitra has 31 days in a leap year"}
    ${"indian"}              | ${"M01"}  | ${31} | ${2026} | ${[]}                           | ${"Chaitra has 30 days in a common year"}
    ${"indian"}              | ${"M12"}  | ${30} | ${2026} | ${["2026-03-21"]}               | ${"last day of Phalguna 1947"}
    ${"persian"}             | ${"M12"}  | ${30} | ${2025} | ${["2025-03-20"]}               | ${"Esfand 30 of leap year 1403"}
    ${"persian"}             | ${"M12"}  | ${30} | ${2026} | ${[]}                           | ${"Esfand has 29 days in 1404"}
    ${"persian"}             | ${"M06"}  | ${31} | ${2026} | ${["2026-09-22"]}               | ${"months 1 to 6 have 31 days"}
    ${"persian"}             | ${"M07"}  | ${31} | ${2026} | ${[]}                           | ${"months 7 to 11 have 30 days"}
    ${"hebrew"}              | ${"M01"}  | ${1}  | ${2025} | ${["2025-09-23"]}               | ${"Rosh Hashanah 5786"}
    ${"hebrew"}              | ${"M02"}  | ${30} | ${2024} | ${["2024-12-01"]}               | ${"Heshvan has 30 days in complete 5785"}
    ${"hebrew"}              | ${"M02"}  | ${30} | ${2025} | ${[]}                           | ${"Heshvan has 29 days in regular 5786"}
    ${"hebrew"}              | ${"M03"}  | ${30} | ${2024} | ${["2024-12-31"]}               | ${"Kislev 30 of 5785"}
    ${"hebrew"}              | ${"M05L"} | ${30} | ${2024} | ${["2024-03-10"]}               | ${"Adar I always has 30 days"}
    ${"hebrew"}              | ${"M05L"} | ${1}  | ${2026} | ${[]}                           | ${"5786 has no Adar I"}
    ${"hebrew"}              | ${"M05L"} | ${1}  | ${2027} | ${["2027-02-08"]}               | ${"1 Adar I 5787, a leap year"}
    ${"hebrew"}              | ${"M06"}  | ${30} | ${2024} | ${[]}                           | ${"Adar and Adar II have 29 days"}
    ${"ethioaa"}             | ${"M01"}  | ${1}  | ${2026} | ${["2026-09-11"]}               | ${"first of Meskerem"}
    ${"ethioaa"}             | ${"M01"}  | ${1}  | ${2023} | ${["2023-09-12"]}               | ${"the year after Ethiopian leap year 2015"}
    ${"ethioaa"}             | ${"M13"}  | ${6}  | ${2023} | ${["2023-09-11"]}               | ${"Pagume 6 of leap year 2015"}
    ${"ethiopic"}            | ${"M01"}  | ${1}  | ${2023} | ${["2023-09-12"]}               | ${"ethiopic computes as ethioaa"}
    ${"ethiopic"}            | ${"M13"}  | ${6}  | ${2027} | ${["2027-09-11"]}               | ${"Pagume 6 of leap year 2019"}
    ${"ethiopic"}            | ${"M13"}  | ${6}  | ${2026} | ${[]}                           | ${"Pagume has 5 days"}
    ${"ethiopic-amete-alem"} | ${"M13"}  | ${5}  | ${2026} | ${["2026-09-10"]}               | ${"alias of ethioaa"}
    ${"coptic"}              | ${"M01"}  | ${1}  | ${2026} | ${["2026-09-11"]}               | ${"Nayrouz"}
    ${"coptic"}              | ${"M01"}  | ${1}  | ${2023} | ${["2023-09-12"]}               | ${"Nayrouz after a Coptic leap year"}
    ${"coptic"}              | ${"M13"}  | ${6}  | ${2027} | ${["2027-09-11"]}               | ${"Pagume 6 of a leap year"}
    ${"coptic"}              | ${"M13"}  | ${6}  | ${2026} | ${[]}                           | ${"Pagume has 5 days"}
    ${"islamic-tbla"}        | ${"M10"}  | ${1}  | ${2026} | ${["2026-03-19"]}               | ${"tabular astronomical epoch: civil minus one day"}
    ${"islamic-tbla"}        | ${"M10"}  | ${1}  | ${2000} | ${["2000-01-07", "2000-12-27"]} | ${"two Islamic years in one ISO year"}
    ${"islamic-umalqura"}    | ${"M10"}  | ${1}  | ${2000} | ${["2000-01-08", "2000-12-27"]} | ${"two Islamic years in one ISO year"}
    ${"islamic-civil"}       | ${"M10"}  | ${1}  | ${2033} | ${["2033-01-03", "2033-12-23"]} | ${"two Islamic years in one ISO year"}
    ${"islamic-civil"}       | ${"M12"}  | ${30} | ${2026} | ${["2026-06-16"]}               | ${"1447 is a leap year"}
    ${"islamic-civil"}       | ${"M12"}  | ${30} | ${2027} | ${[]}                           | ${"1448 is not"}
    ${"Islamic-Civil"}       | ${"M10"}  | ${1}  | ${2026} | ${["2026-03-20"]}               | ${"calendar id is case-insensitive as in Temporal"}
  `(
    "calendarFixed $calendar $monthCode $day in $year: $why",
    ({ calendar, monthCode, day, year, expected }) => {
      expect(
        holidayDates(
          { name: "x", kind: "calendarFixed", calendar, monthCode, day },
          year,
        ),
      ).toEqual(expected);
    },
  );

  // Oracle: every calendar year touching the ISO year, read with the polyfill's overflow "reject"
  // (a day the month lacks throws and is skipped); only dates whose ISO year is `year` count.
  it.each`
    calendar
    ${"iso8601"}
    ${"gregory"}
    ${"hebrew"}
    ${"islamic-civil"}
    ${"islamic-tbla"}
    ${"islamic-umalqura"}
    ${"japanese"}
    ${"buddhist"}
    ${"roc"}
    ${"persian"}
    ${"indian"}
    ${"ethioaa"}
  `(
    "$calendar matches a brute-force read of the polyfill for every month code, day and year 2008 to 2024",
    ({ calendar }) => {
      const monthCodes = [
        "M01",
        "M02",
        "M03",
        "M04",
        "M05",
        "M05L",
        "M06",
        "M07",
        "M08",
        "M09",
        "M10",
        "M11",
        "M12",
        "M13",
      ].filter(
        (monthCode) =>
          (monthCode !== "M13" || calendar === "ethioaa") &&
          (monthCode !== "M05L" || calendar === "hebrew"),
      );

      for (const monthCode of monthCodes) {
        for (const day of [1, 30, 31]) {
          for (let year = 2008; year <= 2024; year++) {
            const first = Temporal.PlainDate.from({
              year,
              month: 1,
              day: 1,
            }).withCalendar(calendar).year;
            const expected: string[] = [];

            for (let y = first - 1; y <= first + 3; y++) {
              try {
                const date = Temporal.PlainDate.from(
                  { calendar, year: y, monthCode, day },
                  { overflow: "reject" },
                ).withCalendar("iso8601");

                if (date.year === year) {
                  expected.push(date.toString());
                }
              } catch {
                // the month or day does not exist that year
              }
            }

            expect(
              holidayDates(
                { name: "x", kind: "calendarFixed", calendar, monthCode, day },
                year,
              ),
              `${monthCode} ${day} ${year}`,
            ).toEqual(expected.sort());
          }
        }
      }
    },
  );

  it.each`
    ethiopicFamily | monthCode | day
    ${"ethiopic"}  | ${"M01"}  | ${1}
    ${"ethiopic"}  | ${"M07"}  | ${30}
    ${"ethiopic"}  | ${"M13"}  | ${5}
    ${"ethiopic"}  | ${"M13"}  | ${6}
    ${"coptic"}    | ${"M01"}  | ${1}
    ${"coptic"}    | ${"M13"}  | ${5}
    ${"coptic"}    | ${"M13"}  | ${6}
  `(
    "$ethiopicFamily $monthCode $day gives the ethioaa dates in every year 2000 to 2030",
    ({ ethiopicFamily, monthCode, day }) => {
      for (let year = 2000; year <= 2030; year++) {
        expect(
          holidayDates(
            {
              name: "x",
              kind: "calendarFixed",
              calendar: ethiopicFamily,
              monthCode,
              day,
            },
            year,
          ),
        ).toEqual(
          holidayDates(
            {
              name: "x",
              kind: "calendarFixed",
              calendar: "ethioaa",
              monthCode,
              day,
            },
            year,
          ),
        );
      }
    },
  );

  it.each`
    rule                                                                         | year       | expected
    ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M12", day: 25 }} | ${-271821} | ${["-271821-12-25"]}
    ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M04", day: 19 }} | ${-271821} | ${["-271821-04-19"]}
    ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M04", day: 18 }} | ${-271821} | ${[]}
    ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M09", day: 13 }} | ${275760}  | ${["+275760-09-13"]}
    ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M09", day: 1 }}  | ${275760}  | ${["+275760-09-01"]}
    ${{ kind: "calendarFixed", calendar: "gregory", monthCode: "M09", day: 13 }} | ${275760}  | ${["+275760-09-13"]}
    ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M08", day: 31 }} | ${275760}  | ${["+275760-08-31"]}
    ${{ kind: "calendarFixed", calendar: "iso8601", monthCode: "M09", day: 14 }} | ${275760}  | ${[]}
    ${{ kind: "calendarFixed", calendar: "gregory", monthCode: "M01", day: 1 }}  | ${275760}  | ${["+275760-01-01"]}
    ${{ kind: "calendarFixed", calendar: "gregory", monthCode: "M01", day: 1 }}  | ${-271821} | ${[]}
    ${{ kind: "easterRelative", offsetDays: 0 }}                                 | ${275760}  | ${["+275760-03-30"]}
    ${{ kind: "nthWeekday", month: 9, weekday: 6, n: 2 }}                        | ${275760}  | ${["+275760-09-13"]}
    ${{ kind: "nthWeekday", month: 9, weekday: 6, n: "last" }}                   | ${275760}  | ${[]}
    ${{ kind: "nthWeekday", month: 4, weekday: 1, n: 3 }}                        | ${-271821} | ${["-271821-04-19"]}
    ${{ kind: "nthWeekday", month: 4, weekday: 1, n: 1 }}                        | ${-271821} | ${[]}
    ${{ kind: "dates", dates: ["-271821-04-19", "+275760-09-13"] }}              | ${-271821} | ${["-271821-04-19"]}
    ${{ kind: "dates", dates: ["-271821-04-19", "+275760-09-13"] }}              | ${275760}  | ${["+275760-09-13"]}
  `(
    "range edge: $rule in year $year gives $expected",
    ({ rule, year, expected }) => {
      expect(holidayDates({ name: "x", ...rule }, year)).toEqual(expected);
    },
  );

  // A calendar read at a Temporal range limit may be unreliable (polyfill Hebrew years before 1);
  // what must hold is that the call never throws and returns at most the year's own dates.
  it.each`
    calendar              | monthCode | year
    ${"hebrew"}           | ${"M07"}  | ${-271821}
    ${"hebrew"}           | ${"M07"}  | ${275760}
    ${"hebrew"}           | ${"M07"}  | ${270000}
    ${"islamic-civil"}    | ${"M10"}  | ${-271821}
    ${"islamic-civil"}    | ${"M10"}  | ${275760}
    ${"islamic-umalqura"} | ${"M10"}  | ${-271821}
    ${"islamic-umalqura"} | ${"M10"}  | ${275760}
    ${"persian"}          | ${"M01"}  | ${-271821}
    ${"persian"}          | ${"M01"}  | ${275760}
    ${"indian"}           | ${"M01"}  | ${-271821}
    ${"indian"}           | ${"M01"}  | ${275760}
    ${"ethioaa"}          | ${"M13"}  | ${-271821}
    ${"ethioaa"}          | ${"M13"}  | ${275760}
    ${"coptic"}           | ${"M13"}  | ${-271821}
    ${"roc"}              | ${"M12"}  | ${-271821}
    ${"japanese"}         | ${"M12"}  | ${275760}
  `(
    "calendarFixed $calendar $monthCode at year $year stays inside that ISO year",
    ({ calendar, monthCode, year }) => {
      const dates = holidayDates(
        { name: "x", kind: "calendarFixed", calendar, monthCode, day: 1 },
        year,
      );
      const sign = year < 0 ? "-" : "+";
      const prefix = `${sign}${String(Math.abs(year)).padStart(6, "0")}-`;

      expect(dates.length).toBeLessThanOrEqual(2);
      expect(dates.every((date) => date.startsWith(prefix))).toBe(true);
      expect([...dates].sort()).toEqual(dates);
    },
  );

  it.each`
    rule                                                                                                          | year    | expected                        | why
    ${{ kind: "fixed", month: 12, day: 31, observed: { 6: { next: 1 } } }}                                        | ${2022} | ${["2023-01-02"]}               | ${"Saturday 31 December moves forward into the next year"}
    ${{ kind: "fixed", month: 12, day: 31, observed: { 6: { next: 1 } } }}                                        | ${2023} | ${["2023-12-31"]}               | ${"Sunday 31 December is not moved"}
    ${{ kind: "fixed", month: 1, day: 1, observed: { 6: { next: 1 } } }}                                          | ${2022} | ${["2022-01-03"]}               | ${"Saturday 1 January moves to Monday inside the year"}
    ${{ kind: "calendarFixed", calendar: "gregory", monthCode: "M12", day: 31, observed: { 7: { next: 1 } } }}    | ${2023} | ${["2024-01-01"]}               | ${"calendarFixed shift crosses into the next year"}
    ${{ kind: "calendarFixed", calendar: "gregory", monthCode: "M12", day: 31, observed: { 7: { next: 1 } } }}    | ${2024} | ${["2024-12-31"]}               | ${"Tuesday is not moved"}
    ${{ kind: "calendarFixed", calendar: "gregory", monthCode: "M01", day: 1, observed: { 6: { previous: 5 } } }} | ${2028} | ${["2027-12-31"]}               | ${"calendarFixed shift crosses into the previous year"}
    ${{ kind: "calendarFixed", calendar: "gregory", monthCode: "M01", day: 1, observed: { 6: { previous: 5 } } }} | ${2027} | ${["2027-01-01"]}               | ${"Friday is not moved"}
    ${{ kind: "calendarFixed", calendar: "islamic-civil", monthCode: "M10", day: 1, observed: MON_FRI }}          | ${2000} | ${["2000-01-08", "2001-01-01"]} | ${"Saturday is not moved, Thursday moves to Monday in the next year"}
  `("observed: $why", ({ rule, year, expected }) => {
    expect(holidayDates({ name: "x", ...rule }, year)).toEqual(expected);
  });

  it("shifts to the next working day across a year boundary with a calendar", () => {
    const rule = {
      name: "x",
      kind: "fixed",
      month: 12,
      day: 31,
      observed: { 6: "nextWorkingDay" },
    } as const;

    expect(
      holidayDates(rule, 2022, {
        calendar: { ...UTC, holidays: ["2023-01-02"] },
      }),
    ).toEqual(["2023-01-03"]);
    expect(holidayDates(rule, 2022, { calendar: UTC })).toEqual(["2023-01-02"]);
  });

  it("ignores a valid calendar for a rule that never needs one", () => {
    expect(
      holidayDates({ name: "x", kind: "fixed", month: 12, day: 25 }, 2026, {
        calendar: UTC,
      }),
    ).toEqual(["2026-12-25"]);
  });

  it("returns [] for a nextWorkingDay policy without a calendar whatever the year", () => {
    const rule = {
      name: "x",
      kind: "fixed",
      month: 12,
      day: 25,
      observed: { 1: "nextWorkingDay" },
    } as const;

    expect(holidayDates(rule, 2026)).toEqual([]);
    expect(holidayDates(rule, 2027)).toEqual([]);
  });

  it.each`
    dates                                                       | year    | expected
    ${["2026-03-20[u-ca=iso8601]"]}                             | ${2026} | ${["2026-03-20"]}
    ${["2026-03-20[foo=bar]"]}                                  | ${2026} | ${["2026-03-20"]}
    ${["2025-12-31", "2026-01-01", "2026-12-31", "2027-01-01"]} | ${2026} | ${["2026-01-01", "2026-12-31"]}
    ${["2026-06-02", "2026-06-01"]}                             | ${2026} | ${["2026-06-01", "2026-06-02"]}
    ${["2026-06-01", "2026-06-01[u-ca=iso8601]"]}               | ${2026} | ${["2026-06-01"]}
  `("dates $dates in $year gives $expected", ({ dates, year, expected }) => {
    expect(holidayDates({ name: "x", kind: "dates", dates }, year)).toEqual(
      expected,
    );
  });

  it.each`
    dates
    ${["2026-03-20[u-ca=hebrew]"]}
    ${["2026-03-20T00:00:00"]}
    ${["2026-03-20[!foo=bar]"]}
    ${["2026-02-29"]}
    ${["2026-13-01"]}
    ${["20260320"]}
    ${["2026-3-20"]}
    ${[""]}
    ${[20260320]}
    ${[null]}
    ${[undefined]}
    ${["2026-03-20", 1]}
    ${HOLEY}
    ${["+275760-09-14"]}
    ${["-271821-04-18"]}
    ${{ length: 1, 0: "2026-03-20" }}
    ${new Set(["2026-03-20"])}
    ${undefined}
    ${null}
  `("returns [] for dates $dates", ({ dates }) => {
    expect(holidayDates({ name: "x", kind: "dates", dates }, 2026)).toEqual([]);
  });

  it("ignores properties a kind does not define, even invalid ones", () => {
    const extras = { observed: { 6: "none" }, n: 99, month: 99, day: 99 };

    expect(
      holidayDates(
        { name: "x", kind: "dates", dates: ["2026-03-20"], ...extras } as never,
        2026,
      ),
    ).toEqual(["2026-03-20"]);
    expect(
      holidayDates(
        {
          name: "x",
          kind: "easterRelative",
          offsetDays: -2,
          ...extras,
        } as never,
        2024,
      ),
    ).toEqual(["2024-03-29"]);
    expect(
      holidayDates(
        {
          name: "x",
          kind: "nthWeekday",
          month: 1,
          weekday: 1,
          n: 3,
          observed: { 6: "none" },
        } as never,
        2026,
      ),
    ).toEqual(["2026-01-19"]);
  });

  it("rejects a bad value in a property the kind does define, whatever the other kinds' properties are", () => {
    expect(
      holidayDates(
        {
          name: "x",
          kind: "nthWeekday",
          month: 13,
          weekday: 1,
          n: 3,
          day: 1,
        } as never,
        2026,
      ),
    ).toEqual([]);
    expect(
      holidayDates(
        {
          name: "x",
          kind: "easterRelative",
          offsetDays: 0.5,
          month: 1,
        } as never,
        2026,
      ),
    ).toEqual([]);
  });

  it.each`
    why | make
    ${"a revoked proxy"} | ${() => {
  const r = Proxy.revocable({}, {});
  r.revoke();
  return r.proxy;
}}
    ${"a proxy whose get throws"} | ${() => new Proxy({}, { get() {
        throw new Error("boom");
      } })}
    ${"a proxy whose has throws"} | ${() => new Proxy({}, { has() {
        throw new Error("boom");
      }, get: () => "fixed" })}
    ${"a throwing kind getter"} | ${() => ({ name: "x", get kind(): string {
    throw new Error("boom");
  } })}
    ${"a throwing name getter"} | ${() => ({ get name(): string {
    throw new Error("boom");
  }, kind: "fixed", month: 1, day: 1 })}
    ${"a throwing dates getter"} | ${() => ({ name: "x", kind: "dates", get dates(): string[] {
    throw new Error("boom");
  } })}
    ${"a throwing observed getter"} | ${() => ({ name: "x", kind: "fixed", month: 1, day: 1, get observed(): never {
    throw new Error("boom");
  } })}
    ${"a dates array proxy that throws"} | ${() => ({ name: "x", kind: "dates", dates: new Proxy(["2026-03-20"], { get() {
      throw new Error("boom");
    } }) })}
  `("returns [] for $why", ({ make }) => {
    expect(holidayDates(make(), 2026)).toEqual([]);
  });

  it("returns [] for a throwing calendar getter in options", () => {
    const options = {
      get calendar(): never {
        throw new Error("boom");
      },
    };

    expect(holidayDates(valid as never, 2026, options as never)).toEqual([]);
  });

  it("accepts a function as the options argument", () => {
    const options = Object.assign(() => 0, { calendar: UTC });
    const rule = {
      name: "x",
      kind: "fixed",
      month: 12,
      day: 25,
      observed: { 5: "nextWorkingDay" },
    } as const;

    expect(holidayDates(rule, 2026, options as never)).toEqual(["2026-12-28"]);
  });

  it("does not mutate the rule or the calendar", () => {
    const rule = Object.freeze({
      name: "x",
      kind: "dates",
      dates: Object.freeze(["2026-06-02", "2026-06-01"]),
    });
    const calendar = Object.freeze({
      ...UTC,
      weekend: Object.freeze([6, 7]),
      holidays: Object.freeze(["2026-12-28"]),
    });

    expect(
      holidayDates(rule as never, 2026, { calendar: calendar as never }),
    ).toEqual(["2026-06-01", "2026-06-02"]);
  });
});
