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

// Validator mirror (#22), CORE-113 (#528): an interval endpoint accepts exactly what the single-value
// validator accepts (`isValidDate`, `isValidDateTime`, `isValidTime`), and a plain value matches its
// exact pattern over the whole string, so no annotation of any kind is allowed (zone, `u-ca`, elective
// or critical). Each function is tested once, as a policy, with an annotated endpoint, and returns its
// sentinel.
const ICA = "[u-ca=iso8601]";
const EL = "[foo=bar]";
const TZ = "[Europe/Paris]";
const CRIT = "[!foo=bar]";

describe("plain Time intervals: an annotation is rejected", () => {
  it.each`
    name                           | call                                                                                                                          | expected
    ${"isValidTimeInterval"}       | ${() => isValidTimeInterval(`09:00:00${ICA}`, `17:00:00${EL}`)}                                                               | ${false}
    ${"intervalAbutsTime"}         | ${() => intervalAbutsTime(`09:00:00${ICA}`, `12:00:00${EL}`, `12:00:00${TZ}`, "17:00:00")}                                    | ${false}
    ${"intervalContainsTime"}      | ${() => intervalContainsTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`)}                                             | ${false}
    ${"intervalContainsTime (4)"}  | ${() => intervalContainsTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, `13:00:00${ICA}`)}                           | ${false}
    ${"intervalCountTime"}         | ${() => intervalCountTime(`12:00:00${ICA}`, `14:00:00${EL}`, "hour")}                                                         | ${null}
    ${"intervalDifferenceTime"}    | ${() => intervalDifferenceTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, "13:00:00")}                               | ${[]}
    ${"intervalDivideEquallyTime"} | ${() => intervalDivideEquallyTime(`09:00:00${ICA}`, `13:00:00${EL}`, 2)}                                                      | ${[]}
    ${"intervalEngulfsTime"}       | ${() => intervalEngulfsTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, "13:00:00")}                                  | ${false}
    ${"intervalFromDurationTime"}  | ${() => intervalFromDurationTime(`12:00:00${ICA}`, "PT1H", "start")}                                                          | ${null}
    ${"intervalIntersectionTime"}  | ${() => intervalIntersectionTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, "18:00:00")}                             | ${null}
    ${"intervalLengthTime"}        | ${() => intervalLengthTime(`12:00:00${ICA}`, `14:30:00${EL}`, "hour")}                                                        | ${null}
    ${"intervalSplitAtTime"}       | ${() => intervalSplitAtTime(`09:00:00${ICA}`, `17:00:00${EL}`, [`12:00:00${TZ}`])}                                            | ${[]}
    ${"intervalUnionTime"}         | ${() => intervalUnionTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, "18:00:00")}                                    | ${null}
    ${"intervalXorAllTime"}        | ${() => intervalXorAllTime([{ start: `09:00:00${ICA}`, end: `12:00:00${EL}` }, { start: `11:00:00${TZ}`, end: "15:00:00" }])} | ${[]}
    ${"intervalXorTime"}           | ${() => intervalXorTime(`09:00:00${ICA}`, `12:00:00${EL}`, `11:00:00${TZ}`, "17:00:00")}                                      | ${[]}
    ${"intervalsOverlapTime"}      | ${() => intervalsOverlapTime(`09:00:00${ICA}`, `17:00:00${EL}`, `12:00:00${TZ}`, "18:00:00")}                                 | ${false}
    ${"mergeIntervalsTime"}        | ${() => mergeIntervalsTime([{ start: `09:00:00${ICA}`, end: `12:00:00${EL}` }, { start: `12:00:00${TZ}`, end: "15:00:00" }])} | ${[]}
    ${"splitIntervalByUnitTime"}   | ${() => splitIntervalByUnitTime(`12:00:00${ICA}`, `14:00:00${EL}`, "hour", 1)}                                                | ${[]}
  `(
    "$name returns $expected for an endpoint carrying an annotation",
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

describe("plain DateTime intervals: an annotation is rejected", () => {
  const d = (time: string, annotation = "") =>
    `2024-01-01T${time}${annotation}`;

  it.each`
    name                                 | call                                                                                                                                       | expected
    ${"isValidDateTimeInterval"}         | ${() => isValidDateTimeInterval(d("09:00:00", ICA), d("17:00:00", EL))}                                                                    | ${false}
    ${"intervalAbutsDateTime"}           | ${() => intervalAbutsDateTime(d("09:00:00", ICA), d("12:00:00", EL), d("12:00:00", TZ), d("17:00:00"))}                                    | ${false}
    ${"intervalContainsDateTime"}        | ${() => intervalContainsDateTime(d("09:00:00", ICA), d("17:00:00", EL), d("12:00:00", TZ))}                                                | ${false}
    ${"intervalContainsDateTime (4)"}    | ${() => intervalContainsDateTime(d("09:00:00", ICA), d("17:00:00", EL), d("12:00:00", TZ), d("13:00:00", ICA))}                            | ${false}
    ${"intervalCountDateTime"}           | ${() => intervalCountDateTime(d("23:59:00", ICA), `2024-01-02T00:01:00${EL}`, "day")}                                                      | ${null}
    ${"intervalDifferenceDateTime"}      | ${() => intervalDifferenceDateTime(d("09:00:00", ICA), d("17:00:00", EL), d("12:00:00", TZ), d("13:00:00"))}                               | ${[]}
    ${"intervalDivideEquallyDateTime"}   | ${() => intervalDivideEquallyDateTime(d("09:00:00", ICA), d("13:00:00", EL), 2)}                                                           | ${[]}
    ${"intervalEngulfsDateTime"}         | ${() => intervalEngulfsDateTime(d("09:00:00", ICA), d("17:00:00", EL), d("12:00:00", TZ), d("13:00:00"))}                                  | ${false}
    ${"intervalFromDurationDateTime"}    | ${() => intervalFromDurationDateTime(d("00:00:00", ICA), "P1DT2H", "start")}                                                               | ${null}
    ${"intervalIntersectionDateTime"}    | ${() => intervalIntersectionDateTime(d("09:00:00", ICA), d("13:00:00", EL), d("12:00:00", TZ), d("17:00:00"))}                             | ${null}
    ${"intervalLengthDateTime"}          | ${() => intervalLengthDateTime(d("12:00:00", ICA), d("14:30:00", EL), "hour")}                                                             | ${null}
    ${"intervalOverlappingDaysDateTime"} | ${() => intervalOverlappingDaysDateTime(d("23:59:00", ICA), `2024-01-02T00:01:00${EL}`, d("23:59:00", TZ), "2024-01-02T00:01:00")}         | ${null}
    ${"intervalSplitAtDateTime"}         | ${() => intervalSplitAtDateTime(d("09:00:00", ICA), d("17:00:00", EL), [d("12:00:00", TZ)])}                                               | ${[]}
    ${"intervalUnionDateTime"}           | ${() => intervalUnionDateTime(d("09:00:00", ICA), d("13:00:00", EL), d("12:00:00", TZ), d("17:00:00"))}                                    | ${null}
    ${"intervalXorAllDateTime"}          | ${() => intervalXorAllDateTime([{ start: d("09:00:00", ICA), end: d("12:00:00", EL) }, { start: d("11:00:00", TZ), end: d("15:00:00") }])} | ${[]}
    ${"intervalXorDateTime"}             | ${() => intervalXorDateTime(d("09:00:00", ICA), d("13:00:00", EL), d("12:00:00", TZ), d("17:00:00"))}                                      | ${[]}
    ${"intervalsOverlapDateTime"}        | ${() => intervalsOverlapDateTime(d("09:00:00", ICA), d("13:00:00", EL), d("12:00:00", TZ), d("17:00:00"))}                                 | ${false}
    ${"mergeIntervalsDateTime"}          | ${() => mergeIntervalsDateTime([{ start: d("09:00:00", ICA), end: d("12:00:00", EL) }, { start: d("12:00:00", TZ), end: d("15:00:00") }])} | ${[]}
    ${"splitIntervalByUnitDateTime"}     | ${() => splitIntervalByUnitDateTime(d("12:00:00", ICA), d("14:00:00", EL), "hour", 1)}                                                     | ${[]}
  `(
    "$name returns $expected for an endpoint carrying an annotation",
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

describe("plain Date intervals: an annotation is rejected", () => {
  // `intervalFromDurationDate` is calendar-aware, so it reads a single `u-ca` annotation (`[u-ca=iso8601]`) and
  // drops it from the result; every other annotation is rejected.
  it.each`
    name                             | call                                                                                                                                  | expected
    ${"isValidDateInterval"}         | ${() => isValidDateInterval(`2024-01-01${ICA}`, `2024-12-31${EL}`)}                                                                   | ${false}
    ${"intervalAbutsDate"}           | ${() => intervalAbutsDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-06-30${TZ}`, "2024-12-31")}                                    | ${false}
    ${"intervalContainsDate"}        | ${() => intervalContainsDate(`2024-01-01${ICA}`, `2024-12-31${EL}`, `2024-06-15${TZ}`)}                                               | ${false}
    ${"intervalCountDate"}           | ${() => intervalCountDate(`2024-01-01${ICA}`, `2024-01-03${EL}`, "day")}                                                              | ${null}
    ${"intervalDifferenceDate"}      | ${() => intervalDifferenceDate(`2024-01-01${ICA}`, `2024-12-31${EL}`, `2024-06-01${TZ}`, "2024-07-01")}                               | ${[]}
    ${"intervalDivideEquallyDate"}   | ${() => intervalDivideEquallyDate(`2024-01-01${ICA}`, `2024-01-03${EL}`, 2)}                                                          | ${[]}
    ${"intervalEngulfsDate"}         | ${() => intervalEngulfsDate(`2024-01-01${ICA}`, `2024-12-31${EL}`, `2024-06-01${TZ}`, "2024-07-01")}                                  | ${false}
    ${"intervalFromDurationDate"}    | ${() => intervalFromDurationDate(`2024-01-01${ICA}`, "P1M", "start")}                                                                 | ${{ start: "2024-01-01", end: "2024-02-01" }}
    ${"intervalIntersectionDate"}    | ${() => intervalIntersectionDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-04-01${TZ}`, "2024-12-31")}                             | ${null}
    ${"intervalLengthDate"}          | ${() => intervalLengthDate(`2024-01-01${ICA}`, `2024-01-03${EL}`, "day")}                                                             | ${null}
    ${"intervalOverlappingDaysDate"} | ${() => intervalOverlappingDaysDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-04-01${TZ}`, "2024-12-31")}                          | ${null}
    ${"intervalSplitAtDate"}         | ${() => intervalSplitAtDate(`2024-01-01${ICA}`, `2024-01-10${EL}`, [`2024-01-05${TZ}`])}                                              | ${[]}
    ${"intervalUnionDate"}           | ${() => intervalUnionDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-04-01${TZ}`, "2024-12-31")}                                    | ${null}
    ${"intervalXorAllDate"}          | ${() => intervalXorAllDate([{ start: `2024-01-01${ICA}`, end: `2024-01-10${EL}` }, { start: `2024-01-05${TZ}`, end: "2024-01-15" }])} | ${[]}
    ${"intervalXorDate"}             | ${() => intervalXorDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-04-01${TZ}`, "2024-12-31")}                                      | ${[]}
    ${"intervalsOverlapDate"}        | ${() => intervalsOverlapDate(`2024-01-01${ICA}`, `2024-06-30${EL}`, `2024-04-01${TZ}`, "2024-12-31")}                                 | ${false}
    ${"mergeIntervalsDate"}          | ${() => mergeIntervalsDate([{ start: `2024-01-01${ICA}`, end: `2024-01-10${EL}` }, { start: `2024-01-05${TZ}`, end: "2024-01-15" }])} | ${[]}
    ${"splitIntervalByUnitDate"}     | ${() => splitIntervalByUnitDate(`2024-01-01${ICA}`, `2024-01-05${EL}`, "day", 2)}                                                     | ${[]}
  `(
    "$name returns $expected for an endpoint carrying an annotation",
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
