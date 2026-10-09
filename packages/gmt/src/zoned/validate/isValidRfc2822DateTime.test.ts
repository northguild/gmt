import { rfc2822DateTime } from "../../regex";
import { NON_STRINGS } from "../../test/ediCodes";
import { parseRfc2822 } from "../parse/parseRfc2822";
import { isValidRfc2822DateTime } from "./isValidRfc2822DateTime";

/**
 * Each verdict is worked out from the RFC 5322 grammar and the calendar, never from the function:
 * the §3.3 `date-time` (folding white space, comments, a 1- or 2-digit day, a 4-or-more-digit
 * year, optional seconds, a `±hhmm` zone whose minutes are 00–59, and a day-of-week that "MUST be
 * the day implied by the date") and the §4.3 obsolete forms a receiver must accept (CFWS between
 * tokens, 2- and 3-digit years, alphabetic zones). `pattern` is what `rfc2822DateTime`, the strict
 * single-space shape, says of the same string. The valid and invalid rows of
 * `parseRfc2822.test.ts` are all here, so the two files stay in step.
 *
 * Weekdays: 2024-03-15 Fri, 2024-03-05 Tue, 2024-01-05 Fri, 2024-07-01 Mon, 2024-02-29 Thu,
 * 0024-03-15 Fri, 2049-03-15 Mon, 1950-03-15 Wed, 1999-03-15 Mon, 2000-03-15 Wed,
 * 10000-01-01 Sat.
 */
describe("isValidRfc2822DateTime", () => {
  it.each`
    value                                                     | expected | pattern  | reason
    ${"Fri, 15 Mar 2024 14:30:00 -0400"}                      | ${true}  | ${true}  | ${"day-of-week, numeric zone"}
    ${"15 Mar 2024 14:30:00 -0400"}                           | ${true}  | ${true}  | ${"no day-of-week"}
    ${"5 Mar 2024 09:00:05 +0530"}                            | ${true}  | ${true}  | ${"1-digit day"}
    ${"Fri, 15 Mar 2024 14:30 -0400"}                         | ${true}  | ${true}  | ${"no seconds"}
    ${"Fri, 05 Jan 2024 09:00:00 GMT"}                        | ${true}  | ${true}  | ${"GMT"}
    ${"Fri, 05 Jan 2024 09:00:00 UT"}                         | ${true}  | ${true}  | ${"UT"}
    ${"Fri, 15 Mar 2024 14:30:00 EST"}                        | ${true}  | ${true}  | ${"EST"}
    ${"Fri, 15 Mar 2024 14:30:00 EDT"}                        | ${true}  | ${true}  | ${"EDT"}
    ${"Fri, 15 Mar 2024 14:30:00 CST"}                        | ${true}  | ${true}  | ${"CST"}
    ${"Fri, 15 Mar 2024 14:30:00 CDT"}                        | ${true}  | ${true}  | ${"CDT"}
    ${"Fri, 15 Mar 2024 14:30:00 MST"}                        | ${true}  | ${true}  | ${"MST"}
    ${"Fri, 15 Mar 2024 14:30:00 MDT"}                        | ${true}  | ${true}  | ${"MDT"}
    ${"Fri, 15 Mar 2024 14:30:00 PST"}                        | ${true}  | ${true}  | ${"PST"}
    ${"Fri, 15 Mar 2024 14:30:00 PDT"}                        | ${true}  | ${true}  | ${"PDT"}
    ${"Mon, 01 Jul 2024 00:00:00 +1300"}                      | ${true}  | ${true}  | ${"zone east of +1200"}
    ${"Mon, 01 Jul 2024 00:00:00 -1100"}                      | ${true}  | ${true}  | ${"zone west of UTC"}
    ${"Fri, 15 Mar 2024 14:30:00 -0000"}                      | ${true}  | ${true}  | ${"-0000: offset unknown"}
    ${"Fri, 15 Mar 2024 14:30:00 +0000"}                      | ${true}  | ${true}  | ${"+0000: Universal Time"}
    ${"Thu, 29 Feb 2024 12:00:00 +0000"}                      | ${true}  | ${true}  | ${"29 February in a leap year"}
    ${"Fri, 15 Mar 0024 14:30:00 -0400"}                      | ${true}  | ${true}  | ${"4 digits are the year itself"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 (EDT)"}                | ${true}  | ${false} | ${"trailing comment"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 (a (nested \\) one))"} | ${true}  | ${false} | ${"nested comment with quoted-pair"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 (\\\u0000)"}           | ${true}  | ${false} | ${"obsolete quoted-pair NUL in a comment"}
    ${"Fri,15 Mar 2024 14:30:00 -0400"}                       | ${true}  | ${false} | ${"no space after the comma"}
    ${"Fri, 15  Mar 2024 14:30:00 -0400"}                     | ${true}  | ${false} | ${"double space"}
    ${"Fri, 15 Mar 2024 14:30:00\t-0400"}                     | ${true}  | ${false} | ${"tab before the zone"}
    ${"Fri, 15 Mar 2024\r\n 14:30:00 -0400"}                  | ${true}  | ${false} | ${"folded line (CRLF WSP)"}
    ${"fri, 15 mar 2024 14:30:00 -0400"}                      | ${true}  | ${false} | ${"lower-case names"}
    ${"FRI, 15 MAR 2024 14:30:00 -0400"}                      | ${true}  | ${false} | ${"upper-case names"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 "}                     | ${true}  | ${false} | ${"trailing FWS"}
    ${"Sat, 01 Jan 10000 00:00:00 +0000"}                     | ${true}  | ${false} | ${"5-digit year (year = 4*DIGIT)"}
    ${"(sent) Fri , 15 Mar 2024 14 : 30 : 00 -0400"}          | ${true}  | ${false} | ${"obsolete: CFWS between tokens"}
    ${"Fri, 15 Mar 24 14:30:00 -0400"}                        | ${true}  | ${false} | ${"obsolete 2-digit year 24 → 2024"}
    ${"Mon, 15 Mar 49 14:30:00 -0400"}                        | ${true}  | ${false} | ${"obsolete 2-digit year 49 → 2049"}
    ${"Wed, 15 Mar 50 14:30:00 -0400"}                        | ${true}  | ${false} | ${"obsolete 2-digit year 50 → 1950"}
    ${"Mon, 15 Mar 99 14:30:00 -0400"}                        | ${true}  | ${false} | ${"obsolete 2-digit year 99 → 1999"}
    ${"Wed, 15 Mar 00 14:30:00 -0400"}                        | ${true}  | ${false} | ${"obsolete 2-digit year 00 → 2000"}
    ${"Fri, 15 Mar 124 14:30:00 -0400"}                       | ${true}  | ${false} | ${"obsolete 3-digit year 124 → 2024"}
    ${"Fri, 15 Mar 2024 14:30:00 gmt"}                        | ${true}  | ${false} | ${"GMT in lower case"}
    ${"Fri, 15 Mar 2024 14:30:00 ut"}                         | ${true}  | ${false} | ${"UT in lower case"}
    ${"Fri, 15 Mar 2024 14:30:00 est"}                        | ${true}  | ${false} | ${"EST in lower case"}
    ${"Fri, 15 Mar 2024 14:30:00 Z"}                          | ${true}  | ${false} | ${"military Z → -0000"}
    ${"Fri, 15 Mar 2024 14:30:00 A"}                          | ${true}  | ${false} | ${"military A → -0000"}
    ${"Fri, 15 Mar 2024 14:30:00 y"}                          | ${true}  | ${false} | ${"military y (lower case) → -0000"}
    ${"Fri, 15 Mar 2024 14:30:00 CEST"}                       | ${true}  | ${false} | ${"unknown alphabetic zone → -0000"}
    ${"Fri, 15 Mar 2024 14:30:00GMT"}                         | ${true}  | ${false} | ${"obs-zone needs no FWS"}
    ${"not a date"}                                           | ${false} | ${false} | ${"not a date-time"}
    ${""}                                                     | ${false} | ${false} | ${"empty"}
    ${"2024-03-15T14:30:00-04:00"}                            | ${false} | ${false} | ${"an ISO 8601 date-time"}
    ${"Fri, 15 Mar 2024 14:30:00 J"}                          | ${false} | ${false} | ${"J is outside the military range"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 extra"}                | ${false} | ${false} | ${"text after the zone"}
    ${"Fri, 15 March 2024 14:30:00 -0400"}                    | ${false} | ${false} | ${"full month name"}
    ${"Fri, 15 Mar 2024 14:30:00"}                            | ${false} | ${false} | ${"no zone"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 (unclosed"}            | ${false} | ${false} | ${"unclosed comment"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400)"}                     | ${false} | ${false} | ${"unopened comment"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400\r\n"}                  | ${false} | ${false} | ${"CRLF with no WSP after it"}
    ${"Fri, 15 Mar 2 14:30:00 -0400"}                         | ${false} | ${false} | ${"1-digit year"}
    ${"Fri 15 Mar 2024 14:30:00 -0400"}                       | ${false} | ${false} | ${"no comma after the day-of-week"}
    ${"Fri, 15 Mar 2024 1:30:00 -0400"}                       | ${false} | ${false} | ${"hour = 2DIGIT"}
    ${"Fri, 15 Mar 2024 14:30:00(c)-0400"}                    | ${false} | ${false} | ${"a numeric zone needs FWS before it"}
    ${"Fri, 15 Mar 2024 14:30:00\u0000-0400"}                 | ${false} | ${false} | ${"NUL outside a comment"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 (\u0000)"}             | ${false} | ${false} | ${"unquoted NUL in a comment"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 (\\\\\u0000)"}         | ${false} | ${false} | ${"NUL after a quoted backslash"}
    ${"Sat, 15 Mar 2024 14:30:00 -0400"}                      | ${false} | ${true}  | ${"15 Mar 2024 was a Friday"}
    ${"Mon, 15 Mar 2024 14:30:00 -0400"}                      | ${false} | ${true}  | ${"15 Mar 2024 was a Friday"}
    ${"Sat, 31 Feb 2024 14:30:00 -0400"}                      | ${false} | ${true}  | ${"February has no 31st"}
    ${"Wed, 29 Feb 2023 14:30:00 -0400"}                      | ${false} | ${true}  | ${"2023 has no 29 February"}
    ${"Mon, 31 Apr 2024 14:30:00 -0400"}                      | ${false} | ${true}  | ${"April has 30 days"}
    ${"31 Jun 2024 14:30:00 -0400"}                           | ${false} | ${true}  | ${"June has 30 days"}
    ${"Fri, 32 Mar 2024 14:30:00 -0400"}                      | ${false} | ${true}  | ${"day 32"}
    ${"0 Mar 2024 14:30:00 -0400"}                            | ${false} | ${true}  | ${"day 0"}
    ${"Fri, 15 Mar 2024 24:00:00 -0400"}                      | ${false} | ${true}  | ${"hour 24"}
    ${"Fri, 15 Mar 2024 14:60:00 -0400"}                      | ${false} | ${true}  | ${"minute 60"}
    ${"Fri, 15 Mar 2024 14:30:60 -0400"}                      | ${false} | ${true}  | ${"second 60: GMT rejects leap seconds"}
    ${"Fri, 15 Mar 2024 14:30:00 -0460"}                      | ${false} | ${true}  | ${"zone minutes above 59"}
    ${"Fri, 15 Mar 2024 14:30:00 +2400"}                      | ${false} | ${true}  | ${"an offset of 24 hours cannot be represented"}
  `(
    "returns $expected for $value ($reason); the pattern alone says $pattern; parseRfc2822 agrees",
    ({
      value,
      expected,
      pattern,
    }: {
      value: string;
      expected: boolean;
      pattern: boolean;
    }) => {
      expect(isValidRfc2822DateTime(value)).toBe(expected);
      expect(rfc2822DateTime.test(value)).toBe(pattern);
      expect(isValidRfc2822DateTime(value)).toBe(parseRfc2822(value) !== "");
    },
  );

  it("returns false for an argument that is not a string, as parseRfc2822 returns ''", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidRfc2822DateTime(make() as never), kind).toBe(false);
      expect(parseRfc2822(make() as never), kind).toBe("");
    }
  });
});
