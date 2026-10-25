import { isValidHolidayRule } from "./isValidHolidayRule";

// oxlint-disable-next-line @northguild/gmt-oxlint/no-new-date -- unsupported-type fixture
const makeDate = () => new Date(0); // date-ban: a Date as a non-rule input

/** Month code → its longest length, `M01` first, for a calendar of `days.length` months. */
const lengths = (days: number[]): Record<string, number> =>
  Object.fromEntries(
    days.map((n, i) => [`M${String(i + 1).padStart(2, "0")}`, n]),
  );

const GREGORIAN_LONGEST = lengths([
  31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
]);
const HEBREW_LONGEST = {
  ...lengths([30, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29]),
  M05L: 30,
};
const ISLAMIC_LONGEST = lengths([
  30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30,
]);
const UMALQURA_LONGEST = lengths(Array<number>(12).fill(30));
const PERSIAN_LONGEST = lengths([
  31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30,
]);
const ETHIOPIC_LONGEST = lengths([...Array<number>(12).fill(30), 6]);

describe("isValidHolidayRule", () => {
  it.each`
    rule                                                                                    | expected | why
    ${{ name: "x", kind: "fixed", month: 12, day: 25 }}                                     | ${true}  | ${"fixed"}
    ${{ name: "", kind: "fixed", month: 12, day: 25 }}                                      | ${true}  | ${"empty name is a label"}
    ${{ name: "x", kind: "fixed", month: 2, day: 29 }}                                      | ${true}  | ${"29 February exists in leap years"}
    ${{ name: "x", kind: "fixed", month: 12, day: 25, observed: { 6: { previous: 5 } } }}   | ${true}  | ${"with a policy"}
    ${{ name: "x", kind: "fixed", month: 12, day: 25, observed: undefined }}                | ${true}  | ${"explicit undefined observed"}
    ${{ name: "x", kind: "calendarFixed", calendar: "islamicc", monthCode: "M10", day: 1 }} | ${true}  | ${"alias accepted"}
    ${{ name: "x", kind: "calendarFixed", calendar: "hebrew", monthCode: "M05L", day: 1 }}  | ${true}  | ${"hebrew leap month"}
    ${{ name: "x", kind: "calendarFixed", calendar: "coptic", monthCode: "M13", day: 1 }}   | ${true}  | ${"coptic month 13"}
    ${{ name: "x", kind: "nthWeekday", month: 11, weekday: 4, n: "last" }}                  | ${true}  | ${"last Thursday"}
    ${{ name: "x", kind: "easterRelative", offsetDays: -2 }}                                | ${true}  | ${"Easter minus 2"}
    ${{ name: "x", kind: "easterRelative", offsetDays: 0, computus: "julian" }}             | ${true}  | ${"julian"}
    ${{ name: "x", kind: "dates", dates: [] }}                                              | ${true}  | ${"empty dates list"}
    ${{ name: "x", kind: "dates", dates: ["2026-03-20"] }}                                  | ${true}  | ${"dates"}
    ${{ name: "x", kind: "calendarFixed", calendar: "chinese", monthCode: "M01", day: 1 }}  | ${false} | ${"chinese unsupported"}
    ${{ name: "x", kind: "calendarFixed", calendar: "nope", monthCode: "M01", day: 1 }}     | ${false} | ${"unknown calendar"}
    ${{ name: "x", kind: "calendarFixed", calendar: "hebrew", monthCode: "M13", day: 1 }}   | ${false} | ${"hebrew has no M13"}
    ${{ name: "x", kind: "fixed", month: 2, day: 30 }}                                      | ${false} | ${"no year has 30 February"}
    ${{ name: "x", kind: "fixed", month: 12, day: 25, observed: { 6: "none" } }}            | ${false} | ${"bad shift"}
    ${{ name: "x", kind: "fixed", month: 12, day: 25, observed: { 6: { next: 6 } } }}       | ${false} | ${"shift to the same weekday"}
    ${{ name: "x", kind: "dates", dates: ["2026-02-30"] }}                                  | ${false} | ${"impossible date"}
    ${{ name: 1, kind: "fixed", month: 12, day: 25 }}                                       | ${false} | ${"name not a string"}
    ${{ kind: "fixed", month: 12, day: 25 }}                                                | ${false} | ${"no name"}
    ${null}                                                                                 | ${false} | ${"null"}
    ${[]}                                                                                   | ${false} | ${"array"}
    ${"rule"}                                                                               | ${false} | ${"string"}
  `("$why: $expected", ({ rule, expected }) => {
    expect(isValidHolidayRule(rule)).toBe(expected);
  });

  it("returns false instead of throwing", () => {
    const rule = {
      name: "x",
      kind: "fixed",
      get month(): number {
        throw new Error("boom");
      },
      day: 1,
    };

    expect(isValidHolidayRule(rule)).toBe(false);
  });

  const fixed = { name: "x", kind: "fixed", month: 1, day: 1 };

  it.each`
    month        | day          | expected
    ${1}         | ${31}        | ${true}
    ${12}        | ${31}        | ${true}
    ${2}         | ${29}        | ${true}
    ${4}         | ${30}        | ${true}
    ${2}         | ${30}        | ${false}
    ${4}         | ${31}        | ${false}
    ${6}         | ${31}        | ${false}
    ${9}         | ${31}        | ${false}
    ${11}        | ${31}        | ${false}
    ${1}         | ${32}        | ${false}
    ${0}         | ${1}         | ${false}
    ${13}        | ${1}         | ${false}
    ${-1}        | ${1}         | ${false}
    ${1}         | ${0}         | ${false}
    ${1}         | ${-1}        | ${false}
    ${1.5}       | ${1}         | ${false}
    ${1}         | ${1.5}       | ${false}
    ${NaN}       | ${1}         | ${false}
    ${1}         | ${NaN}       | ${false}
    ${1}         | ${Infinity}  | ${false}
    ${undefined} | ${1}         | ${false}
    ${1}         | ${undefined} | ${false}
    ${null}      | ${1}         | ${false}
    ${1}         | ${null}      | ${false}
  `("fixed month $month day $day: $expected", ({ month, day, expected }) => {
    expect(isValidHolidayRule({ ...fixed, month, day })).toBe(expected);
  });

  // The title prints a string without quotes, so each string row names which field is the string.
  it.each`
    field      | month  | day    | expected
    ${"month"} | ${"1"} | ${1}   | ${false}
    ${"day"}   | ${1}   | ${"1"} | ${false}
  `(
    "fixed $field given as a string: month $month day $day: $expected",
    ({ month, day, expected }) => {
      expect(isValidHolidayRule({ ...fixed, month, day })).toBe(expected);
    },
  );

  it.each`
    observed                                  | expected
    ${undefined}                              | ${true}
    ${{ 6: { previous: 5 } }}                 | ${true}
    ${{ 6: "nextWorkingDay" }}                | ${true}
    ${{ 2: { previous: 1 }, 3: { next: 1 } }} | ${true}
    ${null}                                   | ${false}
    ${"nextWorkingDay"}                       | ${false}
    ${1}                                      | ${false}
    ${[]}                                     | ${false}
    ${{ 0: "nextWorkingDay" }}                | ${false}
    ${{ 8: "nextWorkingDay" }}                | ${false}
    ${{ 6: null }}                            | ${false}
    ${{ 6: { next: 0 } }}                     | ${false}
    ${{ 6: { previous: 6 } }}                 | ${false}
  `("fixed observed $observed: $expected", ({ observed, expected }) => {
    expect(isValidHolidayRule({ ...fixed, observed })).toBe(expected);
    expect(
      isValidHolidayRule({
        name: "x",
        kind: "calendarFixed",
        calendar: "hebrew",
        monthCode: "M07",
        day: 15,
        observed,
      }),
    ).toBe(expected);
  });

  // The longest each month code can be, from the calendar definitions (Reingold & Dershowitz,
  // Calendrical Calculations), never from the library: a day up to it is valid, the day after is not.
  it.each`
    calendar                 | longest
    ${"iso8601"}             | ${GREGORIAN_LONGEST}
    ${"gregory"}             | ${GREGORIAN_LONGEST}
    ${"japanese"}            | ${GREGORIAN_LONGEST}
    ${"buddhist"}            | ${GREGORIAN_LONGEST}
    ${"roc"}                 | ${GREGORIAN_LONGEST}
    ${"hebrew"}              | ${HEBREW_LONGEST}
    ${"islamic-civil"}       | ${ISLAMIC_LONGEST}
    ${"islamic-tbla"}        | ${ISLAMIC_LONGEST}
    ${"islamicc"}            | ${ISLAMIC_LONGEST}
    ${"Islamic-Civil"}       | ${ISLAMIC_LONGEST}
    ${"islamic-umalqura"}    | ${UMALQURA_LONGEST}
    ${"persian"}             | ${PERSIAN_LONGEST}
    ${"indian"}              | ${PERSIAN_LONGEST}
    ${"ethiopic"}            | ${ETHIOPIC_LONGEST}
    ${"ethioaa"}             | ${ETHIOPIC_LONGEST}
    ${"ethiopic-amete-alem"} | ${ETHIOPIC_LONGEST}
    ${"coptic"}              | ${ETHIOPIC_LONGEST}
  `(
    "calendarFixed $calendar accepts each month's longest day and not the day after",
    ({ calendar, longest }) => {
      for (const [monthCode, day] of Object.entries<number>(longest)) {
        const rule = { name: "x", kind: "calendarFixed", calendar, monthCode };

        expect(isValidHolidayRule({ ...rule, day })).toBe(true);
        expect(isValidHolidayRule({ ...rule, day: day + 1 })).toBe(false);
      }
    },
  );

  it.each`
    calendar              | monthCode | day   | expected | why
    ${"hebrew"}           | ${"M01"}  | ${31} | ${false} | ${"Tishri has 30 days"}
    ${"hebrew"}           | ${"M02"}  | ${30} | ${true}  | ${"Heshvan has 30 days in a complete year"}
    ${"hebrew"}           | ${"M05L"} | ${30} | ${true}  | ${"Adar I has 30 days"}
    ${"hebrew"}           | ${"M06"}  | ${30} | ${false} | ${"Adar and Adar II have 29 days"}
    ${"ethiopic"}         | ${"M13"}  | ${6}  | ${true}  | ${"Pagume has 6 days in a leap year"}
    ${"ethiopic"}         | ${"M13"}  | ${7}  | ${false} | ${"Pagume never has 7 days"}
    ${"coptic"}           | ${"M13"}  | ${7}  | ${false} | ${"Nasie never has 7 days"}
    ${"islamic-civil"}    | ${"M02"}  | ${30} | ${false} | ${"Safar has 29 days"}
    ${"islamic-civil"}    | ${"M12"}  | ${30} | ${true}  | ${"Dhu al-Hijjah has 30 days in a leap year"}
    ${"islamic-umalqura"} | ${"M02"}  | ${30} | ${true}  | ${"any Umm al-Qura month can have 30 days"}
    ${"persian"}          | ${"M06"}  | ${31} | ${true}  | ${"Shahrivar has 31 days"}
    ${"persian"}          | ${"M07"}  | ${31} | ${false} | ${"Mehr has 30 days"}
    ${"indian"}           | ${"M01"}  | ${31} | ${true}  | ${"Chaitra has 31 days in a leap year"}
    ${"indian"}           | ${"M07"}  | ${31} | ${false} | ${"Ashvina has 30 days"}
    ${"gregory"}          | ${"M02"}  | ${29} | ${true}  | ${"February has 29 days in a leap year"}
    ${"gregory"}          | ${"M02"}  | ${30} | ${false} | ${"no year has 30 February"}
  `(
    "calendarFixed $calendar $monthCode day $day: $expected, $why",
    ({ calendar, monthCode, day, expected }) => {
      expect(
        isValidHolidayRule({
          name: "x",
          kind: "calendarFixed",
          calendar,
          monthCode,
          day,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    calendar                 | monthCode    | expected
    ${"coptic"}              | ${"M13"}     | ${true}
    ${"ethiopic"}            | ${"M13"}     | ${true}
    ${"ethioaa"}             | ${"M13"}     | ${true}
    ${"ethiopic-amete-alem"} | ${"M13"}     | ${true}
    ${"iso8601"}             | ${"M13"}     | ${false}
    ${"gregory"}             | ${"M13"}     | ${false}
    ${"hebrew"}              | ${"M13"}     | ${false}
    ${"islamic-civil"}       | ${"M13"}     | ${false}
    ${"islamic-tbla"}        | ${"M13"}     | ${false}
    ${"islamic-umalqura"}    | ${"M13"}     | ${false}
    ${"japanese"}            | ${"M13"}     | ${false}
    ${"buddhist"}            | ${"M13"}     | ${false}
    ${"roc"}                 | ${"M13"}     | ${false}
    ${"persian"}             | ${"M13"}     | ${false}
    ${"indian"}              | ${"M13"}     | ${false}
    ${"hebrew"}              | ${"M05L"}    | ${true}
    ${"iso8601"}             | ${"M05L"}    | ${false}
    ${"gregory"}             | ${"M05L"}    | ${false}
    ${"islamic-civil"}       | ${"M05L"}    | ${false}
    ${"persian"}             | ${"M05L"}    | ${false}
    ${"coptic"}              | ${"M05L"}    | ${false}
    ${"hebrew"}              | ${"M06L"}    | ${false}
    ${"hebrew"}              | ${"M01L"}    | ${false}
    ${"hebrew"}              | ${"M12L"}    | ${false}
    ${"hebrew"}              | ${"M13L"}    | ${false}
    ${"coptic"}              | ${"M13L"}    | ${false}
    ${"hebrew"}              | ${"M00"}     | ${false}
    ${"hebrew"}              | ${"M14"}     | ${false}
    ${"hebrew"}              | ${"M1"}      | ${false}
    ${"hebrew"}              | ${"M5"}      | ${false}
    ${"hebrew"}              | ${"m07"}     | ${false}
    ${"hebrew"}              | ${"M07 "}    | ${false}
    ${"hebrew"}              | ${" M07"}    | ${false}
    ${"hebrew"}              | ${"M007"}    | ${false}
    ${"hebrew"}              | ${""}        | ${false}
    ${"hebrew"}              | ${7}         | ${false}
    ${"hebrew"}              | ${null}      | ${false}
    ${"hebrew"}              | ${undefined} | ${false}
  `(
    "calendarFixed $calendar monthCode $monthCode: $expected",
    ({ calendar, monthCode, expected }) => {
      expect(
        isValidHolidayRule({
          name: "x",
          kind: "calendarFixed",
          calendar,
          monthCode,
          day: 1,
        }),
      ).toBe(expected);
    },
  );

  // The title prints a string without quotes, so the numeric-string row is named for what it is.
  it.each`
    calendar    | monthCode | expected
    ${"hebrew"} | ${"7"}    | ${false}
  `(
    "calendarFixed $calendar monthCode given as the string $monthCode: $expected",
    ({ calendar, monthCode, expected }) => {
      expect(
        isValidHolidayRule({
          name: "x",
          kind: "calendarFixed",
          calendar,
          monthCode,
          day: 1,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    calendar      | day          | expected
    ${"hebrew"}   | ${1}         | ${true}
    ${"hebrew"}   | ${30}        | ${true}
    ${"hebrew"}   | ${0}         | ${false}
    ${"hebrew"}   | ${31}        | ${false}
    ${"hebrew"}   | ${32}        | ${false}
    ${"hebrew"}   | ${-1}        | ${false}
    ${"hebrew"}   | ${1.5}       | ${false}
    ${"hebrew"}   | ${"1"}       | ${false}
    ${"hebrew"}   | ${NaN}       | ${false}
    ${"hebrew"}   | ${undefined} | ${false}
    ${"chinese"}  | ${1}         | ${false}
    ${"dangi"}    | ${1}         | ${false}
    ${"nope"}     | ${1}         | ${false}
    ${""}         | ${1}         | ${false}
    ${"hebrew "}  | ${1}         | ${false}
    ${1}          | ${1}         | ${false}
    ${null}       | ${1}         | ${false}
    ${undefined}  | ${1}         | ${false}
    ${["hebrew"]} | ${1}         | ${false}
  `(
    "calendarFixed calendar $calendar day $day: $expected",
    ({ calendar, day, expected }) => {
      expect(
        isValidHolidayRule({
          name: "x",
          kind: "calendarFixed",
          calendar,
          monthCode: "M07",
          day,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    month        | weekday      | n            | expected
    ${1}         | ${1}         | ${1}         | ${true}
    ${12}        | ${7}         | ${5}         | ${true}
    ${6}         | ${3}         | ${-5}        | ${true}
    ${6}         | ${3}         | ${-1}        | ${true}
    ${6}         | ${3}         | ${"last"}    | ${true}
    ${0}         | ${1}         | ${1}         | ${false}
    ${13}        | ${1}         | ${1}         | ${false}
    ${1.5}       | ${1}         | ${1}         | ${false}
    ${undefined} | ${1}         | ${1}         | ${false}
    ${1}         | ${0}         | ${1}         | ${false}
    ${1}         | ${8}         | ${1}         | ${false}
    ${1}         | ${1.5}       | ${1}         | ${false}
    ${1}         | ${NaN}       | ${1}         | ${false}
    ${1}         | ${undefined} | ${1}         | ${false}
    ${1}         | ${1}         | ${0}         | ${false}
    ${1}         | ${1}         | ${6}         | ${false}
    ${1}         | ${1}         | ${-6}        | ${false}
    ${1}         | ${1}         | ${1.5}       | ${false}
    ${1}         | ${1}         | ${NaN}       | ${false}
    ${1}         | ${1}         | ${"first"}   | ${false}
    ${1}         | ${1}         | ${"Last"}    | ${false}
    ${1}         | ${1}         | ${null}      | ${false}
    ${1}         | ${1}         | ${undefined} | ${false}
  `(
    "nthWeekday month $month weekday $weekday n $n: $expected",
    ({ month, weekday, n, expected }) => {
      expect(
        isValidHolidayRule({
          name: "x",
          kind: "nthWeekday",
          month,
          weekday,
          n,
        }),
      ).toBe(expected);
    },
  );

  // The title prints a string without quotes, so each string row names which field is the string.
  it.each`
    field        | month  | weekday | n      | expected
    ${"month"}   | ${"1"} | ${1}    | ${1}   | ${false}
    ${"weekday"} | ${1}   | ${"1"}  | ${1}   | ${false}
    ${"n"}       | ${1}   | ${1}    | ${"1"} | ${false}
  `(
    "nthWeekday $field given as a string: month $month weekday $weekday n $n: $expected",
    ({ month, weekday, n, expected }) => {
      expect(
        isValidHolidayRule({
          name: "x",
          kind: "nthWeekday",
          month,
          weekday,
          n,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    offsetDays                     | computus       | expected
    ${0}                           | ${undefined}   | ${true}
    ${-0}                          | ${"gregorian"} | ${true}
    ${Number.MAX_SAFE_INTEGER}     | ${"julian"}    | ${true}
    ${-Number.MAX_SAFE_INTEGER}    | ${"julian"}    | ${true}
    ${Number.MAX_SAFE_INTEGER + 1} | ${undefined}   | ${false}
    ${-(2 ** 53)}                  | ${undefined}   | ${false}
    ${1.5}                         | ${undefined}   | ${false}
    ${NaN}                         | ${undefined}   | ${false}
    ${Infinity}                    | ${undefined}   | ${false}
    ${-Infinity}                   | ${undefined}   | ${false}
    ${"1"}                         | ${undefined}   | ${false}
    ${null}                        | ${undefined}   | ${false}
    ${undefined}                   | ${undefined}   | ${false}
    ${1}                           | ${"orthodox"}  | ${false}
    ${1}                           | ${"Julian"}    | ${false}
    ${1}                           | ${""}          | ${false}
    ${1}                           | ${null}        | ${false}
    ${1}                           | ${1}           | ${false}
  `(
    "easterRelative offsetDays $offsetDays computus $computus: $expected",
    ({ offsetDays, computus, expected }) => {
      expect(
        isValidHolidayRule({
          name: "x",
          kind: "easterRelative",
          offsetDays,
          computus,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    dates                                         | expected
    ${[]}                                         | ${true}
    ${["2026-03-20", "2026-03-20", "2025-01-01"]} | ${true}
    ${["2026-03-20[u-ca=iso8601]"]}               | ${true}
    ${["2026-03-20[foo=bar]"]}                    | ${true}
    ${["+275760-09-13", "-271821-04-19"]}         | ${true}
    ${["2024-02-29"]}                             | ${true}
    ${["2026-03-20[u-ca=hebrew]"]}                | ${false}
    ${["2026-03-20[!foo=bar]"]}                   | ${false}
    ${["2026-03-20T10:00:00"]}                    | ${false}
    ${["2026-03-20T00:00:00Z"]}                   | ${false}
    ${["2026-02-29"]}                             | ${false}
    ${["2026-04-31"]}                             | ${false}
    ${["2026-00-10"]}                             | ${false}
    ${["2026-01-00"]}                             | ${false}
    ${["+275760-09-14"]}                          | ${false}
    ${["-271821-04-18"]}                          | ${false}
    ${["20260320"]}                               | ${false}
    ${["2026-3-20"]}                              | ${false}
    ${[""]}                                       | ${false}
    ${[" 2026-03-20"]}                            | ${false}
    ${["2026-03-20", "nope"]}                     | ${false}
    ${["2026-03-20", 20260320]}                   | ${false}
    ${["2026-03-20", null]}                       | ${false}
    ${["2026-03-20", undefined]}                  | ${false}
    ${[["2026-03-20"]]}                           | ${false}
    ${"2026-03-20"}                               | ${false}
    ${{ length: 1, 0: "2026-03-20" }}             | ${false}
    ${new Set(["2026-03-20"])}                    | ${false}
    ${null}                                       | ${false}
    ${undefined}                                  | ${false}
  `("dates $dates: $expected", ({ dates, expected }) => {
    expect(isValidHolidayRule({ name: "x", kind: "dates", dates })).toBe(
      expected,
    );
  });

  it("rejects a dates list with a hole", () => {
    // Index 0 is a hole, not undefined.
    const dates: string[] = [];
    dates[1] = "2026-03-20";

    expect(isValidHolidayRule({ name: "x", kind: "dates", dates })).toBe(false);
  });

  it.each`
    kind
    ${"Fixed"}
    ${"FIXED"}
    ${"calendarfixed"}
    ${"nthweekday"}
    ${"easter"}
    ${"holiday"}
    ${"weekly"}
    ${""}
    ${1}
    ${null}
    ${undefined}
    ${["fixed"]}
  `("kind $kind: false", ({ kind }) => {
    expect(isValidHolidayRule({ name: "x", kind, month: 1, day: 1 })).toBe(
      false,
    );
  });

  it.each`
    name                | expected
    ${""}               | ${true}
    ${"Easter minus 2"} | ${true}
    ${1}                | ${false}
    ${null}             | ${false}
    ${undefined}        | ${false}
    ${["x"]}            | ${false}
    ${{}}               | ${false}
  `("name $name: $expected", ({ name, expected }) => {
    expect(isValidHolidayRule({ ...fixed, name })).toBe(expected);
  });

  it("ignores properties a kind does not define, even malformed ones", () => {
    const extras = { n: "first", offsetDays: 0.5, observed: { 6: "none" } };

    expect(
      isValidHolidayRule({
        name: "x",
        kind: "dates",
        dates: [],
        month: 99,
        ...extras,
      }),
    ).toBe(true);
    expect(
      isValidHolidayRule({
        name: "x",
        kind: "nthWeekday",
        month: 1,
        weekday: 1,
        n: 1,
        day: 99,
        observed: { 6: "none" },
        computus: "orthodox",
      }),
    ).toBe(true);
    expect(
      isValidHolidayRule({
        name: "x",
        kind: "easterRelative",
        offsetDays: 1,
        month: 99,
        observed: { 6: "none" },
      }),
    ).toBe(true);
    expect(
      isValidHolidayRule({
        name: "x",
        kind: "fixed",
        month: 1,
        day: 1,
        monthCode: "M99",
        calendar: "nope",
        n: "first",
      }),
    ).toBe(true);
  });

  it("accepts a rule that inherits its fields and one without a prototype", () => {
    const proto = { name: "x", kind: "fixed", month: 1, day: 1 };

    expect(isValidHolidayRule(Object.create(proto))).toBe(true);
    expect(isValidHolidayRule(Object.assign(Object.create(null), proto))).toBe(
      true,
    );
    expect(isValidHolidayRule(Object.freeze({ ...proto }))).toBe(true);
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
    ${"a proxy whose getPrototypeOf throws"} | ${() => new Proxy({ name: "x", kind: "fixed", month: 1, day: 1 }, { get() {
        throw new Error("boom");
      }, getPrototypeOf() {
        throw new Error("boom");
      } })}
    ${"a throwing kind getter"} | ${() => ({ name: "x", get kind(): string {
    throw new Error("boom");
  } })}
    ${"a throwing name getter"} | ${() => ({ get name(): string {
    throw new Error("boom");
  }, kind: "fixed", month: 1, day: 1 })}
    ${"a throwing dates getter"} | ${() => ({ name: "x", kind: "dates", get dates(): string[] {
    throw new Error("boom");
  } })}
    ${"a dates entry that throws"} | ${() => ({ name: "x", kind: "dates", dates: new Proxy(["2026-03-20"], { get() {
      throw new Error("boom");
    } }) })}
    ${"a throwing observed getter"} | ${() => ({ name: "x", kind: "fixed", month: 1, day: 1, get observed(): never {
    throw new Error("boom");
  } })}
    ${"a throwing observed weekday entry"} | ${() => ({ name: "x", kind: "fixed", month: 1, day: 1, observed: { get 6(): never {
        throw new Error("boom");
      } } })}
    ${"a throwing monthCode getter"} | ${() => ({ name: "x", kind: "calendarFixed", calendar: "hebrew", day: 1, get monthCode(): never {
    throw new Error("boom");
  } })}
    ${"a throwing calendar getter"} | ${() => ({ name: "x", kind: "calendarFixed", monthCode: "M01", day: 1, get calendar(): never {
    throw new Error("boom");
  } })}
    ${"a throwing n getter"} | ${() => ({ name: "x", kind: "nthWeekday", month: 1, weekday: 1, get n(): never {
    throw new Error("boom");
  } })}
    ${"a throwing offsetDays getter"} | ${() => ({ name: "x", kind: "easterRelative", get offsetDays(): never {
    throw new Error("boom");
  } })}
  `("returns false for $why", ({ make }) => {
    expect(isValidHolidayRule(make())).toBe(false);
  });

  it.each`
    rule
    ${() => 0}
    ${Object.assign([], { name: "x", kind: "fixed", month: 1, day: 1 })}
    ${makeDate()}
    ${new Map()}
    ${Symbol("rule")}
    ${1n}
    ${true}
    ${0}
    ${NaN}
    ${undefined}
  `("returns false for the non-rule $rule", ({ rule }) => {
    expect(isValidHolidayRule(rule)).toBe(false);
  });
});
