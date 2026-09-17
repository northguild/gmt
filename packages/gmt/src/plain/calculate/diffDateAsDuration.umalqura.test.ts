import { diffDateAsDuration } from "./diffDateAsDuration";

// islamic-umalqura is table-driven (Umm al-Qura, AH 1300-1600), so it has no arithmetic to derive
// from: every value here is Chromium 153.0.8010.12 native Temporal, recorded in one launch of the Playwright
// Chromium that scripts/temporal-compat.mjs oracle uses (PlainDate#withCalendar reads, fields → ISO,
// add/subtract and until). Strings are RFC 9557, the ISO date plus
// [u-ca=islamic-umalqura], converted from the recorded read by the same Chromium. Never GMT output,
// never the polyfill.

// CORE-6 §4.4 modern grid for islamic-umalqura: from 2023-06-01 + i days, i in {0, 61, 91, 122, 245,
// 274}, to k days later (and back, in years), k in {28, 29, 30, 31, 58, 59, 60, 61, 354, 355, 365,
// 366, 383, 384, 385}. Month-end starts exercise D6 (NonISODateSurpasses).
describe("diffDateAsDuration inside the Umm al-Qura table (CORE-6 §4.4 grid)", () => {
  it.each`
    date1                                  | date2                                  | unit        | expected      | source
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-06-29[u-ca=islamic-umalqura]"} | ${"months"} | ${"P28D"}     | ${"grid islamic-umalqura i=0 +28 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-06-29[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P28D"}     | ${"grid islamic-umalqura i=0 +28 d"}
    ${"2023-06-29[u-ca=islamic-umalqura]"} | ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P28D"}    | ${"grid islamic-umalqura i=0 -28 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-07-02[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M2D"}    | ${"grid islamic-umalqura i=0 +31 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-07-02[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M2D"}    | ${"grid islamic-umalqura i=0 +31 d"}
    ${"2023-07-02[u-ca=islamic-umalqura]"} | ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M2D"}   | ${"grid islamic-umalqura i=0 -31 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-07-29[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M29D"}   | ${"grid islamic-umalqura i=0 +58 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-07-29[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M29D"}   | ${"grid islamic-umalqura i=0 +58 d"}
    ${"2023-07-29[u-ca=islamic-umalqura]"} | ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M28D"}  | ${"grid islamic-umalqura i=0 -58 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-07-31[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M1D"}    | ${"grid islamic-umalqura i=0 +60 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-07-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M1D"}    | ${"grid islamic-umalqura i=0 +60 d"}
    ${"2023-07-31[u-ca=islamic-umalqura]"} | ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M1D"}   | ${"grid islamic-umalqura i=0 -60 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M2D"}    | ${"grid islamic-umalqura i=0 +61 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M2D"}    | ${"grid islamic-umalqura i=0 +61 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M2D"}   | ${"grid islamic-umalqura i=0 -61 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-05-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M"}     | ${"grid islamic-umalqura i=0 +354 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-05-20[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y"}      | ${"grid islamic-umalqura i=0 +354 d"}
    ${"2024-05-20[u-ca=islamic-umalqura]"} | ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y"}     | ${"grid islamic-umalqura i=0 -354 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-05-21[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M1D"}   | ${"grid islamic-umalqura i=0 +355 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-05-21[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1D"}    | ${"grid islamic-umalqura i=0 +355 d"}
    ${"2024-05-21[u-ca=islamic-umalqura]"} | ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1D"}   | ${"grid islamic-umalqura i=0 -355 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-05-31[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M11D"}  | ${"grid islamic-umalqura i=0 +365 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-05-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y11D"}   | ${"grid islamic-umalqura i=0 +365 d"}
    ${"2024-05-31[u-ca=islamic-umalqura]"} | ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y11D"}  | ${"grid islamic-umalqura i=0 -365 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-06-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M12D"}  | ${"grid islamic-umalqura i=0 +366 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y12D"}   | ${"grid islamic-umalqura i=0 +366 d"}
    ${"2024-06-01[u-ca=islamic-umalqura]"} | ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y12D"}  | ${"grid islamic-umalqura i=0 -366 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-06-18[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M"}     | ${"grid islamic-umalqura i=0 +383 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-06-18[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-umalqura i=0 +383 d"}
    ${"2024-06-18[u-ca=islamic-umalqura]"} | ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M"}   | ${"grid islamic-umalqura i=0 -383 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-06-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M2D"}   | ${"grid islamic-umalqura i=0 +385 d"}
    ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"2024-06-20[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M2D"}  | ${"grid islamic-umalqura i=0 +385 d"}
    ${"2024-06-20[u-ca=islamic-umalqura]"} | ${"2023-06-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M2D"} | ${"grid islamic-umalqura i=0 -385 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-08-29[u-ca=islamic-umalqura]"} | ${"months"} | ${"P28D"}     | ${"grid islamic-umalqura i=61 +28 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-08-29[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P28D"}     | ${"grid islamic-umalqura i=61 +28 d"}
    ${"2023-08-29[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P28D"}    | ${"grid islamic-umalqura i=61 -28 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-08-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M"}      | ${"grid islamic-umalqura i=61 +29 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-08-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M"}      | ${"grid islamic-umalqura i=61 +29 d"}
    ${"2023-08-30[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M"}     | ${"grid islamic-umalqura i=61 -29 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M1D"}    | ${"grid islamic-umalqura i=61 +30 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-umalqura i=61 +30 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M1D"}   | ${"grid islamic-umalqura i=61 -30 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-09-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M2D"}    | ${"grid islamic-umalqura i=61 +31 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-09-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M2D"}    | ${"grid islamic-umalqura i=61 +31 d"}
    ${"2023-09-01[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M2D"}   | ${"grid islamic-umalqura i=61 -31 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-09-28[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M29D"}   | ${"grid islamic-umalqura i=61 +58 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-09-28[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M29D"}   | ${"grid islamic-umalqura i=61 +58 d"}
    ${"2023-09-28[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M28D"}  | ${"grid islamic-umalqura i=61 -58 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-09-29[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M"}      | ${"grid islamic-umalqura i=61 +59 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-09-29[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M"}      | ${"grid islamic-umalqura i=61 +59 d"}
    ${"2023-09-29[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M"}     | ${"grid islamic-umalqura i=61 -59 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-09-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M1D"}    | ${"grid islamic-umalqura i=61 +60 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-09-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M1D"}    | ${"grid islamic-umalqura i=61 +60 d"}
    ${"2023-09-30[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M1D"}   | ${"grid islamic-umalqura i=61 -60 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M2D"}    | ${"grid islamic-umalqura i=61 +61 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M2D"}    | ${"grid islamic-umalqura i=61 +61 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M2D"}   | ${"grid islamic-umalqura i=61 -61 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-07-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M"}     | ${"grid islamic-umalqura i=61 +354 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-07-20[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y"}      | ${"grid islamic-umalqura i=61 +354 d"}
    ${"2024-07-20[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y"}     | ${"grid islamic-umalqura i=61 -354 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-07-21[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M1D"}   | ${"grid islamic-umalqura i=61 +355 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-07-21[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1D"}    | ${"grid islamic-umalqura i=61 +355 d"}
    ${"2024-07-21[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1D"}   | ${"grid islamic-umalqura i=61 -355 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-07-31[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M11D"}  | ${"grid islamic-umalqura i=61 +365 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-07-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y11D"}   | ${"grid islamic-umalqura i=61 +365 d"}
    ${"2024-07-31[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y11D"}  | ${"grid islamic-umalqura i=61 -365 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-08-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M12D"}  | ${"grid islamic-umalqura i=61 +366 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y12D"}   | ${"grid islamic-umalqura i=61 +366 d"}
    ${"2024-08-01[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y12D"}  | ${"grid islamic-umalqura i=61 -366 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-08-18[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M"}     | ${"grid islamic-umalqura i=61 +383 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-08-18[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-umalqura i=61 +383 d"}
    ${"2024-08-18[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M"}   | ${"grid islamic-umalqura i=61 -383 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-08-19[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M1D"}   | ${"grid islamic-umalqura i=61 +384 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-08-19[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M1D"}  | ${"grid islamic-umalqura i=61 +384 d"}
    ${"2024-08-19[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M1D"} | ${"grid islamic-umalqura i=61 -384 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-08-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M2D"}   | ${"grid islamic-umalqura i=61 +385 d"}
    ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"2024-08-20[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M2D"}  | ${"grid islamic-umalqura i=61 +385 d"}
    ${"2024-08-20[u-ca=islamic-umalqura]"} | ${"2023-08-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M2D"} | ${"grid islamic-umalqura i=61 -385 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-09-28[u-ca=islamic-umalqura]"} | ${"months"} | ${"P28D"}     | ${"grid islamic-umalqura i=91 +28 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-09-28[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P28D"}     | ${"grid islamic-umalqura i=91 +28 d"}
    ${"2023-09-28[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P28D"}    | ${"grid islamic-umalqura i=91 -28 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-09-29[u-ca=islamic-umalqura]"} | ${"months"} | ${"P29D"}     | ${"grid islamic-umalqura i=91 +29 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-09-29[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P29D"}     | ${"grid islamic-umalqura i=91 +29 d"}
    ${"2023-09-29[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P29D"}    | ${"grid islamic-umalqura i=91 -29 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-09-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M"}      | ${"grid islamic-umalqura i=91 +30 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-09-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M"}      | ${"grid islamic-umalqura i=91 +30 d"}
    ${"2023-09-30[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M"}     | ${"grid islamic-umalqura i=91 -30 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M1D"}    | ${"grid islamic-umalqura i=91 +31 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-umalqura i=91 +31 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M1D"}   | ${"grid islamic-umalqura i=91 -31 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-10-28[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M28D"}   | ${"grid islamic-umalqura i=91 +58 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-10-28[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M28D"}   | ${"grid islamic-umalqura i=91 +58 d"}
    ${"2023-10-28[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M28D"}  | ${"grid islamic-umalqura i=91 -58 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-10-29[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M29D"}   | ${"grid islamic-umalqura i=91 +59 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-10-29[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M29D"}   | ${"grid islamic-umalqura i=91 +59 d"}
    ${"2023-10-29[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M29D"}  | ${"grid islamic-umalqura i=91 -59 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-10-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M"}      | ${"grid islamic-umalqura i=91 +60 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-10-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M"}      | ${"grid islamic-umalqura i=91 +60 d"}
    ${"2023-10-30[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M"}     | ${"grid islamic-umalqura i=91 -60 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-10-31[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M1D"}    | ${"grid islamic-umalqura i=91 +61 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2023-10-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M1D"}    | ${"grid islamic-umalqura i=91 +61 d"}
    ${"2023-10-31[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M1D"}   | ${"grid islamic-umalqura i=91 -61 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-08-19[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M"}     | ${"grid islamic-umalqura i=91 +354 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-08-19[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y"}      | ${"grid islamic-umalqura i=91 +354 d"}
    ${"2024-08-19[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y"}     | ${"grid islamic-umalqura i=91 -354 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-08-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M1D"}   | ${"grid islamic-umalqura i=91 +355 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-08-20[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1D"}    | ${"grid islamic-umalqura i=91 +355 d"}
    ${"2024-08-20[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1D"}   | ${"grid islamic-umalqura i=91 -355 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-08-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M11D"}  | ${"grid islamic-umalqura i=91 +365 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-08-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y11D"}   | ${"grid islamic-umalqura i=91 +365 d"}
    ${"2024-08-30[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y11D"}  | ${"grid islamic-umalqura i=91 -365 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-08-31[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M12D"}  | ${"grid islamic-umalqura i=91 +366 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y12D"}   | ${"grid islamic-umalqura i=91 +366 d"}
    ${"2024-08-31[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y12D"}  | ${"grid islamic-umalqura i=91 -366 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-09-17[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M29D"}  | ${"grid islamic-umalqura i=91 +383 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-09-17[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y29D"}   | ${"grid islamic-umalqura i=91 +383 d"}
    ${"2024-09-17[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y29D"}  | ${"grid islamic-umalqura i=91 -383 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-09-18[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M"}     | ${"grid islamic-umalqura i=91 +384 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-09-18[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-umalqura i=91 +384 d"}
    ${"2024-09-18[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M"}   | ${"grid islamic-umalqura i=91 -384 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-09-19[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M1D"}   | ${"grid islamic-umalqura i=91 +385 d"}
    ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"2024-09-19[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M1D"}  | ${"grid islamic-umalqura i=91 +385 d"}
    ${"2024-09-19[u-ca=islamic-umalqura]"} | ${"2023-08-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M1D"} | ${"grid islamic-umalqura i=91 -385 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-10-29[u-ca=islamic-umalqura]"} | ${"months"} | ${"P28D"}     | ${"grid islamic-umalqura i=122 +28 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-10-29[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P28D"}     | ${"grid islamic-umalqura i=122 +28 d"}
    ${"2023-10-29[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P28D"}    | ${"grid islamic-umalqura i=122 -28 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-10-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P29D"}     | ${"grid islamic-umalqura i=122 +29 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-10-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P29D"}     | ${"grid islamic-umalqura i=122 +29 d"}
    ${"2023-10-30[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P29D"}    | ${"grid islamic-umalqura i=122 -29 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-10-31[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M"}      | ${"grid islamic-umalqura i=122 +30 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-10-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M"}      | ${"grid islamic-umalqura i=122 +30 d"}
    ${"2023-10-31[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M"}     | ${"grid islamic-umalqura i=122 -30 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-11-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M1D"}    | ${"grid islamic-umalqura i=122 +31 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-11-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-umalqura i=122 +31 d"}
    ${"2023-11-01[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M1D"}   | ${"grid islamic-umalqura i=122 -31 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-11-28[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M28D"}   | ${"grid islamic-umalqura i=122 +58 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-11-28[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M28D"}   | ${"grid islamic-umalqura i=122 +58 d"}
    ${"2023-11-28[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M28D"}  | ${"grid islamic-umalqura i=122 -58 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-11-29[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M29D"}   | ${"grid islamic-umalqura i=122 +59 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-11-29[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M29D"}   | ${"grid islamic-umalqura i=122 +59 d"}
    ${"2023-11-29[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M29D"}  | ${"grid islamic-umalqura i=122 -59 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-11-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M"}      | ${"grid islamic-umalqura i=122 +60 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-11-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M"}      | ${"grid islamic-umalqura i=122 +60 d"}
    ${"2023-11-30[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M"}     | ${"grid islamic-umalqura i=122 -60 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-12-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M1D"}    | ${"grid islamic-umalqura i=122 +61 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2023-12-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M1D"}    | ${"grid islamic-umalqura i=122 +61 d"}
    ${"2023-12-01[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M1D"}   | ${"grid islamic-umalqura i=122 -61 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-09-19[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M"}     | ${"grid islamic-umalqura i=122 +354 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-09-19[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y"}      | ${"grid islamic-umalqura i=122 +354 d"}
    ${"2024-09-19[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y"}     | ${"grid islamic-umalqura i=122 -354 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-09-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M1D"}   | ${"grid islamic-umalqura i=122 +355 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-09-20[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1D"}    | ${"grid islamic-umalqura i=122 +355 d"}
    ${"2024-09-20[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1D"}   | ${"grid islamic-umalqura i=122 -355 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-09-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M11D"}  | ${"grid islamic-umalqura i=122 +365 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-09-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y11D"}   | ${"grid islamic-umalqura i=122 +365 d"}
    ${"2024-09-30[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y11D"}  | ${"grid islamic-umalqura i=122 -365 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-10-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M12D"}  | ${"grid islamic-umalqura i=122 +366 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y12D"}   | ${"grid islamic-umalqura i=122 +366 d"}
    ${"2024-10-01[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y12D"}  | ${"grid islamic-umalqura i=122 -366 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-10-18[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M29D"}  | ${"grid islamic-umalqura i=122 +383 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-10-18[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y29D"}   | ${"grid islamic-umalqura i=122 +383 d"}
    ${"2024-10-18[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y29D"}  | ${"grid islamic-umalqura i=122 -383 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-10-19[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M"}     | ${"grid islamic-umalqura i=122 +384 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-10-19[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-umalqura i=122 +384 d"}
    ${"2024-10-19[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M"}   | ${"grid islamic-umalqura i=122 -384 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-10-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M1D"}   | ${"grid islamic-umalqura i=122 +385 d"}
    ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"2024-10-20[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M1D"}  | ${"grid islamic-umalqura i=122 +385 d"}
    ${"2024-10-20[u-ca=islamic-umalqura]"} | ${"2023-10-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M1D"} | ${"grid islamic-umalqura i=122 -385 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-02-29[u-ca=islamic-umalqura]"} | ${"months"} | ${"P28D"}     | ${"grid islamic-umalqura i=245 +28 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-02-29[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P28D"}     | ${"grid islamic-umalqura i=245 +28 d"}
    ${"2024-02-29[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P28D"}    | ${"grid islamic-umalqura i=245 -28 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M"}      | ${"grid islamic-umalqura i=245 +29 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M"}      | ${"grid islamic-umalqura i=245 +29 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M"}     | ${"grid islamic-umalqura i=245 -29 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-03-02[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M1D"}    | ${"grid islamic-umalqura i=245 +30 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-03-02[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-umalqura i=245 +30 d"}
    ${"2024-03-02[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M1D"}   | ${"grid islamic-umalqura i=245 -30 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-03-03[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M2D"}    | ${"grid islamic-umalqura i=245 +31 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-03-03[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M2D"}    | ${"grid islamic-umalqura i=245 +31 d"}
    ${"2024-03-03[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M2D"}   | ${"grid islamic-umalqura i=245 -31 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-03-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M"}      | ${"grid islamic-umalqura i=245 +58 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-03-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M"}      | ${"grid islamic-umalqura i=245 +58 d"}
    ${"2024-03-30[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M"}     | ${"grid islamic-umalqura i=245 -58 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-03-31[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M1D"}    | ${"grid islamic-umalqura i=245 +59 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-03-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M1D"}    | ${"grid islamic-umalqura i=245 +59 d"}
    ${"2024-03-31[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M1D"}   | ${"grid islamic-umalqura i=245 -59 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-04-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M2D"}    | ${"grid islamic-umalqura i=245 +60 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-04-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M2D"}    | ${"grid islamic-umalqura i=245 +60 d"}
    ${"2024-04-01[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M2D"}   | ${"grid islamic-umalqura i=245 -60 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-04-02[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M3D"}    | ${"grid islamic-umalqura i=245 +61 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2024-04-02[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M3D"}    | ${"grid islamic-umalqura i=245 +61 d"}
    ${"2024-04-02[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M3D"}   | ${"grid islamic-umalqura i=245 -61 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-01-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M"}     | ${"grid islamic-umalqura i=245 +354 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-01-20[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y"}      | ${"grid islamic-umalqura i=245 +354 d"}
    ${"2025-01-20[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y"}     | ${"grid islamic-umalqura i=245 -354 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-01-21[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M1D"}   | ${"grid islamic-umalqura i=245 +355 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-01-21[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1D"}    | ${"grid islamic-umalqura i=245 +355 d"}
    ${"2025-01-21[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1D"}   | ${"grid islamic-umalqura i=245 -355 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-01-31[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M11D"}  | ${"grid islamic-umalqura i=245 +365 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-01-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y11D"}   | ${"grid islamic-umalqura i=245 +365 d"}
    ${"2025-01-31[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y10D"}  | ${"grid islamic-umalqura i=245 -365 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-02-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M12D"}  | ${"grid islamic-umalqura i=245 +366 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y12D"}   | ${"grid islamic-umalqura i=245 +366 d"}
    ${"2025-02-01[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y11D"}  | ${"grid islamic-umalqura i=245 -366 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-02-18[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M29D"}  | ${"grid islamic-umalqura i=245 +383 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-02-18[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y29D"}   | ${"grid islamic-umalqura i=245 +383 d"}
    ${"2025-02-18[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y28D"}  | ${"grid islamic-umalqura i=245 -383 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-02-19[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M"}     | ${"grid islamic-umalqura i=245 +384 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-02-19[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-umalqura i=245 +384 d"}
    ${"2025-02-19[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M"}   | ${"grid islamic-umalqura i=245 -384 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-02-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M1D"}   | ${"grid islamic-umalqura i=245 +385 d"}
    ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"2025-02-20[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M1D"}  | ${"grid islamic-umalqura i=245 +385 d"}
    ${"2025-02-20[u-ca=islamic-umalqura]"} | ${"2024-02-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M1D"} | ${"grid islamic-umalqura i=245 -385 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-03-29[u-ca=islamic-umalqura]"} | ${"months"} | ${"P28D"}     | ${"grid islamic-umalqura i=274 +28 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-03-29[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P28D"}     | ${"grid islamic-umalqura i=274 +28 d"}
    ${"2024-03-29[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P28D"}    | ${"grid islamic-umalqura i=274 -28 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-03-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M"}      | ${"grid islamic-umalqura i=274 +29 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-03-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M"}      | ${"grid islamic-umalqura i=274 +29 d"}
    ${"2024-03-30[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M"}     | ${"grid islamic-umalqura i=274 -29 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-03-31[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M1D"}    | ${"grid islamic-umalqura i=274 +30 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-03-31[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M1D"}    | ${"grid islamic-umalqura i=274 +30 d"}
    ${"2024-03-31[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M1D"}   | ${"grid islamic-umalqura i=274 -30 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-04-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M2D"}    | ${"grid islamic-umalqura i=274 +31 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-04-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M2D"}    | ${"grid islamic-umalqura i=274 +31 d"}
    ${"2024-04-01[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M2D"}   | ${"grid islamic-umalqura i=274 -31 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-04-28[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M29D"}   | ${"grid islamic-umalqura i=274 +58 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-04-28[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1M29D"}   | ${"grid islamic-umalqura i=274 +58 d"}
    ${"2024-04-28[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1M28D"}  | ${"grid islamic-umalqura i=274 -58 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-04-29[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M"}      | ${"grid islamic-umalqura i=274 +59 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-04-29[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M"}      | ${"grid islamic-umalqura i=274 +59 d"}
    ${"2024-04-29[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M"}     | ${"grid islamic-umalqura i=274 -59 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-04-30[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M1D"}    | ${"grid islamic-umalqura i=274 +60 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-04-30[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M1D"}    | ${"grid islamic-umalqura i=274 +60 d"}
    ${"2024-04-30[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M1D"}   | ${"grid islamic-umalqura i=274 -60 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-05-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P2M2D"}    | ${"grid islamic-umalqura i=274 +61 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2024-05-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2M2D"}    | ${"grid islamic-umalqura i=274 +61 d"}
    ${"2024-05-01[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P2M2D"}   | ${"grid islamic-umalqura i=274 -61 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-02-18[u-ca=islamic-umalqura]"} | ${"months"} | ${"P11M29D"}  | ${"grid islamic-umalqura i=274 +354 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-02-18[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P11M29D"}  | ${"grid islamic-umalqura i=274 +354 d"}
    ${"2025-02-18[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P11M28D"} | ${"grid islamic-umalqura i=274 -354 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-02-19[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M"}     | ${"grid islamic-umalqura i=274 +355 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-02-19[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y"}      | ${"grid islamic-umalqura i=274 +355 d"}
    ${"2025-02-19[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y"}     | ${"grid islamic-umalqura i=274 -355 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-03-01[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M10D"}  | ${"grid islamic-umalqura i=274 +365 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y10D"}   | ${"grid islamic-umalqura i=274 +365 d"}
    ${"2025-03-01[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y10D"}  | ${"grid islamic-umalqura i=274 -365 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-03-02[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M11D"}  | ${"grid islamic-umalqura i=274 +366 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-03-02[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y11D"}   | ${"grid islamic-umalqura i=274 +366 d"}
    ${"2025-03-02[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y11D"}  | ${"grid islamic-umalqura i=274 -366 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-03-19[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M28D"}  | ${"grid islamic-umalqura i=274 +383 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-03-19[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y28D"}   | ${"grid islamic-umalqura i=274 +383 d"}
    ${"2025-03-19[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y28D"}  | ${"grid islamic-umalqura i=274 -383 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-03-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M"}     | ${"grid islamic-umalqura i=274 +384 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-03-20[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M"}    | ${"grid islamic-umalqura i=274 +384 d"}
    ${"2025-03-20[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M"}   | ${"grid islamic-umalqura i=274 -384 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-03-21[u-ca=islamic-umalqura]"} | ${"months"} | ${"P13M1D"}   | ${"grid islamic-umalqura i=274 +385 d"}
    ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"2025-03-21[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y1M1D"}  | ${"grid islamic-umalqura i=274 +385 d"}
    ${"2025-03-21[u-ca=islamic-umalqura]"} | ${"2024-03-01[u-ca=islamic-umalqura]"} | ${"years"}  | ${"-P1Y1M1D"} | ${"grid islamic-umalqura i=274 -385 d"}
  `(
    "returns $expected in $unit from $date1 to $date2 ($source)",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );
});

describe("diffDateAsDuration inside the Umm al-Qura table (CORE-6 §4.4 stride k=1000)", () => {
  it.each`
    date1                                  | date2                                  | unit       | expected      | source
    ${"1948-02-05[u-ca=islamic-umalqura]"} | ${"1949-03-11[u-ca=islamic-umalqura]"} | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-umalqura k=1000 (ISO 1948-02-05), +400 d"}
  `(
    "returns $expected in $unit from $date1 to $date2 ($source)",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );
});
