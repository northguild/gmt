import { sameInstantBattleCases } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { Interval } from "../../types";
import { isValidInterval } from "./isValidInterval";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because
// interval endpoints are the scenario under test. NY spellings name the same instants as the Z ones.
describe("isValidInterval", () => {
  it("accepts an Interval-typed record", () => {
    const interval: Interval = {
      start: "2024-01-01T09:00:00Z",
      end: "2024-01-01T17:00:00Z",
    };

    expect(isValidInterval(interval)).toBe(true);
  });

  // D1/D3: an offset is required and start ≤ end by instant. 10:00+01:00 is 09:00Z, so it may end at
  // 09:30Z; Temporal.Instant.from uses the offset and ignores a bracketed zone (TC39), so
  // 10:00+01:00[America/New_York] is 09:00Z too. The range limits are Temporal's ±10^8 days.
  it.each`
    start                                            | end                          | reason
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T17:00:00Z"}    | ${"ascending"}
    ${"2024-01-01T09:00:00Z"}                        | ${"2024-01-01T09:00:00Z"}    | ${"empty"}
    ${"2024-01-01T04:00:00-05:00"}                   | ${"2024-01-01T09:00:00Z"}    | ${"same instant, different spelling"}
    ${"2024-01-01T10:00:00+01:00"}                   | ${"2024-01-01T09:30:00Z"}    | ${"descending as text, ascending as instants"}
    ${"-271821-04-20T00:00:00Z"}                     | ${"+275760-09-13T00:00:00Z"} | ${"full Instant range"}
    ${"2024-01-01T10:00:00+01:00[America/New_York]"} | ${"2024-01-01T09:00:00Z"}    | ${"offset disagrees with zone; Instant.from uses the offset"}
  `(
    "returns true for { start: $start, end: $end } ($reason)",
    ({ start, end }) => {
      expect(isValidInterval({ start, end })).toBe(true);
    },
  );

  it.each(sameInstantBattleCases)(
    "returns true for an empty interval from $value to the same instant in UTC ($timeZone)",
    ({ value, utc }) => {
      expect(isValidInterval({ start: value, end: utc })).toBe(true);
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${"x"}
    ${123}
    ${[]}
  `("returns false when $value is non-object input", ({ value }) => {
    expect(isValidInterval(value as unknown as Interval)).toBe(false);
  });

  it.each`
    value                                                                             | reason
    ${{}}                                                                             | ${"empty record"}
    ${{ start: "2024-01-01T09:00:00Z" }}                                              | ${"missing end"}
    ${{ start: 1, end: "2024-01-01T09:00:00Z" }}                                      | ${"non-string start"}
    ${{ start: "", end: "2024-01-01T17:00:00Z" }}                                     | ${"empty-string start"}
    ${{ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }}                 | ${"inverted"}
    ${{ start: "2024-01-01T09:30:00Z", end: "2024-01-01T10:00:00+01:00" }}            | ${"inverted by instant, ascending as text"}
    ${{ start: "2016-12-31T23:59:60Z", end: "2017-01-01T00:00:00Z" }}                 | ${"leap second"}
    ${{ start: "2024-01-01T09:00:00Z[u-ca=iso8601]", end: "2024-01-01T17:00:00Z" }}   | ${"calendar annotation"}
    ${{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z[!u-ca=hebrew]" }}   | ${"critical-flag calendar annotation"}
    ${{ start: "2024-01-01T09:00:00", end: "2024-01-01T17:00:00Z" }}                  | ${"zoneless"}
    ${{ start: "2024-01-01T09:00:00[UTC]", end: "2024-01-01T17:00:00Z" }}             | ${"bracket-only zone"}
    ${{ start: "2024-01-01", end: "2024-01-01T17:00:00Z" }}                           | ${"date only"}
    ${{ start: "-271821-04-20T00:00:00Z", end: "+275760-09-13T00:00:00.000000001Z" }} | ${"past the Instant range"}
  `("returns false when the record is invalid ($reason)", ({ value }) => {
    expect(isValidInterval(value)).toBe(false);
  });

  it("returns false when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(
      isValidInterval({
        start: "2024-01-01T09:00:00Z",
        end: "2024-01-01T17:00:00Z",
      }),
    ).toBe(false);
  });
});
