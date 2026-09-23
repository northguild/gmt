import { subtractDate } from "./subtractDate";

// islamic-umalqura is table-driven (Umm al-Qura, AH 1300-1600), so it has no arithmetic to derive
// from: every value here is Chromium 153.0.8010.12 native Temporal, recorded in one launch of the Playwright
// Chromium that scripts/temporal-compat.mjs oracle uses (PlainDate#withCalendar reads, fields → ISO,
// add/subtract and until). Strings are RFC 9557, the ISO date plus
// [u-ca=islamic-umalqura], converted from the recorded read by the same Chromium. Never GMT output,
// never the polyfill.

// CORE-6 §4.4 modern grid for islamic-umalqura: 2023-06-01 + i days, i in {0, 61, 91, 122, 245, 274}.
describe("subtractDate inside the Umm al-Qura table (CORE-6 §4.4 grid)", () => {
  it.each`
    value                                  | units             | expected                               | source
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"2022-05-13[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=0"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"2022-07-13[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=61"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"2022-08-13[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=91"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"2022-09-12[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=122"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"2023-01-13[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=245"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${{ months: 13 }} | ${"2023-02-11[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=274"}
  `(
    "subtracts $units from $value as $expected ($source)",
    ({ value, units, expected }) => {
      expect(subtractDate(value, units)).toBe(expected);
    },
  );
});
