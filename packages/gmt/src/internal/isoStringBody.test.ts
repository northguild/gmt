import { hasInstantShape, hasZonedDateTimeShape } from "./isoStringBody";

// Strict-shape rule (see coding-standards): GMT's string input is ISO 8601 extended format before the first `[`.
// Temporal's grammar reads every `false` row below; the shape gate is what rejects them.
describe("hasZonedDateTimeShape", () => {
  it.each`
    value                                                  | expected | reason
    ${"2024-10-03T14:30:00-04:00[America/New_York]"}       | ${true}  | ${"extended offset"}
    ${"2024-10-03T14:30:00.123456789Z[UTC]"}               | ${true}  | ${"Z with nanoseconds"}
    ${"2024-10-03T14:30[America/New_York]"}                | ${true}  | ${"no seconds, no offset"}
    ${"1969-12-31T23:15:30-00:44:30[Africa/Monrovia]"}     | ${true}  | ${"offset with seconds"}
    ${"-271821-04-19T20:00:00-04:56:02[America/New_York]"} | ${true}  | ${"signed six-digit year"}
    ${"2024-10-03T14:30:00-04:00"}                         | ${true}  | ${"no annotation: the shape alone"}
    ${"20241003T143000-0400[America/New_York]"}            | ${false} | ${"basic format"}
    ${"2024-10-03 14:30:00-04:00[America/New_York]"}       | ${false} | ${"space separator"}
    ${"2024-10-03t14:30:00-04:00[America/New_York]"}       | ${false} | ${"lower-case t"}
    ${"2024-10-03T18:30:00z[America/New_York]"}            | ${false} | ${"lower-case z"}
    ${"2024-10-03T14:30:00-04[America/New_York]"}          | ${false} | ${"hour-only offset"}
    ${"2024-10-03T14:30:00+24:00[America/New_York]"}       | ${false} | ${"offset hour 24"}
    ${"2024-10-03T14[America/New_York]"}                   | ${false} | ${"hour-only time"}
    ${"2024-10-03[America/New_York]"}                      | ${false} | ${"date without a time"}
    ${""}                                                  | ${false} | ${"empty string"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(hasZonedDateTimeShape(value)).toBe(expected);
  });
});

describe("hasInstantShape", () => {
  it.each`
    value                                   | expected | reason
    ${"2024-10-03T18:30:00Z"}               | ${true}  | ${"Z designator"}
    ${"2024-10-03T14:30:00-04:00[foo=bar]"} | ${true}  | ${"offset, annotation after"}
    ${"2024-10-03T14:30:00,5-04:00:00.5"}   | ${true}  | ${"comma fraction, fractional offset"}
    ${"2024-10-03T14:30:00"}                | ${false} | ${"no designator"}
    ${"2024-10-03T14:30:00[UTC]"}           | ${false} | ${"zone annotation but no designator"}
    ${"2024-10-03T18:30:00z"}               | ${false} | ${"lower-case z"}
    ${"20241003T183000Z"}                   | ${false} | ${"basic format"}
    ${"2024-10-03 18:30:00Z"}               | ${false} | ${"space separator"}
    ${"2024-10-03T14:30:00-0400"}           | ${false} | ${"basic offset"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(hasInstantShape(value)).toBe(expected);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${{}}
  `("returns false for non-string $value", ({ value }) => {
    expect(hasInstantShape(value as never)).toBe(false);
    expect(hasZonedDateTimeShape(value as never)).toBe(false);
  });
});
