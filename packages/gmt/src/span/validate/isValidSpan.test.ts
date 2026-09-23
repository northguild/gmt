import { sameInstantBattleCases } from "../../test";
import { spanMs } from "../calculate/spanMs";
import { spanNs } from "../calculate/spanNs";
import { spanWallClock } from "../calculate/spanWallClock";
import { isValidSpan } from "./isValidSpan";

describe("isValidSpan", () => {
  it.each`
    start                                            | end                          | reason
    ${"2024-03-10T12:00:00Z"}                        | ${"2024-03-10T12:00:01Z"}    | ${"a one-second span"}
    ${"2024-03-10T12:00:00Z"}                        | ${"2024-03-10T12:00:00Z"}    | ${"a zero span is a span"}
    ${"2024-03-10T12:00:01Z"}                        | ${"2024-03-10T12:00:00Z"}    | ${"reversed — spans are signed, not invalid"}
    ${"2024-03-10T07:00:00-05:00[America/New_York]"} | ${"2024-03-10T12:00:00Z"}    | ${"mixed zone and offset forms"}
    ${"-271821-04-20T00:00:00Z"}                     | ${"+275760-09-13T00:00:00Z"} | ${"the full representable range"}
  `("returns true for $start to $end ($reason)", ({ start, end }) => {
    expect(isValidSpan(start, end)).toBe(true);
  });

  // A bracketed zone annotation is syntactic only: Temporal.Instant.from ignores it, and the
  // offset alone fixes the instant (test262 Temporal/Instant/from/
  // argument-string-time-zone-annotation.js). A zone that does not exist, or one whose offset
  // contradicts the string's, is not checked. 12:00+05:00 is 07:00Z; 12:00-04:00 is 16:00Z.
  it.each`
    start                                            | end                                  | reason
    ${"2024-03-10T12:00:00+05:00[America/New_York]"} | ${"2024-03-10T12:00:00Z[Not/AZone]"} | ${"contradicting offset, then a zone that does not exist"}
    ${"2024-03-10T12:00:00Z[+05:00]"}                | ${"2024-03-10T13:00:00Z"}            | ${"numeric zone annotation"}
  `(
    "returns true for $start to $end, whose annotations are not checked ($reason)",
    ({ start, end }) => {
      expect(isValidSpan(start, end)).toBe(true);
    },
  );

  it.each`
    start                                      | end                                        | reason
    ${"invalid"}                               | ${"2024-03-10T12:00:00Z"}                  | ${"unparseable start"}
    ${"2024-03-10T12:00:00Z"}                  | ${"invalid"}                               | ${"unparseable end"}
    ${"2024-03-10T12:00:00"}                   | ${"2024-03-11T12:00:00"}                   | ${"no offset designator"}
    ${"2024-03-10T12:00:00[America/New_York]"} | ${"2024-03-11T12:00:00[America/New_York]"} | ${"bracketed zone but no offset designator"}
    ${"2024-03-10"}                            | ${"2024-03-11"}                            | ${"date-only"}
    ${"2016-12-31T23:59:60Z"}                  | ${"2017-01-01T00:00:00Z"}                  | ${"leap second"}
    ${"+275760-09-13T00:00:00.001Z"}           | ${"2024-03-10T12:00:00Z"}                  | ${"past the representable range"}
    ${""}                                      | ${"2024-03-10T12:00:00Z"}                  | ${"empty string"}
    ${"2024-03-10 12:00:00Z"}                  | ${"2024-03-10T13:00:00Z"}                  | ${"space separator (strict extended shape)"}
    ${"2024-03-10T12:00:00Z"}                  | ${"20240310T130000Z"}                      | ${"basic format (strict extended shape)"}
  `("returns false for $start to $end ($reason)", ({ start, end }) => {
    expect(isValidSpan(start, end)).toBe(false);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${1710072000123456789n}
    ${true}
    ${[]}
    ${{}}
  `("returns false when $value is non-string input", ({ value }) => {
    expect(
      isValidSpan(value as unknown as string, "2024-03-10T12:00:00Z"),
    ).toBe(false);
    expect(
      isValidSpan("2024-03-10T12:00:00Z", value as unknown as string),
    ).toBe(false);
  });

  it.each`
    start                     | end
    ${"2024-03-10T12:00:00Z"} | ${"2024-09-01T08:17:03Z"}
    ${"2024-09-01T08:17:03Z"} | ${"2024-03-10T12:00:00Z"}
    ${"invalid"}              | ${"2024-03-10T12:00:00Z"}
  `("is symmetric for $start and $end", ({ start, end }) => {
    expect(isValidSpan(start, end)).toBe(isValidSpan(end, start));
  });

  it.each(sameInstantBattleCases)(
    "returns true against the same instant expressed in $timeZone",
    ({ value }) => {
      expect(isValidSpan("2024-02-29T00:00:00Z", value)).toBe(true);
    },
  );

  it.each`
    start                                      | end                                        | valid
    ${"2024-03-10T12:00:00Z"}                  | ${"2024-03-10T12:00:01Z"}                  | ${true}
    ${"2024-03-10T12:00:00Z"}                  | ${"invalid"}                               | ${false}
    ${"2024-03-10T12:00:00[America/New_York]"} | ${"2024-03-11T12:00:00[America/New_York]"} | ${false}
    ${"2016-12-31T23:59:60Z"}                  | ${"2017-01-01T00:00:00Z"}                  | ${false}
  `(
    "agrees with spanNs returning a value for $start to $end",
    ({ start, end, valid }) => {
      expect(isValidSpan(start, end)).toBe(valid);
      expect(spanNs(start, end) !== null).toBe(valid);
    },
  );

  it("is true for a pair whose span is too wide for spanMs — a result limit, not an input one", () => {
    const start = "-271821-04-20T00:00:00Z";
    const end = "+275760-09-13T00:00:00Z";

    expect(isValidSpan(start, end)).toBe(true);
    expect(spanMs(start, end)).toBeNull();
    expect(spanNs(start, end)).toBe(17280000000000000000000n);
  });

  it("does not describe spanWallClock, which requires a bracketed zone", () => {
    const start = "2024-03-10T02:30:00[America/New_York]";
    const end = "2024-03-11T02:30:00[America/New_York]";

    // No offset designator, so these are not instants — but they are valid wall clocks.
    expect(isValidSpan(start, end)).toBe(false);
    expect(spanWallClock(start, end, "hours")).toBe(24);
  });

  // Temporal.Instant.from reads RFC 9557 annotations and ignores a time zone, calendar or elective
  // annotation (an instant has no calendar; proposal-temporal `ParseTemporalInstantString`), and
  // rejects an unknown critical one. Native Temporal (Chromium 153) agrees.
  it.each`
    start                                       | end                                 | expected
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"} | ${"2024-03-11T12:00:00-04:00"}      | ${true}
    ${"2024-03-10T12:00:00Z"}                   | ${"2024-03-11T12:00:00Z[foo=bar]"}  | ${true}
    ${"2024-03-10T12:00:00Z"}                   | ${"2024-03-11T12:00:00Z[!foo=bar]"} | ${false}
  `(
    "reads the annotations of $start and $end as Temporal does → $expected",
    ({ start, end, expected }) => {
      expect(isValidSpan(start, end)).toBe(expected);
    },
  );
});
