import { subtractDate } from "./subtractDate";

// islamic-umalqura is table-driven (Umm al-Qura, AH 1300-1600), so it has no arithmetic to derive
// from: every value here is Chromium 153.0.8010.12 native Temporal, recorded in one launch of the Playwright
// Chromium that scripts/temporal-compat.mjs oracle uses (PlainDate#withCalendar reads, fields → ISO,
// add/subtract and until). GMT strings are year-month-day of the recorded read (era ah). Never GMT
// output, never the polyfill.

// CORE-6 §4.4 modern grid for islamic-umalqura: 2023-06-01 + i days, i in {0, 61, 91, 122, 245, 274}.
describe("subtractDate inside the Umm al-Qura table (CORE-6 §4.4 grid)", () => {
  it.each`
    value                                  | units             | expected                               | source
    ${"1444-11-12[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"1443-10-12[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=0"}
    ${"1445-01-14[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"1443-12-14[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=61"}
    ${"1445-02-15[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"1444-01-15[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=91"}
    ${"1445-03-16[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"1444-02-16[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=122"}
    ${"1445-07-20[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"1444-06-20[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=245"}
    ${"1445-08-20[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"1444-07-20[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=274"}
  `(
    "subtracts $units from $value as $expected ($source)",
    ({ value, units, expected }) => {
      expect(subtractDate(value, units)).toBe(expected);
    },
  );
});
