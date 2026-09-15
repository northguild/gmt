import { convertDateToCalendar } from "./convertDateToCalendar";

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

// CORE-6 §4.4 edge-window matrix: every calendar (Ethiopic family via ethiopic-amete-alem) at
// n days inside each limit, n in {0, 1, 30, 200, 420} plus the last failing day of each §1.3 window
// and the first day after it.
describe("convertDateToCalendar next to the range limits (CORE-6 §4.4)", () => {
  it.each`
    value              | calendar                 | expected                                     | source
    ${"+275760-09-13"} | ${"buddhist"}            | ${"276303-09-13[u-ca=buddhist]"}             | ${"xscan buddhist max[0]"}
    ${"+275760-09-12"} | ${"buddhist"}            | ${"276303-09-12[u-ca=buddhist]"}             | ${"xscan buddhist max[1]"}
    ${"+275760-08-14"} | ${"buddhist"}            | ${"276303-08-14[u-ca=buddhist]"}             | ${"xscan buddhist max[30]"}
    ${"+275760-02-26"} | ${"buddhist"}            | ${"276303-02-26[u-ca=buddhist]"}             | ${"xscan buddhist max[200]"}
    ${"+275759-08-13"} | ${"buddhist"}            | ${"276302-08-13[u-ca=buddhist]"}             | ${"xscan buddhist max[397]"}
    ${"+275759-08-12"} | ${"buddhist"}            | ${"276302-08-12[u-ca=buddhist]"}             | ${"xscan buddhist max[398]"}
    ${"+275759-07-21"} | ${"buddhist"}            | ${"276302-07-21[u-ca=buddhist]"}             | ${"xscan buddhist max[420]"}
    ${"-271821-04-21"} | ${"buddhist"}            | ${"-271278-04-21[u-ca=buddhist]"}            | ${"xscan buddhist min[2]"}
    ${"-271821-05-19"} | ${"buddhist"}            | ${"-271278-05-19[u-ca=buddhist]"}            | ${"xscan buddhist min[30]"}
    ${"-271821-11-05"} | ${"buddhist"}            | ${"-271278-11-05[u-ca=buddhist]"}            | ${"xscan buddhist min[200]"}
    ${"-271820-06-12"} | ${"buddhist"}            | ${"-271277-06-12[u-ca=buddhist]"}            | ${"xscan buddhist min[420]"}
    ${"+275760-09-13"} | ${"hebrew"}              | ${"279517-10-11[u-ca=hebrew]"}               | ${"xscan hebrew max[0]"}
    ${"+275760-09-12"} | ${"hebrew"}              | ${"279517-10-10[u-ca=hebrew]"}               | ${"xscan hebrew max[1]"}
    ${"+275760-08-14"} | ${"hebrew"}              | ${"279517-09-10[u-ca=hebrew]"}               | ${"xscan hebrew max[30]"}
    ${"+275760-02-26"} | ${"hebrew"}              | ${"279517-03-17[u-ca=hebrew]"}               | ${"xscan hebrew max[200]"}
    ${"+275759-08-22"} | ${"hebrew"}              | ${"279516-09-06[u-ca=hebrew]"}               | ${"xscan hebrew max[388]"}
    ${"+275759-08-21"} | ${"hebrew"}              | ${"279516-09-05[u-ca=hebrew]"}               | ${"xscan hebrew max[389]"}
    ${"+275759-07-21"} | ${"hebrew"}              | ${"279516-08-03[u-ca=hebrew]"}               | ${"xscan hebrew max[420]"}
    ${"-271821-05-19"} | ${"hebrew"}              | ${"-268058-12-04[u-ca=hebrew]"}              | ${"xscan hebrew min[30]"}
    ${"-271820-05-31"} | ${"hebrew"}              | ${"-268057-12-29[u-ca=hebrew]"}              | ${"xscan hebrew min[408]"}
    ${"-271820-06-01"} | ${"hebrew"}              | ${"-268057-12-30[u-ca=hebrew]"}              | ${"xscan hebrew min[409]"}
    ${"-271820-06-12"} | ${"hebrew"}              | ${"-268057-13-11[u-ca=hebrew]"}              | ${"xscan hebrew min[420]"}
    ${"+275760-09-13"} | ${"islamic-civil"}       | ${"283583-05-23[u-ca=islamic-civil]"}        | ${"xscan islamic-civil max[0]"}
    ${"+275760-09-12"} | ${"islamic-civil"}       | ${"283583-05-22[u-ca=islamic-civil]"}        | ${"xscan islamic-civil max[1]"}
    ${"+275760-08-14"} | ${"islamic-civil"}       | ${"283583-04-22[u-ca=islamic-civil]"}        | ${"xscan islamic-civil max[30]"}
    ${"+275760-02-26"} | ${"islamic-civil"}       | ${"283582-10-29[u-ca=islamic-civil]"}        | ${"xscan islamic-civil max[200]"}
    ${"+275759-09-17"} | ${"islamic-civil"}       | ${"283582-05-15[u-ca=islamic-civil]"}        | ${"xscan islamic-civil max[362]"}
    ${"+275759-09-16"} | ${"islamic-civil"}       | ${"283582-05-14[u-ca=islamic-civil]"}        | ${"xscan islamic-civil max[363]"}
    ${"+275759-07-21"} | ${"islamic-civil"}       | ${"283582-03-16[u-ca=islamic-civil]"}        | ${"xscan islamic-civil max[420]"}
    ${"-271821-04-19"} | ${"islamic-civil"}       | ${"-280804-03-21[u-ca=islamic-civil]"}       | ${"xscan islamic-civil min[0]"}
    ${"-271821-04-20"} | ${"islamic-civil"}       | ${"-280804-03-22[u-ca=islamic-civil]"}       | ${"xscan islamic-civil min[1]"}
    ${"-271821-05-19"} | ${"islamic-civil"}       | ${"-280804-04-21[u-ca=islamic-civil]"}       | ${"xscan islamic-civil min[30]"}
    ${"-271821-11-05"} | ${"islamic-civil"}       | ${"-280804-10-14[u-ca=islamic-civil]"}       | ${"xscan islamic-civil min[200]"}
    ${"-271820-06-12"} | ${"islamic-civil"}       | ${"-280803-05-27[u-ca=islamic-civil]"}       | ${"xscan islamic-civil min[420]"}
    ${"+275760-09-13"} | ${"islamic-tabular"}     | ${"283583-05-24[u-ca=islamic-tabular]"}      | ${"xscan islamic-tbla max[0]"}
    ${"+275760-09-12"} | ${"islamic-tabular"}     | ${"283583-05-23[u-ca=islamic-tabular]"}      | ${"xscan islamic-tbla max[1]"}
    ${"+275760-09-04"} | ${"islamic-tabular"}     | ${"283583-05-15[u-ca=islamic-tabular]"}      | ${"xscan islamic-tbla max[9]"}
    ${"+275760-08-14"} | ${"islamic-tabular"}     | ${"283583-04-23[u-ca=islamic-tabular]"}      | ${"xscan islamic-tbla max[30]"}
    ${"+275760-02-26"} | ${"islamic-tabular"}     | ${"283582-11-01[u-ca=islamic-tabular]"}      | ${"xscan islamic-tbla max[200]"}
    ${"+275759-07-21"} | ${"islamic-tabular"}     | ${"283582-03-17[u-ca=islamic-tabular]"}      | ${"xscan islamic-tbla max[420]"}
    ${"-271821-04-19"} | ${"islamic-tabular"}     | ${"-280804-03-22[u-ca=islamic-tabular]"}     | ${"xscan islamic-tbla min[0]"}
    ${"-271821-04-20"} | ${"islamic-tabular"}     | ${"-280804-03-23[u-ca=islamic-tabular]"}     | ${"xscan islamic-tbla min[1]"}
    ${"-271821-05-19"} | ${"islamic-tabular"}     | ${"-280804-04-22[u-ca=islamic-tabular]"}     | ${"xscan islamic-tbla min[30]"}
    ${"-271821-11-05"} | ${"islamic-tabular"}     | ${"-280804-10-15[u-ca=islamic-tabular]"}     | ${"xscan islamic-tbla min[200]"}
    ${"-271820-01-19"} | ${"islamic-tabular"}     | ${"-280803-01-01[u-ca=islamic-tabular]"}     | ${"xscan islamic-tbla min[275]"}
    ${"-271820-06-12"} | ${"islamic-tabular"}     | ${"-280803-05-28[u-ca=islamic-tabular]"}     | ${"xscan islamic-tbla min[420]"}
    ${"+275760-09-13"} | ${"islamic-umalqura"}    | ${"283583-05-23[u-ca=islamic-umalqura]"}     | ${"xscan islamic-umalqura max[0]"}
    ${"+275760-09-12"} | ${"islamic-umalqura"}    | ${"283583-05-22[u-ca=islamic-umalqura]"}     | ${"xscan islamic-umalqura max[1]"}
    ${"+275760-09-04"} | ${"islamic-umalqura"}    | ${"283583-05-14[u-ca=islamic-umalqura]"}     | ${"xscan islamic-umalqura max[9]"}
    ${"+275760-08-14"} | ${"islamic-umalqura"}    | ${"283583-04-22[u-ca=islamic-umalqura]"}     | ${"xscan islamic-umalqura max[30]"}
    ${"+275760-02-26"} | ${"islamic-umalqura"}    | ${"283582-10-29[u-ca=islamic-umalqura]"}     | ${"xscan islamic-umalqura max[200]"}
    ${"+275759-09-17"} | ${"islamic-umalqura"}    | ${"283582-05-15[u-ca=islamic-umalqura]"}     | ${"xscan islamic-umalqura max[362]"}
    ${"+275759-09-16"} | ${"islamic-umalqura"}    | ${"283582-05-14[u-ca=islamic-umalqura]"}     | ${"xscan islamic-umalqura max[363]"}
    ${"+275759-07-21"} | ${"islamic-umalqura"}    | ${"283582-03-16[u-ca=islamic-umalqura]"}     | ${"xscan islamic-umalqura max[420]"}
    ${"-271821-04-19"} | ${"islamic-umalqura"}    | ${"-280804-03-21[u-ca=islamic-umalqura]"}    | ${"xscan islamic-umalqura min[0]"}
    ${"-271821-04-20"} | ${"islamic-umalqura"}    | ${"-280804-03-22[u-ca=islamic-umalqura]"}    | ${"xscan islamic-umalqura min[1]"}
    ${"-271821-05-19"} | ${"islamic-umalqura"}    | ${"-280804-04-21[u-ca=islamic-umalqura]"}    | ${"xscan islamic-umalqura min[30]"}
    ${"-271821-11-05"} | ${"islamic-umalqura"}    | ${"-280804-10-14[u-ca=islamic-umalqura]"}    | ${"xscan islamic-umalqura min[200]"}
    ${"-271820-01-19"} | ${"islamic-umalqura"}    | ${"-280804-12-30[u-ca=islamic-umalqura]"}    | ${"xscan islamic-umalqura min[275]"}
    ${"-271820-01-20"} | ${"islamic-umalqura"}    | ${"-280803-01-01[u-ca=islamic-umalqura]"}    | ${"xscan islamic-umalqura min[276]"}
    ${"-271820-06-12"} | ${"islamic-umalqura"}    | ${"-280803-05-27[u-ca=islamic-umalqura]"}    | ${"xscan islamic-umalqura min[420]"}
    ${"+275760-09-13"} | ${"persian"}             | ${"275139-07-12[u-ca=persian]"}              | ${"xscan persian max[0]"}
    ${"+275760-09-12"} | ${"persian"}             | ${"275139-07-11[u-ca=persian]"}              | ${"xscan persian max[1]"}
    ${"+275760-08-14"} | ${"persian"}             | ${"275139-06-13[u-ca=persian]"}              | ${"xscan persian max[30]"}
    ${"+275760-02-26"} | ${"persian"}             | ${"275138-12-28[u-ca=persian]"}              | ${"xscan persian max[200]"}
    ${"+275759-07-21"} | ${"persian"}             | ${"275138-05-20[u-ca=persian]"}              | ${"xscan persian max[420]"}
    ${"-271821-04-19"} | ${"persian"}             | ${"-272442-01-09[u-ca=persian]"}             | ${"xscan persian min[0]"}
    ${"-271821-04-20"} | ${"persian"}             | ${"-272442-01-10[u-ca=persian]"}             | ${"xscan persian min[1]"}
    ${"-271821-05-19"} | ${"persian"}             | ${"-272442-02-08[u-ca=persian]"}             | ${"xscan persian min[30]"}
    ${"-271821-11-05"} | ${"persian"}             | ${"-272442-07-23[u-ca=persian]"}             | ${"xscan persian min[200]"}
    ${"-271820-06-12"} | ${"persian"}             | ${"-272441-03-02[u-ca=persian]"}             | ${"xscan persian min[420]"}
    ${"+275760-09-13"} | ${"indian"}              | ${"275682-06-22[u-ca=indian]"}               | ${"xscan indian max[0]"}
    ${"+275760-09-12"} | ${"indian"}              | ${"275682-06-21[u-ca=indian]"}               | ${"xscan indian max[1]"}
    ${"+275760-08-14"} | ${"indian"}              | ${"275682-05-23[u-ca=indian]"}               | ${"xscan indian max[30]"}
    ${"+275760-02-26"} | ${"indian"}              | ${"275681-12-07[u-ca=indian]"}               | ${"xscan indian max[200]"}
    ${"+275759-07-21"} | ${"indian"}              | ${"275681-04-30[u-ca=indian]"}               | ${"xscan indian max[420]"}
    ${"-271821-04-20"} | ${"indian"}              | ${"-271899-01-30[u-ca=indian]"}              | ${"xscan indian min[1]"}
    ${"-271821-05-19"} | ${"indian"}              | ${"-271899-02-29[u-ca=indian]"}              | ${"xscan indian min[30]"}
    ${"-271821-11-05"} | ${"indian"}              | ${"-271899-08-14[u-ca=indian]"}              | ${"xscan indian min[200]"}
    ${"-271820-06-12"} | ${"indian"}              | ${"-271898-03-22[u-ca=indian]"}              | ${"xscan indian min[420]"}
    ${"+275760-09-13"} | ${"ethiopic-amete-alem"} | ${"281247-05-22[u-ca=ethiopic-amete-alem]"}  | ${"xscan ethioaa max[0]"}
    ${"+275760-09-12"} | ${"ethiopic-amete-alem"} | ${"281247-05-21[u-ca=ethiopic-amete-alem]"}  | ${"xscan ethioaa max[1]"}
    ${"+275760-08-14"} | ${"ethiopic-amete-alem"} | ${"281247-04-22[u-ca=ethiopic-amete-alem]"}  | ${"xscan ethioaa max[30]"}
    ${"+275760-02-26"} | ${"ethiopic-amete-alem"} | ${"281246-11-07[u-ca=ethiopic-amete-alem]"}  | ${"xscan ethioaa max[200]"}
    ${"+275759-07-21"} | ${"ethiopic-amete-alem"} | ${"281246-03-27[u-ca=ethiopic-amete-alem]"}  | ${"xscan ethioaa max[420]"}
    ${"-271821-04-19"} | ${"ethiopic-amete-alem"} | ${"-266323-03-23[u-ca=ethiopic-amete-alem]"} | ${"xscan ethioaa min[0]"}
    ${"-271821-04-20"} | ${"ethiopic-amete-alem"} | ${"-266323-03-24[u-ca=ethiopic-amete-alem]"} | ${"xscan ethioaa min[1]"}
    ${"-271821-05-19"} | ${"ethiopic-amete-alem"} | ${"-266323-04-23[u-ca=ethiopic-amete-alem]"} | ${"xscan ethioaa min[30]"}
    ${"-271821-11-05"} | ${"ethiopic-amete-alem"} | ${"-266323-10-13[u-ca=ethiopic-amete-alem]"} | ${"xscan ethioaa min[200]"}
    ${"-271820-06-12"} | ${"ethiopic-amete-alem"} | ${"-266322-05-18[u-ca=ethiopic-amete-alem]"} | ${"xscan ethioaa min[420]"}
    ${"+275760-09-13"} | ${"japanese"}            | ${"273742-09-13[u-ca=japanese;era=reiwa]"}   | ${"xscan japanese max[0]"}
    ${"+275760-09-12"} | ${"japanese"}            | ${"273742-09-12[u-ca=japanese;era=reiwa]"}   | ${"xscan japanese max[1]"}
    ${"+275760-08-14"} | ${"japanese"}            | ${"273742-08-14[u-ca=japanese;era=reiwa]"}   | ${"xscan japanese max[30]"}
    ${"+275760-02-26"} | ${"japanese"}            | ${"273742-02-26[u-ca=japanese;era=reiwa]"}   | ${"xscan japanese max[200]"}
    ${"+275759-07-21"} | ${"japanese"}            | ${"273741-07-21[u-ca=japanese;era=reiwa]"}   | ${"xscan japanese max[420]"}
    ${"-271821-04-20"} | ${"japanese"}            | ${"271822-04-20[u-ca=japanese;era=bce]"}     | ${"xscan japanese min[1]"}
    ${"-271821-05-19"} | ${"japanese"}            | ${"271822-05-19[u-ca=japanese;era=bce]"}     | ${"xscan japanese min[30]"}
    ${"-271821-11-05"} | ${"japanese"}            | ${"271822-11-05[u-ca=japanese;era=bce]"}     | ${"xscan japanese min[200]"}
    ${"-271820-06-12"} | ${"japanese"}            | ${"271821-06-12[u-ca=japanese;era=bce]"}     | ${"xscan japanese min[420]"}
    ${"+275760-09-13"} | ${"taiwan"}              | ${"273849-09-13[u-ca=taiwan]"}               | ${"xscan roc max[0]"}
    ${"+275760-09-12"} | ${"taiwan"}              | ${"273849-09-12[u-ca=taiwan]"}               | ${"xscan roc max[1]"}
    ${"+275760-08-14"} | ${"taiwan"}              | ${"273849-08-14[u-ca=taiwan]"}               | ${"xscan roc max[30]"}
    ${"+275760-02-26"} | ${"taiwan"}              | ${"273849-02-26[u-ca=taiwan]"}               | ${"xscan roc max[200]"}
    ${"+275759-07-21"} | ${"taiwan"}              | ${"273848-07-21[u-ca=taiwan]"}               | ${"xscan roc max[420]"}
    ${"-271821-04-19"} | ${"taiwan"}              | ${"-273732-04-19[u-ca=taiwan]"}              | ${"xscan roc min[0]"}
    ${"-271821-04-20"} | ${"taiwan"}              | ${"-273732-04-20[u-ca=taiwan]"}              | ${"xscan roc min[1]"}
    ${"-271821-05-19"} | ${"taiwan"}              | ${"-273732-05-19[u-ca=taiwan]"}              | ${"xscan roc min[30]"}
    ${"-271821-11-05"} | ${"taiwan"}              | ${"-273732-11-05[u-ca=taiwan]"}              | ${"xscan roc min[200]"}
    ${"-271820-06-12"} | ${"taiwan"}              | ${"-273731-06-12[u-ca=taiwan]"}              | ${"xscan roc min[420]"}
  `(
    "converts $value to $calendar as $expected ($source)",
    ({ value, calendar, expected }) => {
      expect(convertDateToCalendar(value, calendar)).toBe(expected);
    },
  );

  it.each`
    value                                        | expected           | source
    ${"276303-09-13[u-ca=buddhist]"}             | ${"+275760-09-13"} | ${"xscan buddhist max[0]"}
    ${"276303-09-12[u-ca=buddhist]"}             | ${"+275760-09-12"} | ${"xscan buddhist max[1]"}
    ${"276303-08-14[u-ca=buddhist]"}             | ${"+275760-08-14"} | ${"xscan buddhist max[30]"}
    ${"276303-02-26[u-ca=buddhist]"}             | ${"+275760-02-26"} | ${"xscan buddhist max[200]"}
    ${"276302-08-13[u-ca=buddhist]"}             | ${"+275759-08-13"} | ${"xscan buddhist max[397]"}
    ${"276302-08-12[u-ca=buddhist]"}             | ${"+275759-08-12"} | ${"xscan buddhist max[398]"}
    ${"276302-07-21[u-ca=buddhist]"}             | ${"+275759-07-21"} | ${"xscan buddhist max[420]"}
    ${"-271278-04-21[u-ca=buddhist]"}            | ${"-271821-04-21"} | ${"xscan buddhist min[2]"}
    ${"-271278-05-19[u-ca=buddhist]"}            | ${"-271821-05-19"} | ${"xscan buddhist min[30]"}
    ${"-271278-11-05[u-ca=buddhist]"}            | ${"-271821-11-05"} | ${"xscan buddhist min[200]"}
    ${"-271277-06-12[u-ca=buddhist]"}            | ${"-271820-06-12"} | ${"xscan buddhist min[420]"}
    ${"279517-10-11[u-ca=hebrew]"}               | ${"+275760-09-13"} | ${"xscan hebrew max[0]"}
    ${"279517-10-10[u-ca=hebrew]"}               | ${"+275760-09-12"} | ${"xscan hebrew max[1]"}
    ${"279517-09-10[u-ca=hebrew]"}               | ${"+275760-08-14"} | ${"xscan hebrew max[30]"}
    ${"279517-03-17[u-ca=hebrew]"}               | ${"+275760-02-26"} | ${"xscan hebrew max[200]"}
    ${"279516-09-06[u-ca=hebrew]"}               | ${"+275759-08-22"} | ${"xscan hebrew max[388]"}
    ${"279516-09-05[u-ca=hebrew]"}               | ${"+275759-08-21"} | ${"xscan hebrew max[389]"}
    ${"279516-08-03[u-ca=hebrew]"}               | ${"+275759-07-21"} | ${"xscan hebrew max[420]"}
    ${"-268058-12-04[u-ca=hebrew]"}              | ${"-271821-05-19"} | ${"xscan hebrew min[30]"}
    ${"-268057-12-29[u-ca=hebrew]"}              | ${"-271820-05-31"} | ${"xscan hebrew min[408]"}
    ${"-268057-12-30[u-ca=hebrew]"}              | ${"-271820-06-01"} | ${"xscan hebrew min[409]"}
    ${"-268057-13-11[u-ca=hebrew]"}              | ${"-271820-06-12"} | ${"xscan hebrew min[420]"}
    ${"283583-05-23[u-ca=islamic-civil]"}        | ${"+275760-09-13"} | ${"xscan islamic-civil max[0]"}
    ${"283583-05-22[u-ca=islamic-civil]"}        | ${"+275760-09-12"} | ${"xscan islamic-civil max[1]"}
    ${"283583-04-22[u-ca=islamic-civil]"}        | ${"+275760-08-14"} | ${"xscan islamic-civil max[30]"}
    ${"283582-10-29[u-ca=islamic-civil]"}        | ${"+275760-02-26"} | ${"xscan islamic-civil max[200]"}
    ${"283582-05-15[u-ca=islamic-civil]"}        | ${"+275759-09-17"} | ${"xscan islamic-civil max[362]"}
    ${"283582-05-14[u-ca=islamic-civil]"}        | ${"+275759-09-16"} | ${"xscan islamic-civil max[363]"}
    ${"283582-03-16[u-ca=islamic-civil]"}        | ${"+275759-07-21"} | ${"xscan islamic-civil max[420]"}
    ${"-280804-03-21[u-ca=islamic-civil]"}       | ${"-271821-04-19"} | ${"xscan islamic-civil min[0]"}
    ${"-280804-03-22[u-ca=islamic-civil]"}       | ${"-271821-04-20"} | ${"xscan islamic-civil min[1]"}
    ${"-280804-04-21[u-ca=islamic-civil]"}       | ${"-271821-05-19"} | ${"xscan islamic-civil min[30]"}
    ${"-280804-10-14[u-ca=islamic-civil]"}       | ${"-271821-11-05"} | ${"xscan islamic-civil min[200]"}
    ${"-280803-05-27[u-ca=islamic-civil]"}       | ${"-271820-06-12"} | ${"xscan islamic-civil min[420]"}
    ${"283583-05-24[u-ca=islamic-tabular]"}      | ${"+275760-09-13"} | ${"xscan islamic-tbla max[0]"}
    ${"283583-05-23[u-ca=islamic-tabular]"}      | ${"+275760-09-12"} | ${"xscan islamic-tbla max[1]"}
    ${"283583-05-15[u-ca=islamic-tabular]"}      | ${"+275760-09-04"} | ${"xscan islamic-tbla max[9]"}
    ${"283583-04-23[u-ca=islamic-tabular]"}      | ${"+275760-08-14"} | ${"xscan islamic-tbla max[30]"}
    ${"283582-11-01[u-ca=islamic-tabular]"}      | ${"+275760-02-26"} | ${"xscan islamic-tbla max[200]"}
    ${"283582-03-17[u-ca=islamic-tabular]"}      | ${"+275759-07-21"} | ${"xscan islamic-tbla max[420]"}
    ${"-280804-03-22[u-ca=islamic-tabular]"}     | ${"-271821-04-19"} | ${"xscan islamic-tbla min[0]"}
    ${"-280804-03-23[u-ca=islamic-tabular]"}     | ${"-271821-04-20"} | ${"xscan islamic-tbla min[1]"}
    ${"-280804-04-22[u-ca=islamic-tabular]"}     | ${"-271821-05-19"} | ${"xscan islamic-tbla min[30]"}
    ${"-280804-10-15[u-ca=islamic-tabular]"}     | ${"-271821-11-05"} | ${"xscan islamic-tbla min[200]"}
    ${"-280803-01-01[u-ca=islamic-tabular]"}     | ${"-271820-01-19"} | ${"xscan islamic-tbla min[275]"}
    ${"-280803-05-28[u-ca=islamic-tabular]"}     | ${"-271820-06-12"} | ${"xscan islamic-tbla min[420]"}
    ${"283583-05-23[u-ca=islamic-umalqura]"}     | ${"+275760-09-13"} | ${"xscan islamic-umalqura max[0]"}
    ${"283583-05-22[u-ca=islamic-umalqura]"}     | ${"+275760-09-12"} | ${"xscan islamic-umalqura max[1]"}
    ${"283583-05-14[u-ca=islamic-umalqura]"}     | ${"+275760-09-04"} | ${"xscan islamic-umalqura max[9]"}
    ${"283583-04-22[u-ca=islamic-umalqura]"}     | ${"+275760-08-14"} | ${"xscan islamic-umalqura max[30]"}
    ${"283582-10-29[u-ca=islamic-umalqura]"}     | ${"+275760-02-26"} | ${"xscan islamic-umalqura max[200]"}
    ${"283582-05-15[u-ca=islamic-umalqura]"}     | ${"+275759-09-17"} | ${"xscan islamic-umalqura max[362]"}
    ${"283582-05-14[u-ca=islamic-umalqura]"}     | ${"+275759-09-16"} | ${"xscan islamic-umalqura max[363]"}
    ${"283582-03-16[u-ca=islamic-umalqura]"}     | ${"+275759-07-21"} | ${"xscan islamic-umalqura max[420]"}
    ${"-280804-03-21[u-ca=islamic-umalqura]"}    | ${"-271821-04-19"} | ${"xscan islamic-umalqura min[0]"}
    ${"-280804-03-22[u-ca=islamic-umalqura]"}    | ${"-271821-04-20"} | ${"xscan islamic-umalqura min[1]"}
    ${"-280804-04-21[u-ca=islamic-umalqura]"}    | ${"-271821-05-19"} | ${"xscan islamic-umalqura min[30]"}
    ${"-280804-10-14[u-ca=islamic-umalqura]"}    | ${"-271821-11-05"} | ${"xscan islamic-umalqura min[200]"}
    ${"-280804-12-30[u-ca=islamic-umalqura]"}    | ${"-271820-01-19"} | ${"xscan islamic-umalqura min[275]"}
    ${"-280803-01-01[u-ca=islamic-umalqura]"}    | ${"-271820-01-20"} | ${"xscan islamic-umalqura min[276]"}
    ${"-280803-05-27[u-ca=islamic-umalqura]"}    | ${"-271820-06-12"} | ${"xscan islamic-umalqura min[420]"}
    ${"275139-07-12[u-ca=persian]"}              | ${"+275760-09-13"} | ${"xscan persian max[0]"}
    ${"275139-07-11[u-ca=persian]"}              | ${"+275760-09-12"} | ${"xscan persian max[1]"}
    ${"275139-06-13[u-ca=persian]"}              | ${"+275760-08-14"} | ${"xscan persian max[30]"}
    ${"275138-12-28[u-ca=persian]"}              | ${"+275760-02-26"} | ${"xscan persian max[200]"}
    ${"275138-05-20[u-ca=persian]"}              | ${"+275759-07-21"} | ${"xscan persian max[420]"}
    ${"-272442-01-09[u-ca=persian]"}             | ${"-271821-04-19"} | ${"xscan persian min[0]"}
    ${"-272442-01-10[u-ca=persian]"}             | ${"-271821-04-20"} | ${"xscan persian min[1]"}
    ${"-272442-02-08[u-ca=persian]"}             | ${"-271821-05-19"} | ${"xscan persian min[30]"}
    ${"-272442-07-23[u-ca=persian]"}             | ${"-271821-11-05"} | ${"xscan persian min[200]"}
    ${"-272441-03-02[u-ca=persian]"}             | ${"-271820-06-12"} | ${"xscan persian min[420]"}
    ${"275682-06-22[u-ca=indian]"}               | ${"+275760-09-13"} | ${"xscan indian max[0]"}
    ${"275682-06-21[u-ca=indian]"}               | ${"+275760-09-12"} | ${"xscan indian max[1]"}
    ${"275682-05-23[u-ca=indian]"}               | ${"+275760-08-14"} | ${"xscan indian max[30]"}
    ${"275681-12-07[u-ca=indian]"}               | ${"+275760-02-26"} | ${"xscan indian max[200]"}
    ${"275681-04-30[u-ca=indian]"}               | ${"+275759-07-21"} | ${"xscan indian max[420]"}
    ${"-271899-01-30[u-ca=indian]"}              | ${"-271821-04-20"} | ${"xscan indian min[1]"}
    ${"-271899-02-29[u-ca=indian]"}              | ${"-271821-05-19"} | ${"xscan indian min[30]"}
    ${"-271899-08-14[u-ca=indian]"}              | ${"-271821-11-05"} | ${"xscan indian min[200]"}
    ${"-271898-03-22[u-ca=indian]"}              | ${"-271820-06-12"} | ${"xscan indian min[420]"}
    ${"281247-05-22[u-ca=ethiopic-amete-alem]"}  | ${"+275760-09-13"} | ${"xscan ethioaa max[0]"}
    ${"281247-05-21[u-ca=ethiopic-amete-alem]"}  | ${"+275760-09-12"} | ${"xscan ethioaa max[1]"}
    ${"281247-04-22[u-ca=ethiopic-amete-alem]"}  | ${"+275760-08-14"} | ${"xscan ethioaa max[30]"}
    ${"281246-11-07[u-ca=ethiopic-amete-alem]"}  | ${"+275760-02-26"} | ${"xscan ethioaa max[200]"}
    ${"281246-03-27[u-ca=ethiopic-amete-alem]"}  | ${"+275759-07-21"} | ${"xscan ethioaa max[420]"}
    ${"-266323-03-23[u-ca=ethiopic-amete-alem]"} | ${"-271821-04-19"} | ${"xscan ethioaa min[0]"}
    ${"-266323-03-24[u-ca=ethiopic-amete-alem]"} | ${"-271821-04-20"} | ${"xscan ethioaa min[1]"}
    ${"-266323-04-23[u-ca=ethiopic-amete-alem]"} | ${"-271821-05-19"} | ${"xscan ethioaa min[30]"}
    ${"-266323-10-13[u-ca=ethiopic-amete-alem]"} | ${"-271821-11-05"} | ${"xscan ethioaa min[200]"}
    ${"-266322-05-18[u-ca=ethiopic-amete-alem]"} | ${"-271820-06-12"} | ${"xscan ethioaa min[420]"}
    ${"273742-09-13[u-ca=japanese;era=reiwa]"}   | ${"+275760-09-13"} | ${"xscan japanese max[0]"}
    ${"273742-09-12[u-ca=japanese;era=reiwa]"}   | ${"+275760-09-12"} | ${"xscan japanese max[1]"}
    ${"273742-08-14[u-ca=japanese;era=reiwa]"}   | ${"+275760-08-14"} | ${"xscan japanese max[30]"}
    ${"273742-02-26[u-ca=japanese;era=reiwa]"}   | ${"+275760-02-26"} | ${"xscan japanese max[200]"}
    ${"273741-07-21[u-ca=japanese;era=reiwa]"}   | ${"+275759-07-21"} | ${"xscan japanese max[420]"}
    ${"271822-04-20[u-ca=japanese;era=bce]"}     | ${"-271821-04-20"} | ${"xscan japanese min[1]"}
    ${"271822-05-19[u-ca=japanese;era=bce]"}     | ${"-271821-05-19"} | ${"xscan japanese min[30]"}
    ${"271822-11-05[u-ca=japanese;era=bce]"}     | ${"-271821-11-05"} | ${"xscan japanese min[200]"}
    ${"271821-06-12[u-ca=japanese;era=bce]"}     | ${"-271820-06-12"} | ${"xscan japanese min[420]"}
    ${"273849-09-13[u-ca=taiwan]"}               | ${"+275760-09-13"} | ${"xscan roc max[0]"}
    ${"273849-09-12[u-ca=taiwan]"}               | ${"+275760-09-12"} | ${"xscan roc max[1]"}
    ${"273849-08-14[u-ca=taiwan]"}               | ${"+275760-08-14"} | ${"xscan roc max[30]"}
    ${"273849-02-26[u-ca=taiwan]"}               | ${"+275760-02-26"} | ${"xscan roc max[200]"}
    ${"273848-07-21[u-ca=taiwan]"}               | ${"+275759-07-21"} | ${"xscan roc max[420]"}
    ${"-273732-04-19[u-ca=taiwan]"}              | ${"-271821-04-19"} | ${"xscan roc min[0]"}
    ${"-273732-04-20[u-ca=taiwan]"}              | ${"-271821-04-20"} | ${"xscan roc min[1]"}
    ${"-273732-05-19[u-ca=taiwan]"}              | ${"-271821-05-19"} | ${"xscan roc min[30]"}
    ${"-273732-11-05[u-ca=taiwan]"}              | ${"-271821-11-05"} | ${"xscan roc min[200]"}
    ${"-273731-06-12[u-ca=taiwan]"}              | ${"-271820-06-12"} | ${"xscan roc min[420]"}
  `(
    "converts $value back to gregorian as $expected ($source)",
    ({ value, expected }) => {
      expect(convertDateToCalendar(value, "gregorian")).toBe(expected);
    },
  );
});

// CORE-6 §4.4 stride matrix: samples of 1000 + k × 99991 days after the minimum.
describe("convertDateToCalendar across the whole range (CORE-6 §4.4 strides)", () => {
  it.each`
    value              | calendar                 | expected                                     | source
    ${"-271818-01-13"} | ${"buddhist"}            | ${"-271275-01-13[u-ca=buddhist]"}            | ${"stride buddhist k=0"}
    ${"-134935-01-24"} | ${"buddhist"}            | ${"-134392-01-24[u-ca=buddhist]"}            | ${"stride buddhist k=500"}
    ${"1400-07-25"}    | ${"buddhist"}            | ${"1943-07-25[u-ca=buddhist]"}               | ${"stride buddhist k=998"}
    ${"1674-04-30"}    | ${"buddhist"}            | ${"2217-04-30[u-ca=buddhist]"}               | ${"stride buddhist k=999"}
    ${"1948-02-05"}    | ${"buddhist"}            | ${"2491-02-05[u-ca=buddhist]"}               | ${"stride buddhist k=1000"}
    ${"+138831-02-15"} | ${"buddhist"}            | ${"139374-02-15[u-ca=buddhist]"}             | ${"stride buddhist k=1500"}
    ${"+275714-02-26"} | ${"buddhist"}            | ${"276257-02-26[u-ca=buddhist]"}             | ${"stride buddhist k=2000"}
    ${"-271818-01-13"} | ${"hebrew"}              | ${"-268055-07-30[u-ca=hebrew]"}              | ${"stride hebrew k=0"}
    ${"-134935-01-24"} | ${"hebrew"}              | ${"-131174-12-26[u-ca=hebrew]"}              | ${"stride hebrew k=500"}
    ${"1400-07-25"}    | ${"hebrew"}              | ${"5160-11-23[u-ca=hebrew]"}                 | ${"stride hebrew k=998"}
    ${"1674-04-30"}    | ${"hebrew"}              | ${"5434-08-24[u-ca=hebrew]"}                 | ${"stride hebrew k=999"}
    ${"1948-02-05"}    | ${"hebrew"}              | ${"5708-05-25[u-ca=hebrew]"}                 | ${"stride hebrew k=1000"}
    ${"+138831-02-15"} | ${"hebrew"}              | ${"142589-10-21[u-ca=hebrew]"}               | ${"stride hebrew k=1500"}
    ${"+275714-02-26"} | ${"hebrew"}              | ${"279471-03-19[u-ca=hebrew]"}               | ${"stride hebrew k=2000"}
    ${"-271818-01-13"} | ${"islamic-civil"}       | ${"-280801-01-17[u-ca=islamic-civil]"}       | ${"stride islamic-civil k=0"}
    ${"-134935-01-24"} | ${"islamic-civil"}       | ${"-139717-02-20[u-ca=islamic-civil]"}       | ${"stride islamic-civil k=500"}
    ${"1400-07-25"}    | ${"islamic-civil"}       | ${"0802-11-23[u-ca=islamic-civil]"}          | ${"stride islamic-civil k=998"}
    ${"1674-04-30"}    | ${"islamic-civil"}       | ${"1085-01-24[u-ca=islamic-civil]"}          | ${"stride islamic-civil k=999"}
    ${"1948-02-05"}    | ${"islamic-civil"}       | ${"1367-03-24[u-ca=islamic-civil]"}          | ${"stride islamic-civil k=1000"}
    ${"+138831-02-15"} | ${"islamic-civil"}       | ${"142451-04-27[u-ca=islamic-civil]"}        | ${"stride islamic-civil k=1500"}
    ${"+275714-02-26"} | ${"islamic-civil"}       | ${"283535-06-02[u-ca=islamic-civil]"}        | ${"stride islamic-civil k=2000"}
    ${"-271818-01-13"} | ${"islamic-tabular"}     | ${"-280801-01-18[u-ca=islamic-tabular]"}     | ${"stride islamic-tbla k=0"}
    ${"-134935-01-24"} | ${"islamic-tabular"}     | ${"-139717-02-21[u-ca=islamic-tabular]"}     | ${"stride islamic-tbla k=500"}
    ${"1400-07-25"}    | ${"islamic-tabular"}     | ${"0802-11-24[u-ca=islamic-tabular]"}        | ${"stride islamic-tbla k=998"}
    ${"1674-04-30"}    | ${"islamic-tabular"}     | ${"1085-01-25[u-ca=islamic-tabular]"}        | ${"stride islamic-tbla k=999"}
    ${"1948-02-05"}    | ${"islamic-tabular"}     | ${"1367-03-25[u-ca=islamic-tabular]"}        | ${"stride islamic-tbla k=1000"}
    ${"+138831-02-15"} | ${"islamic-tabular"}     | ${"142451-04-28[u-ca=islamic-tabular]"}      | ${"stride islamic-tbla k=1500"}
    ${"+275714-02-26"} | ${"islamic-tabular"}     | ${"283535-06-03[u-ca=islamic-tabular]"}      | ${"stride islamic-tbla k=2000"}
    ${"-271818-01-13"} | ${"islamic-umalqura"}    | ${"-280801-01-17[u-ca=islamic-umalqura]"}    | ${"stride islamic-umalqura k=0"}
    ${"-134935-01-24"} | ${"islamic-umalqura"}    | ${"-139717-02-20[u-ca=islamic-umalqura]"}    | ${"stride islamic-umalqura k=500"}
    ${"1400-07-25"}    | ${"islamic-umalqura"}    | ${"0802-11-23[u-ca=islamic-umalqura]"}       | ${"stride islamic-umalqura k=998"}
    ${"1674-04-30"}    | ${"islamic-umalqura"}    | ${"1085-01-24[u-ca=islamic-umalqura]"}       | ${"stride islamic-umalqura k=999"}
    ${"1948-02-05"}    | ${"islamic-umalqura"}    | ${"1367-03-24[u-ca=islamic-umalqura]"}       | ${"stride islamic-umalqura k=1000"}
    ${"+138831-02-15"} | ${"islamic-umalqura"}    | ${"142451-04-27[u-ca=islamic-umalqura]"}     | ${"stride islamic-umalqura k=1500"}
    ${"+275714-02-26"} | ${"islamic-umalqura"}    | ${"283535-06-02[u-ca=islamic-umalqura]"}     | ${"stride islamic-umalqura k=2000"}
    ${"-271818-01-13"} | ${"persian"}             | ${"-272440-10-03[u-ca=persian]"}             | ${"stride persian k=0"}
    ${"-134935-01-24"} | ${"persian"}             | ${"-135557-10-24[u-ca=persian]"}             | ${"stride persian k=500"}
    ${"1400-07-25"}    | ${"persian"}             | ${"0779-05-03[u-ca=persian]"}                | ${"stride persian k=998"}
    ${"1674-04-30"}    | ${"persian"}             | ${"1053-02-11[u-ca=persian]"}                | ${"stride persian k=999"}
    ${"1948-02-05"}    | ${"persian"}             | ${"1326-11-15[u-ca=persian]"}                | ${"stride persian k=1000"}
    ${"+138831-02-15"} | ${"persian"}             | ${"138209-12-07[u-ca=persian]"}              | ${"stride persian k=1500"}
    ${"+275714-02-26"} | ${"persian"}             | ${"275092-12-28[u-ca=persian]"}              | ${"stride persian k=2000"}
    ${"-271818-01-13"} | ${"indian"}              | ${"-271897-10-23[u-ca=indian]"}              | ${"stride indian k=0"}
    ${"-134935-01-24"} | ${"indian"}              | ${"-135014-11-04[u-ca=indian]"}              | ${"stride indian k=500"}
    ${"1400-07-25"}    | ${"indian"}              | ${"1322-05-03[u-ca=indian]"}                 | ${"stride indian k=998"}
    ${"1674-04-30"}    | ${"indian"}              | ${"1596-02-10[u-ca=indian]"}                 | ${"stride indian k=999"}
    ${"1948-02-05"}    | ${"indian"}              | ${"1869-11-16[u-ca=indian]"}                 | ${"stride indian k=1000"}
    ${"+138831-02-15"} | ${"indian"}              | ${"138752-11-26[u-ca=indian]"}               | ${"stride indian k=1500"}
    ${"+275714-02-26"} | ${"indian"}              | ${"275635-12-07[u-ca=indian]"}               | ${"stride indian k=2000"}
    ${"-271818-01-13"} | ${"ethiopic-amete-alem"} | ${"-266321-12-23[u-ca=ethiopic-amete-alem]"} | ${"stride ethioaa k=0"}
    ${"-134935-01-24"} | ${"ethiopic-amete-alem"} | ${"-129440-03-07[u-ca=ethiopic-amete-alem]"} | ${"stride ethioaa k=500"}
    ${"1400-07-25"}    | ${"ethiopic-amete-alem"} | ${"6892-11-22[u-ca=ethiopic-amete-alem]"}    | ${"stride ethioaa k=998"}
    ${"1674-04-30"}    | ${"ethiopic-amete-alem"} | ${"7166-08-25[u-ca=ethiopic-amete-alem]"}    | ${"stride ethioaa k=999"}
    ${"1948-02-05"}    | ${"ethiopic-amete-alem"} | ${"7440-05-27[u-ca=ethiopic-amete-alem]"}    | ${"stride ethioaa k=1000"}
    ${"+138831-02-15"} | ${"ethiopic-amete-alem"} | ${"144320-08-17[u-ca=ethiopic-amete-alem]"}  | ${"stride ethioaa k=1500"}
    ${"+275714-02-26"} | ${"ethiopic-amete-alem"} | ${"281200-11-07[u-ca=ethiopic-amete-alem]"}  | ${"stride ethioaa k=2000"}
    ${"-271818-01-13"} | ${"japanese"}            | ${"271819-01-13[u-ca=japanese;era=bce]"}     | ${"stride japanese k=0"}
    ${"-134935-01-24"} | ${"japanese"}            | ${"134936-01-24[u-ca=japanese;era=bce]"}     | ${"stride japanese k=500"}
    ${"1400-07-25"}    | ${"japanese"}            | ${"1400-07-25[u-ca=japanese;era=ce]"}        | ${"stride japanese k=998"}
    ${"1674-04-30"}    | ${"japanese"}            | ${"1674-04-30[u-ca=japanese;era=ce]"}        | ${"stride japanese k=999"}
    ${"1948-02-05"}    | ${"japanese"}            | ${"0023-02-05[u-ca=japanese;era=showa]"}     | ${"stride japanese k=1000"}
    ${"+138831-02-15"} | ${"japanese"}            | ${"136813-02-15[u-ca=japanese;era=reiwa]"}   | ${"stride japanese k=1500"}
    ${"+275714-02-26"} | ${"japanese"}            | ${"273696-02-26[u-ca=japanese;era=reiwa]"}   | ${"stride japanese k=2000"}
    ${"-271818-01-13"} | ${"taiwan"}              | ${"-273729-01-13[u-ca=taiwan]"}              | ${"stride roc k=0"}
    ${"-134935-01-24"} | ${"taiwan"}              | ${"-136846-01-24[u-ca=taiwan]"}              | ${"stride roc k=500"}
    ${"1400-07-25"}    | ${"taiwan"}              | ${"-000511-07-25[u-ca=taiwan]"}              | ${"stride roc k=998"}
    ${"1674-04-30"}    | ${"taiwan"}              | ${"-000237-04-30[u-ca=taiwan]"}              | ${"stride roc k=999"}
    ${"1948-02-05"}    | ${"taiwan"}              | ${"0037-02-05[u-ca=taiwan]"}                 | ${"stride roc k=1000"}
    ${"+138831-02-15"} | ${"taiwan"}              | ${"136920-02-15[u-ca=taiwan]"}               | ${"stride roc k=1500"}
    ${"+275714-02-26"} | ${"taiwan"}              | ${"273803-02-26[u-ca=taiwan]"}               | ${"stride roc k=2000"}
  `(
    "converts $value to $calendar as $expected ($source)",
    ({ value, calendar, expected }) => {
      expect(convertDateToCalendar(value, calendar)).toBe(expected);
    },
  );

  it.each`
    value                                        | expected           | source
    ${"-271275-01-13[u-ca=buddhist]"}            | ${"-271818-01-13"} | ${"stride buddhist k=0"}
    ${"-134392-01-24[u-ca=buddhist]"}            | ${"-134935-01-24"} | ${"stride buddhist k=500"}
    ${"1943-07-25[u-ca=buddhist]"}               | ${"1400-07-25"}    | ${"stride buddhist k=998"}
    ${"2217-04-30[u-ca=buddhist]"}               | ${"1674-04-30"}    | ${"stride buddhist k=999"}
    ${"2491-02-05[u-ca=buddhist]"}               | ${"1948-02-05"}    | ${"stride buddhist k=1000"}
    ${"139374-02-15[u-ca=buddhist]"}             | ${"+138831-02-15"} | ${"stride buddhist k=1500"}
    ${"276257-02-26[u-ca=buddhist]"}             | ${"+275714-02-26"} | ${"stride buddhist k=2000"}
    ${"-268055-07-30[u-ca=hebrew]"}              | ${"-271818-01-13"} | ${"stride hebrew k=0"}
    ${"-131174-12-26[u-ca=hebrew]"}              | ${"-134935-01-24"} | ${"stride hebrew k=500"}
    ${"5160-11-23[u-ca=hebrew]"}                 | ${"1400-07-25"}    | ${"stride hebrew k=998"}
    ${"5434-08-24[u-ca=hebrew]"}                 | ${"1674-04-30"}    | ${"stride hebrew k=999"}
    ${"5708-05-25[u-ca=hebrew]"}                 | ${"1948-02-05"}    | ${"stride hebrew k=1000"}
    ${"142589-10-21[u-ca=hebrew]"}               | ${"+138831-02-15"} | ${"stride hebrew k=1500"}
    ${"279471-03-19[u-ca=hebrew]"}               | ${"+275714-02-26"} | ${"stride hebrew k=2000"}
    ${"-280801-01-17[u-ca=islamic-civil]"}       | ${"-271818-01-13"} | ${"stride islamic-civil k=0"}
    ${"-139717-02-20[u-ca=islamic-civil]"}       | ${"-134935-01-24"} | ${"stride islamic-civil k=500"}
    ${"0802-11-23[u-ca=islamic-civil]"}          | ${"1400-07-25"}    | ${"stride islamic-civil k=998"}
    ${"1085-01-24[u-ca=islamic-civil]"}          | ${"1674-04-30"}    | ${"stride islamic-civil k=999"}
    ${"1367-03-24[u-ca=islamic-civil]"}          | ${"1948-02-05"}    | ${"stride islamic-civil k=1000"}
    ${"142451-04-27[u-ca=islamic-civil]"}        | ${"+138831-02-15"} | ${"stride islamic-civil k=1500"}
    ${"283535-06-02[u-ca=islamic-civil]"}        | ${"+275714-02-26"} | ${"stride islamic-civil k=2000"}
    ${"-280801-01-18[u-ca=islamic-tabular]"}     | ${"-271818-01-13"} | ${"stride islamic-tbla k=0"}
    ${"-139717-02-21[u-ca=islamic-tabular]"}     | ${"-134935-01-24"} | ${"stride islamic-tbla k=500"}
    ${"0802-11-24[u-ca=islamic-tabular]"}        | ${"1400-07-25"}    | ${"stride islamic-tbla k=998"}
    ${"1085-01-25[u-ca=islamic-tabular]"}        | ${"1674-04-30"}    | ${"stride islamic-tbla k=999"}
    ${"1367-03-25[u-ca=islamic-tabular]"}        | ${"1948-02-05"}    | ${"stride islamic-tbla k=1000"}
    ${"142451-04-28[u-ca=islamic-tabular]"}      | ${"+138831-02-15"} | ${"stride islamic-tbla k=1500"}
    ${"283535-06-03[u-ca=islamic-tabular]"}      | ${"+275714-02-26"} | ${"stride islamic-tbla k=2000"}
    ${"-280801-01-17[u-ca=islamic-umalqura]"}    | ${"-271818-01-13"} | ${"stride islamic-umalqura k=0"}
    ${"-139717-02-20[u-ca=islamic-umalqura]"}    | ${"-134935-01-24"} | ${"stride islamic-umalqura k=500"}
    ${"0802-11-23[u-ca=islamic-umalqura]"}       | ${"1400-07-25"}    | ${"stride islamic-umalqura k=998"}
    ${"1085-01-24[u-ca=islamic-umalqura]"}       | ${"1674-04-30"}    | ${"stride islamic-umalqura k=999"}
    ${"1367-03-24[u-ca=islamic-umalqura]"}       | ${"1948-02-05"}    | ${"stride islamic-umalqura k=1000"}
    ${"142451-04-27[u-ca=islamic-umalqura]"}     | ${"+138831-02-15"} | ${"stride islamic-umalqura k=1500"}
    ${"283535-06-02[u-ca=islamic-umalqura]"}     | ${"+275714-02-26"} | ${"stride islamic-umalqura k=2000"}
    ${"-272440-10-03[u-ca=persian]"}             | ${"-271818-01-13"} | ${"stride persian k=0"}
    ${"-135557-10-24[u-ca=persian]"}             | ${"-134935-01-24"} | ${"stride persian k=500"}
    ${"0779-05-03[u-ca=persian]"}                | ${"1400-07-25"}    | ${"stride persian k=998"}
    ${"1053-02-11[u-ca=persian]"}                | ${"1674-04-30"}    | ${"stride persian k=999"}
    ${"1326-11-15[u-ca=persian]"}                | ${"1948-02-05"}    | ${"stride persian k=1000"}
    ${"138209-12-07[u-ca=persian]"}              | ${"+138831-02-15"} | ${"stride persian k=1500"}
    ${"275092-12-28[u-ca=persian]"}              | ${"+275714-02-26"} | ${"stride persian k=2000"}
    ${"-271897-10-23[u-ca=indian]"}              | ${"-271818-01-13"} | ${"stride indian k=0"}
    ${"-135014-11-04[u-ca=indian]"}              | ${"-134935-01-24"} | ${"stride indian k=500"}
    ${"1322-05-03[u-ca=indian]"}                 | ${"1400-07-25"}    | ${"stride indian k=998"}
    ${"1596-02-10[u-ca=indian]"}                 | ${"1674-04-30"}    | ${"stride indian k=999"}
    ${"1869-11-16[u-ca=indian]"}                 | ${"1948-02-05"}    | ${"stride indian k=1000"}
    ${"138752-11-26[u-ca=indian]"}               | ${"+138831-02-15"} | ${"stride indian k=1500"}
    ${"275635-12-07[u-ca=indian]"}               | ${"+275714-02-26"} | ${"stride indian k=2000"}
    ${"-266321-12-23[u-ca=ethiopic-amete-alem]"} | ${"-271818-01-13"} | ${"stride ethioaa k=0"}
    ${"-129440-03-07[u-ca=ethiopic-amete-alem]"} | ${"-134935-01-24"} | ${"stride ethioaa k=500"}
    ${"6892-11-22[u-ca=ethiopic-amete-alem]"}    | ${"1400-07-25"}    | ${"stride ethioaa k=998"}
    ${"7166-08-25[u-ca=ethiopic-amete-alem]"}    | ${"1674-04-30"}    | ${"stride ethioaa k=999"}
    ${"7440-05-27[u-ca=ethiopic-amete-alem]"}    | ${"1948-02-05"}    | ${"stride ethioaa k=1000"}
    ${"144320-08-17[u-ca=ethiopic-amete-alem]"}  | ${"+138831-02-15"} | ${"stride ethioaa k=1500"}
    ${"281200-11-07[u-ca=ethiopic-amete-alem]"}  | ${"+275714-02-26"} | ${"stride ethioaa k=2000"}
    ${"271819-01-13[u-ca=japanese;era=bce]"}     | ${"-271818-01-13"} | ${"stride japanese k=0"}
    ${"134936-01-24[u-ca=japanese;era=bce]"}     | ${"-134935-01-24"} | ${"stride japanese k=500"}
    ${"1400-07-25[u-ca=japanese;era=ce]"}        | ${"1400-07-25"}    | ${"stride japanese k=998"}
    ${"1674-04-30[u-ca=japanese;era=ce]"}        | ${"1674-04-30"}    | ${"stride japanese k=999"}
    ${"0023-02-05[u-ca=japanese;era=showa]"}     | ${"1948-02-05"}    | ${"stride japanese k=1000"}
    ${"136813-02-15[u-ca=japanese;era=reiwa]"}   | ${"+138831-02-15"} | ${"stride japanese k=1500"}
    ${"273696-02-26[u-ca=japanese;era=reiwa]"}   | ${"+275714-02-26"} | ${"stride japanese k=2000"}
    ${"-273729-01-13[u-ca=taiwan]"}              | ${"-271818-01-13"} | ${"stride roc k=0"}
    ${"-136846-01-24[u-ca=taiwan]"}              | ${"-134935-01-24"} | ${"stride roc k=500"}
    ${"-000511-07-25[u-ca=taiwan]"}              | ${"1400-07-25"}    | ${"stride roc k=998"}
    ${"-000237-04-30[u-ca=taiwan]"}              | ${"1674-04-30"}    | ${"stride roc k=999"}
    ${"0037-02-05[u-ca=taiwan]"}                 | ${"1948-02-05"}    | ${"stride roc k=1000"}
    ${"136920-02-15[u-ca=taiwan]"}               | ${"+138831-02-15"} | ${"stride roc k=1500"}
    ${"273803-02-26[u-ca=taiwan]"}               | ${"+275714-02-26"} | ${"stride roc k=2000"}
  `(
    "converts $value back to gregorian as $expected ($source)",
    ({ value, expected }) => {
      expect(convertDateToCalendar(value, "gregorian")).toBe(expected);
    },
  );
});
