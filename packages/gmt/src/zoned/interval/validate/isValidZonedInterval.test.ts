import { sameInstantBattleCases } from "../../../test";
import { isValidZonedInterval } from "./isValidZonedInterval";

describe("isValidZonedInterval", () => {
  it.each`
    start                                            | end                                              | expected
    ${"2024-01-01T10:00:00+00:00[UTC]"}              | ${"2024-12-31T23:59:59+00:00[UTC]"}              | ${true}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${true}
  `(
    "returns $expected for valid zoned interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidZonedInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                               | end                                 | expected
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${"2024-02-29T12:00:00+00:00[UTC]"} | ${true}
  `(
    "returns $expected for equal zoned instants $start",
    ({ start, end, expected }) => {
      expect(isValidZonedInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                                            | end                                              | expected
    ${"2024-12-31T23:59:59+00:00[UTC]"}              | ${"2024-01-01T10:00:00+00:00[UTC]"}              | ${false}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${false}
  `(
    "returns $expected for reversed zoned interval $start to $end",
    ({ start, end, expected }) => {
      expect(isValidZonedInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                               | end
    ${"invalid"}                        | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${""}                               | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${"not-a-zoned"}                    | ${"2024-02-29T12:00:00+00:00[UTC]"}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${"invalid"}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${""}
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${"not-a-zoned"}
    ${"invalid"}                        | ${"invalid"}
    ${""}                               | ${""}
  `("returns false for malformed zoned: $start, $end", ({ start, end }) => {
    expect(isValidZonedInterval(start, end)).toBe(false);
  });

  it.each`
    start                               | end                                 | expected
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:60+00:00[UTC]"} | ${false}
  `(
    "returns $expected for leap-second input: $start vs $end",
    ({ start, end, expected }) => {
      expect(isValidZonedInterval(start, end)).toBe(expected);
    },
  );

  it.each`
    start                               | end
    ${null}                             | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${undefined}                        | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${123}                              | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${true}                             | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${[]}                               | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${{}}                               | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${null}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${undefined}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${123}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${true}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${[]}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${{}}
  `("returns false for non-string input: $start, $end", ({ start, end }) => {
    expect(isValidZonedInterval(start as never, end as never)).toBe(false);
  });

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`accepts same-instant zoned interval for ${timeZone}`, () => {
      expect(isValidZonedInterval(value, value)).toBe(true);
    });
  }

  // Validator mirror (#22): an endpoint accepts exactly what isValidZonedDateTime accepts.
  // Temporal.ZonedDateTime.from ignores an elective annotation and names the calendar from `u-ca`
  // (native Chromium 153: `…[UTC][u-ca=iso8601]` and `…[UTC][foo=bar]` are iso8601, `…[!foo=bar]`
  // throws); GMT's zoned values are ISO, so a non-ISO calendar is isValidCalendarZonedInterval's input.
  it.each`
    start                                             | end                                                | reason
    ${"2024-01-01T10:00:00+00:00[UTC][u-ca=iso8601]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}                | ${"ISO calendar annotation"}
    ${"2024-01-01T10:00:00+00:00[UTC]"}               | ${"2024-12-31T23:59:59+00:00[UTC][!u-ca=iso8601]"} | ${"critical ISO calendar annotation"}
    ${"2024-01-01T10:00:00+00:00[UTC][foo=bar]"}      | ${"2024-12-31T23:59:59+00:00[UTC]"}                | ${"elective unknown annotation"}
  `(
    "returns true for $start to $end ($reason)",
    ({ start, end }: { start: string; end: string }) => {
      expect(isValidZonedInterval(start, end)).toBe(true);
    },
  );

  it.each`
    start                                             | end                                              | reason
    ${"2024-01-01T10:00:00+00:00[UTC][u-ca=hebrew]"}  | ${"2024-12-31T23:59:59+00:00[UTC]"}              | ${"non-ISO calendar"}
    ${"2024-01-01T10:00:00+00:00[UTC]"}               | ${"2024-12-31T23:59:59+00:00[UTC][u-ca=hebrew]"} | ${"non-ISO calendar"}
    ${"2024-01-01T10:00:00+00:00[UTC][!u-ca=hebrew]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}              | ${"critical non-ISO calendar"}
    ${"2024-01-01T10:00:00+00:00[UTC][!foo=bar]"}     | ${"2024-12-31T23:59:59+00:00[UTC]"}              | ${"unknown critical annotation"}
    ${"2024-12-31T23:59:59+00:00[UTC][u-ca=iso8601]"} | ${"2024-01-01T10:00:00+00:00[UTC][foo=bar]"}     | ${"annotated, but inverted"}
  `(
    "returns false for $start to $end ($reason)",
    ({ start, end }: { start: string; end: string }) => {
      expect(isValidZonedInterval(start, end)).toBe(false);
    },
  );
});

describe("isValidZonedInterval at the maximum instant", () => {
  it.each`
    start                                               | end                                                   | expected
    ${"+275760-09-13T09:00:00+10:00[Australia/Sydney]"} | ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"}   | ${true}
    ${"+275760-09-13T10:00:00+10:00[Australia/Sydney]"} | ${"+275760-09-13T14:00:00+14:00[Pacific/Kiritimati]"} | ${true}
  `("returns $expected for $start to $end", ({ start, end, expected }) => {
    expect(isValidZonedInterval(start, end)).toBe(expected);
  });
});
