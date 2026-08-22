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

  it("does not cross-validate the leading day-of-week against the computed date", () => {
    // 2024-03-15 is actually a Friday; "Mon" is accepted anyway (same
    // deliberate scope limit as parseDateTimeWithPattern's EEEE/EEE tokens).
    expect(parseRfc2822("Mon, 15 Mar 2024 14:30:00 -0400")).toBe(
      "2024-03-15T14:30:00-04:00[-04:00]",
    );
  });

  it.each`
    value
    ${"not a date"}
    ${""}
    ${"Fri, 15 Mar 2024 14:30:00 J"}
    ${"Fri, 32 Mar 2024 14:30:00 -0400"}
    ${"Fri, 15 Mar 2024 14:30:00 -0400 extra"}
    ${"Fri, 15 March 2024 14:30:00 -0400"}
  `("returns '' for invalid input $value", ({ value }: { value: string }) => {
    expect(parseRfc2822(value)).toBe("");
  });

  it("round-trips through formatRfc2822", () => {
    const original = "Fri, 15 Mar 2024 14:30:00 -0400";
    expect(formatRfc2822(parseRfc2822(original))).toBe(original);
  });
});
