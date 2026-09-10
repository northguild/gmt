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
    ${"2024-03-10 12:00:00Z"}                        | ${"20240310T130000Z"}        | ${"space separator and basic format"}
    ${"-271821-04-20T00:00:00Z"}                     | ${"+275760-09-13T00:00:00Z"} | ${"the full representable range"}
  `("returns true for $start to $end ($reason)", ({ start, end }) => {
    expect(isValidSpan(start, end)).toBe(true);
  });

  it.each`
    start                                       | end                                        | reason
    ${"invalid"}                                | ${"2024-03-10T12:00:00Z"}                  | ${"unparseable start"}
    ${"2024-03-10T12:00:00Z"}                   | ${"invalid"}                               | ${"unparseable end"}
    ${"2024-03-10T12:00:00"}                    | ${"2024-03-11T12:00:00"}                   | ${"no offset designator"}
    ${"2024-03-10T12:00:00[America/New_York]"}  | ${"2024-03-11T12:00:00[America/New_York]"} | ${"bracketed zone but no offset designator"}
    ${"2024-03-10"}                             | ${"2024-03-11"}                            | ${"date-only"}
    ${"2016-12-31T23:59:60Z"}                   | ${"2017-01-01T00:00:00Z"}                  | ${"leap second"}
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"} | ${"2024-03-11T12:00:00-04:00"}             | ${"calendar annotation"}
    ${"+275760-09-13T00:00:00.001Z"}            | ${"2024-03-10T12:00:00Z"}                  | ${"past the representable range"}
    ${""}                                       | ${"2024-03-10T12:00:00Z"}                  | ${"empty string"}
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
});
