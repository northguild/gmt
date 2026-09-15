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
    ${"2017-01-23[u-ca=ethiopic;era=ethiopic]"}
    ${"7517-01-23[u-ca=ethiopic-amete-alem]"}
    ${"1741-01-23[u-ca=coptic]"}
  `(
    "returns true for valid calendar date: $value",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(true);
    },
  );

  // The last representable day in each calendar: ISO +275760-09-13, the TC39 PlainDate maximum.
  // Values: test262 intl402/Temporal/PlainDate/from/extreme-dates.js (ordinal months); the
  // window rows are Chromium 152 reads a few days inside the limit.
  it.each`
    value                                         | source
    ${"279517-10-11[u-ca=hebrew]"}                | ${"test262 max"}
    ${"279517-10-06[u-ca=hebrew]"}                | ${"Chromium 152, max - 5 d"}
    ${"279517-06-09[u-ca=hebrew]"}                | ${"Chromium 152, max - 120 d (M05L)"}
    ${"276303-09-13[u-ca=buddhist]"}              | ${"test262 max"}
    ${"276303-08-13[u-ca=buddhist]"}              | ${"Chromium 152, max - 31 d"}
    ${"283583-05-23[u-ca=islamic-civil]"}         | ${"test262 max"}
    ${"283583-05-15[u-ca=islamic-civil]"}         | ${"Chromium 152, max - 8 d"}
    ${"283583-05-24[u-ca=islamic-tabular]"}       | ${"test262 max"}
    ${"283583-05-23[u-ca=islamic-umalqura]"}      | ${"test262 max"}
    ${"275139-07-12[u-ca=persian]"}               | ${"test262 max"}
    ${"275682-06-22[u-ca=indian]"}                | ${"test262 max"}
    ${"273742-09-13[u-ca=japanese;era=reiwa]"}    | ${"test262 max"}
    ${"273849-09-13[u-ca=taiwan]"}                | ${"test262 max (roc)"}
    ${"281247-05-22[u-ca=ethiopic-amete-alem]"}   | ${"test262 max (ethioaa)"}
    ${"275471-05-22[u-ca=coptic]"}                | ${"test262 max"}
    ${"275747-05-22[u-ca=ethiopic;era=ethiopic]"} | ${"test262 max"}
  `(
    "returns true for the range-limit calendar date $value ($source)",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(true);
    },
  );

  // One day past the maximum is outside ISODateWithinLimits: the fallback must not clamp.
  it.each`
    value
    ${"279517-10-12[u-ca=hebrew]"}
    ${"283583-05-24[u-ca=islamic-civil]"}
    ${"276303-09-14[u-ca=buddhist]"}
  `(
    "returns false for $value, one day past the maximum",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(false);
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
    ${"0000-01-01[u-ca=ethiopic;era=unknown-era]"}
    ${"0501-06-15[u-ca=japanese;era=japanese-inverse]"}
    ${"-000000-01-01[u-ca=taiwan]"}
    ${"-0911-01-01[u-ca=taiwan]"}
    ${"-096239-13-01[u-ca=hebrew]"}
  `(
    "returns false for invalid calendar date: $value",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(false);
    },
  );

  // test262 intl402/Temporal/PlainDate/from/extreme-dates.js: the Umm al-Qura table's first and last
  // non-approximated dates, 1300-M01-01 and 1500-M12-30 (era "ah"), read back unchanged.
  it.each`
    value
    ${"1300-01-01[u-ca=islamic-umalqura]"}
    ${"1500-12-30[u-ca=islamic-umalqura]"}
  `(
    "returns true for the non-approximated Umm al-Qura date $value (test262)",
    ({ value }: { value: string }) => {
      expect(isValidCalendarDate(value)).toBe(true);
    },
  );

  // CORE-6 spec §8 risk 4: a failed parse can fall back to the field search. A sanity bound, not a
  // benchmark. Every string is invalid by construction: Tishri (month 1) always has 30 days, no
  // Hebrew year has a 14th month, and 279517-11..13 lie past the maximum 279517-10-11 (test262).
  it("rejects 1000 invalid hebrew strings within a generous time bound", () => {
    const values = Array.from({ length: 1000 }, (_, i) => {
      const pad = (n: number, width: number) => String(n).padStart(width, "0");
      switch (i % 4) {
        case 0:
          return `${pad(5000 + i, 4)}-01-31[u-ca=hebrew]`;
        case 1:
          return `-${pad(100 + i, 6)}-01-31[u-ca=hebrew]`;
        case 2:
          return `279517-${pad(11 + (i % 3), 2)}-${pad(1 + (i % 29), 2)}[u-ca=hebrew]`;
        default:
          return `${pad(3000 + i, 4)}-14-01[u-ca=hebrew]`;
      }
    });
    const started = performance.now();
    const accepted = values.filter((value) => isValidCalendarDate(value));
    const elapsed = performance.now() - started;

    expect(accepted).toEqual([]);
    expect(elapsed).toBeLessThan(5000);
  });

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
