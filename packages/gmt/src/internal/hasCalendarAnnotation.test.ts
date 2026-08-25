import { hasCalendarAnnotation } from "./hasCalendarAnnotation";

describe("hasCalendarAnnotation", () => {
  it.each`
    value
    ${"5785-01-01[u-ca=hebrew]"}
    ${"2024-10-03[u-ca=hebrew]"}
    ${"2024-02-10T12:00:00-05:00[America/New_York][u-ca=hebrew]"}
    ${"2024-02-10T12:00:00Z[u-ca=hebrew]"}
  `("returns true for annotated value $value", ({ value }: { value: string }) => {
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
});
