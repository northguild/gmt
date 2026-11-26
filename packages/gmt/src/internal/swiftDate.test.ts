import {
  readSwiftDateFields,
  SWIFT_VALUE_DATE_FIRST_YEAR,
  SWIFT_VALUE_DATE_LAST_YEAR,
  swiftValueDateYear,
  writeSwiftDate,
} from "./swiftDate";

const ALL_YY = Array.from({ length: 100 }, (_, i) => i);

describe("SWIFT value-date limits", () => {
  it("are 2001 and 2060", () => {
    expect([SWIFT_VALUE_DATE_FIRST_YEAR, SWIFT_VALUE_DATE_LAST_YEAR]).toEqual([
      2001, 2060,
    ]);
  });
});

describe("readSwiftDateFields", () => {
  it.each`
    value       | expected
    ${"240615"} | ${{ yy: 24, month: 6, day: 15 }}
    ${"000229"} | ${{ yy: 0, month: 2, day: 29 }}
    ${"999999"} | ${{ yy: 99, month: 99, day: 99 }}
    ${"000000"} | ${{ yy: 0, month: 0, day: 0 }}
  `(
    "reads the shape of '$value' without checking the date",
    ({ value, expected }) => {
      expect(readSwiftDateFields(value)).toEqual(expected);
    },
  );

  it.each`
    value               | label
    ${"24061"}          | ${"five characters"}
    ${"2406150"}        | ${"seven characters"}
    ${""}               | ${"empty"}
    ${"24-06-15"}       | ${"hyphenated"}
    ${"2024-06-15"}     | ${"ISO date"}
    ${"20240615"}       | ${"DATE4"}
    ${" 240615"}        | ${"leading space"}
    ${"240615 "}        | ${"trailing space"}
    ${"240615\n"}       | ${"trailing newline"}
    ${"\n240615"}       | ${"leading newline"}
    ${"２４０６１５"}   | ${"full-width digits"}
    ${"٢٤٠٦١٥"}         | ${"Arabic-Indic digits"}
    ${"24O615"}         | ${"letter O"}
    ${"+40615"}         | ${"plus sign"}
    ${"-40615"}         | ${"minus sign"}
    ${"2406.5"}         | ${"decimal point"}
    ${"240615EUR1000,"} | ${"date with currency and amount"}
    ${":32A:240615"}    | ${"tagged field"}
  `("returns null for '$value' ($label)", ({ value }) => {
    expect(readSwiftDateFields(value)).toBeNull();
  });
});

describe("swiftValueDateYear", () => {
  it.each`
    yy    | expected | clause
    ${0}  | ${null}  | ${"00 is outside 01 to 60, T50"}
    ${1}  | ${2001}  | ${"first YY allowed"}
    ${24} | ${2024}  | ${"in range"}
    ${60} | ${2060}  | ${"last YY allowed"}
    ${61} | ${null}  | ${"61 is outside 01 to 60, T50"}
    ${79} | ${null}  | ${"T50"}
    ${80} | ${null}  | ${"T50 (the 2006 rule read it as 1980)"}
    ${99} | ${null}  | ${"T50 (the 2006 rule read it as 1999)"}
  `("gives $expected for yy $yy ($clause)", ({ yy, expected }) => {
    expect(swiftValueDateYear(yy)).toBe(expected);
  });

  it("is null for exactly yy 00 and 61 to 99 and in range otherwise", () => {
    const nulls = ALL_YY.filter((yy) => swiftValueDateYear(yy) === null);
    const years = ALL_YY.map((yy) => swiftValueDateYear(yy)).filter(
      (y): y is number => y !== null,
    );
    expect({
      nulls,
      distinct: new Set(years).size,
      min: Math.min(...years),
      max: Math.max(...years),
    }).toEqual({
      nulls: [0, ...Array.from({ length: 39 }, (_, i) => 61 + i)],
      distinct: 60,
      min: 2001,
      max: 2060,
    });
  });
});

describe("writeSwiftDate", () => {
  it.each`
    year    | month | day   | expected
    ${2024} | ${6}  | ${15} | ${"240615"}
    ${2004} | ${2}  | ${29} | ${"040229"}
    ${2001} | ${1}  | ${1}  | ${"010101"}
    ${2060} | ${12} | ${31} | ${"601231"}
    ${2005} | ${1}  | ${9}  | ${"050109"}
  `(
    "writes $expected for $year-$month-$day",
    ({ year, month, day, expected }) => {
      expect(writeSwiftDate(year, month, day)).toBe(expected);
    },
  );

  it("round-trips the two-digit year of every year the rule gives", () => {
    const bad = ALL_YY.filter((yy) => {
      const year = swiftValueDateYear(yy);
      return (
        year !== null &&
        readSwiftDateFields(writeSwiftDate(year, 1, 1))?.yy !== yy
      );
    });
    expect(bad).toEqual([]);
  });
});
