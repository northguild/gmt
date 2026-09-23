import { diffDateAsDuration } from "./diffDateAsDuration";

// Expected values: Chromium 152 native Temporal, recorded in the CORE-6 research scan
// (q2-xscan-chromium152.json / q2-grid-chromium152.json; the scan is scripts/temporal-compat/scan-body.js).
// Strings are RFC 9557: the ISO date plus [u-ca=<id>]. Each was converted from the CORE-6
// calendar-field string by native Temporal (Chromium 153.0.8010.12,
// `Temporal.PlainDate.from({ calendar, year | era + eraYear, month, day }, { overflow: "reject" })`).
// "" is the sentinel where Chromium throws. Never GMT output, never the polyfill.

// Months: between the limit and the date n days inside it. Years: between that date and the date
// 800 days inside the limit.
describe("diffDateAsDuration next to the range limits (CORE-6 §4.4)", () => {
  it.each`
    date1                                     | date2                                     | unit        | expected      | source
    ${"+275758-07-06[u-ca=buddhist]"}         | ${"+275760-09-13[u-ca=buddhist]"}         | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan buddhist max[0], 800 d inside"}
    ${"+275760-09-12[u-ca=buddhist]"}         | ${"+275760-09-13[u-ca=buddhist]"}         | ${"months"} | ${"P1D"}      | ${"xscan buddhist max[1]"}
    ${"+275758-07-06[u-ca=buddhist]"}         | ${"+275760-09-12[u-ca=buddhist]"}         | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan buddhist max[1], 800 d inside"}
    ${"+275760-08-14[u-ca=buddhist]"}         | ${"+275760-09-13[u-ca=buddhist]"}         | ${"months"} | ${"P30D"}     | ${"xscan buddhist max[30]"}
    ${"+275758-07-06[u-ca=buddhist]"}         | ${"+275760-08-14[u-ca=buddhist]"}         | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan buddhist max[30], 800 d inside"}
    ${"+275760-08-13[u-ca=buddhist]"}         | ${"+275760-09-13[u-ca=buddhist]"}         | ${"months"} | ${"P1M"}      | ${"xscan buddhist max[31]"}
    ${"+275758-07-06[u-ca=buddhist]"}         | ${"+275760-08-13[u-ca=buddhist]"}         | ${"years"}  | ${"P2Y1M7D"}  | ${"xscan buddhist max[31], 800 d inside"}
    ${"+275760-08-12[u-ca=buddhist]"}         | ${"+275760-09-13[u-ca=buddhist]"}         | ${"months"} | ${"P1M1D"}    | ${"xscan buddhist max[32]"}
    ${"+275758-07-06[u-ca=buddhist]"}         | ${"+275760-08-12[u-ca=buddhist]"}         | ${"years"}  | ${"P2Y1M6D"}  | ${"xscan buddhist max[32], 800 d inside"}
    ${"+275760-02-26[u-ca=buddhist]"}         | ${"+275760-09-13[u-ca=buddhist]"}         | ${"months"} | ${"P6M18D"}   | ${"xscan buddhist max[200]"}
    ${"+275758-07-06[u-ca=buddhist]"}         | ${"+275760-02-26[u-ca=buddhist]"}         | ${"years"}  | ${"P1Y7M20D"} | ${"xscan buddhist max[200], 800 d inside"}
    ${"+275759-08-13[u-ca=buddhist]"}         | ${"+275760-09-13[u-ca=buddhist]"}         | ${"months"} | ${"P13M"}     | ${"xscan buddhist max[397]"}
    ${"+275758-07-06[u-ca=buddhist]"}         | ${"+275759-08-13[u-ca=buddhist]"}         | ${"years"}  | ${"P1Y1M7D"}  | ${"xscan buddhist max[397], 800 d inside"}
    ${"+275759-08-12[u-ca=buddhist]"}         | ${"+275760-09-13[u-ca=buddhist]"}         | ${"months"} | ${"P13M1D"}   | ${"xscan buddhist max[398]"}
    ${"+275758-07-06[u-ca=buddhist]"}         | ${"+275759-08-12[u-ca=buddhist]"}         | ${"years"}  | ${"P1Y1M6D"}  | ${"xscan buddhist max[398], 800 d inside"}
    ${"+275759-07-21[u-ca=buddhist]"}         | ${"+275760-09-13[u-ca=buddhist]"}         | ${"months"} | ${"P13M23D"}  | ${"xscan buddhist max[420]"}
    ${"+275758-07-06[u-ca=buddhist]"}         | ${"+275759-07-21[u-ca=buddhist]"}         | ${"years"}  | ${"P1Y15D"}   | ${"xscan buddhist max[420], 800 d inside"}
    ${"-271821-04-19[u-ca=buddhist]"}         | ${"-271819-06-27[u-ca=buddhist]"}         | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan buddhist min[0], 800 d inside"}
    ${"-271821-04-19[u-ca=buddhist]"}         | ${"-271821-04-20[u-ca=buddhist]"}         | ${"months"} | ${"P1D"}      | ${"xscan buddhist min[1]"}
    ${"-271821-04-20[u-ca=buddhist]"}         | ${"-271819-06-27[u-ca=buddhist]"}         | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan buddhist min[1], 800 d inside"}
    ${"-271821-04-19[u-ca=buddhist]"}         | ${"-271821-04-21[u-ca=buddhist]"}         | ${"months"} | ${"P2D"}      | ${"xscan buddhist min[2]"}
    ${"-271821-04-21[u-ca=buddhist]"}         | ${"-271819-06-27[u-ca=buddhist]"}         | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan buddhist min[2], 800 d inside"}
    ${"-271821-04-19[u-ca=buddhist]"}         | ${"-271821-05-19[u-ca=buddhist]"}         | ${"months"} | ${"P1M"}      | ${"xscan buddhist min[30]"}
    ${"-271821-05-19[u-ca=buddhist]"}         | ${"-271819-06-27[u-ca=buddhist]"}         | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan buddhist min[30], 800 d inside"}
    ${"-271821-04-19[u-ca=buddhist]"}         | ${"-271821-11-05[u-ca=buddhist]"}         | ${"months"} | ${"P6M17D"}   | ${"xscan buddhist min[200]"}
    ${"-271821-11-05[u-ca=buddhist]"}         | ${"-271819-06-27[u-ca=buddhist]"}         | ${"years"}  | ${"P1Y7M22D"} | ${"xscan buddhist min[200], 800 d inside"}
    ${"-271821-04-19[u-ca=buddhist]"}         | ${"-271820-06-12[u-ca=buddhist]"}         | ${"months"} | ${"P13M24D"}  | ${"xscan buddhist min[420]"}
    ${"-271820-06-12[u-ca=buddhist]"}         | ${"-271819-06-27[u-ca=buddhist]"}         | ${"years"}  | ${"P1Y15D"}   | ${"xscan buddhist min[420], 800 d inside"}
    ${"+275758-07-06[u-ca=hebrew]"}           | ${"+275760-09-13[u-ca=hebrew]"}           | ${"years"}  | ${"P2Y2M3D"}  | ${"xscan hebrew max[0], 800 d inside"}
    ${"+275760-09-12[u-ca=hebrew]"}           | ${"+275760-09-13[u-ca=hebrew]"}           | ${"months"} | ${"P1D"}      | ${"xscan hebrew max[1]"}
    ${"+275758-07-06[u-ca=hebrew]"}           | ${"+275760-09-12[u-ca=hebrew]"}           | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan hebrew max[1], 800 d inside"}
    ${"+275760-09-08[u-ca=hebrew]"}           | ${"+275760-09-13[u-ca=hebrew]"}           | ${"months"} | ${"P5D"}      | ${"xscan hebrew max[5]"}
    ${"+275758-07-06[u-ca=hebrew]"}           | ${"+275760-09-08[u-ca=hebrew]"}           | ${"years"}  | ${"P2Y1M27D"} | ${"xscan hebrew max[5], 800 d inside"}
    ${"+275760-09-07[u-ca=hebrew]"}           | ${"+275760-09-13[u-ca=hebrew]"}           | ${"months"} | ${"P6D"}      | ${"xscan hebrew max[6]"}
    ${"+275758-07-06[u-ca=hebrew]"}           | ${"+275760-09-07[u-ca=hebrew]"}           | ${"years"}  | ${"P2Y1M26D"} | ${"xscan hebrew max[6], 800 d inside"}
    ${"+275760-08-14[u-ca=hebrew]"}           | ${"+275760-09-13[u-ca=hebrew]"}           | ${"months"} | ${"P1M1D"}    | ${"xscan hebrew max[30]"}
    ${"+275758-07-06[u-ca=hebrew]"}           | ${"+275760-08-14[u-ca=hebrew]"}           | ${"years"}  | ${"P2Y1M2D"}  | ${"xscan hebrew max[30], 800 d inside"}
    ${"+275760-02-26[u-ca=hebrew]"}           | ${"+275760-09-13[u-ca=hebrew]"}           | ${"months"} | ${"P6M23D"}   | ${"xscan hebrew max[200]"}
    ${"+275758-07-06[u-ca=hebrew]"}           | ${"+275760-02-26[u-ca=hebrew]"}           | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan hebrew max[200], 800 d inside"}
    ${"+275759-08-22[u-ca=hebrew]"}           | ${"+275760-09-13[u-ca=hebrew]"}           | ${"months"} | ${"P13M5D"}   | ${"xscan hebrew max[388]"}
    ${"+275758-07-06[u-ca=hebrew]"}           | ${"+275759-08-22[u-ca=hebrew]"}           | ${"years"}  | ${"P1Y1M27D"} | ${"xscan hebrew max[388], 800 d inside"}
    ${"+275759-08-21[u-ca=hebrew]"}           | ${"+275760-09-13[u-ca=hebrew]"}           | ${"months"} | ${"P13M6D"}   | ${"xscan hebrew max[389]"}
    ${"+275758-07-06[u-ca=hebrew]"}           | ${"+275759-08-21[u-ca=hebrew]"}           | ${"years"}  | ${"P1Y1M26D"} | ${"xscan hebrew max[389], 800 d inside"}
    ${"+275759-07-21[u-ca=hebrew]"}           | ${"+275760-09-13[u-ca=hebrew]"}           | ${"months"} | ${"P14M8D"}   | ${"xscan hebrew max[420]"}
    ${"+275758-07-06[u-ca=hebrew]"}           | ${"+275759-07-21[u-ca=hebrew]"}           | ${"years"}  | ${"P1Y25D"}   | ${"xscan hebrew max[420], 800 d inside"}
    ${"-271821-04-19[u-ca=hebrew]"}           | ${"-271819-06-27[u-ca=hebrew]"}           | ${"years"}  | ${"P2Y2M3D"}  | ${"xscan hebrew min[0], 800 d inside"}
    ${"-271821-04-19[u-ca=hebrew]"}           | ${"-271821-04-20[u-ca=hebrew]"}           | ${"months"} | ${"P1D"}      | ${"xscan hebrew min[1]"}
    ${"-271821-04-20[u-ca=hebrew]"}           | ${"-271819-06-27[u-ca=hebrew]"}           | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan hebrew min[1], 800 d inside"}
    ${"-271821-04-19[u-ca=hebrew]"}           | ${"-271821-05-19[u-ca=hebrew]"}           | ${"months"} | ${"P1M"}      | ${"xscan hebrew min[30]"}
    ${"-271821-05-19[u-ca=hebrew]"}           | ${"-271819-06-27[u-ca=hebrew]"}           | ${"years"}  | ${"P2Y1M3D"}  | ${"xscan hebrew min[30], 800 d inside"}
    ${"-271821-04-19[u-ca=hebrew]"}           | ${"-271821-11-05[u-ca=hebrew]"}           | ${"months"} | ${"P6M24D"}   | ${"xscan hebrew min[200]"}
    ${"-271821-11-05[u-ca=hebrew]"}           | ${"-271819-06-27[u-ca=hebrew]"}           | ${"years"}  | ${"P1Y7M8D"}  | ${"xscan hebrew min[200], 800 d inside"}
    ${"-271821-04-19[u-ca=hebrew]"}           | ${"-271820-05-31[u-ca=hebrew]"}           | ${"months"} | ${"P13M25D"}  | ${"xscan hebrew min[408]"}
    ${"-271820-05-31[u-ca=hebrew]"}           | ${"-271819-06-27[u-ca=hebrew]"}           | ${"years"}  | ${"P1Y1M7D"}  | ${"xscan hebrew min[408], 800 d inside"}
    ${"-271821-04-19[u-ca=hebrew]"}           | ${"-271820-06-01[u-ca=hebrew]"}           | ${"months"} | ${"P13M26D"}  | ${"xscan hebrew min[409]"}
    ${"-271820-06-01[u-ca=hebrew]"}           | ${"-271819-06-27[u-ca=hebrew]"}           | ${"years"}  | ${"P1Y1M7D"}  | ${"xscan hebrew min[409], 800 d inside"}
    ${"-271821-04-19[u-ca=hebrew]"}           | ${"-271820-06-12[u-ca=hebrew]"}           | ${"months"} | ${"P14M7D"}   | ${"xscan hebrew min[420]"}
    ${"-271820-06-12[u-ca=hebrew]"}           | ${"-271819-06-27[u-ca=hebrew]"}           | ${"years"}  | ${"P1Y25D"}   | ${"xscan hebrew min[420], 800 d inside"}
    ${"+275758-07-06[u-ca=islamic-civil]"}    | ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"years"}  | ${"P2Y3M3D"}  | ${"xscan islamic-civil max[0], 800 d inside"}
    ${"+275760-09-12[u-ca=islamic-civil]"}    | ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"months"} | ${"P1D"}      | ${"xscan islamic-civil max[1]"}
    ${"+275758-07-06[u-ca=islamic-civil]"}    | ${"+275760-09-12[u-ca=islamic-civil]"}    | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-civil max[1], 800 d inside"}
    ${"+275760-09-05[u-ca=islamic-civil]"}    | ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"months"} | ${"P8D"}      | ${"xscan islamic-civil max[8]"}
    ${"+275758-07-06[u-ca=islamic-civil]"}    | ${"+275760-09-05[u-ca=islamic-civil]"}    | ${"years"}  | ${"P2Y2M24D"} | ${"xscan islamic-civil max[8], 800 d inside"}
    ${"+275760-09-04[u-ca=islamic-civil]"}    | ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"months"} | ${"P9D"}      | ${"xscan islamic-civil max[9]"}
    ${"+275758-07-06[u-ca=islamic-civil]"}    | ${"+275760-09-04[u-ca=islamic-civil]"}    | ${"years"}  | ${"P2Y2M23D"} | ${"xscan islamic-civil max[9], 800 d inside"}
    ${"+275760-08-14[u-ca=islamic-civil]"}    | ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"months"} | ${"P1M1D"}    | ${"xscan islamic-civil max[30]"}
    ${"+275758-07-06[u-ca=islamic-civil]"}    | ${"+275760-08-14[u-ca=islamic-civil]"}    | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-civil max[30], 800 d inside"}
    ${"+275760-02-26[u-ca=islamic-civil]"}    | ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-civil max[200]"}
    ${"+275758-07-06[u-ca=islamic-civil]"}    | ${"+275760-02-26[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-civil max[200], 800 d inside"}
    ${"+275759-09-17[u-ca=islamic-civil]"}    | ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"months"} | ${"P12M8D"}   | ${"xscan islamic-civil max[362]"}
    ${"+275758-07-06[u-ca=islamic-civil]"}    | ${"+275759-09-17[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1Y2M24D"} | ${"xscan islamic-civil max[362], 800 d inside"}
    ${"+275759-09-16[u-ca=islamic-civil]"}    | ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"months"} | ${"P12M9D"}   | ${"xscan islamic-civil max[363]"}
    ${"+275758-07-06[u-ca=islamic-civil]"}    | ${"+275759-09-16[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1Y2M23D"} | ${"xscan islamic-civil max[363], 800 d inside"}
    ${"+275759-07-21[u-ca=islamic-civil]"}    | ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"months"} | ${"P14M7D"}   | ${"xscan islamic-civil max[420]"}
    ${"+275758-07-06[u-ca=islamic-civil]"}    | ${"+275759-07-21[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1Y25D"}   | ${"xscan islamic-civil max[420], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-civil]"}    | ${"-271819-06-27[u-ca=islamic-civil]"}    | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-civil min[0], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-civil]"}    | ${"-271821-04-20[u-ca=islamic-civil]"}    | ${"months"} | ${"P1D"}      | ${"xscan islamic-civil min[1]"}
    ${"-271821-04-20[u-ca=islamic-civil]"}    | ${"-271819-06-27[u-ca=islamic-civil]"}    | ${"years"}  | ${"P2Y3M1D"}  | ${"xscan islamic-civil min[1], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-civil]"}    | ${"-271821-05-19[u-ca=islamic-civil]"}    | ${"months"} | ${"P1M"}      | ${"xscan islamic-civil min[30]"}
    ${"-271821-05-19[u-ca=islamic-civil]"}    | ${"-271819-06-27[u-ca=islamic-civil]"}    | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-civil min[30], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-civil]"}    | ${"-271821-11-05[u-ca=islamic-civil]"}    | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-civil min[200]"}
    ${"-271821-11-05[u-ca=islamic-civil]"}    | ${"-271819-06-27[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-civil min[200], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-civil]"}    | ${"-271820-01-19[u-ca=islamic-civil]"}    | ${"months"} | ${"P9M9D"}    | ${"xscan islamic-civil min[275]"}
    ${"-271820-01-19[u-ca=islamic-civil]"}    | ${"-271819-06-27[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1Y5M23D"} | ${"xscan islamic-civil min[275], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-civil]"}    | ${"-271820-01-20[u-ca=islamic-civil]"}    | ${"months"} | ${"P9M10D"}   | ${"xscan islamic-civil min[276]"}
    ${"-271820-01-20[u-ca=islamic-civil]"}    | ${"-271819-06-27[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1Y5M22D"} | ${"xscan islamic-civil min[276], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-civil]"}    | ${"-271820-06-12[u-ca=islamic-civil]"}    | ${"months"} | ${"P14M6D"}   | ${"xscan islamic-civil min[420]"}
    ${"-271820-06-12[u-ca=islamic-civil]"}    | ${"-271819-06-27[u-ca=islamic-civil]"}    | ${"years"}  | ${"P1Y26D"}   | ${"xscan islamic-civil min[420], 800 d inside"}
    ${"+275758-07-06[u-ca=islamic-tbla]"}     | ${"+275760-09-13[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P2Y3M3D"}  | ${"xscan islamic-tbla max[0], 800 d inside"}
    ${"+275760-09-12[u-ca=islamic-tbla]"}     | ${"+275760-09-13[u-ca=islamic-tbla]"}     | ${"months"} | ${"P1D"}      | ${"xscan islamic-tbla max[1]"}
    ${"+275758-07-06[u-ca=islamic-tbla]"}     | ${"+275760-09-12[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-tbla max[1], 800 d inside"}
    ${"+275760-09-05[u-ca=islamic-tbla]"}     | ${"+275760-09-13[u-ca=islamic-tbla]"}     | ${"months"} | ${"P8D"}      | ${"xscan islamic-tbla max[8]"}
    ${"+275758-07-06[u-ca=islamic-tbla]"}     | ${"+275760-09-05[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P2Y2M24D"} | ${"xscan islamic-tbla max[8], 800 d inside"}
    ${"+275760-09-04[u-ca=islamic-tbla]"}     | ${"+275760-09-13[u-ca=islamic-tbla]"}     | ${"months"} | ${"P9D"}      | ${"xscan islamic-tbla max[9]"}
    ${"+275758-07-06[u-ca=islamic-tbla]"}     | ${"+275760-09-04[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P2Y2M23D"} | ${"xscan islamic-tbla max[9], 800 d inside"}
    ${"+275760-08-14[u-ca=islamic-tbla]"}     | ${"+275760-09-13[u-ca=islamic-tbla]"}     | ${"months"} | ${"P1M1D"}    | ${"xscan islamic-tbla max[30]"}
    ${"+275758-07-06[u-ca=islamic-tbla]"}     | ${"+275760-08-14[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-tbla max[30], 800 d inside"}
    ${"+275760-02-26[u-ca=islamic-tbla]"}     | ${"+275760-09-13[u-ca=islamic-tbla]"}     | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-tbla max[200]"}
    ${"+275758-07-06[u-ca=islamic-tbla]"}     | ${"+275760-02-26[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-tbla max[200], 800 d inside"}
    ${"+275759-07-21[u-ca=islamic-tbla]"}     | ${"+275760-09-13[u-ca=islamic-tbla]"}     | ${"months"} | ${"P14M7D"}   | ${"xscan islamic-tbla max[420]"}
    ${"+275758-07-06[u-ca=islamic-tbla]"}     | ${"+275759-07-21[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1Y25D"}   | ${"xscan islamic-tbla max[420], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-tbla]"}     | ${"-271819-06-27[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-tbla min[0], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-tbla]"}     | ${"-271821-04-20[u-ca=islamic-tbla]"}     | ${"months"} | ${"P1D"}      | ${"xscan islamic-tbla min[1]"}
    ${"-271821-04-20[u-ca=islamic-tbla]"}     | ${"-271819-06-27[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P2Y3M1D"}  | ${"xscan islamic-tbla min[1], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-tbla]"}     | ${"-271821-05-19[u-ca=islamic-tbla]"}     | ${"months"} | ${"P1M"}      | ${"xscan islamic-tbla min[30]"}
    ${"-271821-05-19[u-ca=islamic-tbla]"}     | ${"-271819-06-27[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-tbla min[30], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-tbla]"}     | ${"-271821-11-05[u-ca=islamic-tbla]"}     | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-tbla min[200]"}
    ${"-271821-11-05[u-ca=islamic-tbla]"}     | ${"-271819-06-27[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-tbla min[200], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-tbla]"}     | ${"-271820-01-18[u-ca=islamic-tbla]"}     | ${"months"} | ${"P9M8D"}    | ${"xscan islamic-tbla min[274]"}
    ${"-271820-01-18[u-ca=islamic-tbla]"}     | ${"-271819-06-27[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1Y5M24D"} | ${"xscan islamic-tbla min[274], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-tbla]"}     | ${"-271820-01-19[u-ca=islamic-tbla]"}     | ${"months"} | ${"P9M9D"}    | ${"xscan islamic-tbla min[275]"}
    ${"-271820-01-19[u-ca=islamic-tbla]"}     | ${"-271819-06-27[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1Y5M23D"} | ${"xscan islamic-tbla min[275], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-tbla]"}     | ${"-271820-06-12[u-ca=islamic-tbla]"}     | ${"months"} | ${"P14M6D"}   | ${"xscan islamic-tbla min[420]"}
    ${"-271820-06-12[u-ca=islamic-tbla]"}     | ${"-271819-06-27[u-ca=islamic-tbla]"}     | ${"years"}  | ${"P1Y26D"}   | ${"xscan islamic-tbla min[420], 800 d inside"}
    ${"+275758-07-06[u-ca=islamic-umalqura]"} | ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2Y3M3D"}  | ${"xscan islamic-umalqura max[0], 800 d inside"}
    ${"+275760-09-12[u-ca=islamic-umalqura]"} | ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1D"}      | ${"xscan islamic-umalqura max[1]"}
    ${"+275758-07-06[u-ca=islamic-umalqura]"} | ${"+275760-09-12[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-umalqura max[1], 800 d inside"}
    ${"+275760-09-05[u-ca=islamic-umalqura]"} | ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"months"} | ${"P8D"}      | ${"xscan islamic-umalqura max[8]"}
    ${"+275758-07-06[u-ca=islamic-umalqura]"} | ${"+275760-09-05[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2Y2M24D"} | ${"xscan islamic-umalqura max[8], 800 d inside"}
    ${"+275760-09-04[u-ca=islamic-umalqura]"} | ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"months"} | ${"P9D"}      | ${"xscan islamic-umalqura max[9]"}
    ${"+275758-07-06[u-ca=islamic-umalqura]"} | ${"+275760-09-04[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2Y2M23D"} | ${"xscan islamic-umalqura max[9], 800 d inside"}
    ${"+275760-08-14[u-ca=islamic-umalqura]"} | ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M1D"}    | ${"xscan islamic-umalqura max[30]"}
    ${"+275758-07-06[u-ca=islamic-umalqura]"} | ${"+275760-08-14[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-umalqura max[30], 800 d inside"}
    ${"+275760-02-26[u-ca=islamic-umalqura]"} | ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-umalqura max[200]"}
    ${"+275758-07-06[u-ca=islamic-umalqura]"} | ${"+275760-02-26[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-umalqura max[200], 800 d inside"}
    ${"+275759-09-17[u-ca=islamic-umalqura]"} | ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M8D"}   | ${"xscan islamic-umalqura max[362]"}
    ${"+275758-07-06[u-ca=islamic-umalqura]"} | ${"+275759-09-17[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y2M24D"} | ${"xscan islamic-umalqura max[362], 800 d inside"}
    ${"+275759-09-16[u-ca=islamic-umalqura]"} | ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"months"} | ${"P12M9D"}   | ${"xscan islamic-umalqura max[363]"}
    ${"+275758-07-06[u-ca=islamic-umalqura]"} | ${"+275759-09-16[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y2M23D"} | ${"xscan islamic-umalqura max[363], 800 d inside"}
    ${"+275759-07-21[u-ca=islamic-umalqura]"} | ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"months"} | ${"P14M7D"}   | ${"xscan islamic-umalqura max[420]"}
    ${"+275758-07-06[u-ca=islamic-umalqura]"} | ${"+275759-07-21[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y25D"}   | ${"xscan islamic-umalqura max[420], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-umalqura]"} | ${"-271819-06-27[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-umalqura min[0], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-umalqura]"} | ${"-271821-04-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1D"}      | ${"xscan islamic-umalqura min[1]"}
    ${"-271821-04-20[u-ca=islamic-umalqura]"} | ${"-271819-06-27[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2Y3M1D"}  | ${"xscan islamic-umalqura min[1], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-umalqura]"} | ${"-271821-05-19[u-ca=islamic-umalqura]"} | ${"months"} | ${"P1M"}      | ${"xscan islamic-umalqura min[30]"}
    ${"-271821-05-19[u-ca=islamic-umalqura]"} | ${"-271819-06-27[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-umalqura min[30], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-umalqura]"} | ${"-271821-11-05[u-ca=islamic-umalqura]"} | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-umalqura min[200]"}
    ${"-271821-11-05[u-ca=islamic-umalqura]"} | ${"-271819-06-27[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-umalqura min[200], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-umalqura]"} | ${"-271820-01-19[u-ca=islamic-umalqura]"} | ${"months"} | ${"P9M9D"}    | ${"xscan islamic-umalqura min[275]"}
    ${"-271820-01-19[u-ca=islamic-umalqura]"} | ${"-271819-06-27[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y5M23D"} | ${"xscan islamic-umalqura min[275], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-umalqura]"} | ${"-271820-01-20[u-ca=islamic-umalqura]"} | ${"months"} | ${"P9M10D"}   | ${"xscan islamic-umalqura min[276]"}
    ${"-271820-01-20[u-ca=islamic-umalqura]"} | ${"-271819-06-27[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y5M22D"} | ${"xscan islamic-umalqura min[276], 800 d inside"}
    ${"-271821-04-19[u-ca=islamic-umalqura]"} | ${"-271820-06-12[u-ca=islamic-umalqura]"} | ${"months"} | ${"P14M6D"}   | ${"xscan islamic-umalqura min[420]"}
    ${"-271820-06-12[u-ca=islamic-umalqura]"} | ${"-271819-06-27[u-ca=islamic-umalqura]"} | ${"years"}  | ${"P1Y26D"}   | ${"xscan islamic-umalqura min[420], 800 d inside"}
    ${"+275758-07-06[u-ca=persian]"}          | ${"+275760-09-13[u-ca=persian]"}          | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan persian max[0], 800 d inside"}
    ${"+275760-09-12[u-ca=persian]"}          | ${"+275760-09-13[u-ca=persian]"}          | ${"months"} | ${"P1D"}      | ${"xscan persian max[1]"}
    ${"+275758-07-06[u-ca=persian]"}          | ${"+275760-09-12[u-ca=persian]"}          | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan persian max[1], 800 d inside"}
    ${"+275760-08-14[u-ca=persian]"}          | ${"+275760-09-13[u-ca=persian]"}          | ${"months"} | ${"P30D"}     | ${"xscan persian max[30]"}
    ${"+275758-07-06[u-ca=persian]"}          | ${"+275760-08-14[u-ca=persian]"}          | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan persian max[30], 800 d inside"}
    ${"+275760-02-26[u-ca=persian]"}          | ${"+275760-09-13[u-ca=persian]"}          | ${"months"} | ${"P6M15D"}   | ${"xscan persian max[200]"}
    ${"+275758-07-06[u-ca=persian]"}          | ${"+275760-02-26[u-ca=persian]"}          | ${"years"}  | ${"P1Y7M23D"} | ${"xscan persian max[200], 800 d inside"}
    ${"+275759-07-21[u-ca=persian]"}          | ${"+275760-09-13[u-ca=persian]"}          | ${"months"} | ${"P13M23D"}  | ${"xscan persian max[420]"}
    ${"+275758-07-06[u-ca=persian]"}          | ${"+275759-07-21[u-ca=persian]"}          | ${"years"}  | ${"P1Y15D"}   | ${"xscan persian max[420], 800 d inside"}
    ${"-271821-04-19[u-ca=persian]"}          | ${"-271819-06-27[u-ca=persian]"}          | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan persian min[0], 800 d inside"}
    ${"-271821-04-19[u-ca=persian]"}          | ${"-271821-04-20[u-ca=persian]"}          | ${"months"} | ${"P1D"}      | ${"xscan persian min[1]"}
    ${"-271821-04-20[u-ca=persian]"}          | ${"-271819-06-27[u-ca=persian]"}          | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan persian min[1], 800 d inside"}
    ${"-271821-04-19[u-ca=persian]"}          | ${"-271821-05-19[u-ca=persian]"}          | ${"months"} | ${"P30D"}     | ${"xscan persian min[30]"}
    ${"-271821-05-19[u-ca=persian]"}          | ${"-271819-06-27[u-ca=persian]"}          | ${"years"}  | ${"P2Y1M9D"}  | ${"xscan persian min[30], 800 d inside"}
    ${"-271821-04-19[u-ca=persian]"}          | ${"-271821-11-05[u-ca=persian]"}          | ${"months"} | ${"P6M14D"}   | ${"xscan persian min[200]"}
    ${"-271821-11-05[u-ca=persian]"}          | ${"-271819-06-27[u-ca=persian]"}          | ${"years"}  | ${"P1Y7M25D"} | ${"xscan persian min[200], 800 d inside"}
    ${"-271821-04-19[u-ca=persian]"}          | ${"-271820-04-09[u-ca=persian]"}          | ${"months"} | ${"P11M20D"}  | ${"xscan persian min[356]"}
    ${"-271820-04-09[u-ca=persian]"}          | ${"-271819-06-27[u-ca=persian]"}          | ${"years"}  | ${"P1Y2M19D"} | ${"xscan persian min[356], 800 d inside"}
    ${"-271821-04-19[u-ca=persian]"}          | ${"-271820-04-10[u-ca=persian]"}          | ${"months"} | ${"P11M21D"}  | ${"xscan persian min[357]"}
    ${"-271820-04-10[u-ca=persian]"}          | ${"-271819-06-27[u-ca=persian]"}          | ${"years"}  | ${"P1Y2M16D"} | ${"xscan persian min[357], 800 d inside"}
    ${"-271821-04-19[u-ca=persian]"}          | ${"-271820-06-12[u-ca=persian]"}          | ${"months"} | ${"P13M24D"}  | ${"xscan persian min[420]"}
    ${"-271820-06-12[u-ca=persian]"}          | ${"-271819-06-27[u-ca=persian]"}          | ${"years"}  | ${"P1Y15D"}   | ${"xscan persian min[420], 800 d inside"}
    ${"+275758-07-06[u-ca=indian]"}           | ${"+275760-09-13[u-ca=indian]"}           | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan indian max[0], 800 d inside"}
    ${"+275760-09-12[u-ca=indian]"}           | ${"+275760-09-13[u-ca=indian]"}           | ${"months"} | ${"P1D"}      | ${"xscan indian max[1]"}
    ${"+275758-07-06[u-ca=indian]"}           | ${"+275760-09-12[u-ca=indian]"}           | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan indian max[1], 800 d inside"}
    ${"+275760-08-14[u-ca=indian]"}           | ${"+275760-09-13[u-ca=indian]"}           | ${"months"} | ${"P30D"}     | ${"xscan indian max[30]"}
    ${"+275758-07-06[u-ca=indian]"}           | ${"+275760-08-14[u-ca=indian]"}           | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan indian max[30], 800 d inside"}
    ${"+275760-02-26[u-ca=indian]"}           | ${"+275760-09-13[u-ca=indian]"}           | ${"months"} | ${"P6M15D"}   | ${"xscan indian max[200]"}
    ${"+275758-07-06[u-ca=indian]"}           | ${"+275760-02-26[u-ca=indian]"}           | ${"years"}  | ${"P1Y7M22D"} | ${"xscan indian max[200], 800 d inside"}
    ${"+275759-07-21[u-ca=indian]"}           | ${"+275760-09-13[u-ca=indian]"}           | ${"months"} | ${"P13M23D"}  | ${"xscan indian max[420]"}
    ${"+275758-07-06[u-ca=indian]"}           | ${"+275759-07-21[u-ca=indian]"}           | ${"years"}  | ${"P1Y15D"}   | ${"xscan indian max[420], 800 d inside"}
    ${"-271821-04-19[u-ca=indian]"}           | ${"-271819-06-27[u-ca=indian]"}           | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan indian min[0], 800 d inside"}
    ${"-271821-04-19[u-ca=indian]"}           | ${"-271821-04-20[u-ca=indian]"}           | ${"months"} | ${"P1D"}      | ${"xscan indian min[1]"}
    ${"-271821-04-20[u-ca=indian]"}           | ${"-271819-06-27[u-ca=indian]"}           | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan indian min[1], 800 d inside"}
    ${"-271821-04-19[u-ca=indian]"}           | ${"-271821-05-19[u-ca=indian]"}           | ${"months"} | ${"P1M"}      | ${"xscan indian min[30]"}
    ${"-271821-05-19[u-ca=indian]"}           | ${"-271819-06-27[u-ca=indian]"}           | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan indian min[30], 800 d inside"}
    ${"-271821-04-19[u-ca=indian]"}           | ${"-271821-11-05[u-ca=indian]"}           | ${"months"} | ${"P6M15D"}   | ${"xscan indian min[200]"}
    ${"-271821-11-05[u-ca=indian]"}           | ${"-271819-06-27[u-ca=indian]"}           | ${"years"}  | ${"P1Y7M23D"} | ${"xscan indian min[200], 800 d inside"}
    ${"-271821-04-19[u-ca=indian]"}           | ${"-271820-06-12[u-ca=indian]"}           | ${"months"} | ${"P13M24D"}  | ${"xscan indian min[420]"}
    ${"-271820-06-12[u-ca=indian]"}           | ${"-271819-06-27[u-ca=indian]"}           | ${"years"}  | ${"P1Y15D"}   | ${"xscan indian min[420], 800 d inside"}
    ${"+275758-07-06[u-ca=ethioaa]"}          | ${"+275760-09-13[u-ca=ethioaa]"}          | ${"years"}  | ${"P2Y2M10D"} | ${"xscan ethioaa max[0], 800 d inside"}
    ${"+275760-09-12[u-ca=ethioaa]"}          | ${"+275760-09-13[u-ca=ethioaa]"}          | ${"months"} | ${"P1D"}      | ${"xscan ethioaa max[1]"}
    ${"+275758-07-06[u-ca=ethioaa]"}          | ${"+275760-09-12[u-ca=ethioaa]"}          | ${"years"}  | ${"P2Y2M9D"}  | ${"xscan ethioaa max[1], 800 d inside"}
    ${"+275760-08-14[u-ca=ethioaa]"}          | ${"+275760-09-13[u-ca=ethioaa]"}          | ${"months"} | ${"P1M"}      | ${"xscan ethioaa max[30]"}
    ${"+275758-07-06[u-ca=ethioaa]"}          | ${"+275760-08-14[u-ca=ethioaa]"}          | ${"years"}  | ${"P2Y1M10D"} | ${"xscan ethioaa max[30], 800 d inside"}
    ${"+275760-02-26[u-ca=ethioaa]"}          | ${"+275760-09-13[u-ca=ethioaa]"}          | ${"months"} | ${"P7M15D"}   | ${"xscan ethioaa max[200]"}
    ${"+275758-07-06[u-ca=ethioaa]"}          | ${"+275760-02-26[u-ca=ethioaa]"}          | ${"years"}  | ${"P1Y7M25D"} | ${"xscan ethioaa max[200], 800 d inside"}
    ${"+275759-07-21[u-ca=ethioaa]"}          | ${"+275760-09-13[u-ca=ethioaa]"}          | ${"months"} | ${"P14M25D"}  | ${"xscan ethioaa max[420]"}
    ${"+275758-07-06[u-ca=ethioaa]"}          | ${"+275759-07-21[u-ca=ethioaa]"}          | ${"years"}  | ${"P1Y15D"}   | ${"xscan ethioaa max[420], 800 d inside"}
    ${"-271821-04-19[u-ca=ethioaa]"}          | ${"-271819-06-27[u-ca=ethioaa]"}          | ${"years"}  | ${"P2Y2M10D"} | ${"xscan ethioaa min[0], 800 d inside"}
    ${"-271821-04-19[u-ca=ethioaa]"}          | ${"-271821-04-20[u-ca=ethioaa]"}          | ${"months"} | ${"P1D"}      | ${"xscan ethioaa min[1]"}
    ${"-271821-04-20[u-ca=ethioaa]"}          | ${"-271819-06-27[u-ca=ethioaa]"}          | ${"years"}  | ${"P2Y2M9D"}  | ${"xscan ethioaa min[1], 800 d inside"}
    ${"-271821-04-19[u-ca=ethioaa]"}          | ${"-271821-05-19[u-ca=ethioaa]"}          | ${"months"} | ${"P1M"}      | ${"xscan ethioaa min[30]"}
    ${"-271821-05-19[u-ca=ethioaa]"}          | ${"-271819-06-27[u-ca=ethioaa]"}          | ${"years"}  | ${"P2Y1M10D"} | ${"xscan ethioaa min[30], 800 d inside"}
    ${"-271821-04-19[u-ca=ethioaa]"}          | ${"-271821-11-05[u-ca=ethioaa]"}          | ${"months"} | ${"P6M20D"}   | ${"xscan ethioaa min[200]"}
    ${"-271821-11-05[u-ca=ethioaa]"}          | ${"-271819-06-27[u-ca=ethioaa]"}          | ${"years"}  | ${"P1Y8M20D"} | ${"xscan ethioaa min[200], 800 d inside"}
    ${"-271821-04-19[u-ca=ethioaa]"}          | ${"-271820-06-12[u-ca=ethioaa]"}          | ${"months"} | ${"P14M25D"}  | ${"xscan ethioaa min[420]"}
    ${"-271820-06-12[u-ca=ethioaa]"}          | ${"-271819-06-27[u-ca=ethioaa]"}          | ${"years"}  | ${"P1Y15D"}   | ${"xscan ethioaa min[420], 800 d inside"}
    ${"+275758-07-06[u-ca=japanese]"}         | ${"+275760-09-13[u-ca=japanese]"}         | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan japanese max[0], 800 d inside"}
    ${"+275760-09-12[u-ca=japanese]"}         | ${"+275760-09-13[u-ca=japanese]"}         | ${"months"} | ${"P1D"}      | ${"xscan japanese max[1]"}
    ${"+275758-07-06[u-ca=japanese]"}         | ${"+275760-09-12[u-ca=japanese]"}         | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan japanese max[1], 800 d inside"}
    ${"+275760-08-14[u-ca=japanese]"}         | ${"+275760-09-13[u-ca=japanese]"}         | ${"months"} | ${"P30D"}     | ${"xscan japanese max[30]"}
    ${"+275758-07-06[u-ca=japanese]"}         | ${"+275760-08-14[u-ca=japanese]"}         | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan japanese max[30], 800 d inside"}
    ${"+275760-02-26[u-ca=japanese]"}         | ${"+275760-09-13[u-ca=japanese]"}         | ${"months"} | ${"P6M18D"}   | ${"xscan japanese max[200]"}
    ${"+275758-07-06[u-ca=japanese]"}         | ${"+275760-02-26[u-ca=japanese]"}         | ${"years"}  | ${"P1Y7M20D"} | ${"xscan japanese max[200], 800 d inside"}
    ${"+275759-07-21[u-ca=japanese]"}         | ${"+275760-09-13[u-ca=japanese]"}         | ${"months"} | ${"P13M23D"}  | ${"xscan japanese max[420]"}
    ${"+275758-07-06[u-ca=japanese]"}         | ${"+275759-07-21[u-ca=japanese]"}         | ${"years"}  | ${"P1Y15D"}   | ${"xscan japanese max[420], 800 d inside"}
    ${"-271821-04-19[u-ca=japanese]"}         | ${"-271819-06-27[u-ca=japanese]"}         | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan japanese min[0], 800 d inside"}
    ${"-271821-04-19[u-ca=japanese]"}         | ${"-271821-04-20[u-ca=japanese]"}         | ${"months"} | ${"P1D"}      | ${"xscan japanese min[1]"}
    ${"-271821-04-20[u-ca=japanese]"}         | ${"-271819-06-27[u-ca=japanese]"}         | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan japanese min[1], 800 d inside"}
    ${"-271821-04-19[u-ca=japanese]"}         | ${"-271821-05-19[u-ca=japanese]"}         | ${"months"} | ${"P1M"}      | ${"xscan japanese min[30]"}
    ${"-271821-05-19[u-ca=japanese]"}         | ${"-271819-06-27[u-ca=japanese]"}         | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan japanese min[30], 800 d inside"}
    ${"-271821-04-19[u-ca=japanese]"}         | ${"-271821-11-05[u-ca=japanese]"}         | ${"months"} | ${"P6M17D"}   | ${"xscan japanese min[200]"}
    ${"-271821-11-05[u-ca=japanese]"}         | ${"-271819-06-27[u-ca=japanese]"}         | ${"years"}  | ${"P1Y7M22D"} | ${"xscan japanese min[200], 800 d inside"}
    ${"-271821-04-19[u-ca=japanese]"}         | ${"-271820-06-12[u-ca=japanese]"}         | ${"months"} | ${"P13M24D"}  | ${"xscan japanese min[420]"}
    ${"-271820-06-12[u-ca=japanese]"}         | ${"-271819-06-27[u-ca=japanese]"}         | ${"years"}  | ${"P1Y15D"}   | ${"xscan japanese min[420], 800 d inside"}
    ${"+275758-07-06[u-ca=roc]"}              | ${"+275760-09-13[u-ca=roc]"}              | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan roc max[0], 800 d inside"}
    ${"+275760-09-12[u-ca=roc]"}              | ${"+275760-09-13[u-ca=roc]"}              | ${"months"} | ${"P1D"}      | ${"xscan roc max[1]"}
    ${"+275758-07-06[u-ca=roc]"}              | ${"+275760-09-12[u-ca=roc]"}              | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan roc max[1], 800 d inside"}
    ${"+275760-08-14[u-ca=roc]"}              | ${"+275760-09-13[u-ca=roc]"}              | ${"months"} | ${"P30D"}     | ${"xscan roc max[30]"}
    ${"+275758-07-06[u-ca=roc]"}              | ${"+275760-08-14[u-ca=roc]"}              | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan roc max[30], 800 d inside"}
    ${"+275760-02-26[u-ca=roc]"}              | ${"+275760-09-13[u-ca=roc]"}              | ${"months"} | ${"P6M18D"}   | ${"xscan roc max[200]"}
    ${"+275758-07-06[u-ca=roc]"}              | ${"+275760-02-26[u-ca=roc]"}              | ${"years"}  | ${"P1Y7M20D"} | ${"xscan roc max[200], 800 d inside"}
    ${"+275759-07-21[u-ca=roc]"}              | ${"+275760-09-13[u-ca=roc]"}              | ${"months"} | ${"P13M23D"}  | ${"xscan roc max[420]"}
    ${"+275758-07-06[u-ca=roc]"}              | ${"+275759-07-21[u-ca=roc]"}              | ${"years"}  | ${"P1Y15D"}   | ${"xscan roc max[420], 800 d inside"}
    ${"-271821-04-19[u-ca=roc]"}              | ${"-271819-06-27[u-ca=roc]"}              | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan roc min[0], 800 d inside"}
    ${"-271821-04-19[u-ca=roc]"}              | ${"-271821-04-20[u-ca=roc]"}              | ${"months"} | ${"P1D"}      | ${"xscan roc min[1]"}
    ${"-271821-04-20[u-ca=roc]"}              | ${"-271819-06-27[u-ca=roc]"}              | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan roc min[1], 800 d inside"}
    ${"-271821-04-19[u-ca=roc]"}              | ${"-271821-05-19[u-ca=roc]"}              | ${"months"} | ${"P1M"}      | ${"xscan roc min[30]"}
    ${"-271821-05-19[u-ca=roc]"}              | ${"-271819-06-27[u-ca=roc]"}              | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan roc min[30], 800 d inside"}
    ${"-271821-04-19[u-ca=roc]"}              | ${"-271821-11-05[u-ca=roc]"}              | ${"months"} | ${"P6M17D"}   | ${"xscan roc min[200]"}
    ${"-271821-11-05[u-ca=roc]"}              | ${"-271819-06-27[u-ca=roc]"}              | ${"years"}  | ${"P1Y7M22D"} | ${"xscan roc min[200], 800 d inside"}
    ${"-271821-04-19[u-ca=roc]"}              | ${"-271820-06-12[u-ca=roc]"}              | ${"months"} | ${"P13M24D"}  | ${"xscan roc min[420]"}
    ${"-271820-06-12[u-ca=roc]"}              | ${"-271819-06-27[u-ca=roc]"}              | ${"years"}  | ${"P1Y15D"}   | ${"xscan roc min[420], 800 d inside"}
    ${"+275758-07-06"}                        | ${"+275760-09-13"}                        | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan gregory max[0], 800 d inside"}
    ${"+275760-09-12"}                        | ${"+275760-09-13"}                        | ${"months"} | ${"P1D"}      | ${"xscan gregory max[1]"}
    ${"+275758-07-06"}                        | ${"+275760-09-12"}                        | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan gregory max[1], 800 d inside"}
    ${"+275760-08-14"}                        | ${"+275760-09-13"}                        | ${"months"} | ${"P30D"}     | ${"xscan gregory max[30]"}
    ${"+275758-07-06"}                        | ${"+275760-08-14"}                        | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan gregory max[30], 800 d inside"}
    ${"+275760-02-26"}                        | ${"+275760-09-13"}                        | ${"months"} | ${"P6M18D"}   | ${"xscan gregory max[200]"}
    ${"+275758-07-06"}                        | ${"+275760-02-26"}                        | ${"years"}  | ${"P1Y7M20D"} | ${"xscan gregory max[200], 800 d inside"}
    ${"+275759-07-21"}                        | ${"+275760-09-13"}                        | ${"months"} | ${"P13M23D"}  | ${"xscan gregory max[420]"}
    ${"+275758-07-06"}                        | ${"+275759-07-21"}                        | ${"years"}  | ${"P1Y15D"}   | ${"xscan gregory max[420], 800 d inside"}
    ${"-271821-04-19"}                        | ${"-271819-06-27"}                        | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan gregory min[0], 800 d inside"}
    ${"-271821-04-19"}                        | ${"-271821-04-20"}                        | ${"months"} | ${"P1D"}      | ${"xscan gregory min[1]"}
    ${"-271821-04-20"}                        | ${"-271819-06-27"}                        | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan gregory min[1], 800 d inside"}
    ${"-271821-04-19"}                        | ${"-271821-05-19"}                        | ${"months"} | ${"P1M"}      | ${"xscan gregory min[30]"}
    ${"-271821-05-19"}                        | ${"-271819-06-27"}                        | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan gregory min[30], 800 d inside"}
    ${"-271821-04-19"}                        | ${"-271821-11-05"}                        | ${"months"} | ${"P6M17D"}   | ${"xscan gregory min[200]"}
    ${"-271821-11-05"}                        | ${"-271819-06-27"}                        | ${"years"}  | ${"P1Y7M22D"} | ${"xscan gregory min[200], 800 d inside"}
    ${"-271821-04-19"}                        | ${"-271820-06-12"}                        | ${"months"} | ${"P13M24D"}  | ${"xscan gregory min[420]"}
    ${"-271820-06-12"}                        | ${"-271819-06-27"}                        | ${"years"}  | ${"P1Y15D"}   | ${"xscan gregory min[420], 800 d inside"}
  `(
    "returns $expected in $unit from $date1 to $date2 ($source)",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );
});

describe("diffDateAsDuration across the whole range (CORE-6 §4.4 strides)", () => {
  it.each`
    date1                                     | date2                                     | unit       | expected      | source
    ${"-134935-01-24[u-ca=buddhist]"}         | ${"-134934-02-28[u-ca=buddhist]"}         | ${"years"} | ${"P1Y1M4D"}  | ${"stride buddhist k=500, +400 d"}
    ${"1674-04-30[u-ca=buddhist]"}            | ${"1675-06-04[u-ca=buddhist]"}            | ${"years"} | ${"P1Y1M5D"}  | ${"stride buddhist k=999, +400 d"}
    ${"1948-02-05[u-ca=buddhist]"}            | ${"1949-03-11[u-ca=buddhist]"}            | ${"years"} | ${"P1Y1M6D"}  | ${"stride buddhist k=1000, +400 d"}
    ${"+138831-02-15[u-ca=buddhist]"}         | ${"+138832-03-21[u-ca=buddhist]"}         | ${"years"} | ${"P1Y1M6D"}  | ${"stride buddhist k=1500, +400 d"}
    ${"+275714-02-26[u-ca=buddhist]"}         | ${"+275715-04-02[u-ca=buddhist]"}         | ${"years"} | ${"P1Y1M7D"}  | ${"stride buddhist k=2000, +400 d"}
    ${"-134935-01-24[u-ca=hebrew]"}           | ${"-134934-02-28[u-ca=hebrew]"}           | ${"years"} | ${"P1Y17D"}   | ${"stride hebrew k=500, +400 d"}
    ${"1400-07-25[u-ca=hebrew]"}              | ${"1401-08-29[u-ca=hebrew]"}              | ${"years"} | ${"P1Y1M18D"} | ${"stride hebrew k=998, +400 d"}
    ${"1674-04-30[u-ca=hebrew]"}              | ${"1675-06-04[u-ca=hebrew]"}              | ${"years"} | ${"P1Y1M15D"} | ${"stride hebrew k=999, +400 d"}
    ${"1948-02-05[u-ca=hebrew]"}              | ${"1949-03-11[u-ca=hebrew]"}              | ${"years"} | ${"P1Y15D"}   | ${"stride hebrew k=1000, +400 d"}
    ${"+138831-02-15[u-ca=hebrew]"}           | ${"+138832-03-21[u-ca=hebrew]"}           | ${"years"} | ${"P1Y17D"}   | ${"stride hebrew k=1500, +400 d"}
    ${"+275714-02-26[u-ca=hebrew]"}           | ${"+275715-04-02[u-ca=hebrew]"}           | ${"years"} | ${"P1Y16D"}   | ${"stride hebrew k=2000, +400 d"}
    ${"-271818-01-13[u-ca=islamic-civil]"}    | ${"-271817-02-17[u-ca=islamic-civil]"}    | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-civil k=0, +400 d"}
    ${"-134935-01-24[u-ca=islamic-civil]"}    | ${"-134934-02-28[u-ca=islamic-civil]"}    | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-civil k=500, +400 d"}
    ${"1400-07-25[u-ca=islamic-civil]"}       | ${"1401-08-29[u-ca=islamic-civil]"}       | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-civil k=998, +400 d"}
    ${"1674-04-30[u-ca=islamic-civil]"}       | ${"1675-06-04[u-ca=islamic-civil]"}       | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-civil k=999, +400 d"}
    ${"1948-02-05[u-ca=islamic-civil]"}       | ${"1949-03-11[u-ca=islamic-civil]"}       | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-civil k=1000, +400 d"}
    ${"+138831-02-15[u-ca=islamic-civil]"}    | ${"+138832-03-21[u-ca=islamic-civil]"}    | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-civil k=1500, +400 d"}
    ${"+275714-02-26[u-ca=islamic-civil]"}    | ${"+275715-04-02[u-ca=islamic-civil]"}    | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-civil k=2000, +400 d"}
    ${"-271818-01-13[u-ca=islamic-tbla]"}     | ${"-271817-02-17[u-ca=islamic-tbla]"}     | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-tbla k=0, +400 d"}
    ${"-134935-01-24[u-ca=islamic-tbla]"}     | ${"-134934-02-28[u-ca=islamic-tbla]"}     | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-tbla k=500, +400 d"}
    ${"1400-07-25[u-ca=islamic-tbla]"}        | ${"1401-08-29[u-ca=islamic-tbla]"}        | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-tbla k=998, +400 d"}
    ${"1674-04-30[u-ca=islamic-tbla]"}        | ${"1675-06-04[u-ca=islamic-tbla]"}        | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-tbla k=999, +400 d"}
    ${"1948-02-05[u-ca=islamic-tbla]"}        | ${"1949-03-11[u-ca=islamic-tbla]"}        | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-tbla k=1000, +400 d"}
    ${"+138831-02-15[u-ca=islamic-tbla]"}     | ${"+138832-03-21[u-ca=islamic-tbla]"}     | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-tbla k=1500, +400 d"}
    ${"+275714-02-26[u-ca=islamic-tbla]"}     | ${"+275715-04-02[u-ca=islamic-tbla]"}     | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-tbla k=2000, +400 d"}
    ${"-271818-01-13[u-ca=islamic-umalqura]"} | ${"-271817-02-17[u-ca=islamic-umalqura]"} | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-umalqura k=0, +400 d"}
    ${"-134935-01-24[u-ca=islamic-umalqura]"} | ${"-134934-02-28[u-ca=islamic-umalqura]"} | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-umalqura k=500, +400 d"}
    ${"1400-07-25[u-ca=islamic-umalqura]"}    | ${"1401-08-29[u-ca=islamic-umalqura]"}    | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-umalqura k=998, +400 d"}
    ${"1674-04-30[u-ca=islamic-umalqura]"}    | ${"1675-06-04[u-ca=islamic-umalqura]"}    | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-umalqura k=999, +400 d"}
    ${"+138831-02-15[u-ca=islamic-umalqura]"} | ${"+138832-03-21[u-ca=islamic-umalqura]"} | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-umalqura k=1500, +400 d"}
    ${"+275714-02-26[u-ca=islamic-umalqura]"} | ${"+275715-04-02[u-ca=islamic-umalqura]"} | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-umalqura k=2000, +400 d"}
    ${"-271818-01-13[u-ca=persian]"}          | ${"-271817-02-17[u-ca=persian]"}          | ${"years"} | ${"P1Y1M5D"}  | ${"stride persian k=0, +400 d"}
    ${"-134935-01-24[u-ca=persian]"}          | ${"-134934-02-28[u-ca=persian]"}          | ${"years"} | ${"P1Y1M5D"}  | ${"stride persian k=500, +400 d"}
    ${"1400-07-25[u-ca=persian]"}             | ${"1401-08-29[u-ca=persian]"}             | ${"years"} | ${"P1Y1M4D"}  | ${"stride persian k=998, +400 d"}
    ${"1674-04-30[u-ca=persian]"}             | ${"1675-06-04[u-ca=persian]"}             | ${"years"} | ${"P1Y1M3D"}  | ${"stride persian k=999, +400 d"}
    ${"1948-02-05[u-ca=persian]"}             | ${"1949-03-11[u-ca=persian]"}             | ${"years"} | ${"P1Y1M5D"}  | ${"stride persian k=1000, +400 d"}
    ${"+138831-02-15[u-ca=persian]"}          | ${"+138832-03-21[u-ca=persian]"}          | ${"years"} | ${"P1Y1M5D"}  | ${"stride persian k=1500, +400 d"}
    ${"+275714-02-26[u-ca=persian]"}          | ${"+275715-04-02[u-ca=persian]"}          | ${"years"} | ${"P1Y1M5D"}  | ${"stride persian k=2000, +400 d"}
    ${"-134935-01-24[u-ca=indian]"}           | ${"-134934-02-28[u-ca=indian]"}           | ${"years"} | ${"P1Y1M5D"}  | ${"stride indian k=500, +400 d"}
    ${"1400-07-25[u-ca=indian]"}              | ${"1401-08-29[u-ca=indian]"}              | ${"years"} | ${"P1Y1M4D"}  | ${"stride indian k=998, +400 d"}
    ${"1674-04-30[u-ca=indian]"}              | ${"1675-06-04[u-ca=indian]"}              | ${"years"} | ${"P1Y1M4D"}  | ${"stride indian k=999, +400 d"}
    ${"1948-02-05[u-ca=indian]"}              | ${"1949-03-11[u-ca=indian]"}              | ${"years"} | ${"P1Y1M4D"}  | ${"stride indian k=1000, +400 d"}
    ${"+138831-02-15[u-ca=indian]"}           | ${"+138832-03-21[u-ca=indian]"}           | ${"years"} | ${"P1Y1M5D"}  | ${"stride indian k=1500, +400 d"}
    ${"+275714-02-26[u-ca=indian]"}           | ${"+275715-04-02[u-ca=indian]"}           | ${"years"} | ${"P1Y1M5D"}  | ${"stride indian k=2000, +400 d"}
    ${"-271818-01-13[u-ca=ethioaa]"}          | ${"-271817-02-17[u-ca=ethioaa]"}          | ${"years"} | ${"P1Y1M22D"} | ${"stride ethioaa k=0, +400 d"}
    ${"-134935-01-24[u-ca=ethioaa]"}          | ${"-134934-02-28[u-ca=ethioaa]"}          | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=500, +400 d"}
    ${"1400-07-25[u-ca=ethioaa]"}             | ${"1401-08-29[u-ca=ethioaa]"}             | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=998, +400 d"}
    ${"1674-04-30[u-ca=ethioaa]"}             | ${"1675-06-04[u-ca=ethioaa]"}             | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=999, +400 d"}
    ${"1948-02-05[u-ca=ethioaa]"}             | ${"1949-03-11[u-ca=ethioaa]"}             | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=1000, +400 d"}
    ${"+138831-02-15[u-ca=ethioaa]"}          | ${"+138832-03-21[u-ca=ethioaa]"}          | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=1500, +400 d"}
    ${"+275714-02-26[u-ca=ethioaa]"}          | ${"+275715-04-02[u-ca=ethioaa]"}          | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=2000, +400 d"}
    ${"-271818-01-13[u-ca=japanese]"}         | ${"-271817-02-17[u-ca=japanese]"}         | ${"years"} | ${"P1Y1M4D"}  | ${"stride japanese k=0, +400 d"}
    ${"-134935-01-24[u-ca=japanese]"}         | ${"-134934-02-28[u-ca=japanese]"}         | ${"years"} | ${"P1Y1M4D"}  | ${"stride japanese k=500, +400 d"}
    ${"1400-07-25[u-ca=japanese]"}            | ${"1401-08-29[u-ca=japanese]"}            | ${"years"} | ${"P1Y1M4D"}  | ${"stride japanese k=998, +400 d"}
    ${"1674-04-30[u-ca=japanese]"}            | ${"1675-06-04[u-ca=japanese]"}            | ${"years"} | ${"P1Y1M5D"}  | ${"stride japanese k=999, +400 d"}
    ${"1948-02-05[u-ca=japanese]"}            | ${"1949-03-11[u-ca=japanese]"}            | ${"years"} | ${"P1Y1M6D"}  | ${"stride japanese k=1000, +400 d"}
    ${"+138831-02-15[u-ca=japanese]"}         | ${"+138832-03-21[u-ca=japanese]"}         | ${"years"} | ${"P1Y1M6D"}  | ${"stride japanese k=1500, +400 d"}
    ${"+275714-02-26[u-ca=japanese]"}         | ${"+275715-04-02[u-ca=japanese]"}         | ${"years"} | ${"P1Y1M7D"}  | ${"stride japanese k=2000, +400 d"}
    ${"-271818-01-13[u-ca=roc]"}              | ${"-271817-02-17[u-ca=roc]"}              | ${"years"} | ${"P1Y1M4D"}  | ${"stride roc k=0, +400 d"}
    ${"-134935-01-24[u-ca=roc]"}              | ${"-134934-02-28[u-ca=roc]"}              | ${"years"} | ${"P1Y1M4D"}  | ${"stride roc k=500, +400 d"}
    ${"1400-07-25[u-ca=roc]"}                 | ${"1401-08-29[u-ca=roc]"}                 | ${"years"} | ${"P1Y1M4D"}  | ${"stride roc k=998, +400 d"}
    ${"1674-04-30[u-ca=roc]"}                 | ${"1675-06-04[u-ca=roc]"}                 | ${"years"} | ${"P1Y1M5D"}  | ${"stride roc k=999, +400 d"}
    ${"1948-02-05[u-ca=roc]"}                 | ${"1949-03-11[u-ca=roc]"}                 | ${"years"} | ${"P1Y1M6D"}  | ${"stride roc k=1000, +400 d"}
    ${"+138831-02-15[u-ca=roc]"}              | ${"+138832-03-21[u-ca=roc]"}              | ${"years"} | ${"P1Y1M6D"}  | ${"stride roc k=1500, +400 d"}
    ${"+275714-02-26[u-ca=roc]"}              | ${"+275715-04-02[u-ca=roc]"}              | ${"years"} | ${"P1Y1M7D"}  | ${"stride roc k=2000, +400 d"}
    ${"-271818-01-13"}                        | ${"-271817-02-17"}                        | ${"years"} | ${"P1Y1M4D"}  | ${"stride gregory k=0, +400 d"}
    ${"-134935-01-24"}                        | ${"-134934-02-28"}                        | ${"years"} | ${"P1Y1M4D"}  | ${"stride gregory k=500, +400 d"}
    ${"1400-07-25"}                           | ${"1401-08-29"}                           | ${"years"} | ${"P1Y1M4D"}  | ${"stride gregory k=998, +400 d"}
    ${"1674-04-30"}                           | ${"1675-06-04"}                           | ${"years"} | ${"P1Y1M5D"}  | ${"stride gregory k=999, +400 d"}
    ${"1948-02-05"}                           | ${"1949-03-11"}                           | ${"years"} | ${"P1Y1M6D"}  | ${"stride gregory k=1000, +400 d"}
    ${"+138831-02-15"}                        | ${"+138832-03-21"}                        | ${"years"} | ${"P1Y1M6D"}  | ${"stride gregory k=1500, +400 d"}
    ${"+275714-02-26"}                        | ${"+275715-04-02"}                        | ${"years"} | ${"P1Y1M7D"}  | ${"stride gregory k=2000, +400 d"}
  `(
    "returns $expected in $unit from $date1 to $date2 ($source)",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );
});
