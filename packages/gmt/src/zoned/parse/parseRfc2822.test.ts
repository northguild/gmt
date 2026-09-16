import { formatRfc2822 } from "../format/formatRfc2822";
import { parseRfc2822 } from "./parseRfc2822";

describe("parseRfc2822", () => {
  it.each`
    value                                | expected
    ${"Fri, 15 Mar 2024 14:30:00 -0400"} | ${"2024-03-15T14:30:00-04:00[-04:00]"}
    ${"15 Mar 2024 14:30:00 -0400"}      | ${"2024-03-15T14:30:00-04:00[-04:00]"}
    ${"5 Mar 2024 09:00:05 +0530"}       | ${"2024-03-05T09:00:05+05:30[+05:30]"}
    ${"Fri, 15 Mar 2024 14:30 -0400"}    | ${"2024-03-15T14:30:00-04:00[-04:00]"}
    ${"Fri, 05 Jan 2024 09:00:00 GMT"}   | ${"2024-01-05T09:00:00+00:00[+00:00]"}
    ${"Fri, 05 Jan 2024 09:00:00 UT"}    | ${"2024-01-05T09:00:00+00:00[+00:00]"}
    ${"Fri, 15 Mar 2024 14:30:00 EST"}   | ${"2024-03-15T14:30:00-05:00[-05:00]"}
    ${"Fri, 15 Mar 2024 14:30:00 EDT"}   | ${"2024-03-15T14:30:00-04:00[-04:00]"}
    ${"Fri, 15 Mar 2024 14:30:00 CST"}   | ${"2024-03-15T14:30:00-06:00[-06:00]"}
    ${"Fri, 15 Mar 2024 14:30:00 CDT"}   | ${"2024-03-15T14:30:00-05:00[-05:00]"}
    ${"Fri, 15 Mar 2024 14:30:00 MST"}   | ${"2024-03-15T14:30:00-07:00[-07:00]"}
    ${"Fri, 15 Mar 2024 14:30:00 MDT"}   | ${"2024-03-15T14:30:00-06:00[-06:00]"}
    ${"Fri, 15 Mar 2024 14:30:00 PST"}   | ${"2024-03-15T14:30:00-08:00[-08:00]"}
    ${"Fri, 15 Mar 2024 14:30:00 PDT"}   | ${"2024-03-15T14:30:00-07:00[-07:00]"}
    ${"Mon, 01 Jul 2024 00:00:00 +1300"} | ${"2024-07-01T00:00:00+13:00[+13:00]"}
    ${"Mon, 01 Jul 2024 00:00:00 -1100"} | ${"2024-07-01T00:00:00-11:00[-11:00]"}
  `(
    "parses $value to $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseRfc2822(value)).toBe(expected);
    },
  );

  describe("day-of-week MUST be the day implied by the date (RFC 5322 §3.3)", () => {
    // 2024-03-15 was a Friday (Date.UTC(2024, 2, 15) → getUTCDay() 5).
    it.each`
      value                                | expected
      ${"Sat, 15 Mar 2024 14:30:00 -0400"} | ${""}
      ${"Mon, 15 Mar 2024 14:30:00 -0400"} | ${""}
      ${"Fri, 15 Mar 2024 14:30:00 -0400"} | ${"2024-03-15T14:30:00-04:00[-04:00]"}
      ${"15 Mar 2024 14:30:00 -0400"}      | ${"2024-03-15T14:30:00-04:00[-04:00]"}
    `("$value → '$expected'", ({ value, expected }) => {
      expect(parseRfc2822(value)).toBe(expected);
    });
  });

  describe("current syntax: FWS, CFWS and case-insensitive names (RFC 5322 §3.3, RFC 5234 §2.3)", () => {
    const FRI_15_MAR = "2024-03-15T14:30:00-04:00[-04:00]";
    it.each`
      description                          | value
      ${"trailing comment"}                | ${"Fri, 15 Mar 2024 14:30:00 -0400 (EDT)"}
      ${"nested comment with quoted-pair"} | ${"Fri, 15 Mar 2024 14:30:00 -0400 (a (nested \\) one))"}
      ${"no space after the comma"}        | ${"Fri,15 Mar 2024 14:30:00 -0400"}
      ${"double space"}                    | ${"Fri, 15  Mar 2024 14:30:00 -0400"}
      ${"tab before the zone"}             | ${"Fri, 15 Mar 2024 14:30:00\t-0400"}
      ${"folded line (CRLF WSP)"}          | ${"Fri, 15 Mar 2024\r\n 14:30:00 -0400"}
      ${"lower-case names"}                | ${"fri, 15 mar 2024 14:30:00 -0400"}
      ${"upper-case names"}                | ${"FRI, 15 MAR 2024 14:30:00 -0400"}
      ${"trailing FWS"}                    | ${"Fri, 15 Mar 2024 14:30:00 -0400 "}
    `("accepts $description", ({ value }) => {
      expect(parseRfc2822(value)).toBe(FRI_15_MAR);
    });

    it("accepts an obsolete quoted-pair NUL inside a comment (obs-qp, RFC 5322 §4.1)", () => {
      expect(
        parseRfc2822("Fri, 15 Mar 2024 14:30:00 -0400 (\\\u0000)"),
      ).toBe(FRI_15_MAR);
    });

    it("accepts a 5-digit year (year = 4*DIGIT) and round-trips formatRfc2822's own output", () => {
      // 10000-01-01 is a Saturday: 20 whole 400-year cycles after 2000-01-01.
      expect(parseRfc2822("Sat, 01 Jan 10000 00:00:00 +0000")).toBe(
        "+010000-01-01T00:00:00+00:00[+00:00]",
      );
      const zoned = "+010000-01-01T00:00:00+00:00[UTC]";
      expect(parseRfc2822(formatRfc2822(zoned))).toBe(
        "+010000-01-01T00:00:00+00:00[+00:00]",
      );
    });
  });

  describe("obsolete syntax a receiver MUST accept (RFC 5322 §4.3)", () => {
    it.each`
      value                                            | expected                               | reason
      ${"(sent) Fri , 15 Mar 2024 14 : 30 : 00 -0400"} | ${"2024-03-15T14:30:00-04:00[-04:00]"} | ${"CFWS between tokens"}
      ${"Fri, 15 Mar 2024 14:30:00(c)-0400"}           | ${""}                                  | ${"numeric zone still needs FWS before it"}
      ${"Fri, 15 Mar 24 14:30:00 -0400"}               | ${"2024-03-15T14:30:00-04:00[-04:00]"} | ${"2-digit year 00–49 → +2000"}
      ${"Mon, 15 Mar 49 14:30:00 -0400"}               | ${"2049-03-15T14:30:00-04:00[-04:00]"} | ${"2-digit year 49 → 2049"}
      ${"Wed, 15 Mar 50 14:30:00 -0400"}               | ${"1950-03-15T14:30:00-04:00[-04:00]"} | ${"2-digit year 50 → 1950"}
      ${"Mon, 15 Mar 99 14:30:00 -0400"}               | ${"1999-03-15T14:30:00-04:00[-04:00]"} | ${"2-digit year 99 → 1999"}
      ${"Wed, 15 Mar 00 14:30:00 -0400"}               | ${"2000-03-15T14:30:00-04:00[-04:00]"} | ${"2-digit year 00 → 2000"}
      ${"Fri, 15 Mar 124 14:30:00 -0400"}              | ${"2024-03-15T14:30:00-04:00[-04:00]"} | ${"3-digit year → +1900"}
      ${"Fri, 15 Mar 0024 14:30:00 -0400"}             | ${"0024-03-15T14:30:00-04:00[-04:00]"} | ${"4 digits are the year itself"}
      ${"Fri, 15 Mar 2024 14:30:00 gmt"}               | ${"2024-03-15T14:30:00+00:00[+00:00]"} | ${"GMT, any case"}
      ${"Fri, 15 Mar 2024 14:30:00 ut"}                | ${"2024-03-15T14:30:00+00:00[+00:00]"} | ${"UT, any case"}
      ${"Fri, 15 Mar 2024 14:30:00 est"}               | ${"2024-03-15T14:30:00-05:00[-05:00]"} | ${"EST = -0500, any case"}
      ${"Fri, 15 Mar 2024 14:30:00 Z"}                 | ${"2024-03-15T14:30:00+00:00[+00:00]"} | ${"military Z → -0000"}
      ${"Fri, 15 Mar 2024 14:30:00 A"}                 | ${"2024-03-15T14:30:00+00:00[+00:00]"} | ${"military A → -0000"}
      ${"Fri, 15 Mar 2024 14:30:00 y"}                 | ${"2024-03-15T14:30:00+00:00[+00:00]"} | ${"military y (lower case) → -0000"}
      ${"Fri, 15 Mar 2024 14:30:00 CEST"}              | ${"2024-03-15T14:30:00+00:00[+00:00]"} | ${"unknown alphabetic zone → -0000"}
      ${"Fri, 15 Mar 2024 14:30:00GMT"}                | ${"2024-03-15T14:30:00+00:00[+00:00]"} | ${"obs-zone needs no FWS"}
      ${"Fri, 15 Mar 2024 14:30:00 J"}                 | ${""}                                  | ${"J is outside the military range"}
    `("$value → '$expected' ($reason)", ({ value, expected }) => {
      expect(parseRfc2822(value)).toBe(expected);
    });
  });

  it.each`
    value                                | reason
    ${"Fri, 15 Mar 2024 14:30:00 -0000"} | ${"-0000: offset unknown"}
    ${"Fri, 15 Mar 2024 14:30:00 +0000"} | ${"+0000: Universal Time"}
  `("returns +00:00 for $value ($reason)", ({ value }: { value: string }) => {
    expect(parseRfc2822(value)).toBe("2024-03-15T14:30:00+00:00[+00:00]");
  });

  it.each`
    value
    ${"not a date"}
    ${""}
    ${"Fri, 15 Mar 2024 14:30:00 J"}
    ${"Fri, 32 Mar 2024 14:30:00 -0400"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 extra"}
    ${"Fri, 15 March 2024 14:30:00 -0400"}
    ${"Fri, 15 Mar 2024 14:30:00 -0460"}
    ${"Fri, 15 Mar 2024 14:30:00 +2400"}
    ${"Fri, 15 Mar 2024 14:30:00"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 (unclosed"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400)"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400\r\n"}
    ${"Fri, 15 Mar 2 14:30:00 -0400"}
    ${"Fri 15 Mar 2024 14:30:00 -0400"}
    ${"Fri, 15 Mar 2024 1:30:00 -0400"}
    ${"Fri, 15 Mar 2024 14:30:00\u0000-0400"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 (\u0000)"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 (\\\\\u0000)"}
  `("returns '' for invalid input $value", ({ value }: { value: string }) => {
    expect(parseRfc2822(value)).toBe("");
  });

  it.each`
    value                                | reason
    ${"Sat, 31 Feb 2024 14:30:00 -0400"} | ${"February has no 31st"}
    ${"Wed, 29 Feb 2023 14:30:00 -0400"} | ${"2023 is not a leap year"}
    ${"Mon, 31 Apr 2024 14:30:00 -0400"} | ${"April has 30 days"}
  `(
    "returns '' for impossible date $value ($reason) instead of clamping",
    ({ value }: { value: string }) => {
      expect(parseRfc2822(value)).toBe("");
    },
  );

  it("round-trips through formatRfc2822", () => {
    const original = "Fri, 15 Mar 2024 14:30:00 -0400";
    expect(formatRfc2822(parseRfc2822(original))).toBe(original);
  });
});
