import { addDate } from "./addDate";

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

// CORE-6 §4.4 modern grid: 2023-06-01 + i days, i in {0, 61, 91, 122, 245, 274}.
// islamic-umalqura rows are in addDate.umalqura.test.ts (Chromium 153.0.8010.12 recording).
describe("addDate at ordinary dates in every calendar (CORE-6 §4.4 grid)", () => {
  it.each`
    value                                     | units            | overflow       | expected                                  | source
    ${"2566-08-01[u-ca=buddhist]"}            | ${{ months: 1 }} | ${"constrain"} | ${"2566-09-01[u-ca=buddhist]"}            | ${"grid buddhist i=61"}
    ${"2566-08-01[u-ca=buddhist]"}            | ${{ months: 1 }} | ${"reject"}    | ${"2566-09-01[u-ca=buddhist]"}            | ${"grid buddhist i=61"}
    ${"2566-08-01[u-ca=buddhist]"}            | ${{ years: 1 }}  | ${"constrain"} | ${"2567-08-01[u-ca=buddhist]"}            | ${"grid buddhist i=61"}
    ${"2566-08-31[u-ca=buddhist]"}            | ${{ months: 1 }} | ${"constrain"} | ${"2566-09-30[u-ca=buddhist]"}            | ${"grid buddhist i=91"}
    ${"2566-08-31[u-ca=buddhist]"}            | ${{ months: 1 }} | ${"reject"}    | ${""}                                     | ${"grid buddhist i=91"}
    ${"2566-08-31[u-ca=buddhist]"}            | ${{ years: 1 }}  | ${"constrain"} | ${"2567-08-31[u-ca=buddhist]"}            | ${"grid buddhist i=91"}
    ${"2566-10-01[u-ca=buddhist]"}            | ${{ months: 1 }} | ${"constrain"} | ${"2566-11-01[u-ca=buddhist]"}            | ${"grid buddhist i=122"}
    ${"2566-10-01[u-ca=buddhist]"}            | ${{ months: 1 }} | ${"reject"}    | ${"2566-11-01[u-ca=buddhist]"}            | ${"grid buddhist i=122"}
    ${"2566-10-01[u-ca=buddhist]"}            | ${{ years: 1 }}  | ${"constrain"} | ${"2567-10-01[u-ca=buddhist]"}            | ${"grid buddhist i=122"}
    ${"2567-02-01[u-ca=buddhist]"}            | ${{ months: 1 }} | ${"constrain"} | ${"2567-03-01[u-ca=buddhist]"}            | ${"grid buddhist i=245"}
    ${"2567-02-01[u-ca=buddhist]"}            | ${{ months: 1 }} | ${"reject"}    | ${"2567-03-01[u-ca=buddhist]"}            | ${"grid buddhist i=245"}
    ${"2567-02-01[u-ca=buddhist]"}            | ${{ years: 1 }}  | ${"constrain"} | ${"2568-02-01[u-ca=buddhist]"}            | ${"grid buddhist i=245"}
    ${"2567-03-01[u-ca=buddhist]"}            | ${{ months: 1 }} | ${"constrain"} | ${"2567-04-01[u-ca=buddhist]"}            | ${"grid buddhist i=274"}
    ${"2567-03-01[u-ca=buddhist]"}            | ${{ months: 1 }} | ${"reject"}    | ${"2567-04-01[u-ca=buddhist]"}            | ${"grid buddhist i=274"}
    ${"2567-03-01[u-ca=buddhist]"}            | ${{ years: 1 }}  | ${"constrain"} | ${"2568-03-01[u-ca=buddhist]"}            | ${"grid buddhist i=274"}
    ${"5783-11-14[u-ca=hebrew]"}              | ${{ months: 1 }} | ${"constrain"} | ${"5783-12-14[u-ca=hebrew]"}              | ${"grid hebrew i=61"}
    ${"5783-11-14[u-ca=hebrew]"}              | ${{ months: 1 }} | ${"reject"}    | ${"5783-12-14[u-ca=hebrew]"}              | ${"grid hebrew i=61"}
    ${"5783-11-14[u-ca=hebrew]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"5784-12-14[u-ca=hebrew]"}              | ${"grid hebrew i=61"}
    ${"5783-12-14[u-ca=hebrew]"}              | ${{ months: 1 }} | ${"constrain"} | ${"5784-01-14[u-ca=hebrew]"}              | ${"grid hebrew i=91"}
    ${"5783-12-14[u-ca=hebrew]"}              | ${{ months: 1 }} | ${"reject"}    | ${"5784-01-14[u-ca=hebrew]"}              | ${"grid hebrew i=91"}
    ${"5783-12-14[u-ca=hebrew]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"5784-13-14[u-ca=hebrew]"}              | ${"grid hebrew i=91"}
    ${"5784-01-16[u-ca=hebrew]"}              | ${{ months: 1 }} | ${"constrain"} | ${"5784-02-16[u-ca=hebrew]"}              | ${"grid hebrew i=122"}
    ${"5784-01-16[u-ca=hebrew]"}              | ${{ months: 1 }} | ${"reject"}    | ${"5784-02-16[u-ca=hebrew]"}              | ${"grid hebrew i=122"}
    ${"5784-01-16[u-ca=hebrew]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"5785-01-16[u-ca=hebrew]"}              | ${"grid hebrew i=122"}
    ${"5784-05-22[u-ca=hebrew]"}              | ${{ months: 1 }} | ${"constrain"} | ${"5784-06-22[u-ca=hebrew]"}              | ${"grid hebrew i=245"}
    ${"5784-05-22[u-ca=hebrew]"}              | ${{ months: 1 }} | ${"reject"}    | ${"5784-06-22[u-ca=hebrew]"}              | ${"grid hebrew i=245"}
    ${"5784-05-22[u-ca=hebrew]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"5785-05-22[u-ca=hebrew]"}              | ${"grid hebrew i=245"}
    ${"5784-06-21[u-ca=hebrew]"}              | ${{ months: 1 }} | ${"constrain"} | ${"5784-07-21[u-ca=hebrew]"}              | ${"grid hebrew i=274"}
    ${"5784-06-21[u-ca=hebrew]"}              | ${{ months: 1 }} | ${"reject"}    | ${"5784-07-21[u-ca=hebrew]"}              | ${"grid hebrew i=274"}
    ${"5784-06-21[u-ca=hebrew]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"5785-06-21[u-ca=hebrew]"}              | ${"grid hebrew i=274"}
    ${"1445-01-14[u-ca=islamic-civil]"}       | ${{ months: 1 }} | ${"constrain"} | ${"1445-02-14[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=61"}
    ${"1445-01-14[u-ca=islamic-civil]"}       | ${{ months: 1 }} | ${"reject"}    | ${"1445-02-14[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=61"}
    ${"1445-01-14[u-ca=islamic-civil]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"1446-01-14[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=61"}
    ${"1445-02-14[u-ca=islamic-civil]"}       | ${{ months: 1 }} | ${"constrain"} | ${"1445-03-14[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=91"}
    ${"1445-02-14[u-ca=islamic-civil]"}       | ${{ months: 1 }} | ${"reject"}    | ${"1445-03-14[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=91"}
    ${"1445-02-14[u-ca=islamic-civil]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"1446-02-14[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=91"}
    ${"1445-03-16[u-ca=islamic-civil]"}       | ${{ months: 1 }} | ${"constrain"} | ${"1445-04-16[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=122"}
    ${"1445-03-16[u-ca=islamic-civil]"}       | ${{ months: 1 }} | ${"reject"}    | ${"1445-04-16[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=122"}
    ${"1445-03-16[u-ca=islamic-civil]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"1446-03-16[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=122"}
    ${"1445-07-21[u-ca=islamic-civil]"}       | ${{ months: 1 }} | ${"constrain"} | ${"1445-08-21[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=245"}
    ${"1445-07-21[u-ca=islamic-civil]"}       | ${{ months: 1 }} | ${"reject"}    | ${"1445-08-21[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=245"}
    ${"1445-07-21[u-ca=islamic-civil]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"1446-07-21[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=245"}
    ${"1445-08-20[u-ca=islamic-civil]"}       | ${{ months: 1 }} | ${"constrain"} | ${"1445-09-20[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=274"}
    ${"1445-08-20[u-ca=islamic-civil]"}       | ${{ months: 1 }} | ${"reject"}    | ${"1445-09-20[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=274"}
    ${"1445-08-20[u-ca=islamic-civil]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"1446-08-20[u-ca=islamic-civil]"}       | ${"grid islamic-civil i=274"}
    ${"1445-01-15[u-ca=islamic-tabular]"}     | ${{ months: 1 }} | ${"constrain"} | ${"1445-02-15[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=61"}
    ${"1445-01-15[u-ca=islamic-tabular]"}     | ${{ months: 1 }} | ${"reject"}    | ${"1445-02-15[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=61"}
    ${"1445-01-15[u-ca=islamic-tabular]"}     | ${{ years: 1 }}  | ${"constrain"} | ${"1446-01-15[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=61"}
    ${"1445-02-15[u-ca=islamic-tabular]"}     | ${{ months: 1 }} | ${"constrain"} | ${"1445-03-15[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=91"}
    ${"1445-02-15[u-ca=islamic-tabular]"}     | ${{ months: 1 }} | ${"reject"}    | ${"1445-03-15[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=91"}
    ${"1445-02-15[u-ca=islamic-tabular]"}     | ${{ years: 1 }}  | ${"constrain"} | ${"1446-02-15[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=91"}
    ${"1445-03-17[u-ca=islamic-tabular]"}     | ${{ months: 1 }} | ${"constrain"} | ${"1445-04-17[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=122"}
    ${"1445-03-17[u-ca=islamic-tabular]"}     | ${{ months: 1 }} | ${"reject"}    | ${"1445-04-17[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=122"}
    ${"1445-03-17[u-ca=islamic-tabular]"}     | ${{ years: 1 }}  | ${"constrain"} | ${"1446-03-17[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=122"}
    ${"1445-07-22[u-ca=islamic-tabular]"}     | ${{ months: 1 }} | ${"constrain"} | ${"1445-08-22[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=245"}
    ${"1445-07-22[u-ca=islamic-tabular]"}     | ${{ months: 1 }} | ${"reject"}    | ${"1445-08-22[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=245"}
    ${"1445-07-22[u-ca=islamic-tabular]"}     | ${{ years: 1 }}  | ${"constrain"} | ${"1446-07-22[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=245"}
    ${"1445-08-21[u-ca=islamic-tabular]"}     | ${{ months: 1 }} | ${"constrain"} | ${"1445-09-21[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=274"}
    ${"1445-08-21[u-ca=islamic-tabular]"}     | ${{ months: 1 }} | ${"reject"}    | ${"1445-09-21[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=274"}
    ${"1445-08-21[u-ca=islamic-tabular]"}     | ${{ years: 1 }}  | ${"constrain"} | ${"1446-08-21[u-ca=islamic-tabular]"}     | ${"grid islamic-tbla i=274"}
    ${"1402-05-10[u-ca=persian]"}             | ${{ months: 1 }} | ${"constrain"} | ${"1402-06-10[u-ca=persian]"}             | ${"grid persian i=61"}
    ${"1402-05-10[u-ca=persian]"}             | ${{ months: 1 }} | ${"reject"}    | ${"1402-06-10[u-ca=persian]"}             | ${"grid persian i=61"}
    ${"1402-05-10[u-ca=persian]"}             | ${{ years: 1 }}  | ${"constrain"} | ${"1403-05-10[u-ca=persian]"}             | ${"grid persian i=61"}
    ${"1402-06-09[u-ca=persian]"}             | ${{ months: 1 }} | ${"constrain"} | ${"1402-07-09[u-ca=persian]"}             | ${"grid persian i=91"}
    ${"1402-06-09[u-ca=persian]"}             | ${{ months: 1 }} | ${"reject"}    | ${"1402-07-09[u-ca=persian]"}             | ${"grid persian i=91"}
    ${"1402-06-09[u-ca=persian]"}             | ${{ years: 1 }}  | ${"constrain"} | ${"1403-06-09[u-ca=persian]"}             | ${"grid persian i=91"}
    ${"1402-07-09[u-ca=persian]"}             | ${{ months: 1 }} | ${"constrain"} | ${"1402-08-09[u-ca=persian]"}             | ${"grid persian i=122"}
    ${"1402-07-09[u-ca=persian]"}             | ${{ months: 1 }} | ${"reject"}    | ${"1402-08-09[u-ca=persian]"}             | ${"grid persian i=122"}
    ${"1402-07-09[u-ca=persian]"}             | ${{ years: 1 }}  | ${"constrain"} | ${"1403-07-09[u-ca=persian]"}             | ${"grid persian i=122"}
    ${"1402-11-12[u-ca=persian]"}             | ${{ months: 1 }} | ${"constrain"} | ${"1402-12-12[u-ca=persian]"}             | ${"grid persian i=245"}
    ${"1402-11-12[u-ca=persian]"}             | ${{ months: 1 }} | ${"reject"}    | ${"1402-12-12[u-ca=persian]"}             | ${"grid persian i=245"}
    ${"1402-11-12[u-ca=persian]"}             | ${{ years: 1 }}  | ${"constrain"} | ${"1403-11-12[u-ca=persian]"}             | ${"grid persian i=245"}
    ${"1402-12-11[u-ca=persian]"}             | ${{ months: 1 }} | ${"constrain"} | ${"1403-01-11[u-ca=persian]"}             | ${"grid persian i=274"}
    ${"1402-12-11[u-ca=persian]"}             | ${{ months: 1 }} | ${"reject"}    | ${"1403-01-11[u-ca=persian]"}             | ${"grid persian i=274"}
    ${"1402-12-11[u-ca=persian]"}             | ${{ years: 1 }}  | ${"constrain"} | ${"1403-12-11[u-ca=persian]"}             | ${"grid persian i=274"}
    ${"1945-05-10[u-ca=indian]"}              | ${{ months: 1 }} | ${"constrain"} | ${"1945-06-10[u-ca=indian]"}              | ${"grid indian i=61"}
    ${"1945-05-10[u-ca=indian]"}              | ${{ months: 1 }} | ${"reject"}    | ${"1945-06-10[u-ca=indian]"}              | ${"grid indian i=61"}
    ${"1945-05-10[u-ca=indian]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"1946-05-10[u-ca=indian]"}              | ${"grid indian i=61"}
    ${"1945-06-09[u-ca=indian]"}              | ${{ months: 1 }} | ${"constrain"} | ${"1945-07-09[u-ca=indian]"}              | ${"grid indian i=91"}
    ${"1945-06-09[u-ca=indian]"}              | ${{ months: 1 }} | ${"reject"}    | ${"1945-07-09[u-ca=indian]"}              | ${"grid indian i=91"}
    ${"1945-06-09[u-ca=indian]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"1946-06-09[u-ca=indian]"}              | ${"grid indian i=91"}
    ${"1945-07-09[u-ca=indian]"}              | ${{ months: 1 }} | ${"constrain"} | ${"1945-08-09[u-ca=indian]"}              | ${"grid indian i=122"}
    ${"1945-07-09[u-ca=indian]"}              | ${{ months: 1 }} | ${"reject"}    | ${"1945-08-09[u-ca=indian]"}              | ${"grid indian i=122"}
    ${"1945-07-09[u-ca=indian]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"1946-07-09[u-ca=indian]"}              | ${"grid indian i=122"}
    ${"1945-11-12[u-ca=indian]"}              | ${{ months: 1 }} | ${"constrain"} | ${"1945-12-12[u-ca=indian]"}              | ${"grid indian i=245"}
    ${"1945-11-12[u-ca=indian]"}              | ${{ months: 1 }} | ${"reject"}    | ${"1945-12-12[u-ca=indian]"}              | ${"grid indian i=245"}
    ${"1945-11-12[u-ca=indian]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"1946-11-12[u-ca=indian]"}              | ${"grid indian i=245"}
    ${"1945-12-11[u-ca=indian]"}              | ${{ months: 1 }} | ${"constrain"} | ${"1946-01-11[u-ca=indian]"}              | ${"grid indian i=274"}
    ${"1945-12-11[u-ca=indian]"}              | ${{ months: 1 }} | ${"reject"}    | ${"1946-01-11[u-ca=indian]"}              | ${"grid indian i=274"}
    ${"1945-12-11[u-ca=indian]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"1946-12-11[u-ca=indian]"}              | ${"grid indian i=274"}
    ${"7515-11-25[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }} | ${"constrain"} | ${"7515-12-25[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=61"}
    ${"7515-11-25[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }} | ${"reject"}    | ${"7515-12-25[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=61"}
    ${"7515-11-25[u-ca=ethiopic-amete-alem]"} | ${{ years: 1 }}  | ${"constrain"} | ${"7516-11-25[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=61"}
    ${"7515-12-25[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }} | ${"constrain"} | ${"7515-13-06[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=91"}
    ${"7515-12-25[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }} | ${"reject"}    | ${""}                                     | ${"grid ethioaa i=91"}
    ${"7515-12-25[u-ca=ethiopic-amete-alem]"} | ${{ years: 1 }}  | ${"constrain"} | ${"7516-12-25[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=91"}
    ${"7516-01-20[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }} | ${"constrain"} | ${"7516-02-20[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=122"}
    ${"7516-01-20[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }} | ${"reject"}    | ${"7516-02-20[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=122"}
    ${"7516-01-20[u-ca=ethiopic-amete-alem]"} | ${{ years: 1 }}  | ${"constrain"} | ${"7517-01-20[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=122"}
    ${"7516-05-23[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }} | ${"constrain"} | ${"7516-06-23[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=245"}
    ${"7516-05-23[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }} | ${"reject"}    | ${"7516-06-23[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=245"}
    ${"7516-05-23[u-ca=ethiopic-amete-alem]"} | ${{ years: 1 }}  | ${"constrain"} | ${"7517-05-23[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=245"}
    ${"7516-06-22[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }} | ${"constrain"} | ${"7516-07-22[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=274"}
    ${"7516-06-22[u-ca=ethiopic-amete-alem]"} | ${{ months: 1 }} | ${"reject"}    | ${"7516-07-22[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=274"}
    ${"7516-06-22[u-ca=ethiopic-amete-alem]"} | ${{ years: 1 }}  | ${"constrain"} | ${"7517-06-22[u-ca=ethiopic-amete-alem]"} | ${"grid ethioaa i=274"}
    ${"0005-08-01[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }} | ${"constrain"} | ${"0005-09-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=61"}
    ${"0005-08-01[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }} | ${"reject"}    | ${"0005-09-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=61"}
    ${"0005-08-01[u-ca=japanese;era=reiwa]"}  | ${{ years: 1 }}  | ${"constrain"} | ${"0006-08-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=61"}
    ${"0005-08-31[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }} | ${"constrain"} | ${"0005-09-30[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=91"}
    ${"0005-08-31[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }} | ${"reject"}    | ${""}                                     | ${"grid japanese i=91"}
    ${"0005-08-31[u-ca=japanese;era=reiwa]"}  | ${{ years: 1 }}  | ${"constrain"} | ${"0006-08-31[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=91"}
    ${"0005-10-01[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }} | ${"constrain"} | ${"0005-11-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=122"}
    ${"0005-10-01[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }} | ${"reject"}    | ${"0005-11-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=122"}
    ${"0005-10-01[u-ca=japanese;era=reiwa]"}  | ${{ years: 1 }}  | ${"constrain"} | ${"0006-10-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=122"}
    ${"0006-02-01[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }} | ${"constrain"} | ${"0006-03-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=245"}
    ${"0006-02-01[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }} | ${"reject"}    | ${"0006-03-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=245"}
    ${"0006-02-01[u-ca=japanese;era=reiwa]"}  | ${{ years: 1 }}  | ${"constrain"} | ${"0007-02-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=245"}
    ${"0006-03-01[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }} | ${"constrain"} | ${"0006-04-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=274"}
    ${"0006-03-01[u-ca=japanese;era=reiwa]"}  | ${{ months: 1 }} | ${"reject"}    | ${"0006-04-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=274"}
    ${"0006-03-01[u-ca=japanese;era=reiwa]"}  | ${{ years: 1 }}  | ${"constrain"} | ${"0007-03-01[u-ca=japanese;era=reiwa]"}  | ${"grid japanese i=274"}
    ${"0112-08-01[u-ca=taiwan]"}              | ${{ months: 1 }} | ${"constrain"} | ${"0112-09-01[u-ca=taiwan]"}              | ${"grid roc i=61"}
    ${"0112-08-01[u-ca=taiwan]"}              | ${{ months: 1 }} | ${"reject"}    | ${"0112-09-01[u-ca=taiwan]"}              | ${"grid roc i=61"}
    ${"0112-08-01[u-ca=taiwan]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"0113-08-01[u-ca=taiwan]"}              | ${"grid roc i=61"}
    ${"0112-08-31[u-ca=taiwan]"}              | ${{ months: 1 }} | ${"constrain"} | ${"0112-09-30[u-ca=taiwan]"}              | ${"grid roc i=91"}
    ${"0112-08-31[u-ca=taiwan]"}              | ${{ months: 1 }} | ${"reject"}    | ${""}                                     | ${"grid roc i=91"}
    ${"0112-08-31[u-ca=taiwan]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"0113-08-31[u-ca=taiwan]"}              | ${"grid roc i=91"}
    ${"0112-10-01[u-ca=taiwan]"}              | ${{ months: 1 }} | ${"constrain"} | ${"0112-11-01[u-ca=taiwan]"}              | ${"grid roc i=122"}
    ${"0112-10-01[u-ca=taiwan]"}              | ${{ months: 1 }} | ${"reject"}    | ${"0112-11-01[u-ca=taiwan]"}              | ${"grid roc i=122"}
    ${"0112-10-01[u-ca=taiwan]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"0113-10-01[u-ca=taiwan]"}              | ${"grid roc i=122"}
    ${"0113-02-01[u-ca=taiwan]"}              | ${{ months: 1 }} | ${"constrain"} | ${"0113-03-01[u-ca=taiwan]"}              | ${"grid roc i=245"}
    ${"0113-02-01[u-ca=taiwan]"}              | ${{ months: 1 }} | ${"reject"}    | ${"0113-03-01[u-ca=taiwan]"}              | ${"grid roc i=245"}
    ${"0113-02-01[u-ca=taiwan]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"0114-02-01[u-ca=taiwan]"}              | ${"grid roc i=245"}
    ${"0113-03-01[u-ca=taiwan]"}              | ${{ months: 1 }} | ${"constrain"} | ${"0113-04-01[u-ca=taiwan]"}              | ${"grid roc i=274"}
    ${"0113-03-01[u-ca=taiwan]"}              | ${{ months: 1 }} | ${"reject"}    | ${"0113-04-01[u-ca=taiwan]"}              | ${"grid roc i=274"}
    ${"0113-03-01[u-ca=taiwan]"}              | ${{ years: 1 }}  | ${"constrain"} | ${"0114-03-01[u-ca=taiwan]"}              | ${"grid roc i=274"}
    ${"2023-08-01"}                           | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-01"}                           | ${"grid gregory i=61"}
    ${"2023-08-01"}                           | ${{ months: 1 }} | ${"reject"}    | ${"2023-09-01"}                           | ${"grid gregory i=61"}
    ${"2023-08-01"}                           | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-01"}                           | ${"grid gregory i=61"}
    ${"2023-08-31"}                           | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-30"}                           | ${"grid gregory i=91"}
    ${"2023-08-31"}                           | ${{ months: 1 }} | ${"reject"}    | ${""}                                     | ${"grid gregory i=91"}
    ${"2023-08-31"}                           | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-31"}                           | ${"grid gregory i=91"}
    ${"2023-10-01"}                           | ${{ months: 1 }} | ${"constrain"} | ${"2023-11-01"}                           | ${"grid gregory i=122"}
    ${"2023-10-01"}                           | ${{ months: 1 }} | ${"reject"}    | ${"2023-11-01"}                           | ${"grid gregory i=122"}
    ${"2023-10-01"}                           | ${{ years: 1 }}  | ${"constrain"} | ${"2024-10-01"}                           | ${"grid gregory i=122"}
    ${"2024-02-01"}                           | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-01"}                           | ${"grid gregory i=245"}
    ${"2024-02-01"}                           | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-01"}                           | ${"grid gregory i=245"}
    ${"2024-02-01"}                           | ${{ years: 1 }}  | ${"constrain"} | ${"2025-02-01"}                           | ${"grid gregory i=245"}
    ${"2024-03-01"}                           | ${{ months: 1 }} | ${"constrain"} | ${"2024-04-01"}                           | ${"grid gregory i=274"}
    ${"2024-03-01"}                           | ${{ months: 1 }} | ${"reject"}    | ${"2024-04-01"}                           | ${"grid gregory i=274"}
    ${"2024-03-01"}                           | ${{ years: 1 }}  | ${"constrain"} | ${"2025-03-01"}                           | ${"grid gregory i=274"}
  `(
    "adds $units to $value with overflow $overflow as $expected ($source)",
    ({ value, units, overflow, expected }) => {
      expect(addDate(value, units, { overflow })).toBe(expected);
    },
  );
});
