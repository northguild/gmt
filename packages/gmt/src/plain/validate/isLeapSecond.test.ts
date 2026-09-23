import { isLeapSecond } from "./isLeapSecond";

describe("isLeapSecond", () => {
  it.each`
    value
    ${"2024-12-31T23:59:60Z"}
    ${"2024-12-31T23:59:60.123Z"}
    ${"2024-12-31T23:59:60+00:00"}
    ${"2024-12-31T23:59:60.123+00:00"}
    ${"2024-12-31t23:59:60Z"}
    ${"2024-12-31 23:59:60Z"}
    ${"2024-12-31T235960Z"}
    ${"20241231T235960+00:00[UTC]"}
  `("returns true for valid leap second datetime $value", ({ value }) => {
    expect(isLeapSecond(value)).toBe(true);
  });

  // Temporal parses a second of 60 without any designator too, and clamps it (native Chromium 153:
  // PlainDateTime.from("2016-12-31T23:59:60") is 2016-12-31T23:59:59, PlainTime.from("23:59:60"),
  // "T23:59:60", "235960", "23:59:60+01:00" and "23:59:60[u-ca=iso8601]" are 23:59:59), so each is
  // a second-60 field whether or not an annotation follows it.
  it.each`
    value                                  | spelling
    ${"2016-12-31T23:59:60"}               | ${"bare date-time"}
    ${"2016-12-31T23:59:60.123"}           | ${"bare date-time with a fraction"}
    ${"2016-12-31 23:59:60"}               | ${"bare date-time, space separator"}
    ${"20161231T235960"}                   | ${"bare basic date-time"}
    ${"23:59:60"}                          | ${"bare time"}
    ${"23:59:60.5"}                        | ${"bare time with a fraction"}
    ${"T23:59:60"}                         | ${"time with a T designator"}
    ${"t235960"}                           | ${"basic time with a t designator"}
    ${"235960"}                            | ${"basic time"}
    ${"23:59:60+01:00"}                    | ${"time with an offset"}
    ${"23:59:60[u-ca=iso8601]"}            | ${"time with an annotation"}
    ${"2016-12-31T23:59:60[u-ca=iso8601]"} | ${"date-time with an annotation"}
  `("returns true for $value ($spelling)", ({ value }) => {
    expect(isLeapSecond(value)).toBe(true);
  });

  it.each`
    value
    ${"2024-12-31T23:59:59Z"}
    ${"2024-12-31T23:59:61Z"}
    ${"2024-12-31T23:59:61"}
    ${"23:59:59"}
    ${"23:59"}
    ${"2024-12-31"}
    ${"2024-01-01T00:00:00Z[x=T123460Z]"}
    ${"23:59:59[x=T123460]"}
  `("returns false for non-leap second datetime $value", ({ value }) => {
    expect(isLeapSecond(value)).toBe(false);
  });
});
