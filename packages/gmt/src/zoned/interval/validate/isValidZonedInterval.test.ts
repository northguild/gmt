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

  // E5 (issue #78), decision of record D2 — see isValidZonedDateTime.test.ts for the full
  // rationale.
  it.each`
    start                                            | end
    ${"2024-01-01T10:00:00+00:00[UTC][u-ca=hebrew]"} | ${"2024-12-31T23:59:59+00:00[UTC]"}
    ${"2024-01-01T10:00:00+00:00[UTC]"}              | ${"2024-12-31T23:59:59+00:00[UTC][u-ca=hebrew]"}
  `(
    "returns false when either endpoint carries a calendar annotation: $start, $end",
    ({ start, end }: { start: string; end: string }) => {
      expect(isValidZonedInterval(start, end)).toBe(false);
    },
  );
});
