import { spanMs } from "./spanMs";
import { spanSeconds } from "./spanSeconds";

const valid = "2027-06-15T12:00:00Z";

describe("spanSeconds", () => {
  it.each`
    start                                        | end                                          | expected          | reason
    ${"2027-06-15T12:00:00Z"}                    | ${"2027-06-15T12:01:30Z"}                    | ${90}             | ${"90 s forward"}
    ${"2027-06-15T12:01:30Z"}                    | ${"2027-06-15T12:00:00Z"}                    | ${-90}            | ${"start after end is negative"}
    ${"2027-06-15T12:00:00Z"}                    | ${"2027-06-15T12:00:00.500Z"}                | ${0.5}            | ${"half a second stays fractional"}
    ${"2027-06-15T12:00:00.500Z"}                | ${"2027-06-15T12:00:00Z"}                    | ${-0.5}           | ${"negative half second"}
    ${"2027-06-15T12:00:00Z"}                    | ${"2027-06-15T12:00:00.100Z"}                | ${0.1}            | ${"100 ms is 0.1 s"}
    ${"2027-06-15T12:00:00Z"}                    | ${"2027-06-15T12:00:00.000000001Z"}          | ${1e-9}           | ${"one nanosecond"}
    ${"2027-06-15T12:00:00+02:00"}               | ${"2027-06-15T10:00:00Z"}                    | ${0}              | ${"same instant, different offset"}
    ${"2026-03-28T12:00:00+01:00[Europe/Paris]"} | ${"2026-03-29T12:00:00+02:00[Europe/Paris]"} | ${82800}          | ${"DST day is 23 h elapsed"}
    ${"-271821-04-20T00:00:00Z"}                 | ${"+275760-09-13T00:00:00Z"}                 | ${17280000000000} | ${"widest span"}
  `(
    "returns $expected seconds from $start to $end ($reason)",
    ({ start, end, expected }) => {
      expect(spanSeconds(start, end)).toBe(expected);
    },
  );

  it("returns +0 for equal instants, not -0", () => {
    expect(spanSeconds(valid, valid)).toBe(0);
  });

  it.each`
    start                    | end      | label
    ${""}                    | ${valid} | ${"empty start"}
    ${valid}                 | ${""}    | ${"empty end"}
    ${"2027-06-15"}          | ${valid} | ${"date only"}
    ${"2027-06-15T12:00:00"} | ${valid} | ${"no offset"}
    ${null}                  | ${valid} | ${"null start"}
    ${undefined}             | ${valid} | ${"undefined start"}
    ${1813060800}            | ${valid} | ${"number start"}
    ${"soon"}                | ${valid} | ${"words"}
  `("returns null for $label", ({ start, end }) => {
    expect(spanSeconds(start, end)).toBeNull();
  });

  it.each`
    start                          | end
    ${"2027-06-15T12:00:00Z"}      | ${"2027-06-15T12:01:30Z"}
    ${"2027-06-15T12:00:00Z"}      | ${"2027-06-15T12:00:00.500Z"}
    ${"2027-06-15T12:00:00Z"}      | ${"2027-06-15T12:00:00.100Z"}
    ${"2027-06-15T12:00:00+02:00"} | ${"2027-06-15T13:30:00Z"}
  `("negates when swapped, from $start to $end", ({ start, end }) => {
    expect(spanSeconds(end, start)).toBe(-(spanSeconds(start, end) as number));
  });

  it.each`
    start                     | end
    ${"2027-06-15T12:00:00Z"} | ${"2027-06-15T12:01:30Z"}
    ${"2027-06-15T12:00:00Z"} | ${"2027-06-15T12:00:00.123Z"}
    ${"2027-06-15T12:00:00Z"} | ${"2027-06-15T12:00:00.000000001Z"}
  `("is spanMs over 1000 from $start to $end", ({ start, end }) => {
    expect(spanSeconds(start, end)! * 1000).toBeCloseTo(spanMs(start, end)!, 6);
  });
});
