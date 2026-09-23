import { sqlDateTime } from "./sql-date-time";

// SQL-92 §5.3 `<timestamp string>` (`<date value> <space> <time value>`, Syntax Rule 21: a
// four-digit year and two-digit fields; `<seconds value> ::= <seconds integer value> [ <period>
// [ <seconds fraction> ] ]`) with Table 10's YEAR 0001–9999, and the ODBC `ts` escape
// `yyyy-mm-dd hh:mm:ss[.f...]`. GMT caps the fraction at 9 digits (Temporal's nanosecond) and
// rejects SECOND 60–61 (leap seconds).
describe("regex/sql-date-time", () => {
  it.each`
    value                               | expected | reason
    ${"2024-03-15 14:30:00"}            | ${true}  | ${"seconds, no fraction"}
    ${"2024-03-15 14:30:00.5"}          | ${true}  | ${"one fraction digit"}
    ${"2024-03-15 14:30:00.123456789"}  | ${true}  | ${"nine fraction digits"}
    ${"2024-03-15 14:30:00."}           | ${true}  | ${"period with no fraction (SQL-92 <seconds value>)"}
    ${"0001-01-01 00:00:00"}            | ${true}  | ${"Table 10 minimum year"}
    ${"9999-12-31 23:59:59"}            | ${true}  | ${"Table 10 maximum year"}
    ${"2024-03-15 14:30"}               | ${false} | ${"seconds omitted"}
    ${"0000-01-01 00:00:00"}            | ${false} | ${"year 0000 is outside 0001–9999"}
    ${"+002024-03-15 14:30:00"}         | ${false} | ${"expanded year"}
    ${"+000000-01-01 00:00:00"}         | ${false} | ${"signed expanded year"}
    ${"-000001-01-01 00:00:00"}         | ${false} | ${"negative expanded year"}
    ${"2024-03-15 14:30:00.1234567890"} | ${false} | ${"ten fraction digits"}
    ${"2024-03-15 14:30:00,5"}          | ${false} | ${"comma decimal sign"}
    ${"2024-3-5 14:30:00"}              | ${false} | ${"unpadded month and day"}
    ${"2024-03-05 4:30:00"}             | ${false} | ${"unpadded hour"}
    ${"2024-03-15T14:30:00"}            | ${false} | ${"T separator"}
    ${"2024-03-15  14:30:00"}           | ${false} | ${"two spaces"}
    ${"2024-03-15 14:30:60"}            | ${false} | ${"leap second"}
    ${"not a date"}                     | ${false} | ${"not a literal"}
    ${""}                               | ${false} | ${"empty"}
  `(
    "sqlDateTime matches $value as $expected ($reason)",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(sqlDateTime.test(value)).toBe(expected);
    },
  );
});
