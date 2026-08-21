import { compareDurations } from "./compareDurations";

describe("compareDurations", () => {
  it.each`
    a          | b          | expected
    ${"PT1H"}  | ${"PT30M"} | ${1}
    ${"PT30M"} | ${"PT1H"}  | ${-1}
    ${"P2D"}   | ${"P1D"}   | ${1}
    ${"P1D"}   | ${"PT23H"} | ${1}
    ${"PT23H"} | ${"P1D"}   | ${-1}
  `("returns $expected comparing $a to $b", ({ a, b, expected }) => {
    expect(compareDurations(a, b)).toBe(expected);
  });

  // Equality is by length, not spelling — the same span written two ways compares 0.
  it.each`
    a           | b             | expected
    ${"PT60M"}  | ${"PT1H"}     | ${0}
    ${"PT1H"}   | ${"PT60M"}    | ${0}
    ${"P1D"}    | ${"PT24H"}    | ${0}
    ${"PT1.5S"} | ${"PT1.500S"} | ${0}
    ${"PT0S"}   | ${"PT0S"}     | ${0}
    ${"PT0S"}   | ${"-PT0S"}    | ${0}
    ${"P0D"}    | ${"PT0S"}     | ${0}
  `(
    "returns $expected for the equal-length pair $a and $b",
    ({ a, b, expected }) => {
      expect(compareDurations(a, b)).toBe(expected);
    },
  );

  it.each`
    a           | b           | expected
    ${"-PT1H"}  | ${"PT1H"}   | ${-1}
    ${"PT1H"}   | ${"-PT1H"}  | ${1}
    ${"-PT1H"}  | ${"-PT30M"} | ${-1}
    ${"-PT30M"} | ${"-PT1H"}  | ${1}
    ${"-PT1H"}  | ${"PT0S"}   | ${-1}
    ${"PT0S"}   | ${"-PT1H"}  | ${1}
  `("returns $expected comparing negative $a to $b", ({ a, b, expected }) => {
    expect(compareDurations(a, b)).toBe(expected);
  });

  it.each`
    a         | b
    ${"P1M"}  | ${"P30D"}
    ${"P30D"} | ${"P1M"}
    ${"P1W"}  | ${"P7D"}
    ${"P1Y"}  | ${"P365D"}
    ${"PT1H"} | ${"P1M"}
    ${"-P1M"} | ${"PT1H"}
  `(
    "returns null comparing $a to $b when a calendar unit is present and relativeTo is absent",
    ({ a, b }) => {
      expect(compareDurations(a, b)).toBeNull();
    },
  );

  // The anchor does not merely unblock the comparison, it decides it: a month is longer
  // than 30 days from January (31) and shorter from February 2024 (29).
  it.each`
    a        | b          | relativeTo      | expected
    ${"P1M"} | ${"P30D"}  | ${"2024-01-01"} | ${1}
    ${"P1M"} | ${"P30D"}  | ${"2024-02-01"} | ${-1}
    ${"P1M"} | ${"P30D"}  | ${"2024-04-01"} | ${0}
    ${"P1Y"} | ${"P365D"} | ${"2024-01-01"} | ${1}
    ${"P1Y"} | ${"P365D"} | ${"2023-01-01"} | ${0}
    ${"P1W"} | ${"P7D"}   | ${"2024-01-01"} | ${0}
    ${"P1Y"} | ${"P12M"}  | ${"2024-01-01"} | ${0}
    ${"P1D"} | ${"P1M"}   | ${"2024-01-01"} | ${-1}
  `(
    "returns $expected comparing $a to $b relativeTo $relativeTo",
    ({ a, b, relativeTo, expected }) => {
      expect(compareDurations(a, b, { relativeTo })).toBe(expected);
    },
  );

  // relativeTo is not calendar-units-only: anchored to a zoned instant it resolves real
  // elapsed time, so "P1D" stops being exactly 24 hours across a DST transition.
  it.each`
    relativeTo                                       | expected | note
    ${"2024-03-10T00:00:00-05:00[America/New_York]"} | ${-1}    | ${"spring-forward, 23h"}
    ${"2024-11-03T00:00:00-04:00[America/New_York]"} | ${1}     | ${"fall-back, 25h"}
    ${"2024-03-31T00:00:00+01:00[Europe/Berlin]"}    | ${-1}    | ${"spring-forward, 23h"}
    ${"2024-10-27T00:00:00+02:00[Europe/Berlin]"}    | ${1}     | ${"fall-back, 25h"}
    ${"2024-06-15T00:00:00-04:00[America/New_York]"} | ${0}     | ${"no transition, 24h"}
  `(
    "returns $expected comparing P1D to PT24H relativeTo $relativeTo ($note)",
    ({ relativeTo, expected }) => {
      expect(compareDurations("P1D", "PT24H", { relativeTo })).toBe(expected);
    },
  );

  it("returns the same result whether relativeTo is omitted or irrelevant to the operands", () => {
    expect(compareDurations("PT1H", "PT30M")).toBe(1);
    expect(compareDurations("PT1H", "PT30M", {})).toBe(1);
    expect(
      compareDurations("PT1H", "PT30M", { relativeTo: "2024-01-01" }),
    ).toBe(1);
  });

  it.each`
    a                   | b
    ${"not a duration"} | ${"PT1H"}
    ${"PT1H"}           | ${"not a duration"}
    ${""}               | ${"PT1H"}
    ${"PT1H"}           | ${""}
    ${"2024-03-10"}     | ${"PT1H"}
    ${null}             | ${"PT1H"}
    ${"PT1H"}           | ${undefined}
    ${123}              | ${"PT1H"}
    ${"PT1H"}           | ${true}
    ${[]}               | ${{}}
  `("returns null when $a or $b is not a valid duration string", ({ a, b }) => {
    expect(compareDurations(a, b)).toBeNull();
  });

  it.each`
    relativeTo
    ${"not a date"}
    ${""}
    ${"2024-13-45"}
    ${123}
    ${true}
    ${[]}
  `("returns null when relativeTo $relativeTo is invalid", ({ relativeTo }) => {
    expect(compareDurations("P1M", "P30D", { relativeTo })).toBeNull();
  });

  it("never throws on invalid input", () => {
    expect(() =>
      compareDurations("not a duration", "P1M", { relativeTo: "not a date" }),
    ).not.toThrow();
  });
});
