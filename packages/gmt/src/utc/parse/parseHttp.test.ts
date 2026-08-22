import { formatHttp } from "../format/formatHttp";
import { parseHttp } from "./parseHttp";

describe("parseHttp", () => {
  it.each`
    value                              | expected
    ${"Fri, 15 Mar 2024 14:30:00 GMT"} | ${"2024-03-15T14:30:00Z"}
    ${"Fri, 05 Jan 2024 09:00:00 GMT"} | ${"2024-01-05T09:00:00Z"}
    ${"Tue, 05 Mar 2024 09:00:05 GMT"} | ${"2024-03-05T09:00:05Z"}
  `(
    "parses $value to $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseHttp(value)).toBe(expected);
    },
  );

  it("does not cross-validate the day-of-week against the computed date", () => {
    // 2024-03-15 is actually a Friday; "Mon" is accepted anyway (same
    // deliberate scope limit as parseDateTimeWithPattern's EEEE/EEE tokens).
    expect(parseHttp("Mon, 15 Mar 2024 14:30:00 GMT")).toBe(
      "2024-03-15T14:30:00Z",
    );
  });

  it.each`
    value
    ${"not a date"}
    ${""}
    ${"Fri, 15 Mar 2024 14:30:00 -0400"}
    ${"Friday, 15-Mar-24 14:30:00 GMT"}
    ${"Fri Mar 15 14:30:00 2024"}
    ${"Fri, 32 Mar 2024 14:30:00 GMT"}
    ${"Fri, 15 Mar 2024 14:30 GMT"}
  `("returns '' for invalid input $value", ({ value }: { value: string }) => {
    expect(parseHttp(value)).toBe("");
  });

  it("round-trips through formatHttp", () => {
    const original = "Fri, 15 Mar 2024 14:30:00 GMT";
    expect(formatHttp(parseHttp(original))).toBe(original);
  });
});
