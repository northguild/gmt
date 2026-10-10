import { sqlDateTime } from "../../regex";
import { NON_STRINGS } from "../../test/ediCodes";
import { parseSqlDateTime } from "../parse/parseSqlDateTime";
import { isValidSqlDateTime } from "./isValidSqlDateTime";

/**
 * Each verdict is worked out from the SQL-92 §5.3 `<timestamp string>` grammar that `sqlDateTime`
 * documents (`YYYY-MM-DD HH:MM:SS[.f...]`, year `0001`–`9999`, a single space, seconds required,
 * up to nine fraction digits, no leap second) and from the calendar, never from the function.
 * `pattern` is what the shape-only `sqlDateTime` says of the same string. The valid and invalid
 * rows of `parseSqlDateTime.test.ts` are all here, so the two files stay in step.
 */
describe("isValidSqlDateTime", () => {
  it.each`
    value                               | expected | pattern  | reason
    ${"2024-03-15 14:30:00"}            | ${true}  | ${true}  | ${"date, one space, time with seconds"}
    ${"2024-03-05 09:00:00"}            | ${true}  | ${true}  | ${"zero-padded fields"}
    ${"2024-03-15 14:30:00."}           | ${true}  | ${true}  | ${"a period with no fraction"}
    ${"2024-03-15 14:30:00.5"}          | ${true}  | ${true}  | ${"one fraction digit"}
    ${"2024-03-15 14:30:00.123456789"}  | ${true}  | ${true}  | ${"nine fraction digits"}
    ${"0001-01-01 00:00:00"}            | ${true}  | ${true}  | ${"the first year SQL allows"}
    ${"9999-12-31 23:59:59.999999999"}  | ${true}  | ${true}  | ${"the last nanosecond SQL allows"}
    ${"2024-02-29 00:00:00"}            | ${true}  | ${true}  | ${"29 February in a leap year"}
    ${"2000-02-29 12:00:00"}            | ${true}  | ${true}  | ${"2000 is divisible by 400"}
    ${"not a date"}                     | ${false} | ${false} | ${"not a timestamp"}
    ${""}                               | ${false} | ${false} | ${"empty"}
    ${"2024-03-15T14:30:00"}            | ${false} | ${false} | ${"T separator"}
    ${"2024-3-5 14:30:00"}              | ${false} | ${false} | ${"unpadded month and day"}
    ${"2024-03-05 4:30:00"}             | ${false} | ${false} | ${"unpadded hour"}
    ${"2024-03-15  14:30:00"}           | ${false} | ${false} | ${"two spaces"}
    ${"2024-03-15 14:30"}               | ${false} | ${false} | ${"seconds are required"}
    ${"0000-01-01 00:00:00"}            | ${false} | ${false} | ${"year 0000 is outside 0001–9999"}
    ${"+002024-03-15 14:30:00"}         | ${false} | ${false} | ${"expanded year"}
    ${"-000001-01-01 00:00:00"}         | ${false} | ${false} | ${"signed year"}
    ${"2024-03-15 14:30:60"}            | ${false} | ${false} | ${"second 60: GMT rejects leap seconds"}
    ${"2024-03-15 24:00:00"}            | ${false} | ${false} | ${"hour 24"}
    ${"2024-03-15 14:60:00"}            | ${false} | ${false} | ${"minute 60"}
    ${"2024-13-15 14:30:00"}            | ${false} | ${false} | ${"month 13"}
    ${"2024-03-00 14:30:00"}            | ${false} | ${false} | ${"day 00"}
    ${"2024-03-32 14:30:00"}            | ${false} | ${false} | ${"day 32"}
    ${"2024-03-15 14:30:00.1234567890"} | ${false} | ${false} | ${"ten fraction digits"}
    ${"2024-03-15 14:30:00,5"}          | ${false} | ${false} | ${"comma decimal sign"}
    ${"2024-03-15 14:30:00Z"}           | ${false} | ${false} | ${"a UTC designator"}
    ${"2024-03-15 14:30:00+00:00"}      | ${false} | ${false} | ${"an offset: TIMESTAMP WITH TIME ZONE is out of scope"}
    ${"2024-03-15"}                     | ${false} | ${false} | ${"a date without a time"}
    ${" 2024-03-15 14:30:00"}           | ${false} | ${false} | ${"leading space"}
    ${"2024-03-15 14:30:00 "}           | ${false} | ${false} | ${"trailing space"}
    ${"2024-03-15 14:30:00\n"}          | ${false} | ${false} | ${"trailing line feed"}
    ${"2024-02-30 14:30:00"}            | ${false} | ${true}  | ${"February has no 30th"}
    ${"2023-02-29 14:30:00"}            | ${false} | ${true}  | ${"2023 has no 29 February"}
    ${"1900-02-29 00:00:00"}            | ${false} | ${true}  | ${"1900 is divisible by 100, not 400"}
    ${"2024-06-31 00:00:00"}            | ${false} | ${true}  | ${"June has 30 days"}
    ${"2024-04-31 00:00:00.5"}          | ${false} | ${true}  | ${"April has 30 days"}
    ${"2024-02-31 00:00:00."}           | ${false} | ${true}  | ${"February has no 31st"}
  `(
    "returns $expected for $value ($reason); the pattern alone says $pattern; parseSqlDateTime agrees",
    ({
      value,
      expected,
      pattern,
    }: {
      value: string;
      expected: boolean;
      pattern: boolean;
    }) => {
      expect(isValidSqlDateTime(value)).toBe(expected);
      expect(sqlDateTime.test(value)).toBe(pattern);
      expect(isValidSqlDateTime(value)).toBe(parseSqlDateTime(value) !== "");
    },
  );

  it("returns false for an argument that is not a string, as parseSqlDateTime returns ''", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidSqlDateTime(make() as never), kind).toBe(false);
      expect(parseSqlDateTime(make() as never), kind).toBe("");
    }
  });
});
