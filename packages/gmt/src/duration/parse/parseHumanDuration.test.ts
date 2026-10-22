import { parseHumanDuration } from "./parseHumanDuration";
import {
  fractionRows,
  limitRows,
  millisecondRows,
  minuteOrMonthRows,
  orderRows,
  separatorRows,
  signRows,
  zeroRows,
} from "../../test/humanDurationRows";

const acceptedGroups = {
  "minute or month (G1, G8)": minuteOrMonthRows,
  separators: separatorRows,
  "fractions (Temporal 13.37)": fractionRows,
  "milliseconds (G5)": millisecondRows,
  "sign (G4)": signRows,
  "zero units": zeroRows,
  "order (G2)": orderRows,
  "limits (Temporal 7.5.16)": limitRows,
};

describe("parseHumanDuration", () => {
  for (const [group, rows] of Object.entries(acceptedGroups)) {
    describe(`accepts ${group}`, () => {
      for (const { text, iso } of rows) {
        it(`reads ${JSON.stringify(text)} as ${iso}`, () => {
          expect(parseHumanDuration(text)).toBe(iso);
        });
      }
    });
  }

  // 34 spellings, derived from the grammar's table: unit -> ISO for `2<spelling>`.
  const spellingRows = [
    ...["y", "yr", "yrs", "year", "years"].map((s) => [s, "P2Y"] as const),
    ...["mo", "month", "months"].map((s) => [s, "P2M"] as const),
    ...["w", "wk", "wks", "week", "weeks"].map((s) => [s, "P2W"] as const),
    ...["d", "day", "days"].map((s) => [s, "P2D"] as const),
    ...["h", "hr", "hrs", "hour", "hours"].map((s) => [s, "PT2H"] as const),
    ...["m", "min", "mins", "minute", "minutes"].map(
      (s) => [s, "PT2M"] as const,
    ),
    ...["s", "sec", "secs", "second", "seconds"].map(
      (s) => [s, "PT2S"] as const,
    ),
    ...["ms", "millisecond", "milliseconds"].map(
      (s) => [s, "PT0.002S"] as const,
    ),
  ];

  it("has the 34 spellings", () => {
    expect(spellingRows).toHaveLength(34);
  });

  for (const [spelling, iso] of spellingRows) {
    it(`reads 2${spelling} and 2${spelling.toUpperCase()} as ${iso}`, () => {
      expect(parseHumanDuration(`2${spelling}`)).toBe(iso);
      expect(parseHumanDuration(`2${spelling.toUpperCase()}`)).toBe(iso);
    });
  }

  it.each`
    text                 | rule
    ${" 2h"}             | ${"G9 leading space"}
    ${"2h "}             | ${"G9 trailing space"}
    ${"2h\t30m"}         | ${"G9 tab"}
    ${"2h\n30m"}         | ${"G9 newline"}
    ${"2h\u00A030m"}     | ${"G9 U+00A0"}
    ${"2h ,30m"}         | ${"separator: space before comma"}
    ${"2h,,30m"}         | ${"separator: two commas"}
    ${"2h,and 30m"}      | ${"separator: no space after comma"}
    ${"2h and30m"}       | ${"separator: no space after and"}
    ${"2hand 30m"}       | ${"G1 letter after unit"}
    ${"2hand30m"}        | ${"G1 letter after unit"}
    ${"2h and"}          | ${"separator reaches the end"}
    ${"2h,"}             | ${"separator reaches the end"}
    ${"2h, "}            | ${"separator reaches the end"}
    ${"and 2h"}          | ${"and leads"}
    ${",2h"}             | ${"comma leads"}
    ${"2h and and 30m"}  | ${"doubled and"}
    ${"2h\u2003 30m"}    | ${"G9 em space"}
    ${"2h\r30m"}         | ${"G9 carriage return"}
    ${"2h,\t30m"}        | ${"G9 tab after comma"}
    ${"2h and\t30m"}     | ${"G9 tab after and"}
    ${"2h\tand 30m"}     | ${"G9 tab before and"}
    ${"2h\u00A0and 30m"} | ${"G9 U+00A0 before and"}
    ${"2\th"}            | ${"G9 tab between number and unit"}
    ${"2\u00A0h"}        | ${"G9 U+00A0 between number and unit"}
    ${"2\nh"}            | ${"G9 newline between number and unit"}
    ${"2h\n"}            | ${"G9 trailing newline"}
    ${"2h\t"}            | ${"G9 trailing tab"}
    ${"\t2h"}            | ${"G9 leading tab"}
    ${"\u00A02h"}        | ${"G9 leading U+00A0"}
    ${"2h\u00A0"}        | ${"G9 trailing U+00A0"}
    ${"2h\uFF0C 30m"}    | ${"full-width comma"}
    ${"2h; 30m"}         | ${"semicolon"}
    ${"2h & 30m"}        | ${"ampersand"}
    ${"2h + 30m"}        | ${"plus is not a separator"}
    ${"2h plus 30m"}     | ${"plus word"}
    ${"2h and, 30m"}     | ${"comma after and"}
    ${"2h, and, 30m"}    | ${"comma after and"}
    ${"2h,and,30m"}      | ${"no spaces anywhere"}
  `("refuses $text ($rule)", ({ text }) => {
    expect(parseHumanDuration(text)).toBe("");
  });

  it.each`
    text                | why
    ${"1mx"}            | ${"G1 letter after m"}
    ${"1moo"}           | ${"G1 letter after mo"}
    ${"1ms5"}           | ${"G1 ms then a bare number"}
    ${"1mins5"}         | ${"G1 mins then a bare number"}
    ${"1dayz"}          | ${"G1 letter after day"}
    ${"1hx"}            | ${"G1 letter after h"}
    ${"1m s"}           | ${"G1 unit needs digits first"}
    ${"1mont"}          | ${"G1 prefix of a spelling"}
    ${"1millisecondsx"} | ${"G1 letter after milliseconds"}
    ${"1\u017F"}        | ${"G7 long s for s"}
    ${"1\u017Fec"}      | ${"G7 long s inside sec"}
    ${"1\u017Fecond"}   | ${"G7 long s inside second"}
    ${"1min\u017F"}     | ${"G7 long s after min"}
    ${"1m\u017F"}       | ${"G7 long s for ms"}
    ${"1yr\u017F"}      | ${"G7 long s for yrs"}
    ${"1day\u017F"}     | ${"G7 long s for days"}
    ${"1h\u017F"}       | ${"G7 long s after h"}
    ${"1w\u212A"}       | ${"G7 Kelvin sign for wk"}
    ${"1w\u212As"}      | ${"G7 Kelvin sign for wks"}
    ${"1\u212A"}        | ${"G7 Kelvin sign alone"}
    ${"1s\u212A"}       | ${"G7 Kelvin sign after s"}
    ${"1d\u212A"}       | ${"G7 Kelvin sign after d"}
    ${"1\u0130"}        | ${"G7 dotted capital I"}
    ${"1m\u0130n"}      | ${"G7 dotted capital I for min"}
    ${"1.5h 30m"}       | ${"G3 fraction not last"}
    ${"1.5m 30s"}       | ${"G3 fraction not last"}
    ${"1.5s 500ms"}     | ${"G3 fraction not last"}
    ${"1.5h 500ms"}     | ${"G3 fraction not last"}
    ${"1.5ms"}          | ${"G3 no fraction on ms"}
    ${"1.5d"}           | ${"G3 no fraction on day"}
    ${"1.5w"}           | ${"G3 no fraction on week"}
    ${"1.5mo"}          | ${"G3 no fraction on month"}
    ${"1.5y"}           | ${"G3 no fraction on year"}
    ${"1.0d"}           | ${"G3 no fraction on day, even zero"}
    ${"1.1234567891s"}  | ${"10 fraction digits"}
    ${".5h"}            | ${"digit before the point"}
    ${"1.h"}            | ${"digit after the point"}
    ${"1,5h"}           | ${"comma is never a decimal sign"}
    ${"1,500ms"}        | ${"comma is never a decimal sign"}
    ${"1e3s"}           | ${"no exponent"}
    ${"1_000ms"}        | ${"no digit separator"}
  `("refuses $text ($why)", ({ text }) => {
    expect(parseHumanDuration(text)).toBe("");
  });

  it.each`
    text                               | why
    ${"2h -30m"}                       | ${"G4 sign only first"}
    ${"- 2h"}                          | ${"G4 space after sign"}
    ${"--2h"}                          | ${"G4 two signs"}
    ${"+-2h"}                          | ${"G4 two signs"}
    ${"−2h"}                           | ${"G4 U+2212"}
    ${"-"}                             | ${"sign alone"}
    ${"+"}                             | ${"sign alone"}
    ${"30m 2h"}                        | ${"G2 order"}
    ${"2h 3h"}                         | ${"G2 repeat"}
    ${"2h 3hr"}                        | ${"G2 repeat"}
    ${"1m 1min"}                       | ${"G2 repeat"}
    ${"500ms 1s"}                      | ${"G2 order"}
    ${"1d 1w"}                         | ${"G2 order"}
    ${"1y 1mo 1w 1d 1h 1m 1s 1ms 1ms"} | ${"G2 ninth pair"}
    ${"1mo 1y"}                        | ${"G2 order"}
    ${"1h 1d"}                         | ${"G2 order"}
    ${"1s 1m"}                         | ${"G2 order"}
    ${"1w 1mo"}                        | ${"G2 order"}
    ${"1ms 1ms"}                       | ${"G2 repeat"}
    ${"1y 2mo 3w 4d 5h 6m 7s 8ms 9y"}  | ${"9th pair, valid rank restart"}
    ${"1y2mo3w4d5h6m7s8ms9ms"}         | ${"9th pair, no separators"}
    ${"1y 2mo 3w 4d 5h 6m 7s 8ms x"}   | ${"text after the 8th pair"}
    ${"1y 2mo 3w 4d 5h 6m 7s 8ms,"}    | ${"separator after the 8th pair"}
    ${"1y 2mo 3w 4d 5h 6m 7s 8ms "}    | ${"trailing space after the 8th pair"}
    ${"2h,-30m"}                       | ${"G4 sign after comma"}
    ${"2h and -30m"}                   | ${"G4 sign after and"}
    ${"2h-30m"}                        | ${"G4 sign, no separator"}
    ${"-2h, +30m"}                     | ${"G4 sign on a later pair"}
    ${"+ 2h"}                          | ${"G4 space after plus"}
    ${"-,2h"}                          | ${"G4 sign then separator"}
    ${"-and 2h"}                       | ${"G4 sign then and"}
    ${"-\u00A02h"}                     | ${"G4 sign then U+00A0"}
    ${"2h30m-"}                        | ${"G4 trailing sign"}
    ${"1.5h,"}                         | ${"G3 separator after a fraction"}
    ${"1.5h and"}                      | ${"G3 and after a fraction"}
    ${"1.5 h 30m"}                     | ${"G3 fraction not last, spaced"}
    ${"2h 1.5m 30s"}                   | ${"G3 fraction not last, mid-string"}
    ${"0.5ms"}                         | ${"G3 no fraction on ms"}
    ${"1.0ms"}                         | ${"G3 no fraction on ms, even zero"}
    ${"1.0w"}                          | ${"G3 no fraction on week, even zero"}
    ${"1.0mo"}                         | ${"G3 no fraction on month, even zero"}
    ${"1.1234567891h"}                 | ${"10 fraction digits on h"}
    ${"0.0000000001m"}                 | ${"10 fraction digits on m"}
    ${"1..5h"}                         | ${"two points"}
    ${"1.5.5h"}                        | ${"two fractions"}
    ${"+.5h"}                          | ${"sign then bare fraction"}
  `("refuses $text ($why)", ({ text }) => {
    expect(parseHumanDuration(text)).toBe("");
  });

  it.each`
    text                                        | why
    ${"4294967296y"}                            | ${"years reach 2^32"}
    ${"4294967296mo"}                           | ${"months reach 2^32"}
    ${"4294967296w"}                            | ${"weeks reach 2^32"}
    ${"-4294967296y"}                           | ${"negative years reach 2^32"}
    ${"-9007199254740992s"}                     | ${"negative seconds reach 2^53"}
    ${"99999999999999999999y"}                  | ${"20-digit years"}
    ${"104249991375d"}                          | ${"days past 2^53 seconds"}
    ${"104249991374d 7h 36m 32s"}               | ${"days plus time reach 2^53 seconds"}
    ${"2501999792983h 59m"}                     | ${"hours plus minutes reach 2^53 seconds"}
    ${"2501999792983.999h"}                     | ${"fraction pushes hours past 2^53 seconds"}
    ${"9007199254740992.0s"}                    | ${"fractional zero does not rescue 2^53"}
    ${"9007199254740991s 1000ms"}               | ${"ms fold carries seconds to 2^53"}
    ${"9007199254740992999ms"}                  | ${"BigInt fold, a Number would round"}
    ${"123456789012345678901234567890ms"}       | ${"ms far past the range"}
    ${"2501999792984h"}                         | ${"hours past 2^53 seconds"}
    ${"9007199254740992s"}                      | ${"seconds reach 2^53"}
    ${"9007199254740992000ms"}                  | ${"milliseconds reach 2^53 seconds"}
    ${"1".repeat(400) + "h"}                    | ${"400 digits"}
    ${"10000000000000000s 1ms"}                 | ${"17 significant seconds digits with ms"}
    ${"10000000000000000000ms"}                 | ${"20 significant ms digits"}
    ${"1".repeat(5000) + "ms"}                  | ${"5000 ms digits"}
    ${"1".repeat(5000) + "s 1ms"}               | ${"5000 seconds digits with ms"}
    ${"0".repeat(5000) + "1".repeat(20) + "ms"} | ${"leading zeros then 20 ms digits"}
  `("refuses $text ($why)", ({ text }) => {
    expect(parseHumanDuration(text)).toBe("");
  });

  it.each`
    text
    ${""}
    ${" "}
    ${"h"}
    ${"30"}
    ${"2 x"}
    ${"2 hours ago"}
    ${"1:30"}
    ${"1:30:00"}
    ${"PT1H"}
    ${"P1M"}
    ${"2us"}
    ${"2μs"}
    ${"2ns"}
    ${"2 fortnights"}
    ${"1ſ"}
    ${"1 mın"}
    ${"１h"}
    ${"٢h"}
    ${"2h\u0000"}
    ${"pt2h30m"}
    ${"-PT1H"}
    ${"P1D"}
    ${undefined}
    ${null}
    ${120}
    ${{}}
    ${true}
    ${["2h"]}
    ${2n}
  `("returns the sentinel for $text", ({ text }) => {
    expect(parseHumanDuration(text as string)).toBe("");
  });

  it.each`
    text                                        | expected                     | why
    ${"9007199254740991s 999ms"}                | ${"PT9007199254740991.999S"} | ${"16 significant seconds digits with ms"}
    ${"9007199254740991999ms"}                  | ${"PT9007199254740991.999S"} | ${"19 significant ms digits"}
    ${"0".repeat(5000) + "1ms"}                 | ${"PT0.001S"}                | ${"long run of leading zeros before ms"}
    ${"0".repeat(5000) + "5s 0001ms"}           | ${"PT5.001S"}                | ${"leading zeros on both seconds and ms"}
    ${"0".repeat(20) + "9007199254740991999ms"} | ${"PT9007199254740991.999S"} | ${"leading zeros before 19 significant ms digits"}
  `("reads $text ($why)", ({ text, expected }) => {
    expect(parseHumanDuration(text)).toBe(expected);
  });
});
