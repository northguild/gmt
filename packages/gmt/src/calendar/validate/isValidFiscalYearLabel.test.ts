import { isValidFiscalYearLabel } from "./isValidFiscalYearLabel";

describe("isValidFiscalYearLabel", () => {
  it.each`
    yearLabel         | description
    ${"startYear"}    | ${"the year the fiscal year's first day falls in (NRF, US)"}
    ${"endYear"}      | ${"the year its last day falls in (Woolworths Group, AU)"}
    ${"majorityYear"} | ${"the calendar year holding most of its days (ONS, UK; Canadian Tire, CA)"}
  `("returns true for $yearLabel ($description)", ({ yearLabel }) => {
    expect(isValidFiscalYearLabel(yearLabel)).toBe(true);
  });

  it.each`
    yearLabel       | reason
    ${"fiscalYear"} | ${"not one of the three rules"}
    ${"start"}      | ${"a truncated value"}
    ${"StartYear"}  | ${"wrong case"}
    ${"endYear "}   | ${"trailing whitespace"}
    ${""}           | ${"empty string"}
  `("returns false for the string $yearLabel ($reason)", ({ yearLabel }) => {
    expect(isValidFiscalYearLabel(yearLabel)).toBe(false);
  });

  it.each`
    nonString
    ${2024}
    ${true}
    ${null}
    ${undefined}
    ${{}}
    ${["startYear"]}
    ${new String("startYear")}
  `("returns false when $nonString is non-string", ({ nonString }) => {
    expect(isValidFiscalYearLabel(nonString)).toBe(false);
  });
});
