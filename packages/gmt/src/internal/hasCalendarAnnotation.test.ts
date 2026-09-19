import { hasCalendarAnnotation } from "./hasCalendarAnnotation";

describe("hasCalendarAnnotation", () => {
  it.each`
    value
    ${"5785-01-01[u-ca=hebrew]"}
    ${"2024-10-03[u-ca=hebrew]"}
    ${"2024-02-10T12:00:00-05:00[America/New_York][u-ca=hebrew]"}
    ${"2024-02-10T12:00:00Z[u-ca=hebrew]"}
  `(
    "returns true for annotated value $value",
    ({ value }: { value: string }) => {
      expect(hasCalendarAnnotation(value)).toBe(true);
    },
  );

  // The calendar-aware zoned grammar (RFC 9557) and the non-RFC shapes GMT used to write
  // are all detected as annotated, so the `zoned/` functions outside the calendar grammar keep
  // rejecting them.
  it.each`
    value                                                                | shape
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]"}        | ${"RFC 9557 zoned calendar grammar"}
    ${"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"}        | ${"pre-1.16.0 shape, annotation before time zone"}
    ${"0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]"} | ${"pre-1.16.0 shape with an era suffix"}
  `("returns true for the $shape: $value", ({ value }: { value: string }) => {
    expect(hasCalendarAnnotation(value)).toBe(true);
  });

  it.each`
    value
    ${"2024-10-03"}
    ${"2024-02-10T12:00:00-05:00[America/New_York]"}
    ${"2024-02-10T12:00:00Z"}
    ${""}
  `(
    "returns false for a non-annotated value $value",
    ({ value }: { value: string }) => {
      expect(hasCalendarAnnotation(value)).toBe(false);
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
  `("returns false for non-string input $value", ({ value }) => {
    expect(hasCalendarAnnotation(value as unknown as string)).toBe(false);
  });

  // RFC 9557 §3.1 lets any suffix annotation carry a critical flag, `[!key=value]`. Temporal honours
  // it for the calendar key: `Temporal.ZonedDateTime.from("5784-01-01T00:00:00+00:00[UTC][!u-ca=hebrew]")`
  // succeeds with calendarId "hebrew", reading ISO year 5784 as Hebrew year 9544. The flag changes
  // how strictly a parser must honour the annotation, not whether it is one.
  it.each`
    value                                                           | shape
    ${"2024-02-10T12:00:00Z[!u-ca=hebrew]"}                         | ${"an instant with a critical calendar"}
    ${"2024-02-10T12:00:00-05:00[America/New_York][!u-ca=hebrew]"}  | ${"RFC 9557 zoned ordering with a critical calendar"}
    ${"2024-02-10T12:00:00-05:00[!America/New_York][!u-ca=hebrew]"} | ${"a critical zone and a critical calendar"}
    ${"2024-10-03[!u-ca=hebrew]"}                                   | ${"a date with a critical calendar"}
  `("returns true for $shape: $value", ({ value }: { value: string }) => {
    expect(hasCalendarAnnotation(value)).toBe(true);
  });

  // A critical time-zone annotation carries no key, so it is not a calendar annotation.
  it.each`
    value
    ${"2024-02-10T12:00:00-05:00[!America/New_York]"}
    ${"2024-02-10T12:00:00Z[!UTC]"}
  `(
    "returns false for a critical time-zone annotation without a calendar: $value",
    ({ value }: { value: string }) => {
      expect(hasCalendarAnnotation(value)).toBe(false);
    },
  );
});
