import { convertDateToCalendar } from "./convertDateToCalendar";

// The CORE-6 edge-window and stride dates, in every calendar. Expected values: native Temporal
// (Chromium 153.0.8010.12), `Temporal.PlainDate.from(iso).withCalendar(calendar).toString()`, which is
// the ISO date plus `[u-ca=<id>]` (RFC 9557). The source column names the CORE-6 scan row the date
// came from; the calendar fields those rows recorded are asserted by internal/temporalCompat.

// CORE-6 §4.4 edge-window matrix: every calendar (Ethiopic family via ethioaa) at
// n days inside each limit, n in {0, 1, 30, 200, 420} plus the last failing day of each §1.3 window
// and the first day after it.
describe("convertDateToCalendar next to the range limits (CORE-6 §4.4)", () => {
  it.each`
    value              | calendar              | expected                                  | source
    ${"+275760-09-13"} | ${"buddhist"}         | ${"+275760-09-13[u-ca=buddhist]"}         | ${"xscan buddhist max[0]"}
    ${"+275760-09-12"} | ${"buddhist"}         | ${"+275760-09-12[u-ca=buddhist]"}         | ${"xscan buddhist max[1]"}
    ${"+275760-08-14"} | ${"buddhist"}         | ${"+275760-08-14[u-ca=buddhist]"}         | ${"xscan buddhist max[30]"}
    ${"+275760-02-26"} | ${"buddhist"}         | ${"+275760-02-26[u-ca=buddhist]"}         | ${"xscan buddhist max[200]"}
    ${"+275759-08-13"} | ${"buddhist"}         | ${"+275759-08-13[u-ca=buddhist]"}         | ${"xscan buddhist max[397]"}
    ${"+275759-08-12"} | ${"buddhist"}         | ${"+275759-08-12[u-ca=buddhist]"}         | ${"xscan buddhist max[398]"}
    ${"+275759-07-21"} | ${"buddhist"}         | ${"+275759-07-21[u-ca=buddhist]"}         | ${"xscan buddhist max[420]"}
    ${"-271821-04-21"} | ${"buddhist"}         | ${"-271821-04-21[u-ca=buddhist]"}         | ${"xscan buddhist min[2]"}
    ${"-271821-05-19"} | ${"buddhist"}         | ${"-271821-05-19[u-ca=buddhist]"}         | ${"xscan buddhist min[30]"}
    ${"-271821-11-05"} | ${"buddhist"}         | ${"-271821-11-05[u-ca=buddhist]"}         | ${"xscan buddhist min[200]"}
    ${"-271820-06-12"} | ${"buddhist"}         | ${"-271820-06-12[u-ca=buddhist]"}         | ${"xscan buddhist min[420]"}
    ${"+275760-09-13"} | ${"hebrew"}           | ${"+275760-09-13[u-ca=hebrew]"}           | ${"xscan hebrew max[0]"}
    ${"+275760-09-12"} | ${"hebrew"}           | ${"+275760-09-12[u-ca=hebrew]"}           | ${"xscan hebrew max[1]"}
    ${"+275760-08-14"} | ${"hebrew"}           | ${"+275760-08-14[u-ca=hebrew]"}           | ${"xscan hebrew max[30]"}
    ${"+275760-02-26"} | ${"hebrew"}           | ${"+275760-02-26[u-ca=hebrew]"}           | ${"xscan hebrew max[200]"}
    ${"+275759-08-22"} | ${"hebrew"}           | ${"+275759-08-22[u-ca=hebrew]"}           | ${"xscan hebrew max[388]"}
    ${"+275759-08-21"} | ${"hebrew"}           | ${"+275759-08-21[u-ca=hebrew]"}           | ${"xscan hebrew max[389]"}
    ${"+275759-07-21"} | ${"hebrew"}           | ${"+275759-07-21[u-ca=hebrew]"}           | ${"xscan hebrew max[420]"}
    ${"-271821-05-19"} | ${"hebrew"}           | ${"-271821-05-19[u-ca=hebrew]"}           | ${"xscan hebrew min[30]"}
    ${"-271820-05-31"} | ${"hebrew"}           | ${"-271820-05-31[u-ca=hebrew]"}           | ${"xscan hebrew min[408]"}
    ${"-271820-06-01"} | ${"hebrew"}           | ${"-271820-06-01[u-ca=hebrew]"}           | ${"xscan hebrew min[409]"}
    ${"-271820-06-12"} | ${"hebrew"}           | ${"-271820-06-12[u-ca=hebrew]"}           | ${"xscan hebrew min[420]"}
    ${"+275760-09-13"} | ${"islamic-civil"}    | ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"xscan islamic-civil max[0]"}
    ${"+275760-09-12"} | ${"islamic-civil"}    | ${"+275760-09-12[u-ca=islamic-civil]"}    | ${"xscan islamic-civil max[1]"}
    ${"+275760-08-14"} | ${"islamic-civil"}    | ${"+275760-08-14[u-ca=islamic-civil]"}    | ${"xscan islamic-civil max[30]"}
    ${"+275760-02-26"} | ${"islamic-civil"}    | ${"+275760-02-26[u-ca=islamic-civil]"}    | ${"xscan islamic-civil max[200]"}
    ${"+275759-09-17"} | ${"islamic-civil"}    | ${"+275759-09-17[u-ca=islamic-civil]"}    | ${"xscan islamic-civil max[362]"}
    ${"+275759-09-16"} | ${"islamic-civil"}    | ${"+275759-09-16[u-ca=islamic-civil]"}    | ${"xscan islamic-civil max[363]"}
    ${"+275759-07-21"} | ${"islamic-civil"}    | ${"+275759-07-21[u-ca=islamic-civil]"}    | ${"xscan islamic-civil max[420]"}
    ${"-271821-04-19"} | ${"islamic-civil"}    | ${"-271821-04-19[u-ca=islamic-civil]"}    | ${"xscan islamic-civil min[0]"}
    ${"-271821-04-20"} | ${"islamic-civil"}    | ${"-271821-04-20[u-ca=islamic-civil]"}    | ${"xscan islamic-civil min[1]"}
    ${"-271821-05-19"} | ${"islamic-civil"}    | ${"-271821-05-19[u-ca=islamic-civil]"}    | ${"xscan islamic-civil min[30]"}
    ${"-271821-11-05"} | ${"islamic-civil"}    | ${"-271821-11-05[u-ca=islamic-civil]"}    | ${"xscan islamic-civil min[200]"}
    ${"-271820-06-12"} | ${"islamic-civil"}    | ${"-271820-06-12[u-ca=islamic-civil]"}    | ${"xscan islamic-civil min[420]"}
    ${"+275760-09-13"} | ${"islamic-tbla"}     | ${"+275760-09-13[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla max[0]"}
    ${"+275760-09-12"} | ${"islamic-tbla"}     | ${"+275760-09-12[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla max[1]"}
    ${"+275760-09-04"} | ${"islamic-tbla"}     | ${"+275760-09-04[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla max[9]"}
    ${"+275760-08-14"} | ${"islamic-tbla"}     | ${"+275760-08-14[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla max[30]"}
    ${"+275760-02-26"} | ${"islamic-tbla"}     | ${"+275760-02-26[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla max[200]"}
    ${"+275759-07-21"} | ${"islamic-tbla"}     | ${"+275759-07-21[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla max[420]"}
    ${"-271821-04-19"} | ${"islamic-tbla"}     | ${"-271821-04-19[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla min[0]"}
    ${"-271821-04-20"} | ${"islamic-tbla"}     | ${"-271821-04-20[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla min[1]"}
    ${"-271821-05-19"} | ${"islamic-tbla"}     | ${"-271821-05-19[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla min[30]"}
    ${"-271821-11-05"} | ${"islamic-tbla"}     | ${"-271821-11-05[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla min[200]"}
    ${"-271820-01-19"} | ${"islamic-tbla"}     | ${"-271820-01-19[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla min[275]"}
    ${"-271820-06-12"} | ${"islamic-tbla"}     | ${"-271820-06-12[u-ca=islamic-tbla]"}     | ${"xscan islamic-tbla min[420]"}
    ${"+275760-09-13"} | ${"islamic-umalqura"} | ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura max[0]"}
    ${"+275760-09-12"} | ${"islamic-umalqura"} | ${"+275760-09-12[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura max[1]"}
    ${"+275760-09-04"} | ${"islamic-umalqura"} | ${"+275760-09-04[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura max[9]"}
    ${"+275760-08-14"} | ${"islamic-umalqura"} | ${"+275760-08-14[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura max[30]"}
    ${"+275760-02-26"} | ${"islamic-umalqura"} | ${"+275760-02-26[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura max[200]"}
    ${"+275759-09-17"} | ${"islamic-umalqura"} | ${"+275759-09-17[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura max[362]"}
    ${"+275759-09-16"} | ${"islamic-umalqura"} | ${"+275759-09-16[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura max[363]"}
    ${"+275759-07-21"} | ${"islamic-umalqura"} | ${"+275759-07-21[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura max[420]"}
    ${"-271821-04-19"} | ${"islamic-umalqura"} | ${"-271821-04-19[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura min[0]"}
    ${"-271821-04-20"} | ${"islamic-umalqura"} | ${"-271821-04-20[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura min[1]"}
    ${"-271821-05-19"} | ${"islamic-umalqura"} | ${"-271821-05-19[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura min[30]"}
    ${"-271821-11-05"} | ${"islamic-umalqura"} | ${"-271821-11-05[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura min[200]"}
    ${"-271820-01-19"} | ${"islamic-umalqura"} | ${"-271820-01-19[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura min[275]"}
    ${"-271820-01-20"} | ${"islamic-umalqura"} | ${"-271820-01-20[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura min[276]"}
    ${"-271820-06-12"} | ${"islamic-umalqura"} | ${"-271820-06-12[u-ca=islamic-umalqura]"} | ${"xscan islamic-umalqura min[420]"}
    ${"+275760-09-13"} | ${"persian"}          | ${"+275760-09-13[u-ca=persian]"}          | ${"xscan persian max[0]"}
    ${"+275760-09-12"} | ${"persian"}          | ${"+275760-09-12[u-ca=persian]"}          | ${"xscan persian max[1]"}
    ${"+275760-08-14"} | ${"persian"}          | ${"+275760-08-14[u-ca=persian]"}          | ${"xscan persian max[30]"}
    ${"+275760-02-26"} | ${"persian"}          | ${"+275760-02-26[u-ca=persian]"}          | ${"xscan persian max[200]"}
    ${"+275759-07-21"} | ${"persian"}          | ${"+275759-07-21[u-ca=persian]"}          | ${"xscan persian max[420]"}
    ${"-271821-04-19"} | ${"persian"}          | ${"-271821-04-19[u-ca=persian]"}          | ${"xscan persian min[0]"}
    ${"-271821-04-20"} | ${"persian"}          | ${"-271821-04-20[u-ca=persian]"}          | ${"xscan persian min[1]"}
    ${"-271821-05-19"} | ${"persian"}          | ${"-271821-05-19[u-ca=persian]"}          | ${"xscan persian min[30]"}
    ${"-271821-11-05"} | ${"persian"}          | ${"-271821-11-05[u-ca=persian]"}          | ${"xscan persian min[200]"}
    ${"-271820-06-12"} | ${"persian"}          | ${"-271820-06-12[u-ca=persian]"}          | ${"xscan persian min[420]"}
    ${"+275760-09-13"} | ${"indian"}           | ${"+275760-09-13[u-ca=indian]"}           | ${"xscan indian max[0]"}
    ${"+275760-09-12"} | ${"indian"}           | ${"+275760-09-12[u-ca=indian]"}           | ${"xscan indian max[1]"}
    ${"+275760-08-14"} | ${"indian"}           | ${"+275760-08-14[u-ca=indian]"}           | ${"xscan indian max[30]"}
    ${"+275760-02-26"} | ${"indian"}           | ${"+275760-02-26[u-ca=indian]"}           | ${"xscan indian max[200]"}
    ${"+275759-07-21"} | ${"indian"}           | ${"+275759-07-21[u-ca=indian]"}           | ${"xscan indian max[420]"}
    ${"-271821-04-20"} | ${"indian"}           | ${"-271821-04-20[u-ca=indian]"}           | ${"xscan indian min[1]"}
    ${"-271821-05-19"} | ${"indian"}           | ${"-271821-05-19[u-ca=indian]"}           | ${"xscan indian min[30]"}
    ${"-271821-11-05"} | ${"indian"}           | ${"-271821-11-05[u-ca=indian]"}           | ${"xscan indian min[200]"}
    ${"-271820-06-12"} | ${"indian"}           | ${"-271820-06-12[u-ca=indian]"}           | ${"xscan indian min[420]"}
    ${"+275760-09-13"} | ${"ethioaa"}          | ${"+275760-09-13[u-ca=ethioaa]"}          | ${"xscan ethioaa max[0]"}
    ${"+275760-09-12"} | ${"ethioaa"}          | ${"+275760-09-12[u-ca=ethioaa]"}          | ${"xscan ethioaa max[1]"}
    ${"+275760-08-14"} | ${"ethioaa"}          | ${"+275760-08-14[u-ca=ethioaa]"}          | ${"xscan ethioaa max[30]"}
    ${"+275760-02-26"} | ${"ethioaa"}          | ${"+275760-02-26[u-ca=ethioaa]"}          | ${"xscan ethioaa max[200]"}
    ${"+275759-07-21"} | ${"ethioaa"}          | ${"+275759-07-21[u-ca=ethioaa]"}          | ${"xscan ethioaa max[420]"}
    ${"-271821-04-19"} | ${"ethioaa"}          | ${"-271821-04-19[u-ca=ethioaa]"}          | ${"xscan ethioaa min[0]"}
    ${"-271821-04-20"} | ${"ethioaa"}          | ${"-271821-04-20[u-ca=ethioaa]"}          | ${"xscan ethioaa min[1]"}
    ${"-271821-05-19"} | ${"ethioaa"}          | ${"-271821-05-19[u-ca=ethioaa]"}          | ${"xscan ethioaa min[30]"}
    ${"-271821-11-05"} | ${"ethioaa"}          | ${"-271821-11-05[u-ca=ethioaa]"}          | ${"xscan ethioaa min[200]"}
    ${"-271820-06-12"} | ${"ethioaa"}          | ${"-271820-06-12[u-ca=ethioaa]"}          | ${"xscan ethioaa min[420]"}
    ${"+275760-09-13"} | ${"japanese"}         | ${"+275760-09-13[u-ca=japanese]"}         | ${"xscan japanese max[0]"}
    ${"+275760-09-12"} | ${"japanese"}         | ${"+275760-09-12[u-ca=japanese]"}         | ${"xscan japanese max[1]"}
    ${"+275760-08-14"} | ${"japanese"}         | ${"+275760-08-14[u-ca=japanese]"}         | ${"xscan japanese max[30]"}
    ${"+275760-02-26"} | ${"japanese"}         | ${"+275760-02-26[u-ca=japanese]"}         | ${"xscan japanese max[200]"}
    ${"+275759-07-21"} | ${"japanese"}         | ${"+275759-07-21[u-ca=japanese]"}         | ${"xscan japanese max[420]"}
    ${"-271821-04-20"} | ${"japanese"}         | ${"-271821-04-20[u-ca=japanese]"}         | ${"xscan japanese min[1]"}
    ${"-271821-05-19"} | ${"japanese"}         | ${"-271821-05-19[u-ca=japanese]"}         | ${"xscan japanese min[30]"}
    ${"-271821-11-05"} | ${"japanese"}         | ${"-271821-11-05[u-ca=japanese]"}         | ${"xscan japanese min[200]"}
    ${"-271820-06-12"} | ${"japanese"}         | ${"-271820-06-12[u-ca=japanese]"}         | ${"xscan japanese min[420]"}
    ${"+275760-09-13"} | ${"roc"}              | ${"+275760-09-13[u-ca=roc]"}              | ${"xscan roc max[0]"}
    ${"+275760-09-12"} | ${"roc"}              | ${"+275760-09-12[u-ca=roc]"}              | ${"xscan roc max[1]"}
    ${"+275760-08-14"} | ${"roc"}              | ${"+275760-08-14[u-ca=roc]"}              | ${"xscan roc max[30]"}
    ${"+275760-02-26"} | ${"roc"}              | ${"+275760-02-26[u-ca=roc]"}              | ${"xscan roc max[200]"}
    ${"+275759-07-21"} | ${"roc"}              | ${"+275759-07-21[u-ca=roc]"}              | ${"xscan roc max[420]"}
    ${"-271821-04-19"} | ${"roc"}              | ${"-271821-04-19[u-ca=roc]"}              | ${"xscan roc min[0]"}
    ${"-271821-04-20"} | ${"roc"}              | ${"-271821-04-20[u-ca=roc]"}              | ${"xscan roc min[1]"}
    ${"-271821-05-19"} | ${"roc"}              | ${"-271821-05-19[u-ca=roc]"}              | ${"xscan roc min[30]"}
    ${"-271821-11-05"} | ${"roc"}              | ${"-271821-11-05[u-ca=roc]"}              | ${"xscan roc min[200]"}
    ${"-271820-06-12"} | ${"roc"}              | ${"-271820-06-12[u-ca=roc]"}              | ${"xscan roc min[420]"}
  `(
    "converts $value to $calendar as $expected ($source)",
    ({ value, calendar, expected }) => {
      expect(convertDateToCalendar(value, calendar)).toBe(expected);
    },
  );

  it.each`
    value                                     | expected           | source
    ${"+275760-09-13[u-ca=buddhist]"}         | ${"+275760-09-13"} | ${"xscan buddhist max[0]"}
    ${"+275760-09-12[u-ca=buddhist]"}         | ${"+275760-09-12"} | ${"xscan buddhist max[1]"}
    ${"+275760-08-14[u-ca=buddhist]"}         | ${"+275760-08-14"} | ${"xscan buddhist max[30]"}
    ${"+275760-02-26[u-ca=buddhist]"}         | ${"+275760-02-26"} | ${"xscan buddhist max[200]"}
    ${"+275759-08-13[u-ca=buddhist]"}         | ${"+275759-08-13"} | ${"xscan buddhist max[397]"}
    ${"+275759-08-12[u-ca=buddhist]"}         | ${"+275759-08-12"} | ${"xscan buddhist max[398]"}
    ${"+275759-07-21[u-ca=buddhist]"}         | ${"+275759-07-21"} | ${"xscan buddhist max[420]"}
    ${"-271821-04-21[u-ca=buddhist]"}         | ${"-271821-04-21"} | ${"xscan buddhist min[2]"}
    ${"-271821-05-19[u-ca=buddhist]"}         | ${"-271821-05-19"} | ${"xscan buddhist min[30]"}
    ${"-271821-11-05[u-ca=buddhist]"}         | ${"-271821-11-05"} | ${"xscan buddhist min[200]"}
    ${"-271820-06-12[u-ca=buddhist]"}         | ${"-271820-06-12"} | ${"xscan buddhist min[420]"}
    ${"+275760-09-13[u-ca=hebrew]"}           | ${"+275760-09-13"} | ${"xscan hebrew max[0]"}
    ${"+275760-09-12[u-ca=hebrew]"}           | ${"+275760-09-12"} | ${"xscan hebrew max[1]"}
    ${"+275760-08-14[u-ca=hebrew]"}           | ${"+275760-08-14"} | ${"xscan hebrew max[30]"}
    ${"+275760-02-26[u-ca=hebrew]"}           | ${"+275760-02-26"} | ${"xscan hebrew max[200]"}
    ${"+275759-08-22[u-ca=hebrew]"}           | ${"+275759-08-22"} | ${"xscan hebrew max[388]"}
    ${"+275759-08-21[u-ca=hebrew]"}           | ${"+275759-08-21"} | ${"xscan hebrew max[389]"}
    ${"+275759-07-21[u-ca=hebrew]"}           | ${"+275759-07-21"} | ${"xscan hebrew max[420]"}
    ${"-271821-05-19[u-ca=hebrew]"}           | ${"-271821-05-19"} | ${"xscan hebrew min[30]"}
    ${"-271820-05-31[u-ca=hebrew]"}           | ${"-271820-05-31"} | ${"xscan hebrew min[408]"}
    ${"-271820-06-01[u-ca=hebrew]"}           | ${"-271820-06-01"} | ${"xscan hebrew min[409]"}
    ${"-271820-06-12[u-ca=hebrew]"}           | ${"-271820-06-12"} | ${"xscan hebrew min[420]"}
    ${"+275760-09-13[u-ca=islamic-civil]"}    | ${"+275760-09-13"} | ${"xscan islamic-civil max[0]"}
    ${"+275760-09-12[u-ca=islamic-civil]"}    | ${"+275760-09-12"} | ${"xscan islamic-civil max[1]"}
    ${"+275760-08-14[u-ca=islamic-civil]"}    | ${"+275760-08-14"} | ${"xscan islamic-civil max[30]"}
    ${"+275760-02-26[u-ca=islamic-civil]"}    | ${"+275760-02-26"} | ${"xscan islamic-civil max[200]"}
    ${"+275759-09-17[u-ca=islamic-civil]"}    | ${"+275759-09-17"} | ${"xscan islamic-civil max[362]"}
    ${"+275759-09-16[u-ca=islamic-civil]"}    | ${"+275759-09-16"} | ${"xscan islamic-civil max[363]"}
    ${"+275759-07-21[u-ca=islamic-civil]"}    | ${"+275759-07-21"} | ${"xscan islamic-civil max[420]"}
    ${"-271821-04-19[u-ca=islamic-civil]"}    | ${"-271821-04-19"} | ${"xscan islamic-civil min[0]"}
    ${"-271821-04-20[u-ca=islamic-civil]"}    | ${"-271821-04-20"} | ${"xscan islamic-civil min[1]"}
    ${"-271821-05-19[u-ca=islamic-civil]"}    | ${"-271821-05-19"} | ${"xscan islamic-civil min[30]"}
    ${"-271821-11-05[u-ca=islamic-civil]"}    | ${"-271821-11-05"} | ${"xscan islamic-civil min[200]"}
    ${"-271820-06-12[u-ca=islamic-civil]"}    | ${"-271820-06-12"} | ${"xscan islamic-civil min[420]"}
    ${"+275760-09-13[u-ca=islamic-tbla]"}     | ${"+275760-09-13"} | ${"xscan islamic-tbla max[0]"}
    ${"+275760-09-12[u-ca=islamic-tbla]"}     | ${"+275760-09-12"} | ${"xscan islamic-tbla max[1]"}
    ${"+275760-09-04[u-ca=islamic-tbla]"}     | ${"+275760-09-04"} | ${"xscan islamic-tbla max[9]"}
    ${"+275760-08-14[u-ca=islamic-tbla]"}     | ${"+275760-08-14"} | ${"xscan islamic-tbla max[30]"}
    ${"+275760-02-26[u-ca=islamic-tbla]"}     | ${"+275760-02-26"} | ${"xscan islamic-tbla max[200]"}
    ${"+275759-07-21[u-ca=islamic-tbla]"}     | ${"+275759-07-21"} | ${"xscan islamic-tbla max[420]"}
    ${"-271821-04-19[u-ca=islamic-tbla]"}     | ${"-271821-04-19"} | ${"xscan islamic-tbla min[0]"}
    ${"-271821-04-20[u-ca=islamic-tbla]"}     | ${"-271821-04-20"} | ${"xscan islamic-tbla min[1]"}
    ${"-271821-05-19[u-ca=islamic-tbla]"}     | ${"-271821-05-19"} | ${"xscan islamic-tbla min[30]"}
    ${"-271821-11-05[u-ca=islamic-tbla]"}     | ${"-271821-11-05"} | ${"xscan islamic-tbla min[200]"}
    ${"-271820-01-19[u-ca=islamic-tbla]"}     | ${"-271820-01-19"} | ${"xscan islamic-tbla min[275]"}
    ${"-271820-06-12[u-ca=islamic-tbla]"}     | ${"-271820-06-12"} | ${"xscan islamic-tbla min[420]"}
    ${"+275760-09-13[u-ca=islamic-umalqura]"} | ${"+275760-09-13"} | ${"xscan islamic-umalqura max[0]"}
    ${"+275760-09-12[u-ca=islamic-umalqura]"} | ${"+275760-09-12"} | ${"xscan islamic-umalqura max[1]"}
    ${"+275760-09-04[u-ca=islamic-umalqura]"} | ${"+275760-09-04"} | ${"xscan islamic-umalqura max[9]"}
    ${"+275760-08-14[u-ca=islamic-umalqura]"} | ${"+275760-08-14"} | ${"xscan islamic-umalqura max[30]"}
    ${"+275760-02-26[u-ca=islamic-umalqura]"} | ${"+275760-02-26"} | ${"xscan islamic-umalqura max[200]"}
    ${"+275759-09-17[u-ca=islamic-umalqura]"} | ${"+275759-09-17"} | ${"xscan islamic-umalqura max[362]"}
    ${"+275759-09-16[u-ca=islamic-umalqura]"} | ${"+275759-09-16"} | ${"xscan islamic-umalqura max[363]"}
    ${"+275759-07-21[u-ca=islamic-umalqura]"} | ${"+275759-07-21"} | ${"xscan islamic-umalqura max[420]"}
    ${"-271821-04-19[u-ca=islamic-umalqura]"} | ${"-271821-04-19"} | ${"xscan islamic-umalqura min[0]"}
    ${"-271821-04-20[u-ca=islamic-umalqura]"} | ${"-271821-04-20"} | ${"xscan islamic-umalqura min[1]"}
    ${"-271821-05-19[u-ca=islamic-umalqura]"} | ${"-271821-05-19"} | ${"xscan islamic-umalqura min[30]"}
    ${"-271821-11-05[u-ca=islamic-umalqura]"} | ${"-271821-11-05"} | ${"xscan islamic-umalqura min[200]"}
    ${"-271820-01-19[u-ca=islamic-umalqura]"} | ${"-271820-01-19"} | ${"xscan islamic-umalqura min[275]"}
    ${"-271820-01-20[u-ca=islamic-umalqura]"} | ${"-271820-01-20"} | ${"xscan islamic-umalqura min[276]"}
    ${"-271820-06-12[u-ca=islamic-umalqura]"} | ${"-271820-06-12"} | ${"xscan islamic-umalqura min[420]"}
    ${"+275760-09-13[u-ca=persian]"}          | ${"+275760-09-13"} | ${"xscan persian max[0]"}
    ${"+275760-09-12[u-ca=persian]"}          | ${"+275760-09-12"} | ${"xscan persian max[1]"}
    ${"+275760-08-14[u-ca=persian]"}          | ${"+275760-08-14"} | ${"xscan persian max[30]"}
    ${"+275760-02-26[u-ca=persian]"}          | ${"+275760-02-26"} | ${"xscan persian max[200]"}
    ${"+275759-07-21[u-ca=persian]"}          | ${"+275759-07-21"} | ${"xscan persian max[420]"}
    ${"-271821-04-19[u-ca=persian]"}          | ${"-271821-04-19"} | ${"xscan persian min[0]"}
    ${"-271821-04-20[u-ca=persian]"}          | ${"-271821-04-20"} | ${"xscan persian min[1]"}
    ${"-271821-05-19[u-ca=persian]"}          | ${"-271821-05-19"} | ${"xscan persian min[30]"}
    ${"-271821-11-05[u-ca=persian]"}          | ${"-271821-11-05"} | ${"xscan persian min[200]"}
    ${"-271820-06-12[u-ca=persian]"}          | ${"-271820-06-12"} | ${"xscan persian min[420]"}
    ${"+275760-09-13[u-ca=indian]"}           | ${"+275760-09-13"} | ${"xscan indian max[0]"}
    ${"+275760-09-12[u-ca=indian]"}           | ${"+275760-09-12"} | ${"xscan indian max[1]"}
    ${"+275760-08-14[u-ca=indian]"}           | ${"+275760-08-14"} | ${"xscan indian max[30]"}
    ${"+275760-02-26[u-ca=indian]"}           | ${"+275760-02-26"} | ${"xscan indian max[200]"}
    ${"+275759-07-21[u-ca=indian]"}           | ${"+275759-07-21"} | ${"xscan indian max[420]"}
    ${"-271821-04-20[u-ca=indian]"}           | ${"-271821-04-20"} | ${"xscan indian min[1]"}
    ${"-271821-05-19[u-ca=indian]"}           | ${"-271821-05-19"} | ${"xscan indian min[30]"}
    ${"-271821-11-05[u-ca=indian]"}           | ${"-271821-11-05"} | ${"xscan indian min[200]"}
    ${"-271820-06-12[u-ca=indian]"}           | ${"-271820-06-12"} | ${"xscan indian min[420]"}
    ${"+275760-09-13[u-ca=ethioaa]"}          | ${"+275760-09-13"} | ${"xscan ethioaa max[0]"}
    ${"+275760-09-12[u-ca=ethioaa]"}          | ${"+275760-09-12"} | ${"xscan ethioaa max[1]"}
    ${"+275760-08-14[u-ca=ethioaa]"}          | ${"+275760-08-14"} | ${"xscan ethioaa max[30]"}
    ${"+275760-02-26[u-ca=ethioaa]"}          | ${"+275760-02-26"} | ${"xscan ethioaa max[200]"}
    ${"+275759-07-21[u-ca=ethioaa]"}          | ${"+275759-07-21"} | ${"xscan ethioaa max[420]"}
    ${"-271821-04-19[u-ca=ethioaa]"}          | ${"-271821-04-19"} | ${"xscan ethioaa min[0]"}
    ${"-271821-04-20[u-ca=ethioaa]"}          | ${"-271821-04-20"} | ${"xscan ethioaa min[1]"}
    ${"-271821-05-19[u-ca=ethioaa]"}          | ${"-271821-05-19"} | ${"xscan ethioaa min[30]"}
    ${"-271821-11-05[u-ca=ethioaa]"}          | ${"-271821-11-05"} | ${"xscan ethioaa min[200]"}
    ${"-271820-06-12[u-ca=ethioaa]"}          | ${"-271820-06-12"} | ${"xscan ethioaa min[420]"}
    ${"+275760-09-13[u-ca=japanese]"}         | ${"+275760-09-13"} | ${"xscan japanese max[0]"}
    ${"+275760-09-12[u-ca=japanese]"}         | ${"+275760-09-12"} | ${"xscan japanese max[1]"}
    ${"+275760-08-14[u-ca=japanese]"}         | ${"+275760-08-14"} | ${"xscan japanese max[30]"}
    ${"+275760-02-26[u-ca=japanese]"}         | ${"+275760-02-26"} | ${"xscan japanese max[200]"}
    ${"+275759-07-21[u-ca=japanese]"}         | ${"+275759-07-21"} | ${"xscan japanese max[420]"}
    ${"-271821-04-20[u-ca=japanese]"}         | ${"-271821-04-20"} | ${"xscan japanese min[1]"}
    ${"-271821-05-19[u-ca=japanese]"}         | ${"-271821-05-19"} | ${"xscan japanese min[30]"}
    ${"-271821-11-05[u-ca=japanese]"}         | ${"-271821-11-05"} | ${"xscan japanese min[200]"}
    ${"-271820-06-12[u-ca=japanese]"}         | ${"-271820-06-12"} | ${"xscan japanese min[420]"}
    ${"+275760-09-13[u-ca=roc]"}              | ${"+275760-09-13"} | ${"xscan roc max[0]"}
    ${"+275760-09-12[u-ca=roc]"}              | ${"+275760-09-12"} | ${"xscan roc max[1]"}
    ${"+275760-08-14[u-ca=roc]"}              | ${"+275760-08-14"} | ${"xscan roc max[30]"}
    ${"+275760-02-26[u-ca=roc]"}              | ${"+275760-02-26"} | ${"xscan roc max[200]"}
    ${"+275759-07-21[u-ca=roc]"}              | ${"+275759-07-21"} | ${"xscan roc max[420]"}
    ${"-271821-04-19[u-ca=roc]"}              | ${"-271821-04-19"} | ${"xscan roc min[0]"}
    ${"-271821-04-20[u-ca=roc]"}              | ${"-271821-04-20"} | ${"xscan roc min[1]"}
    ${"-271821-05-19[u-ca=roc]"}              | ${"-271821-05-19"} | ${"xscan roc min[30]"}
    ${"-271821-11-05[u-ca=roc]"}              | ${"-271821-11-05"} | ${"xscan roc min[200]"}
    ${"-271820-06-12[u-ca=roc]"}              | ${"-271820-06-12"} | ${"xscan roc min[420]"}
  `(
    "converts $value back to iso8601 as $expected ($source)",
    ({ value, expected }) => {
      expect(convertDateToCalendar(value, "iso8601")).toBe(expected);
    },
  );
});

// CORE-6 §4.4 stride matrix: samples of 1000 + k × 99991 days after the minimum.
describe("convertDateToCalendar across the whole range (CORE-6 §4.4 strides)", () => {
  it.each`
    value              | calendar              | expected                                  | source
    ${"-271818-01-13"} | ${"buddhist"}         | ${"-271818-01-13[u-ca=buddhist]"}         | ${"stride buddhist k=0"}
    ${"-134935-01-24"} | ${"buddhist"}         | ${"-134935-01-24[u-ca=buddhist]"}         | ${"stride buddhist k=500"}
    ${"1400-07-25"}    | ${"buddhist"}         | ${"1400-07-25[u-ca=buddhist]"}            | ${"stride buddhist k=998"}
    ${"1674-04-30"}    | ${"buddhist"}         | ${"1674-04-30[u-ca=buddhist]"}            | ${"stride buddhist k=999"}
    ${"1948-02-05"}    | ${"buddhist"}         | ${"1948-02-05[u-ca=buddhist]"}            | ${"stride buddhist k=1000"}
    ${"+138831-02-15"} | ${"buddhist"}         | ${"+138831-02-15[u-ca=buddhist]"}         | ${"stride buddhist k=1500"}
    ${"+275714-02-26"} | ${"buddhist"}         | ${"+275714-02-26[u-ca=buddhist]"}         | ${"stride buddhist k=2000"}
    ${"-271818-01-13"} | ${"hebrew"}           | ${"-271818-01-13[u-ca=hebrew]"}           | ${"stride hebrew k=0"}
    ${"-134935-01-24"} | ${"hebrew"}           | ${"-134935-01-24[u-ca=hebrew]"}           | ${"stride hebrew k=500"}
    ${"1400-07-25"}    | ${"hebrew"}           | ${"1400-07-25[u-ca=hebrew]"}              | ${"stride hebrew k=998"}
    ${"1674-04-30"}    | ${"hebrew"}           | ${"1674-04-30[u-ca=hebrew]"}              | ${"stride hebrew k=999"}
    ${"1948-02-05"}    | ${"hebrew"}           | ${"1948-02-05[u-ca=hebrew]"}              | ${"stride hebrew k=1000"}
    ${"+138831-02-15"} | ${"hebrew"}           | ${"+138831-02-15[u-ca=hebrew]"}           | ${"stride hebrew k=1500"}
    ${"+275714-02-26"} | ${"hebrew"}           | ${"+275714-02-26[u-ca=hebrew]"}           | ${"stride hebrew k=2000"}
    ${"-271818-01-13"} | ${"islamic-civil"}    | ${"-271818-01-13[u-ca=islamic-civil]"}    | ${"stride islamic-civil k=0"}
    ${"-134935-01-24"} | ${"islamic-civil"}    | ${"-134935-01-24[u-ca=islamic-civil]"}    | ${"stride islamic-civil k=500"}
    ${"1400-07-25"}    | ${"islamic-civil"}    | ${"1400-07-25[u-ca=islamic-civil]"}       | ${"stride islamic-civil k=998"}
    ${"1674-04-30"}    | ${"islamic-civil"}    | ${"1674-04-30[u-ca=islamic-civil]"}       | ${"stride islamic-civil k=999"}
    ${"1948-02-05"}    | ${"islamic-civil"}    | ${"1948-02-05[u-ca=islamic-civil]"}       | ${"stride islamic-civil k=1000"}
    ${"+138831-02-15"} | ${"islamic-civil"}    | ${"+138831-02-15[u-ca=islamic-civil]"}    | ${"stride islamic-civil k=1500"}
    ${"+275714-02-26"} | ${"islamic-civil"}    | ${"+275714-02-26[u-ca=islamic-civil]"}    | ${"stride islamic-civil k=2000"}
    ${"-271818-01-13"} | ${"islamic-tbla"}     | ${"-271818-01-13[u-ca=islamic-tbla]"}     | ${"stride islamic-tbla k=0"}
    ${"-134935-01-24"} | ${"islamic-tbla"}     | ${"-134935-01-24[u-ca=islamic-tbla]"}     | ${"stride islamic-tbla k=500"}
    ${"1400-07-25"}    | ${"islamic-tbla"}     | ${"1400-07-25[u-ca=islamic-tbla]"}        | ${"stride islamic-tbla k=998"}
    ${"1674-04-30"}    | ${"islamic-tbla"}     | ${"1674-04-30[u-ca=islamic-tbla]"}        | ${"stride islamic-tbla k=999"}
    ${"1948-02-05"}    | ${"islamic-tbla"}     | ${"1948-02-05[u-ca=islamic-tbla]"}        | ${"stride islamic-tbla k=1000"}
    ${"+138831-02-15"} | ${"islamic-tbla"}     | ${"+138831-02-15[u-ca=islamic-tbla]"}     | ${"stride islamic-tbla k=1500"}
    ${"+275714-02-26"} | ${"islamic-tbla"}     | ${"+275714-02-26[u-ca=islamic-tbla]"}     | ${"stride islamic-tbla k=2000"}
    ${"-271818-01-13"} | ${"islamic-umalqura"} | ${"-271818-01-13[u-ca=islamic-umalqura]"} | ${"stride islamic-umalqura k=0"}
    ${"-134935-01-24"} | ${"islamic-umalqura"} | ${"-134935-01-24[u-ca=islamic-umalqura]"} | ${"stride islamic-umalqura k=500"}
    ${"1400-07-25"}    | ${"islamic-umalqura"} | ${"1400-07-25[u-ca=islamic-umalqura]"}    | ${"stride islamic-umalqura k=998"}
    ${"1674-04-30"}    | ${"islamic-umalqura"} | ${"1674-04-30[u-ca=islamic-umalqura]"}    | ${"stride islamic-umalqura k=999"}
    ${"1948-02-05"}    | ${"islamic-umalqura"} | ${"1948-02-05[u-ca=islamic-umalqura]"}    | ${"stride islamic-umalqura k=1000"}
    ${"+138831-02-15"} | ${"islamic-umalqura"} | ${"+138831-02-15[u-ca=islamic-umalqura]"} | ${"stride islamic-umalqura k=1500"}
    ${"+275714-02-26"} | ${"islamic-umalqura"} | ${"+275714-02-26[u-ca=islamic-umalqura]"} | ${"stride islamic-umalqura k=2000"}
    ${"-271818-01-13"} | ${"persian"}          | ${"-271818-01-13[u-ca=persian]"}          | ${"stride persian k=0"}
    ${"-134935-01-24"} | ${"persian"}          | ${"-134935-01-24[u-ca=persian]"}          | ${"stride persian k=500"}
    ${"1400-07-25"}    | ${"persian"}          | ${"1400-07-25[u-ca=persian]"}             | ${"stride persian k=998"}
    ${"1674-04-30"}    | ${"persian"}          | ${"1674-04-30[u-ca=persian]"}             | ${"stride persian k=999"}
    ${"1948-02-05"}    | ${"persian"}          | ${"1948-02-05[u-ca=persian]"}             | ${"stride persian k=1000"}
    ${"+138831-02-15"} | ${"persian"}          | ${"+138831-02-15[u-ca=persian]"}          | ${"stride persian k=1500"}
    ${"+275714-02-26"} | ${"persian"}          | ${"+275714-02-26[u-ca=persian]"}          | ${"stride persian k=2000"}
    ${"-271818-01-13"} | ${"indian"}           | ${"-271818-01-13[u-ca=indian]"}           | ${"stride indian k=0"}
    ${"-134935-01-24"} | ${"indian"}           | ${"-134935-01-24[u-ca=indian]"}           | ${"stride indian k=500"}
    ${"1400-07-25"}    | ${"indian"}           | ${"1400-07-25[u-ca=indian]"}              | ${"stride indian k=998"}
    ${"1674-04-30"}    | ${"indian"}           | ${"1674-04-30[u-ca=indian]"}              | ${"stride indian k=999"}
    ${"1948-02-05"}    | ${"indian"}           | ${"1948-02-05[u-ca=indian]"}              | ${"stride indian k=1000"}
    ${"+138831-02-15"} | ${"indian"}           | ${"+138831-02-15[u-ca=indian]"}           | ${"stride indian k=1500"}
    ${"+275714-02-26"} | ${"indian"}           | ${"+275714-02-26[u-ca=indian]"}           | ${"stride indian k=2000"}
    ${"-271818-01-13"} | ${"ethioaa"}          | ${"-271818-01-13[u-ca=ethioaa]"}          | ${"stride ethioaa k=0"}
    ${"-134935-01-24"} | ${"ethioaa"}          | ${"-134935-01-24[u-ca=ethioaa]"}          | ${"stride ethioaa k=500"}
    ${"1400-07-25"}    | ${"ethioaa"}          | ${"1400-07-25[u-ca=ethioaa]"}             | ${"stride ethioaa k=998"}
    ${"1674-04-30"}    | ${"ethioaa"}          | ${"1674-04-30[u-ca=ethioaa]"}             | ${"stride ethioaa k=999"}
    ${"1948-02-05"}    | ${"ethioaa"}          | ${"1948-02-05[u-ca=ethioaa]"}             | ${"stride ethioaa k=1000"}
    ${"+138831-02-15"} | ${"ethioaa"}          | ${"+138831-02-15[u-ca=ethioaa]"}          | ${"stride ethioaa k=1500"}
    ${"+275714-02-26"} | ${"ethioaa"}          | ${"+275714-02-26[u-ca=ethioaa]"}          | ${"stride ethioaa k=2000"}
    ${"-271818-01-13"} | ${"japanese"}         | ${"-271818-01-13[u-ca=japanese]"}         | ${"stride japanese k=0"}
    ${"-134935-01-24"} | ${"japanese"}         | ${"-134935-01-24[u-ca=japanese]"}         | ${"stride japanese k=500"}
    ${"1400-07-25"}    | ${"japanese"}         | ${"1400-07-25[u-ca=japanese]"}            | ${"stride japanese k=998"}
    ${"1674-04-30"}    | ${"japanese"}         | ${"1674-04-30[u-ca=japanese]"}            | ${"stride japanese k=999"}
    ${"1948-02-05"}    | ${"japanese"}         | ${"1948-02-05[u-ca=japanese]"}            | ${"stride japanese k=1000"}
    ${"+138831-02-15"} | ${"japanese"}         | ${"+138831-02-15[u-ca=japanese]"}         | ${"stride japanese k=1500"}
    ${"+275714-02-26"} | ${"japanese"}         | ${"+275714-02-26[u-ca=japanese]"}         | ${"stride japanese k=2000"}
    ${"-271818-01-13"} | ${"roc"}              | ${"-271818-01-13[u-ca=roc]"}              | ${"stride roc k=0"}
    ${"-134935-01-24"} | ${"roc"}              | ${"-134935-01-24[u-ca=roc]"}              | ${"stride roc k=500"}
    ${"1400-07-25"}    | ${"roc"}              | ${"1400-07-25[u-ca=roc]"}                 | ${"stride roc k=998"}
    ${"1674-04-30"}    | ${"roc"}              | ${"1674-04-30[u-ca=roc]"}                 | ${"stride roc k=999"}
    ${"1948-02-05"}    | ${"roc"}              | ${"1948-02-05[u-ca=roc]"}                 | ${"stride roc k=1000"}
    ${"+138831-02-15"} | ${"roc"}              | ${"+138831-02-15[u-ca=roc]"}              | ${"stride roc k=1500"}
    ${"+275714-02-26"} | ${"roc"}              | ${"+275714-02-26[u-ca=roc]"}              | ${"stride roc k=2000"}
  `(
    "converts $value to $calendar as $expected ($source)",
    ({ value, calendar, expected }) => {
      expect(convertDateToCalendar(value, calendar)).toBe(expected);
    },
  );

  it.each`
    value                                     | expected           | source
    ${"-271818-01-13[u-ca=buddhist]"}         | ${"-271818-01-13"} | ${"stride buddhist k=0"}
    ${"-134935-01-24[u-ca=buddhist]"}         | ${"-134935-01-24"} | ${"stride buddhist k=500"}
    ${"1400-07-25[u-ca=buddhist]"}            | ${"1400-07-25"}    | ${"stride buddhist k=998"}
    ${"1674-04-30[u-ca=buddhist]"}            | ${"1674-04-30"}    | ${"stride buddhist k=999"}
    ${"1948-02-05[u-ca=buddhist]"}            | ${"1948-02-05"}    | ${"stride buddhist k=1000"}
    ${"+138831-02-15[u-ca=buddhist]"}         | ${"+138831-02-15"} | ${"stride buddhist k=1500"}
    ${"+275714-02-26[u-ca=buddhist]"}         | ${"+275714-02-26"} | ${"stride buddhist k=2000"}
    ${"-271818-01-13[u-ca=hebrew]"}           | ${"-271818-01-13"} | ${"stride hebrew k=0"}
    ${"-134935-01-24[u-ca=hebrew]"}           | ${"-134935-01-24"} | ${"stride hebrew k=500"}
    ${"1400-07-25[u-ca=hebrew]"}              | ${"1400-07-25"}    | ${"stride hebrew k=998"}
    ${"1674-04-30[u-ca=hebrew]"}              | ${"1674-04-30"}    | ${"stride hebrew k=999"}
    ${"1948-02-05[u-ca=hebrew]"}              | ${"1948-02-05"}    | ${"stride hebrew k=1000"}
    ${"+138831-02-15[u-ca=hebrew]"}           | ${"+138831-02-15"} | ${"stride hebrew k=1500"}
    ${"+275714-02-26[u-ca=hebrew]"}           | ${"+275714-02-26"} | ${"stride hebrew k=2000"}
    ${"-271818-01-13[u-ca=islamic-civil]"}    | ${"-271818-01-13"} | ${"stride islamic-civil k=0"}
    ${"-134935-01-24[u-ca=islamic-civil]"}    | ${"-134935-01-24"} | ${"stride islamic-civil k=500"}
    ${"1400-07-25[u-ca=islamic-civil]"}       | ${"1400-07-25"}    | ${"stride islamic-civil k=998"}
    ${"1674-04-30[u-ca=islamic-civil]"}       | ${"1674-04-30"}    | ${"stride islamic-civil k=999"}
    ${"1948-02-05[u-ca=islamic-civil]"}       | ${"1948-02-05"}    | ${"stride islamic-civil k=1000"}
    ${"+138831-02-15[u-ca=islamic-civil]"}    | ${"+138831-02-15"} | ${"stride islamic-civil k=1500"}
    ${"+275714-02-26[u-ca=islamic-civil]"}    | ${"+275714-02-26"} | ${"stride islamic-civil k=2000"}
    ${"-271818-01-13[u-ca=islamic-tbla]"}     | ${"-271818-01-13"} | ${"stride islamic-tbla k=0"}
    ${"-134935-01-24[u-ca=islamic-tbla]"}     | ${"-134935-01-24"} | ${"stride islamic-tbla k=500"}
    ${"1400-07-25[u-ca=islamic-tbla]"}        | ${"1400-07-25"}    | ${"stride islamic-tbla k=998"}
    ${"1674-04-30[u-ca=islamic-tbla]"}        | ${"1674-04-30"}    | ${"stride islamic-tbla k=999"}
    ${"1948-02-05[u-ca=islamic-tbla]"}        | ${"1948-02-05"}    | ${"stride islamic-tbla k=1000"}
    ${"+138831-02-15[u-ca=islamic-tbla]"}     | ${"+138831-02-15"} | ${"stride islamic-tbla k=1500"}
    ${"+275714-02-26[u-ca=islamic-tbla]"}     | ${"+275714-02-26"} | ${"stride islamic-tbla k=2000"}
    ${"-271818-01-13[u-ca=islamic-umalqura]"} | ${"-271818-01-13"} | ${"stride islamic-umalqura k=0"}
    ${"-134935-01-24[u-ca=islamic-umalqura]"} | ${"-134935-01-24"} | ${"stride islamic-umalqura k=500"}
    ${"1400-07-25[u-ca=islamic-umalqura]"}    | ${"1400-07-25"}    | ${"stride islamic-umalqura k=998"}
    ${"1674-04-30[u-ca=islamic-umalqura]"}    | ${"1674-04-30"}    | ${"stride islamic-umalqura k=999"}
    ${"1948-02-05[u-ca=islamic-umalqura]"}    | ${"1948-02-05"}    | ${"stride islamic-umalqura k=1000"}
    ${"+138831-02-15[u-ca=islamic-umalqura]"} | ${"+138831-02-15"} | ${"stride islamic-umalqura k=1500"}
    ${"+275714-02-26[u-ca=islamic-umalqura]"} | ${"+275714-02-26"} | ${"stride islamic-umalqura k=2000"}
    ${"-271818-01-13[u-ca=persian]"}          | ${"-271818-01-13"} | ${"stride persian k=0"}
    ${"-134935-01-24[u-ca=persian]"}          | ${"-134935-01-24"} | ${"stride persian k=500"}
    ${"1400-07-25[u-ca=persian]"}             | ${"1400-07-25"}    | ${"stride persian k=998"}
    ${"1674-04-30[u-ca=persian]"}             | ${"1674-04-30"}    | ${"stride persian k=999"}
    ${"1948-02-05[u-ca=persian]"}             | ${"1948-02-05"}    | ${"stride persian k=1000"}
    ${"+138831-02-15[u-ca=persian]"}          | ${"+138831-02-15"} | ${"stride persian k=1500"}
    ${"+275714-02-26[u-ca=persian]"}          | ${"+275714-02-26"} | ${"stride persian k=2000"}
    ${"-271818-01-13[u-ca=indian]"}           | ${"-271818-01-13"} | ${"stride indian k=0"}
    ${"-134935-01-24[u-ca=indian]"}           | ${"-134935-01-24"} | ${"stride indian k=500"}
    ${"1400-07-25[u-ca=indian]"}              | ${"1400-07-25"}    | ${"stride indian k=998"}
    ${"1674-04-30[u-ca=indian]"}              | ${"1674-04-30"}    | ${"stride indian k=999"}
    ${"1948-02-05[u-ca=indian]"}              | ${"1948-02-05"}    | ${"stride indian k=1000"}
    ${"+138831-02-15[u-ca=indian]"}           | ${"+138831-02-15"} | ${"stride indian k=1500"}
    ${"+275714-02-26[u-ca=indian]"}           | ${"+275714-02-26"} | ${"stride indian k=2000"}
    ${"-271818-01-13[u-ca=ethioaa]"}          | ${"-271818-01-13"} | ${"stride ethioaa k=0"}
    ${"-134935-01-24[u-ca=ethioaa]"}          | ${"-134935-01-24"} | ${"stride ethioaa k=500"}
    ${"1400-07-25[u-ca=ethioaa]"}             | ${"1400-07-25"}    | ${"stride ethioaa k=998"}
    ${"1674-04-30[u-ca=ethioaa]"}             | ${"1674-04-30"}    | ${"stride ethioaa k=999"}
    ${"1948-02-05[u-ca=ethioaa]"}             | ${"1948-02-05"}    | ${"stride ethioaa k=1000"}
    ${"+138831-02-15[u-ca=ethioaa]"}          | ${"+138831-02-15"} | ${"stride ethioaa k=1500"}
    ${"+275714-02-26[u-ca=ethioaa]"}          | ${"+275714-02-26"} | ${"stride ethioaa k=2000"}
    ${"-271818-01-13[u-ca=japanese]"}         | ${"-271818-01-13"} | ${"stride japanese k=0"}
    ${"-134935-01-24[u-ca=japanese]"}         | ${"-134935-01-24"} | ${"stride japanese k=500"}
    ${"1400-07-25[u-ca=japanese]"}            | ${"1400-07-25"}    | ${"stride japanese k=998"}
    ${"1674-04-30[u-ca=japanese]"}            | ${"1674-04-30"}    | ${"stride japanese k=999"}
    ${"1948-02-05[u-ca=japanese]"}            | ${"1948-02-05"}    | ${"stride japanese k=1000"}
    ${"+138831-02-15[u-ca=japanese]"}         | ${"+138831-02-15"} | ${"stride japanese k=1500"}
    ${"+275714-02-26[u-ca=japanese]"}         | ${"+275714-02-26"} | ${"stride japanese k=2000"}
    ${"-271818-01-13[u-ca=roc]"}              | ${"-271818-01-13"} | ${"stride roc k=0"}
    ${"-134935-01-24[u-ca=roc]"}              | ${"-134935-01-24"} | ${"stride roc k=500"}
    ${"1400-07-25[u-ca=roc]"}                 | ${"1400-07-25"}    | ${"stride roc k=998"}
    ${"1674-04-30[u-ca=roc]"}                 | ${"1674-04-30"}    | ${"stride roc k=999"}
    ${"1948-02-05[u-ca=roc]"}                 | ${"1948-02-05"}    | ${"stride roc k=1000"}
    ${"+138831-02-15[u-ca=roc]"}              | ${"+138831-02-15"} | ${"stride roc k=1500"}
    ${"+275714-02-26[u-ca=roc]"}              | ${"+275714-02-26"} | ${"stride roc k=2000"}
  `(
    "converts $value back to iso8601 as $expected ($source)",
    ({ value, expected }) => {
      expect(convertDateToCalendar(value, "iso8601")).toBe(expected);
    },
  );
});
