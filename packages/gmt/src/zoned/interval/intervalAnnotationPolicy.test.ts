import { intervalFromDurationZoned } from "./intervalFromDurationZoned";
import { intervalIntersectionZoned } from "./intervalIntersectionZoned";
import { intervalSplitAtZoned } from "./intervalSplitAtZoned";
import { intervalsOverlapZoned } from "./intervalsOverlapZoned";
import { mergeIntervalsZoned } from "./mergeIntervalsZoned";
import { isValidCalendarZonedInterval, isValidZonedInterval } from "./validate";

// Validator mirror (#22) — zoned interval endpoints read RFC 9557 annotations as
// `Temporal.ZonedDateTime.from` does: `[u-ca=iso8601]` names the ISO calendar and an elective
// annotation (`[foo=bar]`) is ignored; an unknown critical annotation (`[!foo=bar]`) is rejected.
// Native Temporal (Chromium 153): `2024-01-01T09:00+00:00[UTC][u-ca=iso8601]` and
// `…[UTC][foo=bar]` both read as `2024-01-01T09:00:00+00:00[UTC]` in iso8601, and `…[!foo=bar]`
// throws a RangeError. Each accepted row's expected value is the unannotated inputs' value, and a
// re-serialised endpoint is `ZonedDateTime#toString()`'s canonical string: the ISO calendar is
// not written, and elective annotations are not kept.
const ICA = "[u-ca=iso8601]";
const EL = "[foo=bar]";
const CRIT = "[!foo=bar]";
const u = (time: string, annotation = "", date = "2024-01-01") =>
  `${date}T${time}+00:00[UTC]${annotation}`;

describe("zoned intervals: annotations Temporal ignores are accepted", () => {
  it.each`
    name                              | call                                                                                                                                     | expected
    ${"isValidZonedInterval"}         | ${() => isValidZonedInterval(u("09:00:00", ICA), u("17:00:00", EL))}                                                                     | ${true}
    ${"isValidCalendarZonedInterval"} | ${() => isValidCalendarZonedInterval(u("09:00:00", ICA), u("17:00:00", EL))}                                                             | ${true}
    ${"intervalsOverlapZoned"}        | ${() => intervalsOverlapZoned(u("09:00:00", ICA), u("13:00:00", EL), u("12:00:00"), u("17:00:00", ICA))}                                 | ${true}
    ${"intervalIntersectionZoned"}    | ${() => intervalIntersectionZoned(u("09:00:00", ICA), u("13:00:00", EL), u("12:00:00"), u("17:00:00", ICA))}                             | ${{ start: u("12:00:00"), end: u("13:00:00") }}
    ${"intervalFromDurationZoned"}    | ${() => intervalFromDurationZoned(u("00:00:00", ICA + EL), "P1D", "start")}                                                              | ${{ start: u("00:00:00"), end: u("00:00:00", "", "2024-01-02") }}
    ${"intervalSplitAtZoned"}         | ${() => intervalSplitAtZoned(u("09:00:00", EL), u("17:00:00", ICA), [u("12:00:00", EL)])}                                                | ${[{ start: u("09:00:00"), end: u("12:00:00") }, { start: u("12:00:00"), end: u("17:00:00") }]}
    ${"mergeIntervalsZoned"}          | ${() => mergeIntervalsZoned([{ start: u("09:00:00", ICA), end: u("12:00:00", EL) }, { start: u("12:00:00"), end: u("17:00:00", ICA) }])} | ${[{ start: u("09:00:00"), end: u("17:00:00") }]}
  `(
    "$name reads annotated endpoints as their unannotated values and returns $expected",
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
