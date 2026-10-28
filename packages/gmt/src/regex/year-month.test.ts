import { plainYearMonth } from "./year-month";

// Temporal grammar DateSpecYearMonth (DateYear DateSeparator DateMonth); DateYear refuses -000000.
describe("regex/year-month", () => {
  it.each`
    value           | why
    ${"2026-10"}    | ${"DateSpecYearMonth"}
    ${"0000-01"}    | ${"year zero"}
    ${"9999-12"}    | ${"last four-digit year"}
    ${"+275760-09"} | ${"latest year-month Temporal represents"}
    ${"-271821-04"} | ${"earliest year-month Temporal represents"}
    ${"+999999-12"} | ${"shape only: the range is not the regex's job"}
    ${"+002026-10"} | ${"six-digit year with a plus sign"}
    ${"-000001-12"} | ${"negative year"}
  `("matches '$value' ($why)", ({ value }: { value: string }) => {
    expect(plainYearMonth.test(value)).toBe(true);
  });

  it.each`
    value           | why
    ${"202610"}     | ${"basic form"}
    ${"2026-1"}     | ${"month not zero-padded"}
    ${"2026-13"}    | ${"month 13"}
    ${"2026-00"}    | ${"month zero"}
    ${"-000000-01"} | ${"DateYear early error: -000000 is not a year"}
    ${"26-10"}      | ${"two-digit year"}
    ${"2026-10-01"} | ${"a full date"}
    ${"--10-01"}    | ${"a month-day"}
    ${" 2026-10"}   | ${"leading space"}
    ${"2026-10 "}   | ${"trailing space"}
    ${"2026-10\n"}  | ${"trailing newline"}
    ${"20261-10"}   | ${"five-digit year"}
    ${"000000-10"}  | ${"six digits without a sign"}
    ${"2026-10Z"}   | ${"a UTC designator"}
    ${""}           | ${"empty string"}
  `("rejects '$value' ($why)", ({ value }: { value: string }) => {
    expect(plainYearMonth.test(value)).toBe(false);
  });
});
