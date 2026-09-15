import { addDate } from "./addDate";

// islamic-umalqura is table-driven (Umm al-Qura, AH 1300-1600), so it has no arithmetic to derive
// from: every value here is Chromium 153.0.8010.12 native Temporal, recorded in one launch of the Playwright
// Chromium that scripts/temporal-compat.mjs oracle uses (PlainDate#withCalendar reads, fields → ISO,
// add/subtract and until). GMT strings are year-month-day of the recorded read (era ah). Never GMT
// output, never the polyfill.

// CORE-6 §4.4 modern grid for islamic-umalqura: 2023-06-01 + i days, i in {0, 61, 91, 122, 245, 274}.
describe("addDate inside the Umm al-Qura table (CORE-6 §4.4 grid)", () => {
  it.each`
    value                                  | units            | overflow       | expected                               | source
    ${"1445-01-14[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"constrain"} | ${"1445-02-14[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=61"}
    ${"1445-01-14[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"reject"}    | ${"1445-02-14[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=61"}
    ${"1445-01-14[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"constrain"} | ${"1446-01-14[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=61"}
    ${"1445-02-15[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"constrain"} | ${"1445-03-15[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=91"}
    ${"1445-02-15[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"reject"}    | ${"1445-03-15[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=91"}
    ${"1445-02-15[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"constrain"} | ${"1446-02-15[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=91"}
    ${"1445-03-16[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"constrain"} | ${"1445-04-16[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=122"}
    ${"1445-03-16[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"reject"}    | ${"1445-04-16[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=122"}
    ${"1445-03-16[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"constrain"} | ${"1446-03-16[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=122"}
    ${"1445-07-20[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"constrain"} | ${"1445-08-20[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=245"}
    ${"1445-07-20[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"reject"}    | ${"1445-08-20[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=245"}
    ${"1445-07-20[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"constrain"} | ${"1446-07-20[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=245"}
    ${"1445-08-20[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"constrain"} | ${"1445-09-20[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=274"}
    ${"1445-08-20[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"reject"}    | ${"1445-09-20[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=274"}
    ${"1445-08-20[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"constrain"} | ${"1446-08-20[u-ca=islamic-umalqura]"} | ${"grid islamic-umalqura i=274"}
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
    ${"1367-03-24[u-ca=islamic-umalqura]"} | ${{ months: 1 }} | ${"1367-04-24[u-ca=islamic-umalqura]"} | ${"stride islamic-umalqura k=1000 (ISO 1948-02-05)"}
    ${"1367-03-24[u-ca=islamic-umalqura]"} | ${{ years: 1 }}  | ${"1368-03-24[u-ca=islamic-umalqura]"} | ${"stride islamic-umalqura k=1000 (ISO 1948-02-05)"}
  `(
    "adds $units to $value as $expected ($source)",
    ({ value, units, expected }) => {
      expect(addDate(value, units)).toBe(expected);
    },
  );
});
