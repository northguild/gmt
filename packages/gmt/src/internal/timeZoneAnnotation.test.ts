import { hasTimeZoneAnnotation } from "./timeZoneAnnotation";

// RFC 9557 §4.1: a time zone annotation is the first one, and the only kind with no `=`.
describe("hasTimeZoneAnnotation", () => {
  it.each`
    value                                        | expected | reason
    ${"2024-06-15T10:00:00Z[Europe/London]"}     | ${true}  | ${"a named zone"}
    ${"2024-06-15T10:00:00Z[!Europe/London]"}    | ${true}  | ${"a critical named zone"}
    ${"2024-06-15T10:00:00-04:00[-04:00]"}       | ${true}  | ${"an offset zone"}
    ${"2024-06-15T10Z[UTC][u-ca=iso8601]"}       | ${true}  | ${"a zone, then a calendar"}
    ${"2024-06-15T10:00:00Z[u-ca=gregory]"}      | ${false} | ${"a calendar alone"}
    ${"2024-06-15T10:00:00Z[!foo=bar]"}          | ${false} | ${"a critical tagged annotation"}
    ${"2024-06-15T10:00:00Z[u-ca=iso8601][UTC]"} | ${false} | ${"a zone that is not first"}
    ${"2024-06-15T10:00:00Z"}                    | ${false} | ${"no annotation"}
    ${""}                                        | ${false} | ${"empty string"}
  `("returns $expected for '$value' ($reason)", ({ value, expected }) => {
    expect(hasTimeZoneAnnotation(value)).toBe(expected);
  });
});
