import { addDate } from "./addDate";

// islamic-umalqura is table-driven (Umm al-Qura, AH 1300-1600), so it has no arithmetic to derive
// from: every value here is Chromium 153.0.8010.12 native Temporal, recorded in one launch of the Playwright
// Chromium that scripts/temporal-compat.mjs oracle uses (PlainDate#withCalendar reads, fields → ISO,
// add/subtract and until). Strings are RFC 9557, the ISO date plus
// [u-ca=islamic-umalqura], converted from the recorded read by the same Chromium. Never GMT output,
// never the polyfill.

// CORE-6 §4.4 modern grid for islamic-umalqura: 2023-06-01 + i days, i in {0, 61, 91, 122, 245, 274}.
describe("addDate inside the Umm al-Qura table (CORE-6 §4.4 grid)", () => {
  it.each`
    value                                  | units            | overflow       | expected                               | source
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"constrain"} | ${"2023-08-30[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=61"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"reject"}    | ${"2023-08-30[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=61"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"constrain"} | ${"2024-07-20[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=61"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-30[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=91"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"reject"}    | ${"2023-09-30[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=91"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-19[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=91"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"constrain"} | ${"2023-10-31[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=122"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"reject"}    | ${"2023-10-31[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=122"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"constrain"} | ${"2024-09-19[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=122"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=245"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=245"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"constrain"} | ${"2025-01-20[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=245"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-30[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=274"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-30[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=274"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"constrain"} | ${"2025-02-19[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=274"}
  `(
    "adds $units to $value with overflow $overflow as $expected ($source)",
    ({ value, units, overflow, expected }) => {
      expect(addDate(value, units, { overflow })).toBe(expected);
    },
  );
});

describe("addDate inside the Umm al-Qura table (CORE-6 §4.4 stride k=1000)", () => {
  it.each`
    value                                  | units            | expected                               | source
    ${"1948-02-05[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"1948-03-05[u-ca=islamic-umalqura]"} | ${"stride islamic-umalqura k=1000 (ISO 1948-02-05)"}
    ${"1948-02-05[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"1949-01-24[u-ca=islamic-umalqura]"} | ${"stride islamic-umalqura k=1000 (ISO 1948-02-05)"}
  `(
    "adds $units to $value as $expected ($source)",
    ({ value, units, expected }) => {
      expect(addDate(value, units)).toBe(expected);
    },
  );
});
