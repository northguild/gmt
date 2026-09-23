import { intervalAbutsDate } from "./intervalAbutsDate";
import { intervalAbutsDateTime } from "./intervalAbutsDateTime";
import { intervalAbutsTime } from "./intervalAbutsTime";
import { intervalContainsDate } from "./intervalContainsDate";
import { intervalContainsDateTime } from "./intervalContainsDateTime";
import { intervalContainsTime } from "./intervalContainsTime";
import { intervalCountDate } from "./intervalCountDate";
import { intervalCountDateTime } from "./intervalCountDateTime";
import { intervalCountTime } from "./intervalCountTime";
import { intervalDifferenceDate } from "./intervalDifferenceDate";
import { intervalDifferenceDateTime } from "./intervalDifferenceDateTime";
import { intervalDifferenceTime } from "./intervalDifferenceTime";
import { intervalDivideEquallyDate } from "./intervalDivideEquallyDate";
import { intervalDivideEquallyDateTime } from "./intervalDivideEquallyDateTime";
import { intervalDivideEquallyTime } from "./intervalDivideEquallyTime";
import { intervalEngulfsDate } from "./intervalEngulfsDate";
import { intervalEngulfsDateTime } from "./intervalEngulfsDateTime";
import { intervalEngulfsTime } from "./intervalEngulfsTime";
import { intervalFromDurationDate } from "./intervalFromDurationDate";
import { intervalFromDurationDateTime } from "./intervalFromDurationDateTime";
import { intervalFromDurationTime } from "./intervalFromDurationTime";
import { intervalIntersectionDate } from "./intervalIntersectionDate";
import { intervalIntersectionDateTime } from "./intervalIntersectionDateTime";
import { intervalIntersectionTime } from "./intervalIntersectionTime";
import { intervalLengthDate } from "./intervalLengthDate";
import { intervalLengthDateTime } from "./intervalLengthDateTime";
import { intervalLengthTime } from "./intervalLengthTime";
import { intervalOverlappingDaysDate } from "./intervalOverlappingDaysDate";
import { intervalOverlappingDaysDateTime } from "./intervalOverlappingDaysDateTime";
import { intervalSplitAtDate } from "./intervalSplitAtDate";
import { intervalSplitAtDateTime } from "./intervalSplitAtDateTime";
import { intervalSplitAtTime } from "./intervalSplitAtTime";
import { intervalUnionDate } from "./intervalUnionDate";
import { intervalUnionDateTime } from "./intervalUnionDateTime";
import { intervalUnionTime } from "./intervalUnionTime";
import { intervalXorAllDate } from "./intervalXorAllDate";
import { intervalXorAllDateTime } from "./intervalXorAllDateTime";
import { intervalXorAllTime } from "./intervalXorAllTime";
import { intervalXorDate } from "./intervalXorDate";
import { intervalXorDateTime } from "./intervalXorDateTime";
import { intervalXorTime } from "./intervalXorTime";
import { intervalsOverlapDate } from "./intervalsOverlapDate";
import { intervalsOverlapDateTime } from "./intervalsOverlapDateTime";
import { intervalsOverlapTime } from "./intervalsOverlapTime";
import { mergeIntervalsDate } from "./mergeIntervalsDate";
import { mergeIntervalsDateTime } from "./mergeIntervalsDateTime";
import { mergeIntervalsTime } from "./mergeIntervalsTime";
import { splitIntervalByUnitDate } from "./splitIntervalByUnitDate";
import { splitIntervalByUnitDateTime } from "./splitIntervalByUnitDateTime";
import { splitIntervalByUnitTime } from "./splitIntervalByUnitTime";
import {
  isValidDateInterval,
  isValidDateTimeInterval,
  isValidTimeInterval,
} from "./validate";

// Validator mirror (#22) — an interval endpoint accepts exactly what the single-value
// validator accepts (`isValidDate`/`isValidCalendarDate`, `isValidDateTime`, `isValidTime`), so
// the annotation rules are tested once as a policy over every plain interval function rather than
// re-stated in 50 files. Temporal's ISO grammar (proposal-temporal `ParseISODateTime`; RFC 9557
// §3.3): an elective annotation (`[foo=bar]`) and a time zone annotation on a plain value
// (`[Europe/Paris]`) are read and ignored, `[u-ca=iso8601]` names the ISO calendar, and an unknown
// critical annotation (`[!foo=bar]`) is rejected. Native Temporal (Chromium 153) reads
// `09:00[u-ca=iso8601]`, `09:00[foo=bar]` and `09:00[UTC]` as 09:00:00, and
// `2024-01-01T09:00[foo=bar]` / `[Europe/Paris]` as 2024-01-01T09:00:00 in iso8601; it throws a
// RangeError for `[!foo=bar]`. So each accepted row's expected value is the unannotated inputs'
// value (the JSDoc example values of each function), and outputs are Temporal's canonical strings,
// annotation dropped.
const ICA = "[u-ca=iso8601]";
const EL = "[foo=bar]";
const TZ = "[Europe/Paris]";
const CRIT = "[!foo=bar]";

describe("plain Time intervals: annotations Temporal ignores are accepted", () => {
  it.each`
    name                           | call                                                                                                                          | expected
    ${"isValidTimeInterval"}       | ${() => isValidTimeInterval(`09:00:00${ICA}`, `17:00:00${EL}`)}                                                               | ${true}
    ${"intervalAbutsTime"}         | ${() => intervalAbutsTime(`09:00:00${ICA}`, `12:00:00${EL}`, `12:00:00${TZ}`, "17:00:00")}                                    | ${true}
    ${"intervalContainsTime"}      | ${() => intervalContainsTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`)}                                             | ${true}
    ${"intervalContainsTime (4)"}  | ${() => intervalContainsTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, `13:00:00${ICA}`)}                           | ${true}
    ${"intervalCountTime"}         | ${() => intervalCountTime(`12:00:00${ICA}`, `14:00:00${EL}`, "hour")}                                                         | ${2}
    ${"intervalDifferenceTime"}    | ${() => intervalDifferenceTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, "13:00:00")}                               | ${[{ start: "09:00:00", end: "12:00:00" }, { start: "13:00:00", end: "17:00:00" }]}
    ${"intervalDivideEquallyTime"} | ${() => intervalDivideEquallyTime(`09:00:00${ICA}`, `13:00:00${EL}`, 2)}                                                      | ${[{ start: "09:00:00", end: "11:00:00" }, { start: "11:00:00", end: "13:00:00" }]}
    ${"intervalEngulfsTime"}       | ${() => intervalEngulfsTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, "13:00:00")}                                  | ${true}
    ${"intervalFromDurationTime"}  | ${() => intervalFromDurationTime(`12:00:00${ICA}`, "PT1H", "start")}                                                          | ${{ start: "12:00:00", end: "13:00:00" }}
    ${"intervalIntersectionTime"}  | ${() => intervalIntersectionTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, "18:00:00")}                             | ${{ start: "12:00:00", end: "17:00:00" }}
    ${"intervalLengthTime"}        | ${() => intervalLengthTime(`12:00:00${ICA}`, `14:30:00${EL}`, "hour")}                                                        | ${2.5}
    ${"intervalSplitAtTime"}       | ${() => intervalSplitAtTime(`09:00:00${ICA}`, `17:00:00${EL}`, [`12:00:00${TZ}`])}                                            | ${[{ start: "09:00:00", end: "12:00:00" }, { start: "12:00:00", end: "17:00:00" }]}
    ${"intervalUnionTime"}         | ${() => intervalUnionTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, "18:00:00")}                                    | ${{ start: "09:00:00", end: "18:00:00" }}
    ${"intervalXorAllTime"}        | ${() => intervalXorAllTime([{ start: `09:00:00${ICA}`, end: `12:00:00${EL}` }, { start: `11:00:00${TZ}`, end: "15:00:00" }])} | ${[{ start: "09:00:00", end: "11:00:00" }, { start: "12:00:00", end: "15:00:00" }]}
    ${"intervalXorTime"}           | ${() => intervalXorTime(`09:00:00${ICA}`, `12:00:00${EL}`, `11:00:00${TZ}`, "17:00:00")}                                      | ${[{ start: "09:00:00", end: "11:00:00" }, { start: "12:00:00", end: "17:00:00" }]}
    ${"intervalsOverlapTime"}      | ${() => intervalsOverlapTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, "18:00:00")}                                 | ${true}
    ${"mergeIntervalsTime"}        | ${() => mergeIntervalsTime([{ start: `09:00:00${ICA}`, end: `12:00:00${EL}` }, { start: `12:00:00${TZ}`, end: "15:00:00" }])} | ${[{ start: "09:00:00", end: "15:00:00" }]}
    ${"splitIntervalByUnitTime"}   | ${() => splitIntervalByUnitTime(`12:00:00${ICA}`, `14:00:00${EL}`, "hour", 1)}                                                | ${[{ start: "12:00:00", end: "13:00:00" }, { start: "13:00:00", end: "14:00:00" }]}
  `(
    "$name reads annotated endpoints as their unannotated times and returns $expected",
    ({ call, expected }) => {
      expect((call as () => unknown)()).toEqual(expected);
    },
  );

  it.each`
    name                           | call                                                                                                                 | sentinel
    ${"isValidTimeInterval"}       | ${() => isValidTimeInterval(`09:00:00${CRIT}`, "17:00:00")}                                                          | ${false}
    ${"intervalAbutsTime"}         | ${() => intervalAbutsTime("09:00:00", "12:00:00", "12:00:00", `17:00:00${CRIT}`)}                                    | ${false}
    ${"intervalContainsTime"}      | ${() => intervalContainsTime("09:00:00", "17:00:00", `12:00:00${CRIT}`)}                                             | ${false}
    ${"intervalContainsTime (4)"}  | ${() => intervalContainsTime("09:00:00", "17:00:00", "12:00:00", `13:00:00${CRIT}`)}                                 | ${false}
    ${"intervalCountTime"}         | ${() => intervalCountTime("12:00:00", `14:00:00${CRIT}`, "hour")}                                                    | ${null}
    ${"intervalDifferenceTime"}    | ${() => intervalDifferenceTime("09:00:00", "17:00:00", `12:00:00${CRIT}`, "13:00:00")}                               | ${[]}
    ${"intervalDivideEquallyTime"} | ${() => intervalDivideEquallyTime(`09:00:00${CRIT}`, "13:00:00", 2)}                                                 | ${[]}
    ${"intervalEngulfsTime"}       | ${() => intervalEngulfsTime("09:00:00", "17:00:00", "12:00:00", `13:00:00${CRIT}`)}                                  | ${false}
    ${"intervalFromDurationTime"}  | ${() => intervalFromDurationTime(`12:00:00${CRIT}`, "PT1H", "start")}                                                | ${null}
    ${"intervalIntersectionTime"}  | ${() => intervalIntersectionTime("09:00:00", "17:00:00", "12:00:00", `18:00:00${CRIT}`)}                             | ${null}
    ${"intervalLengthTime"}        | ${() => intervalLengthTime(`12:00:00${CRIT}`, "14:30:00", "hour")}                                                   | ${null}
    ${"intervalSplitAtTime"}       | ${() => intervalSplitAtTime("09:00:00", "17:00:00", [`12:00:00${CRIT}`])}                                            | ${[]}
    ${"intervalUnionTime"}         | ${() => intervalUnionTime("09:00:00", "17:00:00", "12:00:00", `18:00:00${CRIT}`)}                                    | ${null}
    ${"intervalXorAllTime"}        | ${() => intervalXorAllTime([{ start: "09:00:00", end: "12:00:00" }, { start: `11:00:00${CRIT}`, end: "15:00:00" }])} | ${[]}
    ${"intervalXorTime"}           | ${() => intervalXorTime("09:00:00", "12:00:00", "11:00:00", `17:00:00${CRIT}`)}                                      | ${[]}
    ${"intervalsOverlapTime"}      | ${() => intervalsOverlapTime("09:00:00", "17:00:00", `12:00:00${CRIT}`, "18:00:00")}                                 | ${false}
    ${"mergeIntervalsTime"}        | ${() => mergeIntervalsTime([{ start: "09:00:00", end: "12:00:00" }, { start: "12:00:00", end: `15:00:00${CRIT}` }])} | ${[]}
    ${"splitIntervalByUnitTime"}   | ${() => splitIntervalByUnitTime("12:00:00", `14:00:00${CRIT}`, "hour", 1)}                                           | ${[]}
  `(
    "$name returns $sentinel for an unknown critical annotation",
    ({ call, sentinel }) => {
      expect((call as () => unknown)()).toEqual(sentinel);
    },
  );
});

describe("plain DateTime intervals: annotations Temporal ignores are accepted, non-ISO calendars are not", () => {
  const d = (time: string, annotation = "") =>
    `2024-01-01T${time}${annotation}`;

  it.each`
    name                                 | call                                                                                                                                       | expected
    ${"isValidDateTimeInterval"}         | ${() => isValidDateTimeInterval(d("09:00:00", ICA), d("17:00:00", EL))}                                                                    | ${true}
    ${"intervalAbutsDateTime"}           | ${() => intervalAbutsDateTime(d("09:00:00", ICA), d("12:00:00", EL), d("12:00:00", TZ), d("17:00:00"))}                                    | ${true}
    ${"intervalContainsDateTime"}        | ${() => intervalContainsDateTime(d("09:00:00", ICA), d("17:00:00", EL), d("12:00:00", TZ))}                                                | ${true}
    ${"intervalContainsDateTime (4)"}    | ${() => intervalContainsDateTime(d("09:00:00", ICA), d("17:00:00", EL), d("12:00:00", TZ), d("13:00:00", ICA))}                            | ${true}
    ${"intervalCountDateTime"}           | ${() => intervalCountDateTime(d("23:59:00", ICA), `2024-01-02T00:01:00${EL}`, "day")}                                                      | ${2}
    ${"intervalDifferenceDateTime"}      | ${() => intervalDifferenceDateTime(d("09:00:00", ICA), d("17:00:00", EL), d("12:00:00", TZ), d("13:00:00"))}                               | ${[{ start: d("09:00:00"), end: d("12:00:00") }, { start: d("13:00:00"), end: d("17:00:00") }]}
    ${"intervalDivideEquallyDateTime"}   | ${() => intervalDivideEquallyDateTime(d("09:00:00", ICA), d("13:00:00", EL), 2)}                                                           | ${[{ start: d("09:00:00"), end: d("11:00:00") }, { start: d("11:00:00"), end: d("13:00:00") }]}
    ${"intervalEngulfsDateTime"}         | ${() => intervalEngulfsDateTime(d("09:00:00", ICA), d("17:00:00", EL), d("12:00:00", TZ), d("13:00:00"))}                                  | ${true}
    ${"intervalFromDurationDateTime"}    | ${() => intervalFromDurationDateTime(d("00:00:00", ICA), "P1DT2H", "start")}                                                               | ${{ start: d("00:00:00"), end: "2024-01-02T02:00:00" }}
    ${"intervalIntersectionDateTime"}    | ${() => intervalIntersectionDateTime(d("09:00:00", ICA), d("13:00:00", EL), d("12:00:00", TZ), d("17:00:00"))}                             | ${{ start: d("12:00:00"), end: d("13:00:00") }}
    ${"intervalLengthDateTime"}          | ${() => intervalLengthDateTime(d("12:00:00", ICA), d("14:30:00", EL), "hour")}                                                             | ${2.5}
    ${"intervalOverlappingDaysDateTime"} | ${() => intervalOverlappingDaysDateTime(d("23:59:00", ICA), `2024-01-02T00:01:00${EL}`, d("23:59:00", TZ), "2024-01-02T00:01:00")}         | ${2}
    ${"intervalSplitAtDateTime"}         | ${() => intervalSplitAtDateTime(d("09:00:00", ICA), d("17:00:00", EL), [d("12:00:00", TZ)])}                                               | ${[{ start: d("09:00:00"), end: d("12:00:00") }, { start: d("12:00:00"), end: d("17:00:00") }]}
    ${"intervalUnionDateTime"}           | ${() => intervalUnionDateTime(d("09:00:00", ICA), d("13:00:00", EL), d("12:00:00", TZ), d("17:00:00"))}                                    | ${{ start: d("09:00:00"), end: d("17:00:00") }}
    ${"intervalXorAllDateTime"}          | ${() => intervalXorAllDateTime([{ start: d("09:00:00", ICA), end: d("12:00:00", EL) }, { start: d("11:00:00", TZ), end: d("15:00:00") }])} | ${[{ start: d("09:00:00"), end: d("11:00:00") }, { start: d("12:00:00"), end: d("15:00:00") }]}
    ${"intervalXorDateTime"}             | ${() => intervalXorDateTime(d("09:00:00", ICA), d("13:00:00", EL), d("12:00:00", TZ), d("17:00:00"))}                                      | ${[{ start: d("09:00:00"), end: d("12:00:00") }, { start: d("13:00:00"), end: d("17:00:00") }]}
    ${"intervalsOverlapDateTime"}        | ${() => intervalsOverlapDateTime(d("09:00:00", ICA), d("13:00:00", EL), d("12:00:00", TZ), d("17:00:00"))}                                 | ${true}
    ${"mergeIntervalsDateTime"}          | ${() => mergeIntervalsDateTime([{ start: d("09:00:00", ICA), end: d("12:00:00", EL) }, { start: d("12:00:00", TZ), end: d("15:00:00") }])} | ${[{ start: d("09:00:00"), end: d("15:00:00") }]}
    ${"splitIntervalByUnitDateTime"}     | ${() => splitIntervalByUnitDateTime(d("12:00:00", ICA), d("14:00:00", EL), "hour", 1)}                                                     | ${[{ start: d("12:00:00"), end: d("13:00:00") }, { start: d("13:00:00"), end: d("14:00:00") }]}
  `(
    "$name reads annotated endpoints as their unannotated date-times and returns $expected",
    ({ call, expected }) => {
      expect((call as () => unknown)()).toEqual(expected);
    },
  );

  // Each row carries one rejected annotation: an unknown critical one (Temporal throws), or a
  // non-ISO calendar, which `isValidDateTime` rejects because GMT's PlainDateTime is ISO-only.
  it.each`
    name                                 | annotation         | call                                                                                                                                      | sentinel
    ${"isValidDateTimeInterval"}         | ${CRIT}            | ${(a: string) => isValidDateTimeInterval(d("09:00:00", a), d("17:00:00"))}                                                                | ${false}
    ${"isValidDateTimeInterval"}         | ${"[u-ca=hebrew]"} | ${(a: string) => isValidDateTimeInterval(d("09:00:00"), d("17:00:00", a))}                                                                | ${false}
    ${"intervalAbutsDateTime"}           | ${CRIT}            | ${(a: string) => intervalAbutsDateTime(d("09:00:00"), d("12:00:00"), d("12:00:00"), d("17:00:00", a))}                                    | ${false}
    ${"intervalContainsDateTime"}        | ${CRIT}            | ${(a: string) => intervalContainsDateTime(d("09:00:00"), d("17:00:00"), d("12:00:00", a))}                                                | ${false}
    ${"intervalContainsDateTime (4)"}    | ${"[u-ca=hebrew]"} | ${(a: string) => intervalContainsDateTime(d("09:00:00"), d("17:00:00"), d("12:00:00"), d("13:00:00", a))}                                 | ${false}
    ${"intervalCountDateTime"}           | ${CRIT}            | ${(a: string) => intervalCountDateTime(d("23:59:00"), `2024-01-02T00:01:00${a}`, "day")}                                                  | ${null}
    ${"intervalDifferenceDateTime"}      | ${"[u-ca=hebrew]"} | ${(a: string) => intervalDifferenceDateTime(d("09:00:00"), d("17:00:00"), d("12:00:00", a), d("13:00:00"))}                               | ${[]}
    ${"intervalDivideEquallyDateTime"}   | ${CRIT}            | ${(a: string) => intervalDivideEquallyDateTime(d("09:00:00", a), d("13:00:00"), 2)}                                                       | ${[]}
    ${"intervalEngulfsDateTime"}         | ${CRIT}            | ${(a: string) => intervalEngulfsDateTime(d("09:00:00"), d("17:00:00"), d("12:00:00"), d("13:00:00", a))}                                  | ${false}
    ${"intervalFromDurationDateTime"}    | ${"[u-ca=hebrew]"} | ${(a: string) => intervalFromDurationDateTime(d("00:00:00", a), "P1DT2H", "start")}                                                       | ${null}
    ${"intervalIntersectionDateTime"}    | ${CRIT}            | ${(a: string) => intervalIntersectionDateTime(d("09:00:00"), d("13:00:00"), d("12:00:00"), d("17:00:00", a))}                             | ${null}
    ${"intervalLengthDateTime"}          | ${CRIT}            | ${(a: string) => intervalLengthDateTime(d("12:00:00", a), d("14:30:00"), "hour")}                                                         | ${null}
    ${"intervalOverlappingDaysDateTime"} | ${CRIT}            | ${(a: string) => intervalOverlappingDaysDateTime(d("23:59:00"), "2024-01-02T00:01:00", d("23:59:00", a), "2024-01-02T00:01:00")}          | ${null}
    ${"intervalSplitAtDateTime"}         | ${"[u-ca=hebrew]"} | ${(a: string) => intervalSplitAtDateTime(d("09:00:00"), d("17:00:00"), [d("12:00:00", a)])}                                               | ${[]}
    ${"intervalUnionDateTime"}           | ${CRIT}            | ${(a: string) => intervalUnionDateTime(d("09:00:00"), d("13:00:00"), d("12:00:00"), d("17:00:00", a))}                                    | ${null}
    ${"intervalXorAllDateTime"}          | ${CRIT}            | ${(a: string) => intervalXorAllDateTime([{ start: d("09:00:00"), end: d("12:00:00") }, { start: d("11:00:00", a), end: d("15:00:00") }])} | ${[]}
    ${"intervalXorDateTime"}             | ${CRIT}            | ${(a: string) => intervalXorDateTime(d("09:00:00"), d("13:00:00"), d("12:00:00", a), d("17:00:00"))}                                      | ${[]}
    ${"intervalsOverlapDateTime"}        | ${"[u-ca=hebrew]"} | ${(a: string) => intervalsOverlapDateTime(d("09:00:00", a), d("13:00:00"), d("12:00:00"), d("17:00:00"))}                                 | ${false}
    ${"mergeIntervalsDateTime"}          | ${CRIT}            | ${(a: string) => mergeIntervalsDateTime([{ start: d("09:00:00"), end: d("12:00:00") }, { start: d("12:00:00"), end: d("15:00:00", a) }])} | ${[]}
    ${"splitIntervalByUnitDateTime"}     | ${CRIT}            | ${(a: string) => splitIntervalByUnitDateTime(d("12:00:00"), d("14:00:00", a), "hour", 1)}                                                 | ${[]}
  `(
    "$name returns $sentinel for an endpoint annotated $annotation",
    ({ annotation, call, sentinel }) => {
      expect((call as (a: string) => unknown)(annotation)).toEqual(sentinel);
    },
  );
});

describe("plain Date intervals: annotations Temporal ignores are accepted", () => {
  it.each`
    name                             | call                                                                                                                                  | expected
    ${"isValidDateInterval"}         | ${() => isValidDateInterval(`2024-01-01${ICA}`, `2024-12-31${EL}`)}                                                                   | ${true}
    ${"intervalAbutsDate"}           | ${() => intervalAbutsDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-06-30${TZ}`, "2024-12-31")}                                    | ${true}
    ${"intervalContainsDate"}        | ${() => intervalContainsDate(`2024-01-01${ICA}`, `2024-12-31${EL}`, `2024-06-15${TZ}`)}                                               | ${true}
    ${"intervalCountDate"}           | ${() => intervalCountDate(`2024-01-01${ICA}`, `2024-01-03${EL}`, "day")}                                                              | ${2}
    ${"intervalDifferenceDate"}      | ${() => intervalDifferenceDate(`2024-01-01${ICA}`, `2024-12-31${EL}`, `2024-06-01${TZ}`, "2024-07-01")}                               | ${[{ start: "2024-01-01", end: "2024-06-01" }, { start: "2024-07-01", end: "2024-12-31" }]}
    ${"intervalDivideEquallyDate"}   | ${() => intervalDivideEquallyDate(`2024-01-01${ICA}`, `2024-01-03${EL}`, 2)}                                                          | ${[{ start: "2024-01-01", end: "2024-01-02" }, { start: "2024-01-02", end: "2024-01-03" }]}
    ${"intervalEngulfsDate"}         | ${() => intervalEngulfsDate(`2024-01-01${ICA}`, `2024-12-31${EL}`, `2024-06-01${TZ}`, "2024-07-01")}                                  | ${true}
    ${"intervalFromDurationDate"}    | ${() => intervalFromDurationDate(`2024-01-01${ICA}`, "P1M", "start")}                                                                 | ${{ start: "2024-01-01", end: "2024-02-01" }}
    ${"intervalIntersectionDate"}    | ${() => intervalIntersectionDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-04-01${TZ}`, "2024-12-31")}                             | ${{ start: "2024-04-01", end: "2024-06-30" }}
    ${"intervalLengthDate"}          | ${() => intervalLengthDate(`2024-01-01${ICA}`, `2024-01-03${EL}`, "day")}                                                             | ${2}
    ${"intervalOverlappingDaysDate"} | ${() => intervalOverlappingDaysDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-04-01${TZ}`, "2024-12-31")}                          | ${90}
    ${"intervalSplitAtDate"}         | ${() => intervalSplitAtDate(`2024-01-01${ICA}`, `2024-01-10${EL}`, [`2024-01-05${TZ}`])}                                              | ${[{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-10" }]}
    ${"intervalUnionDate"}           | ${() => intervalUnionDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-04-01${TZ}`, "2024-12-31")}                                    | ${{ start: "2024-01-01", end: "2024-12-31" }}
    ${"intervalXorAllDate"}          | ${() => intervalXorAllDate([{ start: `2024-01-01${ICA}`, end: `2024-01-10${EL}` }, { start: `2024-01-05${TZ}`, end: "2024-01-15" }])} | ${[{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-10", end: "2024-01-15" }]}
    ${"intervalXorDate"}             | ${() => intervalXorDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-04-01${TZ}`, "2024-12-31")}                                      | ${[{ start: "2024-01-01", end: "2024-04-01" }, { start: "2024-06-30", end: "2024-12-31" }]}
    ${"intervalsOverlapDate"}        | ${() => intervalsOverlapDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-04-01${TZ}`, "2024-12-31")}                                 | ${true}
    ${"mergeIntervalsDate"}          | ${() => mergeIntervalsDate([{ start: `2024-01-01${ICA}`, end: `2024-01-10${EL}` }, { start: `2024-01-05${TZ}`, end: "2024-01-15" }])} | ${[{ start: "2024-01-01", end: "2024-01-15" }]}
    ${"splitIntervalByUnitDate"}     | ${() => splitIntervalByUnitDate(`2024-01-01${ICA}`, `2024-01-05${EL}`, "day", 2)}                                                     | ${[{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-05" }]}
  `(
    "$name reads annotated endpoints as their unannotated dates and returns $expected",
    ({ call, expected }) => {
      expect((call as () => unknown)()).toEqual(expected);
    },
  );

  it.each`
    name                         | call                                                                                         | sentinel
    ${"isValidDateInterval"}     | ${() => isValidDateInterval(`2024-01-01${CRIT}`, "2024-12-31")}                              | ${false}
    ${"intervalsOverlapDate"}    | ${() => intervalsOverlapDate("2024-01-01", "2024-06-30", `2024-04-01${CRIT}`, "2024-12-31")} | ${false}
    ${"intervalUnionDate"}       | ${() => intervalUnionDate("2024-01-01", "2024-06-30", "2024-04-01", `2024-12-31${CRIT}`)}    | ${null}
    ${"intervalSplitAtDate"}     | ${() => intervalSplitAtDate("2024-01-01", "2024-01-10", [`2024-01-05${CRIT}`])}              | ${[]}
    ${"splitIntervalByUnitDate"} | ${() => splitIntervalByUnitDate("2024-01-01", `2024-01-05${CRIT}`, "day", 2)}                | ${[]}
  `(
    "$name returns $sentinel for an unknown critical annotation",
    ({ call, sentinel }) => {
      expect((call as () => unknown)()).toEqual(sentinel);
    },
  );
});
