import { splitIsoInterval } from "./isoInterval";

describe("splitIsoInterval", () => {
  // UN/ECE Recommendation 7 ¶14: the beginning and the end of a period, "separated by a
  // solidus". Each expected pair is the text either side of the one solidus that is outside an
  // RFC 9557 bracket.
  it.each`
    value                                                                 | expected
    ${"2024-06-15/2024-06-20"}                                            | ${["2024-06-15", "2024-06-20"]}
    ${"2024-06-15T14:30/2024-06-20T16:00"}                                | ${["2024-06-15T14:30", "2024-06-20T16:00"]}
    ${"2024-06-15/2024-06-20T16:00"}                                      | ${["2024-06-15", "2024-06-20T16:00"]}
    ${"09:00/17:00"}                                                      | ${["09:00", "17:00"]}
    ${"22:00/06:00"}                                                      | ${["22:00", "06:00"]}
    ${"2024-06-15T14:30:00Z/2024-06-20T16:00:00+02:00"}                   | ${["2024-06-15T14:30:00Z", "2024-06-20T16:00:00+02:00"]}
    ${"2024-06-15T14:30+01:00[Europe/London]/2024-06-20T16:00"}           | ${["2024-06-15T14:30+01:00[Europe/London]", "2024-06-20T16:00"]}
    ${"2024-06-15T14:30/2024-06-20T16:00-04:00[America/New_York]"}        | ${["2024-06-15T14:30", "2024-06-20T16:00-04:00[America/New_York]"]}
    ${"2024-06-15[Europe/London][u-ca=iso8601]/2024-06-20[Asia/Kolkata]"} | ${["2024-06-15[Europe/London][u-ca=iso8601]", "2024-06-20[Asia/Kolkata]"]}
    ${"P5D/2024-06-20"}                                                   | ${["P5D", "2024-06-20"]}
    ${"a/b"}                                                              | ${["a", "b"]}
  `("splits $value into $expected", ({ value, expected }) => {
    expect(splitIsoInterval(value)).toEqual(expected);
  });

  it.each`
    value                                    | reads
    ${"2024-06-15"}                          | ${"one value: no solidus"}
    ${"2024-06-15T14:30[Europe/London]"}     | ${"one value: its only solidus is inside a bracket"}
    ${"2024-06-15/2024-06-20/2024-06-25"}    | ${"three halves"}
    ${"/2024-06-20"}                         | ${"an empty start"}
    ${"2024-06-15/"}                         | ${"an empty end"}
    ${"/"}                                   | ${"two empty halves"}
    ${""}                                    | ${"an empty string"}
    ${"2024-06-15[Europe/London/2024-06-20"} | ${"an unclosed bracket"}
    ${"2024-06-15]/2024-06-20"}              | ${"a stray closing bracket"}
    ${"2024-06-15--2024-06-20"}              | ${"a double hyphen, not a solidus"}
  `("returns null for $value ($reads)", ({ value }) => {
    expect(splitIsoInterval(value)).toBeNull();
  });

  it.each`
    input        | description
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${20240615}  | ${"number"}
    ${true}      | ${"boolean"}
    ${[]}        | ${"array"}
    ${{}}        | ${"object"}
  `("returns null when the value is $description", ({ input }) => {
    expect(splitIsoInterval(input as never)).toBeNull();
  });
});
