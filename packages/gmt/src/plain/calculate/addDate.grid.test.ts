import { addDate } from "./addDate";

// Expected values: Chromium 152 native Temporal, recorded in the CORE-6 research scan
// (q2-xscan-chromium152.json / q2-grid-chromium152.json; the scan is scripts/temporal-compat/scan-body.js).
// Strings are RFC 9557: the ISO date plus [u-ca=<id>]. Each was converted from the CORE-6
// calendar-field string by native Temporal (Chromium 153.0.8010.12,
// `Temporal.PlainDate.from({ calendar, year | era + eraYear, month, day }, { overflow: "reject" })`).
// "" is the sentinel where Chromium throws. Never GMT output, never the polyfill.

// CORE-6 §4.4 modern grid: 2023-06-01 + i days, i in {0, 61, 91, 122, 245, 274}.
// islamic-umalqura rows are in addDate.umalqura.test.ts (Chromium 153.0.8010.12 recording).
describe("addDate at ordinary dates in every calendar (CORE-6 §4.4 grid)", () => {
  it.each`
    value                               | units            | overflow       | expected                            | source
    ${"2023-08-01[u-ca=buddhist]"}      | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-01[u-ca=buddhist]"}      | ${"grid buddhist i=61"}
    ${"2023-08-01[u-ca=buddhist]"}      | ${{ months: 1 }} | ${"reject"}    | ${"2023-09-01[u-ca=buddhist]"}      | ${"grid buddhist i=61"}
    ${"2023-08-01[u-ca=buddhist]"}      | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-01[u-ca=buddhist]"}      | ${"grid buddhist i=61"}
    ${"2023-08-31[u-ca=buddhist]"}      | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-30[u-ca=buddhist]"}      | ${"grid buddhist i=91"}
    ${"2023-08-31[u-ca=buddhist]"}      | ${{ months: 1 }} | ${"reject"}    | ${""}                               | ${"grid buddhist i=91"}
    ${"2023-08-31[u-ca=buddhist]"}      | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-31[u-ca=buddhist]"}      | ${"grid buddhist i=91"}
    ${"2023-10-01[u-ca=buddhist]"}      | ${{ months: 1 }} | ${"constrain"} | ${"2023-11-01[u-ca=buddhist]"}      | ${"grid buddhist i=122"}
    ${"2023-10-01[u-ca=buddhist]"}      | ${{ months: 1 }} | ${"reject"}    | ${"2023-11-01[u-ca=buddhist]"}      | ${"grid buddhist i=122"}
    ${"2023-10-01[u-ca=buddhist]"}      | ${{ years: 1 }}  | ${"constrain"} | ${"2024-10-01[u-ca=buddhist]"}      | ${"grid buddhist i=122"}
    ${"2024-02-01[u-ca=buddhist]"}      | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-01[u-ca=buddhist]"}      | ${"grid buddhist i=245"}
    ${"2024-02-01[u-ca=buddhist]"}      | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-01[u-ca=buddhist]"}      | ${"grid buddhist i=245"}
    ${"2024-02-01[u-ca=buddhist]"}      | ${{ years: 1 }}  | ${"constrain"} | ${"2025-02-01[u-ca=buddhist]"}      | ${"grid buddhist i=245"}
    ${"2024-03-01[u-ca=buddhist]"}      | ${{ months: 1 }} | ${"constrain"} | ${"2024-04-01[u-ca=buddhist]"}      | ${"grid buddhist i=274"}
    ${"2024-03-01[u-ca=buddhist]"}      | ${{ months: 1 }} | ${"reject"}    | ${"2024-04-01[u-ca=buddhist]"}      | ${"grid buddhist i=274"}
    ${"2024-03-01[u-ca=buddhist]"}      | ${{ years: 1 }}  | ${"constrain"} | ${"2025-03-01[u-ca=buddhist]"}      | ${"grid buddhist i=274"}
    ${"2023-08-01[u-ca=hebrew]"}        | ${{ months: 1 }} | ${"constrain"} | ${"2023-08-31[u-ca=hebrew]"}        | ${"grid hebrew i=61"}
    ${"2023-08-01[u-ca=hebrew]"}        | ${{ months: 1 }} | ${"reject"}    | ${"2023-08-31[u-ca=hebrew]"}        | ${"grid hebrew i=61"}
    ${"2023-08-01[u-ca=hebrew]"}        | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-18[u-ca=hebrew]"}        | ${"grid hebrew i=61"}
    ${"2023-08-31[u-ca=hebrew]"}        | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-29[u-ca=hebrew]"}        | ${"grid hebrew i=91"}
    ${"2023-08-31[u-ca=hebrew]"}        | ${{ months: 1 }} | ${"reject"}    | ${"2023-09-29[u-ca=hebrew]"}        | ${"grid hebrew i=91"}
    ${"2023-08-31[u-ca=hebrew]"}        | ${{ years: 1 }}  | ${"constrain"} | ${"2024-09-17[u-ca=hebrew]"}        | ${"grid hebrew i=91"}
    ${"2023-10-01[u-ca=hebrew]"}        | ${{ months: 1 }} | ${"constrain"} | ${"2023-10-31[u-ca=hebrew]"}        | ${"grid hebrew i=122"}
    ${"2023-10-01[u-ca=hebrew]"}        | ${{ months: 1 }} | ${"reject"}    | ${"2023-10-31[u-ca=hebrew]"}        | ${"grid hebrew i=122"}
    ${"2023-10-01[u-ca=hebrew]"}        | ${{ years: 1 }}  | ${"constrain"} | ${"2024-10-18[u-ca=hebrew]"}        | ${"grid hebrew i=122"}
    ${"2024-02-01[u-ca=hebrew]"}        | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-02[u-ca=hebrew]"}        | ${"grid hebrew i=245"}
    ${"2024-02-01[u-ca=hebrew]"}        | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-02[u-ca=hebrew]"}        | ${"grid hebrew i=245"}
    ${"2024-02-01[u-ca=hebrew]"}        | ${{ years: 1 }}  | ${"constrain"} | ${"2025-02-20[u-ca=hebrew]"}        | ${"grid hebrew i=245"}
    ${"2024-03-01[u-ca=hebrew]"}        | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-31[u-ca=hebrew]"}        | ${"grid hebrew i=274"}
    ${"2024-03-01[u-ca=hebrew]"}        | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-31[u-ca=hebrew]"}        | ${"grid hebrew i=274"}
    ${"2024-03-01[u-ca=hebrew]"}        | ${{ years: 1 }}  | ${"constrain"} | ${"2025-03-21[u-ca=hebrew]"}        | ${"grid hebrew i=274"}
    ${"2023-08-01[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${"constrain"} | ${"2023-08-31[u-ca=islamic-civil]"} | ${"grid islamic-civil i=61"}
    ${"2023-08-01[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${"reject"}    | ${"2023-08-31[u-ca=islamic-civil]"} | ${"grid islamic-civil i=61"}
    ${"2023-08-01[u-ca=islamic-civil]"} | ${{ years: 1 }}  | ${"constrain"} | ${"2024-07-21[u-ca=islamic-civil]"} | ${"grid islamic-civil i=61"}
    ${"2023-08-31[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-29[u-ca=islamic-civil]"} | ${"grid islamic-civil i=91"}
    ${"2023-08-31[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${"reject"}    | ${"2023-09-29[u-ca=islamic-civil]"} | ${"grid islamic-civil i=91"}
    ${"2023-08-31[u-ca=islamic-civil]"} | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-20[u-ca=islamic-civil]"} | ${"grid islamic-civil i=91"}
    ${"2023-10-01[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${"constrain"} | ${"2023-10-31[u-ca=islamic-civil]"} | ${"grid islamic-civil i=122"}
    ${"2023-10-01[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${"reject"}    | ${"2023-10-31[u-ca=islamic-civil]"} | ${"grid islamic-civil i=122"}
    ${"2023-10-01[u-ca=islamic-civil]"} | ${{ years: 1 }}  | ${"constrain"} | ${"2024-09-20[u-ca=islamic-civil]"} | ${"grid islamic-civil i=122"}
    ${"2024-02-01[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-02[u-ca=islamic-civil]"} | ${"grid islamic-civil i=245"}
    ${"2024-02-01[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-02[u-ca=islamic-civil]"} | ${"grid islamic-civil i=245"}
    ${"2024-02-01[u-ca=islamic-civil]"} | ${{ years: 1 }}  | ${"constrain"} | ${"2025-01-21[u-ca=islamic-civil]"} | ${"grid islamic-civil i=245"}
    ${"2024-03-01[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-30[u-ca=islamic-civil]"} | ${"grid islamic-civil i=274"}
    ${"2024-03-01[u-ca=islamic-civil]"} | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-30[u-ca=islamic-civil]"} | ${"grid islamic-civil i=274"}
    ${"2024-03-01[u-ca=islamic-civil]"} | ${{ years: 1 }}  | ${"constrain"} | ${"2025-02-19[u-ca=islamic-civil]"} | ${"grid islamic-civil i=274"}
    ${"2023-08-01[u-ca=islamic-tbla]"}  | ${{ months: 1 }} | ${"constrain"} | ${"2023-08-31[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=61"}
    ${"2023-08-01[u-ca=islamic-tbla]"}  | ${{ months: 1 }} | ${"reject"}    | ${"2023-08-31[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=61"}
    ${"2023-08-01[u-ca=islamic-tbla]"}  | ${{ years: 1 }}  | ${"constrain"} | ${"2024-07-21[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=61"}
    ${"2023-08-31[u-ca=islamic-tbla]"}  | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-29[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=91"}
    ${"2023-08-31[u-ca=islamic-tbla]"}  | ${{ months: 1 }} | ${"reject"}    | ${"2023-09-29[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=91"}
    ${"2023-08-31[u-ca=islamic-tbla]"}  | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-20[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=91"}
    ${"2023-10-01[u-ca=islamic-tbla]"}  | ${{ months: 1 }} | ${"constrain"} | ${"2023-10-31[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=122"}
    ${"2023-10-01[u-ca=islamic-tbla]"}  | ${{ months: 1 }} | ${"reject"}    | ${"2023-10-31[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=122"}
    ${"2023-10-01[u-ca=islamic-tbla]"}  | ${{ years: 1 }}  | ${"constrain"} | ${"2024-09-20[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=122"}
    ${"2024-02-01[u-ca=islamic-tbla]"}  | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-02[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=245"}
    ${"2024-02-01[u-ca=islamic-tbla]"}  | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-02[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=245"}
    ${"2024-02-01[u-ca=islamic-tbla]"}  | ${{ years: 1 }}  | ${"constrain"} | ${"2025-01-21[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=245"}
    ${"2024-03-01[u-ca=islamic-tbla]"}  | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-30[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=274"}
    ${"2024-03-01[u-ca=islamic-tbla]"}  | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-30[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=274"}
    ${"2024-03-01[u-ca=islamic-tbla]"}  | ${{ years: 1 }}  | ${"constrain"} | ${"2025-02-19[u-ca=islamic-tbla]"}  | ${"grid islamic-tbla i=274"}
    ${"2023-08-01[u-ca=persian]"}       | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-01[u-ca=persian]"}       | ${"grid persian i=61"}
    ${"2023-08-01[u-ca=persian]"}       | ${{ months: 1 }} | ${"reject"}    | ${"2023-09-01[u-ca=persian]"}       | ${"grid persian i=61"}
    ${"2023-08-01[u-ca=persian]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"2024-07-31[u-ca=persian]"}       | ${"grid persian i=61"}
    ${"2023-08-31[u-ca=persian]"}       | ${{ months: 1 }} | ${"constrain"} | ${"2023-10-01[u-ca=persian]"}       | ${"grid persian i=91"}
    ${"2023-08-31[u-ca=persian]"}       | ${{ months: 1 }} | ${"reject"}    | ${"2023-10-01[u-ca=persian]"}       | ${"grid persian i=91"}
    ${"2023-08-31[u-ca=persian]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-30[u-ca=persian]"}       | ${"grid persian i=91"}
    ${"2023-10-01[u-ca=persian]"}       | ${{ months: 1 }} | ${"constrain"} | ${"2023-10-31[u-ca=persian]"}       | ${"grid persian i=122"}
    ${"2023-10-01[u-ca=persian]"}       | ${{ months: 1 }} | ${"reject"}    | ${"2023-10-31[u-ca=persian]"}       | ${"grid persian i=122"}
    ${"2023-10-01[u-ca=persian]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"2024-09-30[u-ca=persian]"}       | ${"grid persian i=122"}
    ${"2024-02-01[u-ca=persian]"}       | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-02[u-ca=persian]"}       | ${"grid persian i=245"}
    ${"2024-02-01[u-ca=persian]"}       | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-02[u-ca=persian]"}       | ${"grid persian i=245"}
    ${"2024-02-01[u-ca=persian]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"2025-01-31[u-ca=persian]"}       | ${"grid persian i=245"}
    ${"2024-03-01[u-ca=persian]"}       | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-30[u-ca=persian]"}       | ${"grid persian i=274"}
    ${"2024-03-01[u-ca=persian]"}       | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-30[u-ca=persian]"}       | ${"grid persian i=274"}
    ${"2024-03-01[u-ca=persian]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"2025-03-01[u-ca=persian]"}       | ${"grid persian i=274"}
    ${"2023-08-01[u-ca=indian]"}        | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-01[u-ca=indian]"}        | ${"grid indian i=61"}
    ${"2023-08-01[u-ca=indian]"}        | ${{ months: 1 }} | ${"reject"}    | ${"2023-09-01[u-ca=indian]"}        | ${"grid indian i=61"}
    ${"2023-08-01[u-ca=indian]"}        | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-01[u-ca=indian]"}        | ${"grid indian i=61"}
    ${"2023-08-31[u-ca=indian]"}        | ${{ months: 1 }} | ${"constrain"} | ${"2023-10-01[u-ca=indian]"}        | ${"grid indian i=91"}
    ${"2023-08-31[u-ca=indian]"}        | ${{ months: 1 }} | ${"reject"}    | ${"2023-10-01[u-ca=indian]"}        | ${"grid indian i=91"}
    ${"2023-08-31[u-ca=indian]"}        | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-31[u-ca=indian]"}        | ${"grid indian i=91"}
    ${"2023-10-01[u-ca=indian]"}        | ${{ months: 1 }} | ${"constrain"} | ${"2023-10-31[u-ca=indian]"}        | ${"grid indian i=122"}
    ${"2023-10-01[u-ca=indian]"}        | ${{ months: 1 }} | ${"reject"}    | ${"2023-10-31[u-ca=indian]"}        | ${"grid indian i=122"}
    ${"2023-10-01[u-ca=indian]"}        | ${{ years: 1 }}  | ${"constrain"} | ${"2024-10-01[u-ca=indian]"}        | ${"grid indian i=122"}
    ${"2024-02-01[u-ca=indian]"}        | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-02[u-ca=indian]"}        | ${"grid indian i=245"}
    ${"2024-02-01[u-ca=indian]"}        | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-02[u-ca=indian]"}        | ${"grid indian i=245"}
    ${"2024-02-01[u-ca=indian]"}        | ${{ years: 1 }}  | ${"constrain"} | ${"2025-02-01[u-ca=indian]"}        | ${"grid indian i=245"}
    ${"2024-03-01[u-ca=indian]"}        | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-31[u-ca=indian]"}        | ${"grid indian i=274"}
    ${"2024-03-01[u-ca=indian]"}        | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-31[u-ca=indian]"}        | ${"grid indian i=274"}
    ${"2024-03-01[u-ca=indian]"}        | ${{ years: 1 }}  | ${"constrain"} | ${"2025-03-02[u-ca=indian]"}        | ${"grid indian i=274"}
    ${"2023-08-01[u-ca=ethioaa]"}       | ${{ months: 1 }} | ${"constrain"} | ${"2023-08-31[u-ca=ethioaa]"}       | ${"grid ethioaa i=61"}
    ${"2023-08-01[u-ca=ethioaa]"}       | ${{ months: 1 }} | ${"reject"}    | ${"2023-08-31[u-ca=ethioaa]"}       | ${"grid ethioaa i=61"}
    ${"2023-08-01[u-ca=ethioaa]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-01[u-ca=ethioaa]"}       | ${"grid ethioaa i=61"}
    ${"2023-08-31[u-ca=ethioaa]"}       | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-11[u-ca=ethioaa]"}       | ${"grid ethioaa i=91"}
    ${"2023-08-31[u-ca=ethioaa]"}       | ${{ months: 1 }} | ${"reject"}    | ${""}                               | ${"grid ethioaa i=91"}
    ${"2023-08-31[u-ca=ethioaa]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-31[u-ca=ethioaa]"}       | ${"grid ethioaa i=91"}
    ${"2023-10-01[u-ca=ethioaa]"}       | ${{ months: 1 }} | ${"constrain"} | ${"2023-10-31[u-ca=ethioaa]"}       | ${"grid ethioaa i=122"}
    ${"2023-10-01[u-ca=ethioaa]"}       | ${{ months: 1 }} | ${"reject"}    | ${"2023-10-31[u-ca=ethioaa]"}       | ${"grid ethioaa i=122"}
    ${"2023-10-01[u-ca=ethioaa]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"2024-09-30[u-ca=ethioaa]"}       | ${"grid ethioaa i=122"}
    ${"2024-02-01[u-ca=ethioaa]"}       | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-02[u-ca=ethioaa]"}       | ${"grid ethioaa i=245"}
    ${"2024-02-01[u-ca=ethioaa]"}       | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-02[u-ca=ethioaa]"}       | ${"grid ethioaa i=245"}
    ${"2024-02-01[u-ca=ethioaa]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"2025-01-31[u-ca=ethioaa]"}       | ${"grid ethioaa i=245"}
    ${"2024-03-01[u-ca=ethioaa]"}       | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-31[u-ca=ethioaa]"}       | ${"grid ethioaa i=274"}
    ${"2024-03-01[u-ca=ethioaa]"}       | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-31[u-ca=ethioaa]"}       | ${"grid ethioaa i=274"}
    ${"2024-03-01[u-ca=ethioaa]"}       | ${{ years: 1 }}  | ${"constrain"} | ${"2025-03-01[u-ca=ethioaa]"}       | ${"grid ethioaa i=274"}
    ${"2023-08-01[u-ca=japanese]"}      | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-01[u-ca=japanese]"}      | ${"grid japanese i=61"}
    ${"2023-08-01[u-ca=japanese]"}      | ${{ months: 1 }} | ${"reject"}    | ${"2023-09-01[u-ca=japanese]"}      | ${"grid japanese i=61"}
    ${"2023-08-01[u-ca=japanese]"}      | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-01[u-ca=japanese]"}      | ${"grid japanese i=61"}
    ${"2023-08-31[u-ca=japanese]"}      | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-30[u-ca=japanese]"}      | ${"grid japanese i=91"}
    ${"2023-08-31[u-ca=japanese]"}      | ${{ months: 1 }} | ${"reject"}    | ${""}                               | ${"grid japanese i=91"}
    ${"2023-08-31[u-ca=japanese]"}      | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-31[u-ca=japanese]"}      | ${"grid japanese i=91"}
    ${"2023-10-01[u-ca=japanese]"}      | ${{ months: 1 }} | ${"constrain"} | ${"2023-11-01[u-ca=japanese]"}      | ${"grid japanese i=122"}
    ${"2023-10-01[u-ca=japanese]"}      | ${{ months: 1 }} | ${"reject"}    | ${"2023-11-01[u-ca=japanese]"}      | ${"grid japanese i=122"}
    ${"2023-10-01[u-ca=japanese]"}      | ${{ years: 1 }}  | ${"constrain"} | ${"2024-10-01[u-ca=japanese]"}      | ${"grid japanese i=122"}
    ${"2024-02-01[u-ca=japanese]"}      | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-01[u-ca=japanese]"}      | ${"grid japanese i=245"}
    ${"2024-02-01[u-ca=japanese]"}      | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-01[u-ca=japanese]"}      | ${"grid japanese i=245"}
    ${"2024-02-01[u-ca=japanese]"}      | ${{ years: 1 }}  | ${"constrain"} | ${"2025-02-01[u-ca=japanese]"}      | ${"grid japanese i=245"}
    ${"2024-03-01[u-ca=japanese]"}      | ${{ months: 1 }} | ${"constrain"} | ${"2024-04-01[u-ca=japanese]"}      | ${"grid japanese i=274"}
    ${"2024-03-01[u-ca=japanese]"}      | ${{ months: 1 }} | ${"reject"}    | ${"2024-04-01[u-ca=japanese]"}      | ${"grid japanese i=274"}
    ${"2024-03-01[u-ca=japanese]"}      | ${{ years: 1 }}  | ${"constrain"} | ${"2025-03-01[u-ca=japanese]"}      | ${"grid japanese i=274"}
    ${"2023-08-01[u-ca=roc]"}           | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-01[u-ca=roc]"}           | ${"grid roc i=61"}
    ${"2023-08-01[u-ca=roc]"}           | ${{ months: 1 }} | ${"reject"}    | ${"2023-09-01[u-ca=roc]"}           | ${"grid roc i=61"}
    ${"2023-08-01[u-ca=roc]"}           | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-01[u-ca=roc]"}           | ${"grid roc i=61"}
    ${"2023-08-31[u-ca=roc]"}           | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-30[u-ca=roc]"}           | ${"grid roc i=91"}
    ${"2023-08-31[u-ca=roc]"}           | ${{ months: 1 }} | ${"reject"}    | ${""}                               | ${"grid roc i=91"}
    ${"2023-08-31[u-ca=roc]"}           | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-31[u-ca=roc]"}           | ${"grid roc i=91"}
    ${"2023-10-01[u-ca=roc]"}           | ${{ months: 1 }} | ${"constrain"} | ${"2023-11-01[u-ca=roc]"}           | ${"grid roc i=122"}
    ${"2023-10-01[u-ca=roc]"}           | ${{ months: 1 }} | ${"reject"}    | ${"2023-11-01[u-ca=roc]"}           | ${"grid roc i=122"}
    ${"2023-10-01[u-ca=roc]"}           | ${{ years: 1 }}  | ${"constrain"} | ${"2024-10-01[u-ca=roc]"}           | ${"grid roc i=122"}
    ${"2024-02-01[u-ca=roc]"}           | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-01[u-ca=roc]"}           | ${"grid roc i=245"}
    ${"2024-02-01[u-ca=roc]"}           | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-01[u-ca=roc]"}           | ${"grid roc i=245"}
    ${"2024-02-01[u-ca=roc]"}           | ${{ years: 1 }}  | ${"constrain"} | ${"2025-02-01[u-ca=roc]"}           | ${"grid roc i=245"}
    ${"2024-03-01[u-ca=roc]"}           | ${{ months: 1 }} | ${"constrain"} | ${"2024-04-01[u-ca=roc]"}           | ${"grid roc i=274"}
    ${"2024-03-01[u-ca=roc]"}           | ${{ months: 1 }} | ${"reject"}    | ${"2024-04-01[u-ca=roc]"}           | ${"grid roc i=274"}
    ${"2024-03-01[u-ca=roc]"}           | ${{ years: 1 }}  | ${"constrain"} | ${"2025-03-01[u-ca=roc]"}           | ${"grid roc i=274"}
    ${"2023-08-01"}                     | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-01"}                     | ${"grid gregory i=61"}
    ${"2023-08-01"}                     | ${{ months: 1 }} | ${"reject"}    | ${"2023-09-01"}                     | ${"grid gregory i=61"}
    ${"2023-08-01"}                     | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-01"}                     | ${"grid gregory i=61"}
    ${"2023-08-31"}                     | ${{ months: 1 }} | ${"constrain"} | ${"2023-09-30"}                     | ${"grid gregory i=91"}
    ${"2023-08-31"}                     | ${{ months: 1 }} | ${"reject"}    | ${""}                               | ${"grid gregory i=91"}
    ${"2023-08-31"}                     | ${{ years: 1 }}  | ${"constrain"} | ${"2024-08-31"}                     | ${"grid gregory i=91"}
    ${"2023-10-01"}                     | ${{ months: 1 }} | ${"constrain"} | ${"2023-11-01"}                     | ${"grid gregory i=122"}
    ${"2023-10-01"}                     | ${{ months: 1 }} | ${"reject"}    | ${"2023-11-01"}                     | ${"grid gregory i=122"}
    ${"2023-10-01"}                     | ${{ years: 1 }}  | ${"constrain"} | ${"2024-10-01"}                     | ${"grid gregory i=122"}
    ${"2024-02-01"}                     | ${{ months: 1 }} | ${"constrain"} | ${"2024-03-01"}                     | ${"grid gregory i=245"}
    ${"2024-02-01"}                     | ${{ months: 1 }} | ${"reject"}    | ${"2024-03-01"}                     | ${"grid gregory i=245"}
    ${"2024-02-01"}                     | ${{ years: 1 }}  | ${"constrain"} | ${"2025-02-01"}                     | ${"grid gregory i=245"}
    ${"2024-03-01"}                     | ${{ months: 1 }} | ${"constrain"} | ${"2024-04-01"}                     | ${"grid gregory i=274"}
    ${"2024-03-01"}                     | ${{ months: 1 }} | ${"reject"}    | ${"2024-04-01"}                     | ${"grid gregory i=274"}
    ${"2024-03-01"}                     | ${{ years: 1 }}  | ${"constrain"} | ${"2025-03-01"}                     | ${"grid gregory i=274"}
  `(
    "adds $units to $value with overflow $overflow as $expected ($source)",
    ({ value, units, overflow, expected }) => {
      expect(addDate(value, units, { overflow })).toBe(expected);
    },
  );
});
