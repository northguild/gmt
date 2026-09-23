import { sameInstantBattleCases } from "../../test";
import { isValidZonedRange } from "./isValidZonedRange";

describe("isValidZonedRange", () => {
  it.each`
    value1                                           | value2                                           | allowEqual | expected
    ${"2024-01-01T10:00:00+00:00[UTC]"}              | ${"2024-12-31T23:59:59+00:00[UTC]"}              | ${false}   | ${true}
    ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${false}   | ${true}
  `(
    "returns $expected for valid zoned range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidZonedRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1                              | value2                              | allowEqual | expected
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${"2024-02-29T12:00:00+00:00[UTC]"} | ${false}   | ${false}
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${"2024-02-29T12:00:00+00:00[UTC]"} | ${true}    | ${true}
  `(
    "returns $expected for equal zoned values $value1 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidZonedRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1                                           | value2                                           | allowEqual | expected
    ${"2024-12-31T23:59:59+00:00[UTC]"}              | ${"2024-01-01T10:00:00+00:00[UTC]"}              | ${false}   | ${false}
    ${"2024-02-29T12:00:00-05:00[America/New_York]"} | ${"2024-01-01T00:00:00-05:00[America/New_York]"} | ${false}   | ${false}
  `(
    "returns $expected for reversed zoned range $value1 to $value2 (allowEqual=$allowEqual)",
    ({ value1, value2, allowEqual, expected }) => {
      expect(
        isValidZonedRange({ value1, value2, options: { allowEqual } }),
      ).toBe(expected);
    },
  );

  it.each`
    value1                              | value2
    ${"invalid"}                        | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${""}                               | ${"2024-01-01T10:00:00+00:00[UTC]"}
    ${"not-a-zoned"}                    | ${"2024-02-29T12:00:00+00:00[UTC]"}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${"invalid"}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${""}
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${"not-a-zoned"}
    ${"invalid"}                        | ${"invalid"}
    ${""}                               | ${""}
  `(
    "returns false for malformed zoned: $value1, $value2",
    ({ value1, value2 }) => {
      expect(isValidZonedRange({ value1, value2 })).toBe(false);
    },
  );

  it.each`
    value1                              | value2                              | expected
    ${"2024-12-31T23:59:60+00:00[UTC]"} | ${"2025-01-01T00:00:00+00:00[UTC]"} | ${false}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:60+00:00[UTC]"} | ${false}
    ${"2016-12-31t23:59:60+00:00[UTC]"} | ${"2017-01-01T00:00:00+00:00[UTC]"} | ${false}
    ${"2016-12-31 23:59:60+00:00[UTC]"} | ${"2017-01-01T00:00:00+00:00[UTC]"} | ${false}
    ${"2016-12-31T00:00:00+00:00[UTC]"} | ${"2016-12-31T235960+00:00[UTC]"}   | ${false}
    ${"2016-12-31T00:00:00+00:00[UTC]"} | ${"20161231T235960Z[UTC]"}          | ${false}
  `(
    "returns $expected for leap-second input: $value1 vs $value2",
    ({ value1, value2, expected }) => {
      expect(isValidZonedRange({ value1, value2 })).toBe(expected);
    },
  );

  // Temporal.ZonedDateTime.from reads the first `u-ca` annotation (proposal-temporal
  // `ParseISODateTime`). zoned/ is ISO-only, so a non-ISO calendar is rejected (the calendar
  // functions take `isValidCalendarZonedDateTime`), while `[u-ca=iso8601]` names the ISO calendar
  // and an elective annotation is ignored (RFC 9557 §3.3). Native Temporal agrees.
  it.each`
    value1                                            | value2                                                          | expected | reason
    ${"2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]"}  | ${"2024-02-01T00:00:00+00:00[UTC]"}                             | ${false} | ${"non-ISO calendar on value1"}
    ${"2024-01-01T00:00:00+00:00[UTC][!u-ca=hebrew]"} | ${"2024-02-01T00:00:00+00:00[UTC]"}                             | ${false} | ${"critical non-ISO calendar on value1"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}               | ${"2024-02-01T00:00:00+00:00[UTC][u-ca=gregory][u-ca=iso8601]"} | ${false} | ${"first calendar on value2 is gregory"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}               | ${"2024-02-01T00:00:00+00:00[UTC][u-ca=iso8601][u-ca=gregory]"} | ${true}  | ${"first calendar on value2 is iso8601"}
    ${"2024-01-01T00:00:00+00:00[UTC]"}               | ${"2024-02-01T00:00:00+00:00[UTC][u-ca=iso8601]"}               | ${true}  | ${"iso8601 calendar on value2"}
    ${"2024-01-01T00:00:00+00:00[UTC][foo=bar]"}      | ${"2024-02-01T00:00:00+00:00[UTC]"}                             | ${true}  | ${"elective annotation on value1"}
    ${"2024-01-01T00:00:00+00:00[UTC][!foo=bar]"}     | ${"2024-02-01T00:00:00+00:00[UTC]"}                             | ${false} | ${"unknown critical annotation on value1"}
  `(
    "returns $expected when an endpoint carries annotations: $value1, $value2 ($reason)",
    ({ value1, value2, expected }) => {
      expect(isValidZonedRange({ value1, value2 })).toBe(expected);
    },
  );

  it.each`
    value1                              | value2
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
  `(
    "returns false for non-string input: $value1, $value2",
    ({ value1, value2 }) => {
      expect(
        isValidZonedRange({ value1: value1 as never, value2: value2 as never }),
      ).toBe(false);
    },
  );

  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`accepts same-instant zoned datetime in ${timeZone} with allowEqual=true`, () => {
      expect(
        isValidZonedRange({
          value1: value,
          value2: value,
          options: { allowEqual: true },
        }),
      ).toBe(true);
    });
  }
});

// The strict-shape rule (see coding-standards), applied to zoned strings: each endpoint must have GMT's strict ISO 8601
// extended shape before its first `[`, as `isValidZonedDateTime` requires. Polyfill 0.5.1 reads
// every lenient spelling below as a valid ZonedDateTime earlier than `value2`.
describe("isValidZonedRange requires GMT's strict extended shape", () => {
  it.each`
    value1                              | value2                              | reason
    ${"20240101T100000+0000[UTC]"}      | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"basic format in value1"}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${"2024-12-31 23:59:59+00:00[UTC]"} | ${"space separator in value2"}
    ${"2024-01-01t10:00:00+00:00[UTC]"} | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"lower-case t in value1"}
    ${"2024-01-01T10:00:00z[UTC]"}      | ${"2024-12-31T23:59:59+00:00[UTC]"} | ${"lower-case z in value1"}
    ${"2024-01-01T10:00:00+00:00[UTC]"} | ${"2024-12-31[UTC]"}                | ${"date without a time in value2"}
  `("returns false for $value1 → $value2 ($reason)", ({ value1, value2 }) => {
    expect(isValidZonedRange({ value1, value2 })).toBe(false);
  });
});
