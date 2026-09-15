import { sameInstantBattleCases } from "../../test";
import type { Interval } from "../../types";
import { intervalContains } from "./intervalContains";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because
// interval endpoints are the scenario under test. NY spellings name the same instants as Z(09/17).
const A = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };

describe("intervalContains", () => {
  it.each`
    start                        | end                          | isoString                           | expected | reason
    ${"2024-01-01T09:00:00Z"}    | ${"2024-01-01T17:00:00Z"}    | ${"2024-01-01T12:00:00Z"}           | ${true}  | ${"inside"}
    ${"2024-01-01T09:00:00Z"}    | ${"2024-01-01T17:00:00Z"}    | ${"2024-01-01T09:00:00Z"}           | ${true}  | ${"start is inside"}
    ${"2024-01-01T09:00:00Z"}    | ${"2024-01-01T17:00:00Z"}    | ${"2024-01-01T17:00:00Z"}           | ${false} | ${"end is not"}
    ${"2024-01-01T09:00:00Z"}    | ${"2024-01-01T17:00:00Z"}    | ${"2024-01-01T08:59:59.999999999Z"} | ${false} | ${"1 ns before start"}
    ${"2024-01-01T09:00:00Z"}    | ${"2024-01-01T17:00:00Z"}    | ${"2024-01-01T16:59:59.999999999Z"} | ${true}  | ${"1 ns before end"}
    ${"2024-01-01T09:00:00Z"}    | ${"2024-01-01T17:00:00Z"}    | ${"2024-01-01T04:00:00-05:00"}      | ${true}  | ${"start, different spelling"}
    ${"2024-01-01T09:00:00Z"}    | ${"2024-01-01T17:00:00Z"}    | ${"2024-01-01T12:00:00-05:00"}      | ${false} | ${"end, different spelling"}
    ${"2024-01-01T12:00:00Z"}    | ${"2024-01-01T12:00:00Z"}    | ${"2024-01-01T12:00:00Z"}           | ${false} | ${"empty interval"}
    ${"-271821-04-20T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"} | ${"-271821-04-20T00:00:00Z"}        | ${true}  | ${"full range, earliest instant"}
    ${"-271821-04-20T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"}        | ${false} | ${"full range, latest instant"}
  `(
    "returns $expected for $isoString in [$start, $end) ($reason)",
    ({ start, end, isoString, expected }) => {
      expect(intervalContains({ start, end }, isoString)).toBe(expected);
    },
  );

  it.each(sameInstantBattleCases)(
    "returns true for $utc in [$value, 2024-02-29T01:00:00Z) and false in the empty [$utc, $value) ($timeZone)",
    ({ value, utc }) => {
      expect(
        intervalContains({ start: value, end: "2024-02-29T01:00:00Z" }, utc),
      ).toBe(true);
      expect(intervalContains({ start: utc, end: value }, utc)).toBe(false);
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${"x"}
    ${123}
    ${[]}
  `("returns false when interval $value is non-object input", ({ value }) => {
    expect(
      intervalContains(value as unknown as Interval, "2024-01-01T12:00:00Z"),
    ).toBe(false);
  });

  it.each`
    bad                                                                               | reason
    ${{}}                                                                             | ${"empty record"}
    ${{ start: "2024-01-01T09:00:00Z" }}                                              | ${"missing end"}
    ${{ start: 1, end: "2024-01-01T09:00:00Z" }}                                      | ${"non-string start"}
    ${{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }}                 | ${"inverted"}
    ${{ start: "2024-01-01T09:30:00Z", end: "2024-01-01T10:00:00+01:00" }}            | ${"inverted by instant, ascending as text"}
    ${{ start: "2016-12-31T23:59:60Z", end: "2017-01-01T00:00:00Z" }}                 | ${"leap second"}
    ${{ start: "2024-01-01T09:00:00Z[u-ca=iso8601]", end: "2024-01-01T17:00:00Z" }}   | ${"calendar annotation"}
    ${{ start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00Z" }}                  | ${"zoneless"}
    ${{ start: "2024-01-01T09:00:00[UTC]", end: "2024-01-01T17:00:00Z" }}             | ${"bracket-only zone"}
    ${{ start: "2024-01-01", end: "2024-01-01T17:00:00Z" }}                           | ${"date only"}
    ${{ start: "-271821-04-20T00:00:00Z", end: "+275760-09-13T00:00:00.000000001Z" }} | ${"past the Instant range"}
  `("returns false when the interval is invalid ($reason)", ({ bad }) => {
    expect(intervalContains(bad, "2024-01-01T12:00:00Z")).toBe(false);
  });

  it.each`
    isoString                               | reason
    ${123}                                  | ${"non-string"}
    ${"2024-01-01T12:00:00"}                | ${"zoneless"}
    ${"2016-12-31T23:59:60Z"}               | ${"leap second"}
    ${"2024-01-01T12:00:00Z[u-ca=iso8601]"} | ${"calendar annotation"}
    ${"2024-01-01T12:00:00Z[!u-ca=hebrew]"} | ${"critical-flag calendar annotation"}
  `(
    "returns false when isoString $isoString is not an instant ($reason)",
    ({ isoString }) => {
      expect(intervalContains(A, isoString)).toBe(false);
    },
  );
});
