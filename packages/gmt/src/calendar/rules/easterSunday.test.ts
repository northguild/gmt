import { easterSunday } from "./easterSunday";

describe("easterSunday", () => {
  // Gregorian dates: Meeus ch. 8 worked years and the story rows; Julian dates checked
  // against the Explanatory Supplement Julian computus and a floor-division Julian Day Number.
  it.each`
    year    | computus       | expected
    ${2024} | ${undefined}   | ${"2024-03-31"}
    ${2024} | ${"gregorian"} | ${"2024-03-31"}
    ${2024} | ${"julian"}    | ${"2024-05-05"}
    ${2025} | ${undefined}   | ${"2025-04-20"}
    ${2025} | ${"julian"}    | ${"2025-04-20"}
    ${2026} | ${undefined}   | ${"2026-04-05"}
    ${2026} | ${"julian"}    | ${"2026-04-12"}
    ${2027} | ${undefined}   | ${"2027-03-28"}
    ${2027} | ${"julian"}    | ${"2027-05-02"}
    ${1991} | ${undefined}   | ${"1991-03-31"}
    ${1992} | ${undefined}   | ${"1992-04-19"}
    ${1993} | ${undefined}   | ${"1993-04-11"}
    ${1954} | ${undefined}   | ${"1954-04-18"}
    ${2000} | ${undefined}   | ${"2000-04-23"}
    ${1818} | ${undefined}   | ${"1818-03-22"}
    ${2285} | ${undefined}   | ${"2285-03-22"}
    ${179}  | ${"julian"}    | ${"0179-04-11"}
    ${711}  | ${"julian"}    | ${"0711-04-16"}
    ${1243} | ${"julian"}    | ${"1243-04-19"}
    ${1583} | ${undefined}   | ${"1583-04-10"}
    ${1583} | ${"julian"}    | ${"1583-04-10"}
    ${1582} | ${undefined}   | ${"1582-04-18"}
    ${1582} | ${"julian"}    | ${"1582-04-25"}
    ${0}    | ${undefined}   | ${"0000-04-09"}
    ${-1}   | ${undefined}   | ${"-000001-04-18"}
    ${1943} | ${undefined}   | ${"1943-04-25"}
    ${2038} | ${undefined}   | ${"2038-04-25"}
    ${1900} | ${undefined}   | ${"1900-04-15"}
    ${2100} | ${undefined}   | ${"2100-03-28"}
    ${1900} | ${"julian"}    | ${"1900-04-22"}
    ${2100} | ${"julian"}    | ${"2100-05-02"}
    ${2200} | ${"julian"}    | ${"2200-04-06"}
    ${4}    | ${"julian"}    | ${"0004-03-21"}
  `(
    "returns $expected for year $year, computus $computus",
    ({ year, computus, expected }) => {
      expect(easterSunday(year, computus && { computus })).toBe(expected);
    },
  );
});

describe("easterSunday at the range edges", () => {
  // Temporal range edges and Julian years whose ISO year differs from `year`.
  it.each`
    year       | computus       | expected
    ${-271821} | ${"gregorian"} | ${""}
    ${-271820} | ${"gregorian"} | ${"-271820-04-16"}
    ${275760}  | ${"gregorian"} | ${"+275760-03-30"}
    ${275761}  | ${"gregorian"} | ${""}
    ${-271815} | ${"julian"}    | ${"-271821-09-19"}
    ${-271816} | ${"julian"}    | ${""}
    ${275754}  | ${"julian"}    | ${"+275759-12-16"}
    ${275755}  | ${"julian"}    | ${""}
    ${33808}   | ${"julian"}    | ${"+033809-01-01"}
  `(
    "returns $expected for year $year at the range edge, computus $computus",
    ({ year, computus, expected }) => {
      expect(easterSunday(year, { computus })).toBe(expected);
    },
  );
});

describe("easterSunday options and invalid input", () => {
  it('treats an explicit { computus: undefined } as "gregorian"', () => {
    expect(easterSunday(2024, { computus: undefined })).toBe("2024-03-31");
  });

  it("treats a year of -0 as year 0", () => {
    expect(easterSunday(-0)).toBe("0000-04-09");
  });

  it.each`
    year                       | options                    | description
    ${2024.5}                  | ${undefined}               | ${"fractional year"}
    ${NaN}                     | ${undefined}               | ${"NaN year"}
    ${Infinity}                | ${undefined}               | ${"infinite year"}
    ${"2024"}                  | ${undefined}               | ${"string year"}
    ${null}                    | ${undefined}               | ${"null year"}
    ${Number.MAX_SAFE_INTEGER} | ${undefined}               | ${"year beyond Temporal's range"}
    ${-1e21}                   | ${{ computus: "julian" }}  | ${"huge negative Julian year"}
    ${2024}                    | ${"julian"}                | ${"string options"}
    ${2024}                    | ${42}                      | ${"number options"}
    ${2024}                    | ${null}                    | ${"null options"}
    ${2024}                    | ${{ computus: "Julian" }}  | ${"wrong-case computus"}
    ${2024}                    | ${{ computus: "gregory" }} | ${"CLDR id instead of computus"}
    ${2024}                    | ${{ computus: "lunar" }}   | ${"unknown computus"}
    ${2024}                    | ${{ computus: 1 }}         | ${"numeric computus"}
    ${2024}                    | ${{ computus: null }}      | ${"null computus"}
  `("returns an empty string for $description", ({ year, options }) => {
    expect(easterSunday(year, options)).toBe("");
  });
});

describe("easterSunday with a hostile options object", () => {
  it("returns an empty string when reading computus throws", () => {
    const options = {
      get computus(): never {
        throw new Error("boom");
      },
    };

    expect(easterSunday(2024, options)).toBe("");
  });
});
