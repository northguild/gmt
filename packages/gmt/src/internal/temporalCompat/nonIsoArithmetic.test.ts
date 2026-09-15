import { Temporal } from "@js-temporal/polyfill";
import { hebrewArithmeticModel } from "./hebrewArithmetic";
import { indianArithmeticModel } from "./indianArithmetic";
import {
  type ArithmeticModel,
  compareMonthCodes,
  type DateDurationFields,
  isNonIsoDateUntilResult,
  nonIsoDateAdd,
  nonIsoDateUntil,
} from "./nonIsoArithmetic";
import { readArithmeticModel } from "./readArithmeticModel";

// The spec algorithms are called directly, over each model, so they stay covered whether or not
// the installed polyfill still needs them (CORE-6 spec §4.5). Dates are ISO; expected values are
// Chromium 152 native Temporal (q2-grid-chromium152.json "grid", q2-xscan-chromium152.json
// "xscan") or test262, never the polyfill or GMT.
const models: Record<string, () => ArithmeticModel> = {
  read: () => readArithmeticModel("hebrew"),
  hebrew: () => hebrewArithmeticModel,
  indian: () => indianArithmeticModel,
};

function modelFor(kind: string, calendar: string): ArithmeticModel {
  return kind === "read" ? readArithmeticModel(calendar) : models[kind]();
}

function durationString(fields: DateDurationFields): string {
  return Temporal.Duration.from(fields).toString();
}

const date = (iso: string) => Temporal.PlainDate.from(iso);

describe("compareMonthCodes", () => {
  it.each`
    a         | b         | sign  | reason
    ${"M05"}  | ${"M05L"} | ${-1} | ${"a leap month follows its base month"}
    ${"M05L"} | ${"M06"}  | ${-1} | ${"and precedes the next month"}
    ${"M12"}  | ${"M02"}  | ${1}  | ${"by number"}
    ${"M07"}  | ${"M07"}  | ${0}  | ${"equal"}
  `("compares $a with $b as $sign ($reason)", ({ a, b, sign }) => {
    expect(Math.sign(compareMonthCodes(a, b))).toBe(sign);
  });

  it("throws RangeError for a malformed month code", () => {
    expect(() => compareMonthCodes("5", "M05")).toThrow(RangeError);
  });
});

describe("nonIsoDateUntil", () => {
  it.each`
    kind        | calendar           | one                | two                | largestUnit | expected     | source
    ${"read"}   | ${"buddhist"}      | ${"2023-08-31"}    | ${"2023-09-30"}    | ${"month"}  | ${"P30D"}    | ${"D6 (grid)"}
    ${"read"}   | ${"japanese"}      | ${"2023-09-30"}    | ${"2023-08-31"}    | ${"year"}   | ${"-P30D"}   | ${"D6 negated (grid reverse)"}
    ${"read"}   | ${"ethioaa"}       | ${"2023-08-13"}    | ${"2023-09-11"}    | ${"month"}  | ${"P29D"}    | ${"D6 into Pagumen (grid)"}
    ${"read"}   | ${"hebrew"}        | ${"2024-02-11"}    | ${"2025-03-01"}    | ${"year"}   | ${"P12M29D"} | ${"D7 (grid)"}
    ${"read"}   | ${"hebrew"}        | ${"+275760-07-06"} | ${"+275760-09-13"} | ${"month"}  | ${"P2M10D"}  | ${"D1 to the maximum (xscan max[69])"}
    ${"read"}   | ${"ethioaa"}       | ${"+275760-06-24"} | ${"+275760-09-13"} | ${"month"}  | ${"P2M21D"}  | ${"D1 to the maximum (xscan max[81])"}
    ${"read"}   | ${"islamic-civil"} | ${"-271821-04-19"} | ${"-271821-06-03"} | ${"month"}  | ${"P1M15D"}  | ${"D1 from the minimum (xscan min[45])"}
    ${"read"}   | ${"persian"}       | ${"-271821-04-19"} | ${"-271820-05-23"} | ${"month"}  | ${"P13M4D"}  | ${"D1 from the minimum (xscan persian min[400])"}
    ${"hebrew"} | ${"hebrew"}        | ${"-271818-01-13"} | ${"-271817-02-17"} | ${"year"}   | ${"P1Y15D"}  | ${"D3/D4 (xscan stride k=0)"}
    ${"hebrew"} | ${"hebrew"}        | ${"-271821-04-19"} | ${"-271820-05-23"} | ${"month"}  | ${"P13M17D"} | ${"D3/D4 from the minimum (xscan min[400])"}
    ${"hebrew"} | ${"hebrew"}        | ${"2024-02-11"}    | ${"2025-03-01"}    | ${"year"}   | ${"P12M29D"} | ${"the owned model agrees at modern dates (grid)"}
    ${"indian"} | ${"indian"}        | ${"-271818-01-13"} | ${"-271817-02-17"} | ${"year"}   | ${"P1Y1M5D"} | ${"D5 (xscan stride k=0)"}
    ${"indian"} | ${"indian"}        | ${"2023-09-22"}    | ${"2023-10-22"}    | ${"month"}  | ${"P30D"}    | ${"the owned model agrees at modern dates (grid)"}
  `(
    "is $expected from $one to $two in $calendar by $largestUnit over the $kind model ($source)",
    ({ kind, calendar, one, two, largestUnit, expected }) => {
      expect(
        durationString(
          nonIsoDateUntil(
            modelFor(kind, calendar),
            date(one),
            date(two),
            largestUnit,
          ),
        ),
      ).toBe(expected);
    },
  );
});

describe("isNonIsoDateUntilResult", () => {
  it.each`
    candidate                                      | accepted | reason
    ${{ years: 0, months: 0, weeks: 0, days: 30 }} | ${true}  | ${"the spec answer"}
    ${{ years: 0, months: 1, weeks: 0, days: 0 }}  | ${false} | ${"polyfill 0.5.1's D6 answer: Aug 31 + 1 month surpasses Sep 30"}
    ${{ years: 0, months: 0, weeks: 0, days: 29 }} | ${false} | ${"one day short"}
    ${{ years: 0, months: 0, weeks: 1, days: 23 }} | ${false} | ${"weeks never come from a month difference"}
  `(
    "accepts $candidate for buddhist 2023-08-31 to 2023-09-30 as $accepted ($reason)",
    ({ candidate, accepted }) => {
      expect(
        isNonIsoDateUntilResult(
          readArithmeticModel("buddhist"),
          date("2023-08-31"),
          date("2023-09-30"),
          "month",
          candidate,
        ),
      ).toBe(accepted);
    },
  );
});

describe("nonIsoDateAdd", () => {
  it.each`
    kind        | calendar           | start              | duration                                       | overflow       | expected           | source
    ${"read"}   | ${"buddhist"}      | ${"+275759-09-13"} | ${{ years: 1, months: 0, weeks: 0, days: 0 }}  | ${"constrain"} | ${"+275760-09-13"} | ${"D1 (xscan buddhist max[366])"}
    ${"read"}   | ${"islamic-civil"} | ${"-271820-05-23"} | ${{ years: -1, months: 0, weeks: 0, days: 0 }} | ${"constrain"} | ${"-271821-06-03"} | ${"D1 (xscan min[400])"}
    ${"read"}   | ${"islamic-civil"} | ${"-271821-06-26"} | ${{ years: 0, months: 1, weeks: 0, days: 0 }}  | ${"constrain"} | ${"-271821-07-25"} | ${"D1 isolated window (xscan min[68])"}
    ${"read"}   | ${"hebrew"}        | ${"+275760-08-15"} | ${{ years: 0, months: 1, weeks: 0, days: 0 }}  | ${"constrain"} | ${"+275760-09-13"} | ${"lands on the maximum (xscan max[29])"}
    ${"read"}   | ${"ethioaa"}       | ${"2023-08-06"}    | ${{ years: 0, months: 2, weeks: 1, days: 1 }}  | ${"constrain"} | ${"2023-09-19"}    | ${"Hamle 30 + 2 months constrains to Pagumen 6 (2023-09-11), then 8 days"}
    ${"hebrew"} | ${"hebrew"}        | ${"-270450-11-13"} | ${{ years: 1, months: 0, weeks: 0, days: 0 }}  | ${"constrain"} | ${"-270449-12-03"} | ${"D3/D4 M05L -> M06 (xscan stride k=5)"}
    ${"hebrew"} | ${"hebrew"}        | ${"-271821-05-29"} | ${{ years: 1, months: 0, weeks: 0, days: 0 }}  | ${"constrain"} | ${"-271820-06-15"} | ${"D3/D4 (xscan min[40])"}
    ${"indian"} | ${"indian"}        | ${"-271818-01-13"} | ${{ years: 0, months: 1, weeks: 0, days: 0 }}  | ${"constrain"} | ${"-271818-02-12"} | ${"D5 (xscan stride k=0)"}
    ${"indian"} | ${"indian"}        | ${"-271821-04-19"} | ${{ years: 1, months: 0, weeks: 0, days: 0 }}  | ${"constrain"} | ${"-271820-04-18"} | ${"D5 from the minimum (xscan min[0])"}
  `(
    "adds $duration to $start in $calendar over the $kind model: $expected ($source)",
    ({ kind, calendar, start, duration, overflow, expected }) => {
      expect(
        nonIsoDateAdd(
          modelFor(kind, calendar),
          date(start),
          duration,
          overflow,
        ).toString(),
      ).toBe(expected);
    },
  );

  it.each`
    kind        | calendar           | start              | duration                                          | overflow       | reason
    ${"read"}   | ${"hebrew"}        | ${"+275760-08-16"} | ${{ years: 0, months: 1, weeks: 0, days: 0 }}     | ${"constrain"} | ${"one day past the maximum (xscan max[28] ERR): never clamped"}
    ${"read"}   | ${"islamic-civil"} | ${"-271821-04-28"} | ${{ years: 0, months: -1, weeks: 0, days: 0 }}    | ${"constrain"} | ${"before the minimum (xscan min[9] ERR)"}
    ${"read"}   | ${"hebrew"}        | ${"2024-02-11"}    | ${{ years: 1, months: 0, weeks: 0, days: 0 }}     | ${"reject"}    | ${"Adar I 5784 has no month in common 5785 (spec ConstrainMonthCode reject)"}
    ${"hebrew"} | ${"hebrew"}        | ${"-270450-11-13"} | ${{ years: 1, months: 0, weeks: 0, days: 0 }}     | ${"reject"}    | ${"the same rejection in the owned model"}
    ${"indian"} | ${"indian"}        | ${"-271818-01-13"} | ${{ years: 0, months: 0, weeks: 0, days: -1100 }} | ${"constrain"} | ${"1100 days back is before the minimum, 999 days earlier"}
  `(
    "throws RangeError adding $duration to $start in $calendar ($reason)",
    ({ kind, calendar, start, duration, overflow }) => {
      expect(() =>
        nonIsoDateAdd(
          modelFor(kind, calendar),
          date(start),
          duration,
          overflow,
        ),
      ).toThrow(RangeError);
    },
  );
});
