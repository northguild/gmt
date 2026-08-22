import { formatRfc3339 } from "../format/formatRfc3339";
import { parseRfc3339 } from "./parseRfc3339";

describe("parseRfc3339", () => {
  it.each`
    value                          | expected
    ${"2024-03-15T14:30:00-04:00"} | ${"2024-03-15T14:30:00-04:00[-04:00]"}
    ${"2024-03-15T14:30:00Z"}      | ${"2024-03-15T14:30:00+00:00[+00:00]"}
    ${"2024-03-15t14:30:00z"}      | ${"2024-03-15T14:30:00+00:00[+00:00]"}
    ${"2024-03-15 14:30:00Z"}      | ${"2024-03-15T14:30:00+00:00[+00:00]"}
    ${"2024-03-15T14:30:00.5Z"}    | ${"2024-03-15T14:30:00.5+00:00[+00:00]"}
    ${"2024-07-01T00:00:00+13:00"} | ${"2024-07-01T00:00:00+13:00[+13:00]"}
    ${"2024-07-01T00:00:00-11:00"} | ${"2024-07-01T00:00:00-11:00[-11:00]"}
  `(
    "parses $value to $expected",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(parseRfc3339(value)).toBe(expected);
    },
  );

  it.each`
    value
    ${"not a date"}
    ${""}
    ${"2024-03-15T14:30:00"}
    ${"2024-03-15T14:30:00+00:00[UTC]"}
    ${"2024-03-15T14:30:00-0400"}
    ${"2024-03-15T14:30:60Z"}
  `("returns '' for invalid input $value", ({ value }: { value: string }) => {
    expect(parseRfc3339(value)).toBe("");
  });

  it("round-trips through formatRfc3339", () => {
    const original = "2024-03-15T14:30:00-04:00";
    expect(formatRfc3339(parseRfc3339(original))).toBe(original);
  });
});
