import { normalizeDateTime } from "./normalizeDateTime";

describe("normalizeDateTime", () => {
  it.each`
    input                                                              | expected
    ${"  hello  "}                                                     | ${"hello"}
    ${"\uFEFFhello\uFEFF"}                                             | ${"hello"}
    ${"GMT\u200E+2\u200F"}                                             | ${"GMT+2"}
    ${"10:00\u2009AM\u2013\u200912:00\u2009PM"}                        | ${"10:00 AM - 12:00 PM"}
    ${"2/29/2024, 10:00:00\u00A0AM\u2009\u2013\u200912:00:00\u00A0PM"} | ${"2/29/2024, 10:00:00 AM - 12:00:00 PM"}
    ${"A\u00A0\u202FB"}                                                | ${"A B"}
    ${"1\u20132"}                                                      | ${"1-2"}
    ${"1\u20442"}                                                      | ${"1/2"}
    ${"A\t \u00A0B"}                                                   | ${"A B"}
  `("normalizes $input -> $expected", ({ input, expected }) => {
    expect(normalizeDateTime(input)).toBe(expected);
  });

  it("applies lowercase when requested", () => {
    expect(normalizeDateTime("Hello WORLD", { lower: true })).toBe(
      "hello world",
    );
  });

  it.each`
    input
    ${null}
    ${undefined}
    ${123}
    ${{}}
    ${[]}
    ${true}
  `("returns empty string for non-string input: $input", ({ input }) => {
    expect(normalizeDateTime(input as unknown as string)).toBe("");
  });
});
