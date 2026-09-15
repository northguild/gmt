import { diffDateAsDuration } from "./diffDateAsDuration";

// Expected values: Chromium 152 native Temporal, recorded in the CORE-6 research scan
// (q2-xscan-chromium152.json / q2-grid-chromium152.json; the scan is scripts/temporal-compat/scan-body.js).
// Each GMT string is built from the recorded read (year|monthCode|month|day) under the owner decisions
// in context/domination/research/calendar-standards-decisions.md: PadISOYear-signed years (Q1),
// ordinal months, Japanese proposal eras (Q2), Buddhist = ISO year + 543 (Q3). Where the scan
// recorded only an ISO result (add/subtract results, the 800-day and 400-day far dates, grid dates),
// the calendar fields come from the published arithmetic of each calendar (Dershowitz-Reingold
// Hebrew and Islamic, ICU's 33-year Persian rule, the Coptic-family rule, the 1955 Indian rule),
// anchored on test262 extreme-dates.js and matching all 31,273 recorded Chromium reads.
// "" is the sentinel where Chromium throws. Never GMT output, never the polyfill.

// Months: between the limit and the date n days inside it. Years: between that date and the date
// 800 days inside the limit.
describe("diffDateAsDuration next to the range limits (CORE-6 §4.4)", () => {
  it.each`
    date1                                        | date2                                        | unit        | expected      | source
    ${"276301-07-06[u-ca=buddhist]"}             | ${"276303-09-13[u-ca=buddhist]"}             | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan buddhist max[0], 800 d inside"}
    ${"276303-09-12[u-ca=buddhist]"}             | ${"276303-09-13[u-ca=buddhist]"}             | ${"months"} | ${"P1D"}      | ${"xscan buddhist max[1]"}
    ${"276301-07-06[u-ca=buddhist]"}             | ${"276303-09-12[u-ca=buddhist]"}             | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan buddhist max[1], 800 d inside"}
    ${"276303-08-14[u-ca=buddhist]"}             | ${"276303-09-13[u-ca=buddhist]"}             | ${"months"} | ${"P30D"}     | ${"xscan buddhist max[30]"}
    ${"276301-07-06[u-ca=buddhist]"}             | ${"276303-08-14[u-ca=buddhist]"}             | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan buddhist max[30], 800 d inside"}
    ${"276303-08-13[u-ca=buddhist]"}             | ${"276303-09-13[u-ca=buddhist]"}             | ${"months"} | ${"P1M"}      | ${"xscan buddhist max[31]"}
    ${"276301-07-06[u-ca=buddhist]"}             | ${"276303-08-13[u-ca=buddhist]"}             | ${"years"}  | ${"P2Y1M7D"}  | ${"xscan buddhist max[31], 800 d inside"}
    ${"276303-08-12[u-ca=buddhist]"}             | ${"276303-09-13[u-ca=buddhist]"}             | ${"months"} | ${"P1M1D"}    | ${"xscan buddhist max[32]"}
    ${"276301-07-06[u-ca=buddhist]"}             | ${"276303-08-12[u-ca=buddhist]"}             | ${"years"}  | ${"P2Y1M6D"}  | ${"xscan buddhist max[32], 800 d inside"}
    ${"276303-02-26[u-ca=buddhist]"}             | ${"276303-09-13[u-ca=buddhist]"}             | ${"months"} | ${"P6M18D"}   | ${"xscan buddhist max[200]"}
    ${"276301-07-06[u-ca=buddhist]"}             | ${"276303-02-26[u-ca=buddhist]"}             | ${"years"}  | ${"P1Y7M20D"} | ${"xscan buddhist max[200], 800 d inside"}
    ${"276302-08-13[u-ca=buddhist]"}             | ${"276303-09-13[u-ca=buddhist]"}             | ${"months"} | ${"P13M"}     | ${"xscan buddhist max[397]"}
    ${"276301-07-06[u-ca=buddhist]"}             | ${"276302-08-13[u-ca=buddhist]"}             | ${"years"}  | ${"P1Y1M7D"}  | ${"xscan buddhist max[397], 800 d inside"}
    ${"276302-08-12[u-ca=buddhist]"}             | ${"276303-09-13[u-ca=buddhist]"}             | ${"months"} | ${"P13M1D"}   | ${"xscan buddhist max[398]"}
    ${"276301-07-06[u-ca=buddhist]"}             | ${"276302-08-12[u-ca=buddhist]"}             | ${"years"}  | ${"P1Y1M6D"}  | ${"xscan buddhist max[398], 800 d inside"}
    ${"276302-07-21[u-ca=buddhist]"}             | ${"276303-09-13[u-ca=buddhist]"}             | ${"months"} | ${"P13M23D"}  | ${"xscan buddhist max[420]"}
    ${"276301-07-06[u-ca=buddhist]"}             | ${"276302-07-21[u-ca=buddhist]"}             | ${"years"}  | ${"P1Y15D"}   | ${"xscan buddhist max[420], 800 d inside"}
    ${"-271278-04-19[u-ca=buddhist]"}            | ${"-271276-06-27[u-ca=buddhist]"}            | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan buddhist min[0], 800 d inside"}
    ${"-271278-04-19[u-ca=buddhist]"}            | ${"-271278-04-20[u-ca=buddhist]"}            | ${"months"} | ${"P1D"}      | ${"xscan buddhist min[1]"}
    ${"-271278-04-20[u-ca=buddhist]"}            | ${"-271276-06-27[u-ca=buddhist]"}            | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan buddhist min[1], 800 d inside"}
    ${"-271278-04-19[u-ca=buddhist]"}            | ${"-271278-04-21[u-ca=buddhist]"}            | ${"months"} | ${"P2D"}      | ${"xscan buddhist min[2]"}
    ${"-271278-04-21[u-ca=buddhist]"}            | ${"-271276-06-27[u-ca=buddhist]"}            | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan buddhist min[2], 800 d inside"}
    ${"-271278-04-19[u-ca=buddhist]"}            | ${"-271278-05-19[u-ca=buddhist]"}            | ${"months"} | ${"P1M"}      | ${"xscan buddhist min[30]"}
    ${"-271278-05-19[u-ca=buddhist]"}            | ${"-271276-06-27[u-ca=buddhist]"}            | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan buddhist min[30], 800 d inside"}
    ${"-271278-04-19[u-ca=buddhist]"}            | ${"-271278-11-05[u-ca=buddhist]"}            | ${"months"} | ${"P6M17D"}   | ${"xscan buddhist min[200]"}
    ${"-271278-11-05[u-ca=buddhist]"}            | ${"-271276-06-27[u-ca=buddhist]"}            | ${"years"}  | ${"P1Y7M22D"} | ${"xscan buddhist min[200], 800 d inside"}
    ${"-271278-04-19[u-ca=buddhist]"}            | ${"-271277-06-12[u-ca=buddhist]"}            | ${"months"} | ${"P13M24D"}  | ${"xscan buddhist min[420]"}
    ${"-271277-06-12[u-ca=buddhist]"}            | ${"-271276-06-27[u-ca=buddhist]"}            | ${"years"}  | ${"P1Y15D"}   | ${"xscan buddhist min[420], 800 d inside"}
    ${"279515-08-08[u-ca=hebrew]"}               | ${"279517-10-11[u-ca=hebrew]"}               | ${"years"}  | ${"P2Y2M3D"}  | ${"xscan hebrew max[0], 800 d inside"}
    ${"279517-10-10[u-ca=hebrew]"}               | ${"279517-10-11[u-ca=hebrew]"}               | ${"months"} | ${"P1D"}      | ${"xscan hebrew max[1]"}
    ${"279515-08-08[u-ca=hebrew]"}               | ${"279517-10-10[u-ca=hebrew]"}               | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan hebrew max[1], 800 d inside"}
    ${"279517-10-06[u-ca=hebrew]"}               | ${"279517-10-11[u-ca=hebrew]"}               | ${"months"} | ${"P5D"}      | ${"xscan hebrew max[5]"}
    ${"279515-08-08[u-ca=hebrew]"}               | ${"279517-10-06[u-ca=hebrew]"}               | ${"years"}  | ${"P2Y1M27D"} | ${"xscan hebrew max[5], 800 d inside"}
    ${"279517-10-05[u-ca=hebrew]"}               | ${"279517-10-11[u-ca=hebrew]"}               | ${"months"} | ${"P6D"}      | ${"xscan hebrew max[6]"}
    ${"279515-08-08[u-ca=hebrew]"}               | ${"279517-10-05[u-ca=hebrew]"}               | ${"years"}  | ${"P2Y1M26D"} | ${"xscan hebrew max[6], 800 d inside"}
    ${"279517-09-10[u-ca=hebrew]"}               | ${"279517-10-11[u-ca=hebrew]"}               | ${"months"} | ${"P1M1D"}    | ${"xscan hebrew max[30]"}
    ${"279515-08-08[u-ca=hebrew]"}               | ${"279517-09-10[u-ca=hebrew]"}               | ${"years"}  | ${"P2Y1M2D"}  | ${"xscan hebrew max[30], 800 d inside"}
    ${"279517-03-17[u-ca=hebrew]"}               | ${"279517-10-11[u-ca=hebrew]"}               | ${"months"} | ${"P6M23D"}   | ${"xscan hebrew max[200]"}
    ${"279515-08-08[u-ca=hebrew]"}               | ${"279517-03-17[u-ca=hebrew]"}               | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan hebrew max[200], 800 d inside"}
    ${"279516-09-06[u-ca=hebrew]"}               | ${"279517-10-11[u-ca=hebrew]"}               | ${"months"} | ${"P13M5D"}   | ${"xscan hebrew max[388]"}
    ${"279515-08-08[u-ca=hebrew]"}               | ${"279516-09-06[u-ca=hebrew]"}               | ${"years"}  | ${"P1Y1M27D"} | ${"xscan hebrew max[388], 800 d inside"}
    ${"279516-09-05[u-ca=hebrew]"}               | ${"279517-10-11[u-ca=hebrew]"}               | ${"months"} | ${"P13M6D"}   | ${"xscan hebrew max[389]"}
    ${"279515-08-08[u-ca=hebrew]"}               | ${"279516-09-05[u-ca=hebrew]"}               | ${"years"}  | ${"P1Y1M26D"} | ${"xscan hebrew max[389], 800 d inside"}
    ${"279516-08-03[u-ca=hebrew]"}               | ${"279517-10-11[u-ca=hebrew]"}               | ${"months"} | ${"P14M8D"}   | ${"xscan hebrew max[420]"}
    ${"279515-08-08[u-ca=hebrew]"}               | ${"279516-08-03[u-ca=hebrew]"}               | ${"years"}  | ${"P1Y25D"}   | ${"xscan hebrew max[420], 800 d inside"}
    ${"-268058-11-04[u-ca=hebrew]"}              | ${"-268055-01-07[u-ca=hebrew]"}              | ${"years"}  | ${"P2Y2M3D"}  | ${"xscan hebrew min[0], 800 d inside"}
    ${"-268058-11-04[u-ca=hebrew]"}              | ${"-268058-11-05[u-ca=hebrew]"}              | ${"months"} | ${"P1D"}      | ${"xscan hebrew min[1]"}
    ${"-268058-11-05[u-ca=hebrew]"}              | ${"-268055-01-07[u-ca=hebrew]"}              | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan hebrew min[1], 800 d inside"}
    ${"-268058-11-04[u-ca=hebrew]"}              | ${"-268058-12-04[u-ca=hebrew]"}              | ${"months"} | ${"P1M"}      | ${"xscan hebrew min[30]"}
    ${"-268058-12-04[u-ca=hebrew]"}              | ${"-268055-01-07[u-ca=hebrew]"}              | ${"years"}  | ${"P2Y1M3D"}  | ${"xscan hebrew min[30], 800 d inside"}
    ${"-268058-11-04[u-ca=hebrew]"}              | ${"-268057-05-28[u-ca=hebrew]"}              | ${"months"} | ${"P6M24D"}   | ${"xscan hebrew min[200]"}
    ${"-268057-05-28[u-ca=hebrew]"}              | ${"-268055-01-07[u-ca=hebrew]"}              | ${"years"}  | ${"P1Y7M8D"}  | ${"xscan hebrew min[200], 800 d inside"}
    ${"-268058-11-04[u-ca=hebrew]"}              | ${"-268057-12-29[u-ca=hebrew]"}              | ${"months"} | ${"P13M25D"}  | ${"xscan hebrew min[408]"}
    ${"-268057-12-29[u-ca=hebrew]"}              | ${"-268055-01-07[u-ca=hebrew]"}              | ${"years"}  | ${"P1Y1M7D"}  | ${"xscan hebrew min[408], 800 d inside"}
    ${"-268058-11-04[u-ca=hebrew]"}              | ${"-268057-12-30[u-ca=hebrew]"}              | ${"months"} | ${"P13M26D"}  | ${"xscan hebrew min[409]"}
    ${"-268057-12-30[u-ca=hebrew]"}              | ${"-268055-01-07[u-ca=hebrew]"}              | ${"years"}  | ${"P1Y1M7D"}  | ${"xscan hebrew min[409], 800 d inside"}
    ${"-268058-11-04[u-ca=hebrew]"}              | ${"-268057-13-11[u-ca=hebrew]"}              | ${"months"} | ${"P14M7D"}   | ${"xscan hebrew min[420]"}
    ${"-268057-13-11[u-ca=hebrew]"}              | ${"-268055-01-07[u-ca=hebrew]"}              | ${"years"}  | ${"P1Y25D"}   | ${"xscan hebrew min[420], 800 d inside"}
    ${"283581-02-20[u-ca=islamic-civil]"}        | ${"283583-05-23[u-ca=islamic-civil]"}        | ${"years"}  | ${"P2Y3M3D"}  | ${"xscan islamic-civil max[0], 800 d inside"}
    ${"283583-05-22[u-ca=islamic-civil]"}        | ${"283583-05-23[u-ca=islamic-civil]"}        | ${"months"} | ${"P1D"}      | ${"xscan islamic-civil max[1]"}
    ${"283581-02-20[u-ca=islamic-civil]"}        | ${"283583-05-22[u-ca=islamic-civil]"}        | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-civil max[1], 800 d inside"}
    ${"283583-05-15[u-ca=islamic-civil]"}        | ${"283583-05-23[u-ca=islamic-civil]"}        | ${"months"} | ${"P8D"}      | ${"xscan islamic-civil max[8]"}
    ${"283581-02-20[u-ca=islamic-civil]"}        | ${"283583-05-15[u-ca=islamic-civil]"}        | ${"years"}  | ${"P2Y2M24D"} | ${"xscan islamic-civil max[8], 800 d inside"}
    ${"283583-05-14[u-ca=islamic-civil]"}        | ${"283583-05-23[u-ca=islamic-civil]"}        | ${"months"} | ${"P9D"}      | ${"xscan islamic-civil max[9]"}
    ${"283581-02-20[u-ca=islamic-civil]"}        | ${"283583-05-14[u-ca=islamic-civil]"}        | ${"years"}  | ${"P2Y2M23D"} | ${"xscan islamic-civil max[9], 800 d inside"}
    ${"283583-04-22[u-ca=islamic-civil]"}        | ${"283583-05-23[u-ca=islamic-civil]"}        | ${"months"} | ${"P1M1D"}    | ${"xscan islamic-civil max[30]"}
    ${"283581-02-20[u-ca=islamic-civil]"}        | ${"283583-04-22[u-ca=islamic-civil]"}        | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-civil max[30], 800 d inside"}
    ${"283582-10-29[u-ca=islamic-civil]"}        | ${"283583-05-23[u-ca=islamic-civil]"}        | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-civil max[200]"}
    ${"283581-02-20[u-ca=islamic-civil]"}        | ${"283582-10-29[u-ca=islamic-civil]"}        | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-civil max[200], 800 d inside"}
    ${"283582-05-15[u-ca=islamic-civil]"}        | ${"283583-05-23[u-ca=islamic-civil]"}        | ${"months"} | ${"P12M8D"}   | ${"xscan islamic-civil max[362]"}
    ${"283581-02-20[u-ca=islamic-civil]"}        | ${"283582-05-15[u-ca=islamic-civil]"}        | ${"years"}  | ${"P1Y2M24D"} | ${"xscan islamic-civil max[362], 800 d inside"}
    ${"283582-05-14[u-ca=islamic-civil]"}        | ${"283583-05-23[u-ca=islamic-civil]"}        | ${"months"} | ${"P12M9D"}   | ${"xscan islamic-civil max[363]"}
    ${"283581-02-20[u-ca=islamic-civil]"}        | ${"283582-05-14[u-ca=islamic-civil]"}        | ${"years"}  | ${"P1Y2M23D"} | ${"xscan islamic-civil max[363], 800 d inside"}
    ${"283582-03-16[u-ca=islamic-civil]"}        | ${"283583-05-23[u-ca=islamic-civil]"}        | ${"months"} | ${"P14M7D"}   | ${"xscan islamic-civil max[420]"}
    ${"283581-02-20[u-ca=islamic-civil]"}        | ${"283582-03-16[u-ca=islamic-civil]"}        | ${"years"}  | ${"P1Y25D"}   | ${"xscan islamic-civil max[420], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-civil]"}       | ${"-280802-06-23[u-ca=islamic-civil]"}       | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-civil min[0], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-civil]"}       | ${"-280804-03-22[u-ca=islamic-civil]"}       | ${"months"} | ${"P1D"}      | ${"xscan islamic-civil min[1]"}
    ${"-280804-03-22[u-ca=islamic-civil]"}       | ${"-280802-06-23[u-ca=islamic-civil]"}       | ${"years"}  | ${"P2Y3M1D"}  | ${"xscan islamic-civil min[1], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-civil]"}       | ${"-280804-04-21[u-ca=islamic-civil]"}       | ${"months"} | ${"P1M"}      | ${"xscan islamic-civil min[30]"}
    ${"-280804-04-21[u-ca=islamic-civil]"}       | ${"-280802-06-23[u-ca=islamic-civil]"}       | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-civil min[30], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-civil]"}       | ${"-280804-10-14[u-ca=islamic-civil]"}       | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-civil min[200]"}
    ${"-280804-10-14[u-ca=islamic-civil]"}       | ${"-280802-06-23[u-ca=islamic-civil]"}       | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-civil min[200], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-civil]"}       | ${"-280804-12-30[u-ca=islamic-civil]"}       | ${"months"} | ${"P9M9D"}    | ${"xscan islamic-civil min[275]"}
    ${"-280804-12-30[u-ca=islamic-civil]"}       | ${"-280802-06-23[u-ca=islamic-civil]"}       | ${"years"}  | ${"P1Y5M23D"} | ${"xscan islamic-civil min[275], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-civil]"}       | ${"-280803-01-01[u-ca=islamic-civil]"}       | ${"months"} | ${"P9M10D"}   | ${"xscan islamic-civil min[276]"}
    ${"-280803-01-01[u-ca=islamic-civil]"}       | ${"-280802-06-23[u-ca=islamic-civil]"}       | ${"years"}  | ${"P1Y5M22D"} | ${"xscan islamic-civil min[276], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-civil]"}       | ${"-280803-05-27[u-ca=islamic-civil]"}       | ${"months"} | ${"P14M6D"}   | ${"xscan islamic-civil min[420]"}
    ${"-280803-05-27[u-ca=islamic-civil]"}       | ${"-280802-06-23[u-ca=islamic-civil]"}       | ${"years"}  | ${"P1Y26D"}   | ${"xscan islamic-civil min[420], 800 d inside"}
    ${"283581-02-21[u-ca=islamic-tabular]"}      | ${"283583-05-24[u-ca=islamic-tabular]"}      | ${"years"}  | ${"P2Y3M3D"}  | ${"xscan islamic-tbla max[0], 800 d inside"}
    ${"283583-05-23[u-ca=islamic-tabular]"}      | ${"283583-05-24[u-ca=islamic-tabular]"}      | ${"months"} | ${"P1D"}      | ${"xscan islamic-tbla max[1]"}
    ${"283581-02-21[u-ca=islamic-tabular]"}      | ${"283583-05-23[u-ca=islamic-tabular]"}      | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-tbla max[1], 800 d inside"}
    ${"283583-05-16[u-ca=islamic-tabular]"}      | ${"283583-05-24[u-ca=islamic-tabular]"}      | ${"months"} | ${"P8D"}      | ${"xscan islamic-tbla max[8]"}
    ${"283581-02-21[u-ca=islamic-tabular]"}      | ${"283583-05-16[u-ca=islamic-tabular]"}      | ${"years"}  | ${"P2Y2M24D"} | ${"xscan islamic-tbla max[8], 800 d inside"}
    ${"283583-05-15[u-ca=islamic-tabular]"}      | ${"283583-05-24[u-ca=islamic-tabular]"}      | ${"months"} | ${"P9D"}      | ${"xscan islamic-tbla max[9]"}
    ${"283581-02-21[u-ca=islamic-tabular]"}      | ${"283583-05-15[u-ca=islamic-tabular]"}      | ${"years"}  | ${"P2Y2M23D"} | ${"xscan islamic-tbla max[9], 800 d inside"}
    ${"283583-04-23[u-ca=islamic-tabular]"}      | ${"283583-05-24[u-ca=islamic-tabular]"}      | ${"months"} | ${"P1M1D"}    | ${"xscan islamic-tbla max[30]"}
    ${"283581-02-21[u-ca=islamic-tabular]"}      | ${"283583-04-23[u-ca=islamic-tabular]"}      | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-tbla max[30], 800 d inside"}
    ${"283582-11-01[u-ca=islamic-tabular]"}      | ${"283583-05-24[u-ca=islamic-tabular]"}      | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-tbla max[200]"}
    ${"283581-02-21[u-ca=islamic-tabular]"}      | ${"283582-11-01[u-ca=islamic-tabular]"}      | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-tbla max[200], 800 d inside"}
    ${"283582-03-17[u-ca=islamic-tabular]"}      | ${"283583-05-24[u-ca=islamic-tabular]"}      | ${"months"} | ${"P14M7D"}   | ${"xscan islamic-tbla max[420]"}
    ${"283581-02-21[u-ca=islamic-tabular]"}      | ${"283582-03-17[u-ca=islamic-tabular]"}      | ${"years"}  | ${"P1Y25D"}   | ${"xscan islamic-tbla max[420], 800 d inside"}
    ${"-280804-03-22[u-ca=islamic-tabular]"}     | ${"-280802-06-24[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-tbla min[0], 800 d inside"}
    ${"-280804-03-22[u-ca=islamic-tabular]"}     | ${"-280804-03-23[u-ca=islamic-tabular]"}     | ${"months"} | ${"P1D"}      | ${"xscan islamic-tbla min[1]"}
    ${"-280804-03-23[u-ca=islamic-tabular]"}     | ${"-280802-06-24[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P2Y3M1D"}  | ${"xscan islamic-tbla min[1], 800 d inside"}
    ${"-280804-03-22[u-ca=islamic-tabular]"}     | ${"-280804-04-22[u-ca=islamic-tabular]"}     | ${"months"} | ${"P1M"}      | ${"xscan islamic-tbla min[30]"}
    ${"-280804-04-22[u-ca=islamic-tabular]"}     | ${"-280802-06-24[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-tbla min[30], 800 d inside"}
    ${"-280804-03-22[u-ca=islamic-tabular]"}     | ${"-280804-10-15[u-ca=islamic-tabular]"}     | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-tbla min[200]"}
    ${"-280804-10-15[u-ca=islamic-tabular]"}     | ${"-280802-06-24[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-tbla min[200], 800 d inside"}
    ${"-280804-03-22[u-ca=islamic-tabular]"}     | ${"-280804-12-30[u-ca=islamic-tabular]"}     | ${"months"} | ${"P9M8D"}    | ${"xscan islamic-tbla min[274]"}
    ${"-280804-12-30[u-ca=islamic-tabular]"}     | ${"-280802-06-24[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P1Y5M24D"} | ${"xscan islamic-tbla min[274], 800 d inside"}
    ${"-280804-03-22[u-ca=islamic-tabular]"}     | ${"-280803-01-01[u-ca=islamic-tabular]"}     | ${"months"} | ${"P9M9D"}    | ${"xscan islamic-tbla min[275]"}
    ${"-280803-01-01[u-ca=islamic-tabular]"}     | ${"-280802-06-24[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P1Y5M23D"} | ${"xscan islamic-tbla min[275], 800 d inside"}
    ${"-280804-03-22[u-ca=islamic-tabular]"}     | ${"-280803-05-28[u-ca=islamic-tabular]"}     | ${"months"} | ${"P14M6D"}   | ${"xscan islamic-tbla min[420]"}
    ${"-280803-05-28[u-ca=islamic-tabular]"}     | ${"-280802-06-24[u-ca=islamic-tabular]"}     | ${"years"}  | ${"P1Y26D"}   | ${"xscan islamic-tbla min[420], 800 d inside"}
    ${"283581-02-20[u-ca=islamic-umalqura]"}     | ${"283583-05-23[u-ca=islamic-umalqura]"}     | ${"years"}  | ${"P2Y3M3D"}  | ${"xscan islamic-umalqura max[0], 800 d inside"}
    ${"283583-05-22[u-ca=islamic-umalqura]"}     | ${"283583-05-23[u-ca=islamic-umalqura]"}     | ${"months"} | ${"P1D"}      | ${"xscan islamic-umalqura max[1]"}
    ${"283581-02-20[u-ca=islamic-umalqura]"}     | ${"283583-05-22[u-ca=islamic-umalqura]"}     | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-umalqura max[1], 800 d inside"}
    ${"283583-05-15[u-ca=islamic-umalqura]"}     | ${"283583-05-23[u-ca=islamic-umalqura]"}     | ${"months"} | ${"P8D"}      | ${"xscan islamic-umalqura max[8]"}
    ${"283581-02-20[u-ca=islamic-umalqura]"}     | ${"283583-05-15[u-ca=islamic-umalqura]"}     | ${"years"}  | ${"P2Y2M24D"} | ${"xscan islamic-umalqura max[8], 800 d inside"}
    ${"283583-05-14[u-ca=islamic-umalqura]"}     | ${"283583-05-23[u-ca=islamic-umalqura]"}     | ${"months"} | ${"P9D"}      | ${"xscan islamic-umalqura max[9]"}
    ${"283581-02-20[u-ca=islamic-umalqura]"}     | ${"283583-05-14[u-ca=islamic-umalqura]"}     | ${"years"}  | ${"P2Y2M23D"} | ${"xscan islamic-umalqura max[9], 800 d inside"}
    ${"283583-04-22[u-ca=islamic-umalqura]"}     | ${"283583-05-23[u-ca=islamic-umalqura]"}     | ${"months"} | ${"P1M1D"}    | ${"xscan islamic-umalqura max[30]"}
    ${"283581-02-20[u-ca=islamic-umalqura]"}     | ${"283583-04-22[u-ca=islamic-umalqura]"}     | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-umalqura max[30], 800 d inside"}
    ${"283582-10-29[u-ca=islamic-umalqura]"}     | ${"283583-05-23[u-ca=islamic-umalqura]"}     | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-umalqura max[200]"}
    ${"283581-02-20[u-ca=islamic-umalqura]"}     | ${"283582-10-29[u-ca=islamic-umalqura]"}     | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-umalqura max[200], 800 d inside"}
    ${"283582-05-15[u-ca=islamic-umalqura]"}     | ${"283583-05-23[u-ca=islamic-umalqura]"}     | ${"months"} | ${"P12M8D"}   | ${"xscan islamic-umalqura max[362]"}
    ${"283581-02-20[u-ca=islamic-umalqura]"}     | ${"283582-05-15[u-ca=islamic-umalqura]"}     | ${"years"}  | ${"P1Y2M24D"} | ${"xscan islamic-umalqura max[362], 800 d inside"}
    ${"283582-05-14[u-ca=islamic-umalqura]"}     | ${"283583-05-23[u-ca=islamic-umalqura]"}     | ${"months"} | ${"P12M9D"}   | ${"xscan islamic-umalqura max[363]"}
    ${"283581-02-20[u-ca=islamic-umalqura]"}     | ${"283582-05-14[u-ca=islamic-umalqura]"}     | ${"years"}  | ${"P1Y2M23D"} | ${"xscan islamic-umalqura max[363], 800 d inside"}
    ${"283582-03-16[u-ca=islamic-umalqura]"}     | ${"283583-05-23[u-ca=islamic-umalqura]"}     | ${"months"} | ${"P14M7D"}   | ${"xscan islamic-umalqura max[420]"}
    ${"283581-02-20[u-ca=islamic-umalqura]"}     | ${"283582-03-16[u-ca=islamic-umalqura]"}     | ${"years"}  | ${"P1Y25D"}   | ${"xscan islamic-umalqura max[420], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-umalqura]"}    | ${"-280802-06-23[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P2Y3M2D"}  | ${"xscan islamic-umalqura min[0], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-umalqura]"}    | ${"-280804-03-22[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P1D"}      | ${"xscan islamic-umalqura min[1]"}
    ${"-280804-03-22[u-ca=islamic-umalqura]"}    | ${"-280802-06-23[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P2Y3M1D"}  | ${"xscan islamic-umalqura min[1], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-umalqura]"}    | ${"-280804-04-21[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P1M"}      | ${"xscan islamic-umalqura min[30]"}
    ${"-280804-04-21[u-ca=islamic-umalqura]"}    | ${"-280802-06-23[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P2Y2M2D"}  | ${"xscan islamic-umalqura min[30], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-umalqura]"}    | ${"-280804-10-14[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P6M23D"}   | ${"xscan islamic-umalqura min[200]"}
    ${"-280804-10-14[u-ca=islamic-umalqura]"}    | ${"-280802-06-23[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1Y8M9D"}  | ${"xscan islamic-umalqura min[200], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-umalqura]"}    | ${"-280804-12-30[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P9M9D"}    | ${"xscan islamic-umalqura min[275]"}
    ${"-280804-12-30[u-ca=islamic-umalqura]"}    | ${"-280802-06-23[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1Y5M23D"} | ${"xscan islamic-umalqura min[275], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-umalqura]"}    | ${"-280803-01-01[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P9M10D"}   | ${"xscan islamic-umalqura min[276]"}
    ${"-280803-01-01[u-ca=islamic-umalqura]"}    | ${"-280802-06-23[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1Y5M22D"} | ${"xscan islamic-umalqura min[276], 800 d inside"}
    ${"-280804-03-21[u-ca=islamic-umalqura]"}    | ${"-280803-05-27[u-ca=islamic-umalqura]"}    | ${"months"} | ${"P14M6D"}   | ${"xscan islamic-umalqura min[420]"}
    ${"-280803-05-27[u-ca=islamic-umalqura]"}    | ${"-280802-06-23[u-ca=islamic-umalqura]"}    | ${"years"}  | ${"P1Y26D"}   | ${"xscan islamic-umalqura min[420], 800 d inside"}
    ${"275137-05-05[u-ca=persian]"}              | ${"275139-07-12[u-ca=persian]"}              | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan persian max[0], 800 d inside"}
    ${"275139-07-11[u-ca=persian]"}              | ${"275139-07-12[u-ca=persian]"}              | ${"months"} | ${"P1D"}      | ${"xscan persian max[1]"}
    ${"275137-05-05[u-ca=persian]"}              | ${"275139-07-11[u-ca=persian]"}              | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan persian max[1], 800 d inside"}
    ${"275139-06-13[u-ca=persian]"}              | ${"275139-07-12[u-ca=persian]"}              | ${"months"} | ${"P30D"}     | ${"xscan persian max[30]"}
    ${"275137-05-05[u-ca=persian]"}              | ${"275139-06-13[u-ca=persian]"}              | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan persian max[30], 800 d inside"}
    ${"275138-12-28[u-ca=persian]"}              | ${"275139-07-12[u-ca=persian]"}              | ${"months"} | ${"P6M15D"}   | ${"xscan persian max[200]"}
    ${"275137-05-05[u-ca=persian]"}              | ${"275138-12-28[u-ca=persian]"}              | ${"years"}  | ${"P1Y7M23D"} | ${"xscan persian max[200], 800 d inside"}
    ${"275138-05-20[u-ca=persian]"}              | ${"275139-07-12[u-ca=persian]"}              | ${"months"} | ${"P13M23D"}  | ${"xscan persian max[420]"}
    ${"275137-05-05[u-ca=persian]"}              | ${"275138-05-20[u-ca=persian]"}              | ${"years"}  | ${"P1Y15D"}   | ${"xscan persian max[420], 800 d inside"}
    ${"-272442-01-09[u-ca=persian]"}             | ${"-272440-03-17[u-ca=persian]"}             | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan persian min[0], 800 d inside"}
    ${"-272442-01-09[u-ca=persian]"}             | ${"-272442-01-10[u-ca=persian]"}             | ${"months"} | ${"P1D"}      | ${"xscan persian min[1]"}
    ${"-272442-01-10[u-ca=persian]"}             | ${"-272440-03-17[u-ca=persian]"}             | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan persian min[1], 800 d inside"}
    ${"-272442-01-09[u-ca=persian]"}             | ${"-272442-02-08[u-ca=persian]"}             | ${"months"} | ${"P30D"}     | ${"xscan persian min[30]"}
    ${"-272442-02-08[u-ca=persian]"}             | ${"-272440-03-17[u-ca=persian]"}             | ${"years"}  | ${"P2Y1M9D"}  | ${"xscan persian min[30], 800 d inside"}
    ${"-272442-01-09[u-ca=persian]"}             | ${"-272442-07-23[u-ca=persian]"}             | ${"months"} | ${"P6M14D"}   | ${"xscan persian min[200]"}
    ${"-272442-07-23[u-ca=persian]"}             | ${"-272440-03-17[u-ca=persian]"}             | ${"years"}  | ${"P1Y7M25D"} | ${"xscan persian min[200], 800 d inside"}
    ${"-272442-01-09[u-ca=persian]"}             | ${"-272442-12-29[u-ca=persian]"}             | ${"months"} | ${"P11M20D"}  | ${"xscan persian min[356]"}
    ${"-272442-12-29[u-ca=persian]"}             | ${"-272440-03-17[u-ca=persian]"}             | ${"years"}  | ${"P1Y2M19D"} | ${"xscan persian min[356], 800 d inside"}
    ${"-272442-01-09[u-ca=persian]"}             | ${"-272441-01-01[u-ca=persian]"}             | ${"months"} | ${"P11M21D"}  | ${"xscan persian min[357]"}
    ${"-272441-01-01[u-ca=persian]"}             | ${"-272440-03-17[u-ca=persian]"}             | ${"years"}  | ${"P1Y2M16D"} | ${"xscan persian min[357], 800 d inside"}
    ${"-272442-01-09[u-ca=persian]"}             | ${"-272441-03-02[u-ca=persian]"}             | ${"months"} | ${"P13M24D"}  | ${"xscan persian min[420]"}
    ${"-272441-03-02[u-ca=persian]"}             | ${"-272440-03-17[u-ca=persian]"}             | ${"years"}  | ${"P1Y15D"}   | ${"xscan persian min[420], 800 d inside"}
    ${"275680-04-15[u-ca=indian]"}               | ${"275682-06-22[u-ca=indian]"}               | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan indian max[0], 800 d inside"}
    ${"275682-06-21[u-ca=indian]"}               | ${"275682-06-22[u-ca=indian]"}               | ${"months"} | ${"P1D"}      | ${"xscan indian max[1]"}
    ${"275680-04-15[u-ca=indian]"}               | ${"275682-06-21[u-ca=indian]"}               | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan indian max[1], 800 d inside"}
    ${"275682-05-23[u-ca=indian]"}               | ${"275682-06-22[u-ca=indian]"}               | ${"months"} | ${"P30D"}     | ${"xscan indian max[30]"}
    ${"275680-04-15[u-ca=indian]"}               | ${"275682-05-23[u-ca=indian]"}               | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan indian max[30], 800 d inside"}
    ${"275681-12-07[u-ca=indian]"}               | ${"275682-06-22[u-ca=indian]"}               | ${"months"} | ${"P6M15D"}   | ${"xscan indian max[200]"}
    ${"275680-04-15[u-ca=indian]"}               | ${"275681-12-07[u-ca=indian]"}               | ${"years"}  | ${"P1Y7M22D"} | ${"xscan indian max[200], 800 d inside"}
    ${"275681-04-30[u-ca=indian]"}               | ${"275682-06-22[u-ca=indian]"}               | ${"months"} | ${"P13M23D"}  | ${"xscan indian max[420]"}
    ${"275680-04-15[u-ca=indian]"}               | ${"275681-04-30[u-ca=indian]"}               | ${"years"}  | ${"P1Y15D"}   | ${"xscan indian max[420], 800 d inside"}
    ${"-271899-01-29[u-ca=indian]"}              | ${"-271897-04-06[u-ca=indian]"}              | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan indian min[0], 800 d inside"}
    ${"-271899-01-29[u-ca=indian]"}              | ${"-271899-01-30[u-ca=indian]"}              | ${"months"} | ${"P1D"}      | ${"xscan indian min[1]"}
    ${"-271899-01-30[u-ca=indian]"}              | ${"-271897-04-06[u-ca=indian]"}              | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan indian min[1], 800 d inside"}
    ${"-271899-01-29[u-ca=indian]"}              | ${"-271899-02-29[u-ca=indian]"}              | ${"months"} | ${"P1M"}      | ${"xscan indian min[30]"}
    ${"-271899-02-29[u-ca=indian]"}              | ${"-271897-04-06[u-ca=indian]"}              | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan indian min[30], 800 d inside"}
    ${"-271899-01-29[u-ca=indian]"}              | ${"-271899-08-14[u-ca=indian]"}              | ${"months"} | ${"P6M15D"}   | ${"xscan indian min[200]"}
    ${"-271899-08-14[u-ca=indian]"}              | ${"-271897-04-06[u-ca=indian]"}              | ${"years"}  | ${"P1Y7M23D"} | ${"xscan indian min[200], 800 d inside"}
    ${"-271899-01-29[u-ca=indian]"}              | ${"-271898-03-22[u-ca=indian]"}              | ${"months"} | ${"P13M24D"}  | ${"xscan indian min[420]"}
    ${"-271898-03-22[u-ca=indian]"}              | ${"-271897-04-06[u-ca=indian]"}              | ${"years"}  | ${"P1Y15D"}   | ${"xscan indian min[420], 800 d inside"}
    ${"281245-03-12[u-ca=ethiopic-amete-alem]"}  | ${"281247-05-22[u-ca=ethiopic-amete-alem]"}  | ${"years"}  | ${"P2Y2M10D"} | ${"xscan ethioaa max[0], 800 d inside"}
    ${"281247-05-21[u-ca=ethiopic-amete-alem]"}  | ${"281247-05-22[u-ca=ethiopic-amete-alem]"}  | ${"months"} | ${"P1D"}      | ${"xscan ethioaa max[1]"}
    ${"281245-03-12[u-ca=ethiopic-amete-alem]"}  | ${"281247-05-21[u-ca=ethiopic-amete-alem]"}  | ${"years"}  | ${"P2Y2M9D"}  | ${"xscan ethioaa max[1], 800 d inside"}
    ${"281247-04-22[u-ca=ethiopic-amete-alem]"}  | ${"281247-05-22[u-ca=ethiopic-amete-alem]"}  | ${"months"} | ${"P1M"}      | ${"xscan ethioaa max[30]"}
    ${"281245-03-12[u-ca=ethiopic-amete-alem]"}  | ${"281247-04-22[u-ca=ethiopic-amete-alem]"}  | ${"years"}  | ${"P2Y1M10D"} | ${"xscan ethioaa max[30], 800 d inside"}
    ${"281246-11-07[u-ca=ethiopic-amete-alem]"}  | ${"281247-05-22[u-ca=ethiopic-amete-alem]"}  | ${"months"} | ${"P7M15D"}   | ${"xscan ethioaa max[200]"}
    ${"281245-03-12[u-ca=ethiopic-amete-alem]"}  | ${"281246-11-07[u-ca=ethiopic-amete-alem]"}  | ${"years"}  | ${"P1Y7M25D"} | ${"xscan ethioaa max[200], 800 d inside"}
    ${"281246-03-27[u-ca=ethiopic-amete-alem]"}  | ${"281247-05-22[u-ca=ethiopic-amete-alem]"}  | ${"months"} | ${"P14M25D"}  | ${"xscan ethioaa max[420]"}
    ${"281245-03-12[u-ca=ethiopic-amete-alem]"}  | ${"281246-03-27[u-ca=ethiopic-amete-alem]"}  | ${"years"}  | ${"P1Y15D"}   | ${"xscan ethioaa max[420], 800 d inside"}
    ${"-266323-03-23[u-ca=ethiopic-amete-alem]"} | ${"-266321-06-03[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P2Y2M10D"} | ${"xscan ethioaa min[0], 800 d inside"}
    ${"-266323-03-23[u-ca=ethiopic-amete-alem]"} | ${"-266323-03-24[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P1D"}      | ${"xscan ethioaa min[1]"}
    ${"-266323-03-24[u-ca=ethiopic-amete-alem]"} | ${"-266321-06-03[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P2Y2M9D"}  | ${"xscan ethioaa min[1], 800 d inside"}
    ${"-266323-03-23[u-ca=ethiopic-amete-alem]"} | ${"-266323-04-23[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P1M"}      | ${"xscan ethioaa min[30]"}
    ${"-266323-04-23[u-ca=ethiopic-amete-alem]"} | ${"-266321-06-03[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P2Y1M10D"} | ${"xscan ethioaa min[30], 800 d inside"}
    ${"-266323-03-23[u-ca=ethiopic-amete-alem]"} | ${"-266323-10-13[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P6M20D"}   | ${"xscan ethioaa min[200]"}
    ${"-266323-10-13[u-ca=ethiopic-amete-alem]"} | ${"-266321-06-03[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P1Y8M20D"} | ${"xscan ethioaa min[200], 800 d inside"}
    ${"-266323-03-23[u-ca=ethiopic-amete-alem]"} | ${"-266322-05-18[u-ca=ethiopic-amete-alem]"} | ${"months"} | ${"P14M25D"}  | ${"xscan ethioaa min[420]"}
    ${"-266322-05-18[u-ca=ethiopic-amete-alem]"} | ${"-266321-06-03[u-ca=ethiopic-amete-alem]"} | ${"years"}  | ${"P1Y15D"}   | ${"xscan ethioaa min[420], 800 d inside"}
    ${"273740-07-06[u-ca=japanese;era=reiwa]"}   | ${"273742-09-13[u-ca=japanese;era=reiwa]"}   | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan japanese max[0], 800 d inside"}
    ${"273742-09-12[u-ca=japanese;era=reiwa]"}   | ${"273742-09-13[u-ca=japanese;era=reiwa]"}   | ${"months"} | ${"P1D"}      | ${"xscan japanese max[1]"}
    ${"273740-07-06[u-ca=japanese;era=reiwa]"}   | ${"273742-09-12[u-ca=japanese;era=reiwa]"}   | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan japanese max[1], 800 d inside"}
    ${"273742-08-14[u-ca=japanese;era=reiwa]"}   | ${"273742-09-13[u-ca=japanese;era=reiwa]"}   | ${"months"} | ${"P30D"}     | ${"xscan japanese max[30]"}
    ${"273740-07-06[u-ca=japanese;era=reiwa]"}   | ${"273742-08-14[u-ca=japanese;era=reiwa]"}   | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan japanese max[30], 800 d inside"}
    ${"273742-02-26[u-ca=japanese;era=reiwa]"}   | ${"273742-09-13[u-ca=japanese;era=reiwa]"}   | ${"months"} | ${"P6M18D"}   | ${"xscan japanese max[200]"}
    ${"273740-07-06[u-ca=japanese;era=reiwa]"}   | ${"273742-02-26[u-ca=japanese;era=reiwa]"}   | ${"years"}  | ${"P1Y7M20D"} | ${"xscan japanese max[200], 800 d inside"}
    ${"273741-07-21[u-ca=japanese;era=reiwa]"}   | ${"273742-09-13[u-ca=japanese;era=reiwa]"}   | ${"months"} | ${"P13M23D"}  | ${"xscan japanese max[420]"}
    ${"273740-07-06[u-ca=japanese;era=reiwa]"}   | ${"273741-07-21[u-ca=japanese;era=reiwa]"}   | ${"years"}  | ${"P1Y15D"}   | ${"xscan japanese max[420], 800 d inside"}
    ${"271822-04-19[u-ca=japanese;era=bce]"}     | ${"271820-06-27[u-ca=japanese;era=bce]"}     | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan japanese min[0], 800 d inside"}
    ${"271822-04-19[u-ca=japanese;era=bce]"}     | ${"271822-04-20[u-ca=japanese;era=bce]"}     | ${"months"} | ${"P1D"}      | ${"xscan japanese min[1]"}
    ${"271822-04-20[u-ca=japanese;era=bce]"}     | ${"271820-06-27[u-ca=japanese;era=bce]"}     | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan japanese min[1], 800 d inside"}
    ${"271822-04-19[u-ca=japanese;era=bce]"}     | ${"271822-05-19[u-ca=japanese;era=bce]"}     | ${"months"} | ${"P1M"}      | ${"xscan japanese min[30]"}
    ${"271822-05-19[u-ca=japanese;era=bce]"}     | ${"271820-06-27[u-ca=japanese;era=bce]"}     | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan japanese min[30], 800 d inside"}
    ${"271822-04-19[u-ca=japanese;era=bce]"}     | ${"271822-11-05[u-ca=japanese;era=bce]"}     | ${"months"} | ${"P6M17D"}   | ${"xscan japanese min[200]"}
    ${"271822-11-05[u-ca=japanese;era=bce]"}     | ${"271820-06-27[u-ca=japanese;era=bce]"}     | ${"years"}  | ${"P1Y7M22D"} | ${"xscan japanese min[200], 800 d inside"}
    ${"271822-04-19[u-ca=japanese;era=bce]"}     | ${"271821-06-12[u-ca=japanese;era=bce]"}     | ${"months"} | ${"P13M24D"}  | ${"xscan japanese min[420]"}
    ${"271821-06-12[u-ca=japanese;era=bce]"}     | ${"271820-06-27[u-ca=japanese;era=bce]"}     | ${"years"}  | ${"P1Y15D"}   | ${"xscan japanese min[420], 800 d inside"}
    ${"273847-07-06[u-ca=taiwan]"}               | ${"273849-09-13[u-ca=taiwan]"}               | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan roc max[0], 800 d inside"}
    ${"273849-09-12[u-ca=taiwan]"}               | ${"273849-09-13[u-ca=taiwan]"}               | ${"months"} | ${"P1D"}      | ${"xscan roc max[1]"}
    ${"273847-07-06[u-ca=taiwan]"}               | ${"273849-09-12[u-ca=taiwan]"}               | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan roc max[1], 800 d inside"}
    ${"273849-08-14[u-ca=taiwan]"}               | ${"273849-09-13[u-ca=taiwan]"}               | ${"months"} | ${"P30D"}     | ${"xscan roc max[30]"}
    ${"273847-07-06[u-ca=taiwan]"}               | ${"273849-08-14[u-ca=taiwan]"}               | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan roc max[30], 800 d inside"}
    ${"273849-02-26[u-ca=taiwan]"}               | ${"273849-09-13[u-ca=taiwan]"}               | ${"months"} | ${"P6M18D"}   | ${"xscan roc max[200]"}
    ${"273847-07-06[u-ca=taiwan]"}               | ${"273849-02-26[u-ca=taiwan]"}               | ${"years"}  | ${"P1Y7M20D"} | ${"xscan roc max[200], 800 d inside"}
    ${"273848-07-21[u-ca=taiwan]"}               | ${"273849-09-13[u-ca=taiwan]"}               | ${"months"} | ${"P13M23D"}  | ${"xscan roc max[420]"}
    ${"273847-07-06[u-ca=taiwan]"}               | ${"273848-07-21[u-ca=taiwan]"}               | ${"years"}  | ${"P1Y15D"}   | ${"xscan roc max[420], 800 d inside"}
    ${"-273732-04-19[u-ca=taiwan]"}              | ${"-273730-06-27[u-ca=taiwan]"}              | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan roc min[0], 800 d inside"}
    ${"-273732-04-19[u-ca=taiwan]"}              | ${"-273732-04-20[u-ca=taiwan]"}              | ${"months"} | ${"P1D"}      | ${"xscan roc min[1]"}
    ${"-273732-04-20[u-ca=taiwan]"}              | ${"-273730-06-27[u-ca=taiwan]"}              | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan roc min[1], 800 d inside"}
    ${"-273732-04-19[u-ca=taiwan]"}              | ${"-273732-05-19[u-ca=taiwan]"}              | ${"months"} | ${"P1M"}      | ${"xscan roc min[30]"}
    ${"-273732-05-19[u-ca=taiwan]"}              | ${"-273730-06-27[u-ca=taiwan]"}              | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan roc min[30], 800 d inside"}
    ${"-273732-04-19[u-ca=taiwan]"}              | ${"-273732-11-05[u-ca=taiwan]"}              | ${"months"} | ${"P6M17D"}   | ${"xscan roc min[200]"}
    ${"-273732-11-05[u-ca=taiwan]"}              | ${"-273730-06-27[u-ca=taiwan]"}              | ${"years"}  | ${"P1Y7M22D"} | ${"xscan roc min[200], 800 d inside"}
    ${"-273732-04-19[u-ca=taiwan]"}              | ${"-273731-06-12[u-ca=taiwan]"}              | ${"months"} | ${"P13M24D"}  | ${"xscan roc min[420]"}
    ${"-273731-06-12[u-ca=taiwan]"}              | ${"-273730-06-27[u-ca=taiwan]"}              | ${"years"}  | ${"P1Y15D"}   | ${"xscan roc min[420], 800 d inside"}
    ${"+275758-07-06"}                           | ${"+275760-09-13"}                           | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan gregory max[0], 800 d inside"}
    ${"+275760-09-12"}                           | ${"+275760-09-13"}                           | ${"months"} | ${"P1D"}      | ${"xscan gregory max[1]"}
    ${"+275758-07-06"}                           | ${"+275760-09-12"}                           | ${"years"}  | ${"P2Y2M6D"}  | ${"xscan gregory max[1], 800 d inside"}
    ${"+275760-08-14"}                           | ${"+275760-09-13"}                           | ${"months"} | ${"P30D"}     | ${"xscan gregory max[30]"}
    ${"+275758-07-06"}                           | ${"+275760-08-14"}                           | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan gregory max[30], 800 d inside"}
    ${"+275760-02-26"}                           | ${"+275760-09-13"}                           | ${"months"} | ${"P6M18D"}   | ${"xscan gregory max[200]"}
    ${"+275758-07-06"}                           | ${"+275760-02-26"}                           | ${"years"}  | ${"P1Y7M20D"} | ${"xscan gregory max[200], 800 d inside"}
    ${"+275759-07-21"}                           | ${"+275760-09-13"}                           | ${"months"} | ${"P13M23D"}  | ${"xscan gregory max[420]"}
    ${"+275758-07-06"}                           | ${"+275759-07-21"}                           | ${"years"}  | ${"P1Y15D"}   | ${"xscan gregory max[420], 800 d inside"}
    ${"-271821-04-19"}                           | ${"-271819-06-27"}                           | ${"years"}  | ${"P2Y2M8D"}  | ${"xscan gregory min[0], 800 d inside"}
    ${"-271821-04-19"}                           | ${"-271821-04-20"}                           | ${"months"} | ${"P1D"}      | ${"xscan gregory min[1]"}
    ${"-271821-04-20"}                           | ${"-271819-06-27"}                           | ${"years"}  | ${"P2Y2M7D"}  | ${"xscan gregory min[1], 800 d inside"}
    ${"-271821-04-19"}                           | ${"-271821-05-19"}                           | ${"months"} | ${"P1M"}      | ${"xscan gregory min[30]"}
    ${"-271821-05-19"}                           | ${"-271819-06-27"}                           | ${"years"}  | ${"P2Y1M8D"}  | ${"xscan gregory min[30], 800 d inside"}
    ${"-271821-04-19"}                           | ${"-271821-11-05"}                           | ${"months"} | ${"P6M17D"}   | ${"xscan gregory min[200]"}
    ${"-271821-11-05"}                           | ${"-271819-06-27"}                           | ${"years"}  | ${"P1Y7M22D"} | ${"xscan gregory min[200], 800 d inside"}
    ${"-271821-04-19"}                           | ${"-271820-06-12"}                           | ${"months"} | ${"P13M24D"}  | ${"xscan gregory min[420]"}
    ${"-271820-06-12"}                           | ${"-271819-06-27"}                           | ${"years"}  | ${"P1Y15D"}   | ${"xscan gregory min[420], 800 d inside"}
  `(
    "returns $expected in $unit from $date1 to $date2 ($source)",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );
});

describe("diffDateAsDuration across the whole range (CORE-6 §4.4 strides)", () => {
  it.each`
    date1                                        | date2                                        | unit       | expected      | source
    ${"-134392-01-24[u-ca=buddhist]"}            | ${"-134391-02-28[u-ca=buddhist]"}            | ${"years"} | ${"P1Y1M4D"}  | ${"stride buddhist k=500, +400 d"}
    ${"2217-04-30[u-ca=buddhist]"}               | ${"2218-06-04[u-ca=buddhist]"}               | ${"years"} | ${"P1Y1M5D"}  | ${"stride buddhist k=999, +400 d"}
    ${"2491-02-05[u-ca=buddhist]"}               | ${"2492-03-11[u-ca=buddhist]"}               | ${"years"} | ${"P1Y1M6D"}  | ${"stride buddhist k=1000, +400 d"}
    ${"139374-02-15[u-ca=buddhist]"}             | ${"139375-03-21[u-ca=buddhist]"}             | ${"years"} | ${"P1Y1M6D"}  | ${"stride buddhist k=1500, +400 d"}
    ${"276257-02-26[u-ca=buddhist]"}             | ${"276258-04-02[u-ca=buddhist]"}             | ${"years"} | ${"P1Y1M7D"}  | ${"stride buddhist k=2000, +400 d"}
    ${"-131174-12-26[u-ca=hebrew]"}              | ${"-131172-01-14[u-ca=hebrew]"}              | ${"years"} | ${"P1Y17D"}   | ${"stride hebrew k=500, +400 d"}
    ${"5160-11-23[u-ca=hebrew]"}                 | ${"5161-12-11[u-ca=hebrew]"}                 | ${"years"} | ${"P1Y1M18D"} | ${"stride hebrew k=998, +400 d"}
    ${"5434-08-24[u-ca=hebrew]"}                 | ${"5435-09-10[u-ca=hebrew]"}                 | ${"years"} | ${"P1Y1M15D"} | ${"stride hebrew k=999, +400 d"}
    ${"5708-05-25[u-ca=hebrew]"}                 | ${"5709-06-10[u-ca=hebrew]"}                 | ${"years"} | ${"P1Y15D"}   | ${"stride hebrew k=1000, +400 d"}
    ${"142589-10-21[u-ca=hebrew]"}               | ${"142590-12-09[u-ca=hebrew]"}               | ${"years"} | ${"P1Y17D"}   | ${"stride hebrew k=1500, +400 d"}
    ${"279471-03-19[u-ca=hebrew]"}               | ${"279472-04-05[u-ca=hebrew]"}               | ${"years"} | ${"P1Y16D"}   | ${"stride hebrew k=2000, +400 d"}
    ${"-280801-01-17[u-ca=islamic-civil]"}       | ${"-280800-03-03[u-ca=islamic-civil]"}       | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-civil k=0, +400 d"}
    ${"-139717-02-20[u-ca=islamic-civil]"}       | ${"-139716-04-07[u-ca=islamic-civil]"}       | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-civil k=500, +400 d"}
    ${"0802-11-23[u-ca=islamic-civil]"}          | ${"0804-01-10[u-ca=islamic-civil]"}          | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-civil k=998, +400 d"}
    ${"1085-01-24[u-ca=islamic-civil]"}          | ${"1086-03-10[u-ca=islamic-civil]"}          | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-civil k=999, +400 d"}
    ${"1367-03-24[u-ca=islamic-civil]"}          | ${"1368-05-11[u-ca=islamic-civil]"}          | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-civil k=1000, +400 d"}
    ${"142451-04-27[u-ca=islamic-civil]"}        | ${"142452-06-14[u-ca=islamic-civil]"}        | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-civil k=1500, +400 d"}
    ${"283535-06-02[u-ca=islamic-civil]"}        | ${"283536-07-18[u-ca=islamic-civil]"}        | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-civil k=2000, +400 d"}
    ${"-280801-01-18[u-ca=islamic-tabular]"}     | ${"-280800-03-04[u-ca=islamic-tabular]"}     | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-tbla k=0, +400 d"}
    ${"-139717-02-21[u-ca=islamic-tabular]"}     | ${"-139716-04-08[u-ca=islamic-tabular]"}     | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-tbla k=500, +400 d"}
    ${"0802-11-24[u-ca=islamic-tabular]"}        | ${"0804-01-11[u-ca=islamic-tabular]"}        | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-tbla k=998, +400 d"}
    ${"1085-01-25[u-ca=islamic-tabular]"}        | ${"1086-03-11[u-ca=islamic-tabular]"}        | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-tbla k=999, +400 d"}
    ${"1367-03-25[u-ca=islamic-tabular]"}        | ${"1368-05-12[u-ca=islamic-tabular]"}        | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-tbla k=1000, +400 d"}
    ${"142451-04-28[u-ca=islamic-tabular]"}      | ${"142452-06-15[u-ca=islamic-tabular]"}      | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-tbla k=1500, +400 d"}
    ${"283535-06-03[u-ca=islamic-tabular]"}      | ${"283536-07-19[u-ca=islamic-tabular]"}      | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-tbla k=2000, +400 d"}
    ${"-280801-01-17[u-ca=islamic-umalqura]"}    | ${"-280800-03-03[u-ca=islamic-umalqura]"}    | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-umalqura k=0, +400 d"}
    ${"-139717-02-20[u-ca=islamic-umalqura]"}    | ${"-139716-04-07[u-ca=islamic-umalqura]"}    | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-umalqura k=500, +400 d"}
    ${"0802-11-23[u-ca=islamic-umalqura]"}       | ${"0804-01-10[u-ca=islamic-umalqura]"}       | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-umalqura k=998, +400 d"}
    ${"1085-01-24[u-ca=islamic-umalqura]"}       | ${"1086-03-10[u-ca=islamic-umalqura]"}       | ${"years"} | ${"P1Y1M15D"} | ${"stride islamic-umalqura k=999, +400 d"}
    ${"142451-04-27[u-ca=islamic-umalqura]"}     | ${"142452-06-14[u-ca=islamic-umalqura]"}     | ${"years"} | ${"P1Y1M17D"} | ${"stride islamic-umalqura k=1500, +400 d"}
    ${"283535-06-02[u-ca=islamic-umalqura]"}     | ${"283536-07-18[u-ca=islamic-umalqura]"}     | ${"years"} | ${"P1Y1M16D"} | ${"stride islamic-umalqura k=2000, +400 d"}
    ${"-272440-10-03[u-ca=persian]"}             | ${"-272439-11-08[u-ca=persian]"}             | ${"years"} | ${"P1Y1M5D"}  | ${"stride persian k=0, +400 d"}
    ${"-135557-10-24[u-ca=persian]"}             | ${"-135556-11-29[u-ca=persian]"}             | ${"years"} | ${"P1Y1M5D"}  | ${"stride persian k=500, +400 d"}
    ${"0779-05-03[u-ca=persian]"}                | ${"0780-06-07[u-ca=persian]"}                | ${"years"} | ${"P1Y1M4D"}  | ${"stride persian k=998, +400 d"}
    ${"1053-02-11[u-ca=persian]"}                | ${"1054-03-14[u-ca=persian]"}                | ${"years"} | ${"P1Y1M3D"}  | ${"stride persian k=999, +400 d"}
    ${"1326-11-15[u-ca=persian]"}                | ${"1327-12-20[u-ca=persian]"}                | ${"years"} | ${"P1Y1M5D"}  | ${"stride persian k=1000, +400 d"}
    ${"138209-12-07[u-ca=persian]"}              | ${"138211-01-12[u-ca=persian]"}              | ${"years"} | ${"P1Y1M5D"}  | ${"stride persian k=1500, +400 d"}
    ${"275092-12-28[u-ca=persian]"}              | ${"275094-02-02[u-ca=persian]"}              | ${"years"} | ${"P1Y1M5D"}  | ${"stride persian k=2000, +400 d"}
    ${"-135014-11-04[u-ca=indian]"}              | ${"-135013-12-09[u-ca=indian]"}              | ${"years"} | ${"P1Y1M5D"}  | ${"stride indian k=500, +400 d"}
    ${"1322-05-03[u-ca=indian]"}                 | ${"1323-06-07[u-ca=indian]"}                 | ${"years"} | ${"P1Y1M4D"}  | ${"stride indian k=998, +400 d"}
    ${"1596-02-10[u-ca=indian]"}                 | ${"1597-03-14[u-ca=indian]"}                 | ${"years"} | ${"P1Y1M4D"}  | ${"stride indian k=999, +400 d"}
    ${"1869-11-16[u-ca=indian]"}                 | ${"1870-12-20[u-ca=indian]"}                 | ${"years"} | ${"P1Y1M4D"}  | ${"stride indian k=1000, +400 d"}
    ${"138752-11-26[u-ca=indian]"}               | ${"138754-01-01[u-ca=indian]"}               | ${"years"} | ${"P1Y1M5D"}  | ${"stride indian k=1500, +400 d"}
    ${"275635-12-07[u-ca=indian]"}               | ${"275637-01-12[u-ca=indian]"}               | ${"years"} | ${"P1Y1M5D"}  | ${"stride indian k=2000, +400 d"}
    ${"-266321-12-23[u-ca=ethiopic-amete-alem]"} | ${"-266319-01-22[u-ca=ethiopic-amete-alem]"} | ${"years"} | ${"P1Y1M22D"} | ${"stride ethioaa k=0, +400 d"}
    ${"-129440-03-07[u-ca=ethiopic-amete-alem]"} | ${"-129439-04-12[u-ca=ethiopic-amete-alem]"} | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=500, +400 d"}
    ${"6892-11-22[u-ca=ethiopic-amete-alem]"}    | ${"6893-12-27[u-ca=ethiopic-amete-alem]"}    | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=998, +400 d"}
    ${"7166-08-25[u-ca=ethiopic-amete-alem]"}    | ${"7167-09-30[u-ca=ethiopic-amete-alem]"}    | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=999, +400 d"}
    ${"7440-05-27[u-ca=ethiopic-amete-alem]"}    | ${"7441-07-02[u-ca=ethiopic-amete-alem]"}    | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=1000, +400 d"}
    ${"144320-08-17[u-ca=ethiopic-amete-alem]"}  | ${"144321-09-22[u-ca=ethiopic-amete-alem]"}  | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=1500, +400 d"}
    ${"281200-11-07[u-ca=ethiopic-amete-alem]"}  | ${"281201-12-12[u-ca=ethiopic-amete-alem]"}  | ${"years"} | ${"P1Y1M5D"}  | ${"stride ethioaa k=2000, +400 d"}
    ${"271819-01-13[u-ca=japanese;era=bce]"}     | ${"271818-02-17[u-ca=japanese;era=bce]"}     | ${"years"} | ${"P1Y1M4D"}  | ${"stride japanese k=0, +400 d"}
    ${"134936-01-24[u-ca=japanese;era=bce]"}     | ${"134935-02-28[u-ca=japanese;era=bce]"}     | ${"years"} | ${"P1Y1M4D"}  | ${"stride japanese k=500, +400 d"}
    ${"1400-07-25[u-ca=japanese;era=ce]"}        | ${"1401-08-29[u-ca=japanese;era=ce]"}        | ${"years"} | ${"P1Y1M4D"}  | ${"stride japanese k=998, +400 d"}
    ${"1674-04-30[u-ca=japanese;era=ce]"}        | ${"1675-06-04[u-ca=japanese;era=ce]"}        | ${"years"} | ${"P1Y1M5D"}  | ${"stride japanese k=999, +400 d"}
    ${"0023-02-05[u-ca=japanese;era=showa]"}     | ${"0024-03-11[u-ca=japanese;era=showa]"}     | ${"years"} | ${"P1Y1M6D"}  | ${"stride japanese k=1000, +400 d"}
    ${"136813-02-15[u-ca=japanese;era=reiwa]"}   | ${"136814-03-21[u-ca=japanese;era=reiwa]"}   | ${"years"} | ${"P1Y1M6D"}  | ${"stride japanese k=1500, +400 d"}
    ${"273696-02-26[u-ca=japanese;era=reiwa]"}   | ${"273697-04-02[u-ca=japanese;era=reiwa]"}   | ${"years"} | ${"P1Y1M7D"}  | ${"stride japanese k=2000, +400 d"}
    ${"-273729-01-13[u-ca=taiwan]"}              | ${"-273728-02-17[u-ca=taiwan]"}              | ${"years"} | ${"P1Y1M4D"}  | ${"stride roc k=0, +400 d"}
    ${"-136846-01-24[u-ca=taiwan]"}              | ${"-136845-02-28[u-ca=taiwan]"}              | ${"years"} | ${"P1Y1M4D"}  | ${"stride roc k=500, +400 d"}
    ${"-000511-07-25[u-ca=taiwan]"}              | ${"-000510-08-29[u-ca=taiwan]"}              | ${"years"} | ${"P1Y1M4D"}  | ${"stride roc k=998, +400 d"}
    ${"-000237-04-30[u-ca=taiwan]"}              | ${"-000236-06-04[u-ca=taiwan]"}              | ${"years"} | ${"P1Y1M5D"}  | ${"stride roc k=999, +400 d"}
    ${"0037-02-05[u-ca=taiwan]"}                 | ${"0038-03-11[u-ca=taiwan]"}                 | ${"years"} | ${"P1Y1M6D"}  | ${"stride roc k=1000, +400 d"}
    ${"136920-02-15[u-ca=taiwan]"}               | ${"136921-03-21[u-ca=taiwan]"}               | ${"years"} | ${"P1Y1M6D"}  | ${"stride roc k=1500, +400 d"}
    ${"273803-02-26[u-ca=taiwan]"}               | ${"273804-04-02[u-ca=taiwan]"}               | ${"years"} | ${"P1Y1M7D"}  | ${"stride roc k=2000, +400 d"}
    ${"-271818-01-13"}                           | ${"-271817-02-17"}                           | ${"years"} | ${"P1Y1M4D"}  | ${"stride gregory k=0, +400 d"}
    ${"-134935-01-24"}                           | ${"-134934-02-28"}                           | ${"years"} | ${"P1Y1M4D"}  | ${"stride gregory k=500, +400 d"}
    ${"1400-07-25"}                              | ${"1401-08-29"}                              | ${"years"} | ${"P1Y1M4D"}  | ${"stride gregory k=998, +400 d"}
    ${"1674-04-30"}                              | ${"1675-06-04"}                              | ${"years"} | ${"P1Y1M5D"}  | ${"stride gregory k=999, +400 d"}
    ${"1948-02-05"}                              | ${"1949-03-11"}                              | ${"years"} | ${"P1Y1M6D"}  | ${"stride gregory k=1000, +400 d"}
    ${"+138831-02-15"}                           | ${"+138832-03-21"}                           | ${"years"} | ${"P1Y1M6D"}  | ${"stride gregory k=1500, +400 d"}
    ${"+275714-02-26"}                           | ${"+275715-04-02"}                           | ${"years"} | ${"P1Y1M7D"}  | ${"stride gregory k=2000, +400 d"}
  `(
    "returns $expected in $unit from $date1 to $date2 ($source)",
    ({ date1, date2, unit, expected }) => {
      expect(diffDateAsDuration(date1, date2, unit)).toBe(expected);
    },
  );
});
