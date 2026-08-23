import { isValidCalendarDate } from "./isValidCalendarDate";

describe("isValidCalendarDate", () => {
  it.each`
    value
    ${"2024-02-29"}
    ${"2024-10-03"}
    ${"5785-01-01[u-ca=hebrew]"}
    ${"5784-06-01[u-ca=hebrew]"}
    ${"1446-03-29[u-ca=islamic-civil]"}
    ${"1446-03-30[u-ca=islamic-tabular]"}
    ${"1446-03-30[u-ca=islamic-umalqura]"}
    ${"0006-10-03[u-ca=japanese;era=reiwa]"}
    ${"2567-10-03[u-ca=buddhist]"}
    ${"0113-10-03[u-ca=taiwan]"}
    ${"1403-07-12[u-ca=persian]"}
    ${"1946-07-11[u-ca=indian]"}
  `(
    "returns true for valid calendar date: $value",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2024-02-30"}
    ${"5783-14-01[u-ca=hebrew]"}
    ${"2024-10-03[u-ca=martian]"}
    ${"not-a-date"}
    ${""}
    ${"0006-10-03[u-ca=japanese;era=unknown-era]"}
  `(
    "returns false for invalid calendar date: $value",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(false);
    },
  );

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
  `(
    "returns false for non-string input: $value",
    ({ value }: { value: unknown }) => {
      expect(isValidCalendarDate(value as string)).toBe(false);
    },
  );
});
