import { Temporal } from "../../internal/temporal";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getQuarter } from "./getQuarter";

describe("getQuarter", () => {
  it.each`
    value           | expected
    ${"2024-01-15"} | ${{ year: 2024, quarter: 1 }}
    ${"2024-03-31"} | ${{ year: 2024, quarter: 1 }}
    ${"2024-04-01"} | ${{ year: 2024, quarter: 2 }}
    ${"2024-06-30"} | ${{ year: 2024, quarter: 2 }}
    ${"2024-07-01"} | ${{ year: 2024, quarter: 3 }}
    ${"2024-09-30"} | ${{ year: 2024, quarter: 3 }}
    ${"2024-10-01"} | ${{ year: 2024, quarter: 4 }}
    ${"2024-12-31"} | ${{ year: 2024, quarter: 4 }}
  `("returns $expected for $value with no options", ({ value, expected }) => {
    expect(getQuarter(value)).toEqual(expected);
  });

  // A January fiscal year starts and ends in one calendar year, so every label agrees with the
  // calendar quarters.
  it.each`
    value           | yearLabel         | expected
    ${"2024-01-15"} | ${"startYear"}    | ${{ year: 2024, quarter: 1 }}
    ${"2024-01-15"} | ${"endYear"}      | ${{ year: 2024, quarter: 1 }}
    ${"2024-01-15"} | ${"majorityYear"} | ${{ year: 2024, quarter: 1 }}
    ${"2024-06-15"} | ${"startYear"}    | ${{ year: 2024, quarter: 2 }}
    ${"2024-06-15"} | ${"endYear"}      | ${{ year: 2024, quarter: 2 }}
    ${"2024-06-15"} | ${"majorityYear"} | ${{ year: 2024, quarter: 2 }}
    ${"2024-12-31"} | ${"startYear"}    | ${{ year: 2024, quarter: 4 }}
    ${"2024-12-31"} | ${"endYear"}      | ${{ year: 2024, quarter: 4 }}
    ${"2024-12-31"} | ${"majorityYear"} | ${{ year: 2024, quarter: 4 }}
  `(
    "returns $expected for $value with fiscalYearStartMonth 1 and yearLabel $yearLabel, the calendar quarter",
    ({ value, yearLabel, expected }) => {
      expect(getQuarter(value, { fiscalYearStartMonth: 1, yearLabel })).toEqual(
        expected,
      );
    },
  );

  it.each`
    value           | fiscalYearStartMonth | expected                      | description
    ${"2024-06-30"} | ${4}                 | ${{ year: 2024, quarter: 1 }} | ${"the last day of its Q1"}
    ${"2024-07-01"} | ${4}                 | ${{ year: 2024, quarter: 2 }} | ${"the first day of its Q2"}
    ${"2025-03-31"} | ${4}                 | ${{ year: 2024, quarter: 4 }} | ${"its last day, still labelled by the year it started in"}
    ${"2024-07-01"} | ${7}                 | ${{ year: 2024, quarter: 1 }} | ${"a July fiscal year opening"}
    ${"2024-06-30"} | ${7}                 | ${{ year: 2023, quarter: 4 }} | ${"the day before that"}
    ${"2024-10-01"} | ${10}                | ${{ year: 2024, quarter: 1 }} | ${"an October fiscal year opening"}
    ${"2024-09-30"} | ${10}                | ${{ year: 2023, quarter: 4 }} | ${"the day before that"}
    ${"2024-12-31"} | ${12}                | ${{ year: 2024, quarter: 1 }} | ${"a December fiscal year opening on its first month"}
    ${"2024-11-30"} | ${12}                | ${{ year: 2023, quarter: 4 }} | ${"the day before that"}
    ${"2024-02-29"} | ${2}                 | ${{ year: 2024, quarter: 1 }} | ${"a leap day in a February fiscal year"}
  `(
    "returns $expected for $value with fiscalYearStartMonth $fiscalYearStartMonth and startYear ($description)",
    ({ value, fiscalYearStartMonth, expected }) => {
      expect(
        getQuarter(value, { fiscalYearStartMonth, yearLabel: "startYear" }),
      ).toEqual(expected);
    },
  );

  // Every start month under every label, on one date. The fiscal year holding 2024-06-15 runs
  // from day 1 of the start month for a year; majorityYear counts its days by month length.
  it.each`
    fiscalYearStartMonth | yearLabel         | expected                      | fiscalYear
    ${1}                 | ${"startYear"}    | ${{ year: 2024, quarter: 2 }} | ${"2024-01-01 to 2024-12-31"}
    ${1}                 | ${"endYear"}      | ${{ year: 2024, quarter: 2 }} | ${"2024-01-01 to 2024-12-31"}
    ${1}                 | ${"majorityYear"} | ${{ year: 2024, quarter: 2 }} | ${"2024-01-01 to 2024-12-31: one calendar year"}
    ${2}                 | ${"startYear"}    | ${{ year: 2024, quarter: 2 }} | ${"2024-02-01 to 2025-01-31"}
    ${2}                 | ${"endYear"}      | ${{ year: 2025, quarter: 2 }} | ${"2024-02-01 to 2025-01-31"}
    ${2}                 | ${"majorityYear"} | ${{ year: 2024, quarter: 2 }} | ${"2024-02-01 to 2025-01-31: 335 days in 2024, 31 in 2025"}
    ${3}                 | ${"startYear"}    | ${{ year: 2024, quarter: 2 }} | ${"2024-03-01 to 2025-02-28"}
    ${3}                 | ${"endYear"}      | ${{ year: 2025, quarter: 2 }} | ${"2024-03-01 to 2025-02-28"}
    ${3}                 | ${"majorityYear"} | ${{ year: 2024, quarter: 2 }} | ${"2024-03-01 to 2025-02-28: 306 days in 2024, 59 in 2025"}
    ${4}                 | ${"startYear"}    | ${{ year: 2024, quarter: 1 }} | ${"2024-04-01 to 2025-03-31"}
    ${4}                 | ${"endYear"}      | ${{ year: 2025, quarter: 1 }} | ${"2024-04-01 to 2025-03-31"}
    ${4}                 | ${"majorityYear"} | ${{ year: 2024, quarter: 1 }} | ${"2024-04-01 to 2025-03-31: 275 days in 2024, 90 in 2025"}
    ${5}                 | ${"startYear"}    | ${{ year: 2024, quarter: 1 }} | ${"2024-05-01 to 2025-04-30"}
    ${5}                 | ${"endYear"}      | ${{ year: 2025, quarter: 1 }} | ${"2024-05-01 to 2025-04-30"}
    ${5}                 | ${"majorityYear"} | ${{ year: 2024, quarter: 1 }} | ${"2024-05-01 to 2025-04-30: 245 days in 2024, 120 in 2025"}
    ${6}                 | ${"startYear"}    | ${{ year: 2024, quarter: 1 }} | ${"2024-06-01 to 2025-05-31"}
    ${6}                 | ${"endYear"}      | ${{ year: 2025, quarter: 1 }} | ${"2024-06-01 to 2025-05-31"}
    ${6}                 | ${"majorityYear"} | ${{ year: 2024, quarter: 1 }} | ${"2024-06-01 to 2025-05-31: 214 days in 2024, 151 in 2025"}
    ${7}                 | ${"startYear"}    | ${{ year: 2023, quarter: 4 }} | ${"2023-07-01 to 2024-06-30"}
    ${7}                 | ${"endYear"}      | ${{ year: 2024, quarter: 4 }} | ${"2023-07-01 to 2024-06-30"}
    ${7}                 | ${"majorityYear"} | ${{ year: 2023, quarter: 4 }} | ${"2023-07-01 to 2024-06-30: 184 days in 2023, 182 in 2024"}
    ${8}                 | ${"startYear"}    | ${{ year: 2023, quarter: 4 }} | ${"2023-08-01 to 2024-07-31"}
    ${8}                 | ${"endYear"}      | ${{ year: 2024, quarter: 4 }} | ${"2023-08-01 to 2024-07-31"}
    ${8}                 | ${"majorityYear"} | ${{ year: 2024, quarter: 4 }} | ${"2023-08-01 to 2024-07-31: 153 days in 2023, 213 in 2024"}
    ${9}                 | ${"startYear"}    | ${{ year: 2023, quarter: 4 }} | ${"2023-09-01 to 2024-08-31"}
    ${9}                 | ${"endYear"}      | ${{ year: 2024, quarter: 4 }} | ${"2023-09-01 to 2024-08-31"}
    ${9}                 | ${"majorityYear"} | ${{ year: 2024, quarter: 4 }} | ${"2023-09-01 to 2024-08-31: 122 days in 2023, 244 in 2024"}
    ${10}                | ${"startYear"}    | ${{ year: 2023, quarter: 3 }} | ${"2023-10-01 to 2024-09-30"}
    ${10}                | ${"endYear"}      | ${{ year: 2024, quarter: 3 }} | ${"2023-10-01 to 2024-09-30"}
    ${10}                | ${"majorityYear"} | ${{ year: 2024, quarter: 3 }} | ${"2023-10-01 to 2024-09-30: 92 days in 2023, 274 in 2024"}
    ${11}                | ${"startYear"}    | ${{ year: 2023, quarter: 3 }} | ${"2023-11-01 to 2024-10-31"}
    ${11}                | ${"endYear"}      | ${{ year: 2024, quarter: 3 }} | ${"2023-11-01 to 2024-10-31"}
    ${11}                | ${"majorityYear"} | ${{ year: 2024, quarter: 3 }} | ${"2023-11-01 to 2024-10-31: 61 days in 2023, 305 in 2024"}
    ${12}                | ${"startYear"}    | ${{ year: 2023, quarter: 3 }} | ${"2023-12-01 to 2024-11-30"}
    ${12}                | ${"endYear"}      | ${{ year: 2024, quarter: 3 }} | ${"2023-12-01 to 2024-11-30"}
    ${12}                | ${"majorityYear"} | ${{ year: 2024, quarter: 3 }} | ${"2023-12-01 to 2024-11-30: 31 days in 2023, 335 in 2024"}
  `(
    "places 2024-06-15 in $expected when the fiscal year starts in month $fiscalYearStartMonth, labelled by $yearLabel ($fiscalYear)",
    ({ fiscalYearStartMonth, yearLabel, expected }) => {
      expect(
        getQuarter("2024-06-15", { fiscalYearStartMonth, yearLabel }),
      ).toEqual(expected);
    },
  );

  it.each`
    value                    | expected
    ${"2024-04-01T00:00:00"} | ${{ year: 2024, quarter: 1 }}
    ${"2024-03-31T23:59:59"} | ${{ year: 2023, quarter: 4 }}
  `(
    "reads the date half of the zoneless datetime $value as $expected",
    ({ value, expected }) => {
      expect(
        getQuarter(value, { fiscalYearStartMonth: 4, yearLabel: "startYear" }),
      ).toEqual(expected);
    },
  );

  it("returns the calendar quarter when options is an explicit undefined", () => {
    expect(getQuarter("2024-06-15", undefined)).toEqual({
      year: 2024,
      quarter: 2,
    });
  });

  // Once options are passed the caller has asked for a fiscal year, and both fields are required:
  // there is no default month and no default label.
  it.each`
    options                                                        | description
    ${{}}                                                          | ${"an empty options object"}
    ${{ fiscalYearStartMonth: 4 }}                                 | ${"no yearLabel"}
    ${{ yearLabel: "startYear" }}                                  | ${"no fiscalYearStartMonth"}
    ${{ fiscalYearStartMonth: undefined, yearLabel: "startYear" }} | ${"an explicit undefined month"}
    ${{ fiscalYearStartMonth: 4, yearLabel: undefined }}           | ${"an explicit undefined label"}
    ${{ fiscalYearStartMonth: 4, yearLabel: "bogus" }}             | ${"an unrecognised label"}
    ${{ fiscalYearStartMonth: 4, yearLabel: "StartYear" }}         | ${"a label in the wrong case"}
    ${{ fiscalYearStartMonth: 4, yearLabel: null }}                | ${"a null label"}
    ${{ fiscalYearStartMonth: 4, yearLabel: 2024 }}                | ${"a numeric label"}
  `("returns null for $description", ({ options }) => {
    expect(getQuarter("2024-06-15", options)).toBeNull();
  });

  it.each`
    options | kind
    ${null} | ${"null"}
    ${"4"}  | ${"the string 4"}
    ${4}    | ${"the number 4"}
    ${true} | ${"the boolean true"}
  `("returns null when options is $kind", ({ options }) => {
    expect(getQuarter("2024-06-15", options)).toBeNull();
  });

  it.each`
    field
    ${"fiscalYearStartMonth"}
    ${"yearLabel"}
  `("returns null when the $field getter throws", ({ field }) => {
    const options = { fiscalYearStartMonth: 4, yearLabel: "startYear" };
    Object.defineProperty(options, field, {
      get() {
        throw new Error("hostile getter");
      },
    });

    expect(
      getQuarter("2024-06-15", options as Parameters<typeof getQuarter>[1]),
    ).toBeNull();
  });

  // `null` is a present member, so it is validated: it is not a month number.
  it.each`
    fiscalYearStartMonth        | description
    ${0}                        | ${"below the first month"}
    ${13}                       | ${"above the last month"}
    ${-1}                       | ${"negative"}
    ${1.5}                      | ${"not an integer"}
    ${Number.NaN}               | ${"NaN"}
    ${Number.POSITIVE_INFINITY} | ${"infinite"}
    ${"4"}                      | ${"a string"}
    ${null}                     | ${"explicitly null, a value rather than an omission"}
  `(
    "returns null when fiscalYearStartMonth $fiscalYearStartMonth is $description",
    ({ fiscalYearStartMonth }) => {
      expect(
        getQuarter("2024-06-15", {
          fiscalYearStartMonth,
          yearLabel: "startYear",
        }),
      ).toBeNull();
    },
  );

  it.each`
    value                                            | description
    ${"2024-06-15T12:00:00Z"}                        | ${"a UTC instant"}
    ${"2024-06-15T12:00:00-04:00[America/New_York]"} | ${"a zoned datetime"}
    ${"invalid"}                                     | ${"an unparseable string"}
    ${""}                                            | ${"an empty string"}
    ${"2024-02-30"}                                  | ${"a date that does not exist"}
  `("returns null when $value is $description", ({ value }) => {
    expect(getQuarter(value)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `("returns null when $value is non-string input", ({ value }) => {
    expect(getQuarter(value as unknown as string)).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getQuarter("2024-06-15")).toBeNull();
  });

  // The pre-built mock fails the parse of `value`. With options, the fiscal year is built
  // after it: `from` on a property bag for its start, `add` and `subtract` for its end, and
  // `until` to count majorityYear's days.
  it("returns null when Temporal.PlainDate.from throws on the fiscal year's start", () => {
    const from = Temporal.PlainDate.from;
    vi.spyOn(Temporal.PlainDate, "from").mockImplementation((item, options) => {
      if (typeof item !== "string") throw new RangeError("simulated failure");
      return from.call(Temporal.PlainDate, item, options);
    });

    expect(
      getQuarter("2024-06-15", {
        fiscalYearStartMonth: 4,
        yearLabel: "startYear",
      }),
    ).toBeNull();
  });

  it.each`
    method
    ${"add"}
    ${"subtract"}
    ${"until"}
  `(
    "returns null when Temporal.PlainDate.prototype.$method throws while labelling by majorityYear",
    ({ method }: { method: "add" | "subtract" | "until" }) => {
      vi.spyOn(Temporal.PlainDate.prototype, method).mockImplementation(() => {
        throw new RangeError("simulated failure");
      });

      expect(
        getQuarter("2024-06-15", {
          fiscalYearStartMonth: 4,
          yearLabel: "majorityYear",
        }),
      ).toBeNull();
    },
  );

  // A function is an ECMAScript Object (ECMA-262 §6.1.7), which Temporal's GetOptionsObject
  // accepts, so its two fields are read like a plain options bag's.
  it("reads a function carrying both option fields as those options", () => {
    expect(
      getQuarter(
        "2024-06-15",
        Object.assign(() => 0, {
          fiscalYearStartMonth: 4,
          yearLabel: "startYear" as const,
        }),
      ),
    ).toEqual({ year: 2024, quarter: 1 });
  });

  // Temporal's ISO grammar reads an elective annotation (`[foo=bar]`) and `[u-ca=iso8601]` and ignores
  // them (RFC 9557 §3.3; native Temporal agrees), so the result is the unannotated input's.
  it.each`
    value                               | expected
    ${"2024-06-15[foo=bar]"}            | ${{ year: 2024, quarter: 2 }}
    ${"2024-06-15T12:00[u-ca=iso8601]"} | ${{ year: 2024, quarter: 2 }}
    ${"2024-06-15[!foo=bar]"}           | ${null}
  `(
    "reads the annotations of $value as Temporal does",
    ({ value, expected }) => {
      expect(getQuarter(value)).toEqual(expected);
    },
  );
  // The caller states the year label: the calendar year the fiscal year starts in, ends in, or
  // holds most of its days in (CORE-5.md, Corrections). The fiscal year runs from day 1 of the
  // start month for a year;
  // the day counts are worked by month length in each row's description.
  it.each`
    value           | fiscalYearStartMonth | yearLabel         | expected                      | description
    ${"2024-04-01"} | ${4}                 | ${"startYear"}    | ${{ year: 2024, quarter: 1 }} | ${"2024-04-01 to 2025-03-31 starts in 2024"}
    ${"2024-04-01"} | ${4}                 | ${"endYear"}      | ${{ year: 2025, quarter: 1 }} | ${"and ends in 2025"}
    ${"2024-04-01"} | ${4}                 | ${"majorityYear"} | ${{ year: 2024, quarter: 1 }} | ${"275 days in 2024, 90 in 2025"}
    ${"2024-03-31"} | ${4}                 | ${"startYear"}    | ${{ year: 2023, quarter: 4 }} | ${"2023-04-01 to 2024-03-31 starts in 2023"}
    ${"2024-03-31"} | ${4}                 | ${"endYear"}      | ${{ year: 2024, quarter: 4 }} | ${"and ends in 2024"}
    ${"2024-03-31"} | ${4}                 | ${"majorityYear"} | ${{ year: 2023, quarter: 4 }} | ${"275 days in 2023, 91 in 2024"}
    ${"2023-10-15"} | ${7}                 | ${"startYear"}    | ${{ year: 2023, quarter: 2 }} | ${"2023-07-01 to 2024-06-30 starts in 2023"}
    ${"2023-10-15"} | ${7}                 | ${"endYear"}      | ${{ year: 2024, quarter: 2 }} | ${"and ends in 2024"}
    ${"2023-10-15"} | ${7}                 | ${"majorityYear"} | ${{ year: 2023, quarter: 2 }} | ${"184 days in 2023, 182 in 2024"}
    ${"2024-10-01"} | ${10}                | ${"startYear"}    | ${{ year: 2024, quarter: 1 }} | ${"2024-10-01 to 2025-09-30 starts in 2024"}
    ${"2024-10-01"} | ${10}                | ${"endYear"}      | ${{ year: 2025, quarter: 1 }} | ${"and ends in 2025"}
    ${"2024-10-01"} | ${10}                | ${"majorityYear"} | ${{ year: 2025, quarter: 1 }} | ${"92 days in 2024, 273 in 2025"}
    ${"2024-06-15"} | ${8}                 | ${"majorityYear"} | ${{ year: 2024, quarter: 4 }} | ${"2023-08-01 to 2024-07-31: 153 days in 2023, 213 in 2024"}
    ${"2024-08-01"} | ${8}                 | ${"majorityYear"} | ${{ year: 2025, quarter: 1 }} | ${"2024-08-01 to 2025-07-31: 153 days in 2024, 212 in 2025"}
  `(
    "returns $expected for $value with fiscalYearStartMonth $fiscalYearStartMonth and $yearLabel ($description)",
    ({ value, fiscalYearStartMonth, yearLabel, expected }) => {
      expect(getQuarter(value, { fiscalYearStartMonth, yearLabel })).toEqual(
        expected,
      );
    },
  );

  // §3.3: July to December is 184 days, more than half of 365 or 366, so start months 1 to 7
  // put most days in the start year; from August the start-year part is at most 153 days.
  // One date per month across 2023 (common) and 2024 (leap) covers fiscal years ending in
  // a leap year and starting in one.
  const fifteenths = [2023, 2024].flatMap((year) =>
    Array.from(
      { length: 12 },
      (_unused, index) => `${year}-${String(index + 1).padStart(2, "0")}-15`,
    ),
  );

  it.each`
    fiscalYearStartMonth | yearsAfterStart | majorityIs
    ${1}                 | ${0}            | ${"the start year, which is also the end year"}
    ${2}                 | ${0}            | ${"the start year"}
    ${3}                 | ${0}            | ${"the start year"}
    ${4}                 | ${0}            | ${"the start year"}
    ${5}                 | ${0}            | ${"the start year"}
    ${6}                 | ${0}            | ${"the start year"}
    ${7}                 | ${0}            | ${"the start year: July to December is 184 days"}
    ${8}                 | ${1}            | ${"the end year: August to December is 153 days"}
    ${9}                 | ${1}            | ${"the end year"}
    ${10}                | ${1}            | ${"the end year"}
    ${11}                | ${1}            | ${"the end year"}
    ${12}                | ${1}            | ${"the end year"}
  `(
    "labels every month of 2023 and 2024 by majorityYear as $majorityIs when the fiscal year starts in month $fiscalYearStartMonth",
    ({ fiscalYearStartMonth, yearsAfterStart }) => {
      for (const value of fifteenths) {
        const [year, month] = value.split("-").map(Number);
        const startYear = month < fiscalYearStartMonth ? year - 1 : year;

        expect(
          getQuarter(value, { fiscalYearStartMonth, yearLabel: "majorityYear" })
            ?.year,
          value,
        ).toBe(startYear + yearsAfterStart);
      }
    },
  );
  // A fiscal year can run past Temporal's first or last date (-271821-04-19, +275760-09-13)
  // and still have a label: the year label is calendar arithmetic, not a date Temporal must
  // hold. 1.19 returned these quarters, and adding yearLabel "startYear" keeps them.
  it.each`
    value              | fiscalYearStartMonth | yearLabel         | expected                         | description
    ${"+275760-09-13"} | ${1}                 | ${"startYear"}    | ${{ year: 275760, quarter: 3 }}  | ${"the last date; its year ends 275760-12-31, past the range"}
    ${"+275760-09-13"} | ${1}                 | ${"majorityYear"} | ${{ year: 275760, quarter: 3 }}  | ${"a January year has one label"}
    ${"+275760-09-13"} | ${10}                | ${"startYear"}    | ${{ year: 275759, quarter: 4 }}  | ${"275759-10-01 to 275760-09-30 starts in 275759"}
    ${"+275760-09-13"} | ${10}                | ${"endYear"}      | ${{ year: 275760, quarter: 4 }}  | ${"and ends in 275760"}
    ${"+275760-09-13"} | ${10}                | ${"majorityYear"} | ${{ year: 275760, quarter: 4 }}  | ${"92 days in 275759, 274 in 275760"}
    ${"-271821-04-19"} | ${1}                 | ${"endYear"}      | ${{ year: -271821, quarter: 2 }} | ${"the first date; its year starts -271821-01-01, before the range"}
    ${"-271821-04-19"} | ${4}                 | ${"startYear"}    | ${{ year: -271821, quarter: 1 }} | ${"-271821-04-01 to -271820-03-31 starts in -271821"}
    ${"-271821-04-19"} | ${4}                 | ${"endYear"}      | ${{ year: -271820, quarter: 1 }} | ${"and ends in -271820"}
    ${"-271821-04-19"} | ${7}                 | ${"majorityYear"} | ${{ year: -271822, quarter: 4 }} | ${"-271822-07-01 to -271821-06-30: July to December is 184 days"}
    ${"-271821-04-19"} | ${8}                 | ${"majorityYear"} | ${{ year: -271821, quarter: 3 }} | ${"-271822-08-01 to -271821-07-31: 153 days in -271822, 212 in -271821"}
  `(
    "returns $expected for $value with fiscalYearStartMonth $fiscalYearStartMonth and $yearLabel at Temporal's range limits ($description)",
    ({ value, fiscalYearStartMonth, yearLabel, expected }) => {
      expect(getQuarter(value, { fiscalYearStartMonth, yearLabel })).toEqual(
        expected,
      );
    },
  );
});
