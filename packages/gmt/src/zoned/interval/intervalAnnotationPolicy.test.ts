import { intervalFromDurationZoned } from "./intervalFromDurationZoned";
import { intervalIntersectionZoned } from "./intervalIntersectionZoned";
import { intervalSplitAtZoned } from "./intervalSplitAtZoned";
import { intervalsOverlapZoned } from "./intervalsOverlapZoned";
import { mergeIntervalsZoned } from "./mergeIntervalsZoned";
import { isValidCalendarZonedInterval, isValidZonedInterval } from "./validate";

// Validator mirror (#22), CORE-113 (#528): a zoned interval endpoint is the zoned body plus its zone
// bracket and nothing else, so `[u-ca=iso8601]` and an elective `[foo=bar]` are rejected as well as
// an unknown critical one. Each function is tested once, as a policy, and returns its sentinel.
const ICA = "[u-ca=iso8601]";
const EL = "[foo=bar]";
const CRIT = "[!foo=bar]";
const u = (time: string, annotation = "", date = "2024-01-01") =>
  `${date}T${time}+00:00[UTC]${annotation}`;

describe("zoned intervals: an annotation is rejected", () => {
  it.each`
    name                              | call                                                                                                                                     | expected
    ${"isValidZonedInterval"}         | ${() => isValidZonedInterval(u("09:00:00", ICA), u("17:00:00", EL))}                                                                     | ${false}
    ${"isValidCalendarZonedInterval"} | ${() => isValidCalendarZonedInterval(u("09:00:00", ICA), u("17:00:00", EL))}                                                             | ${false}
    ${"intervalsOverlapZoned"}        | ${() => intervalsOverlapZoned(u("09:00:00", ICA), u("13:00:00", EL), u("12:00:00"), u("17:00:00", ICA))}                                 | ${false}
    ${"intervalIntersectionZoned"}    | ${() => intervalIntersectionZoned(u("09:00:00", ICA), u("13:00:00", EL), u("12:00:00"), u("17:00:00", ICA))}                             | ${null}
    ${"intervalFromDurationZoned"}    | ${() => intervalFromDurationZoned(u("00:00:00", ICA + EL), "P1D", "start")}                                                              | ${null}
    ${"intervalSplitAtZoned"}         | ${() => intervalSplitAtZoned(u("09:00:00", EL), u("17:00:00", ICA), [u("12:00:00", EL)])}                                                | ${[]}
    ${"mergeIntervalsZoned"}          | ${() => mergeIntervalsZoned([{ start: u("09:00:00", ICA), end: u("12:00:00", EL) }, { start: u("12:00:00"), end: u("17:00:00", ICA) }])} | ${[]}
  `(
    "$name returns $expected for an endpoint carrying an annotation",
    ({ call, expected }) => {
      expect((call as () => unknown)()).toEqual(expected);
    },
  );

  it.each`
    name                              | call                                                                                                 | sentinel
    ${"isValidZonedInterval"}         | ${() => isValidZonedInterval(u("09:00:00", CRIT), u("17:00:00"))}                                    | ${false}
    ${"isValidCalendarZonedInterval"} | ${() => isValidCalendarZonedInterval(u("09:00:00"), u("17:00:00", CRIT))}                            | ${false}
    ${"intervalsOverlapZoned"}        | ${() => intervalsOverlapZoned(u("09:00:00"), u("13:00:00"), u("12:00:00", CRIT), u("17:00:00"))}     | ${false}
    ${"intervalIntersectionZoned"}    | ${() => intervalIntersectionZoned(u("09:00:00"), u("13:00:00"), u("12:00:00"), u("17:00:00", CRIT))} | ${null}
    ${"intervalFromDurationZoned"}    | ${() => intervalFromDurationZoned(u("00:00:00", CRIT), "P1D", "start")}                              | ${null}
    ${"intervalSplitAtZoned"}         | ${() => intervalSplitAtZoned(u("09:00:00"), u("17:00:00"), [u("12:00:00", CRIT)])}                   | ${[]}
    ${"mergeIntervalsZoned"}          | ${() => mergeIntervalsZoned([{ start: u("09:00:00"), end: u("12:00:00", CRIT) }])}                   | ${[]}
  `(
    "$name returns $sentinel for an unknown critical annotation",
    ({ call, sentinel }) => {
      expect((call as () => unknown)()).toEqual(sentinel);
    },
  );
});
