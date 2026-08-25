// the subset of Temporal.PlainTimeLike fields that cycleTime/cycleDateTime/cycleZoned can wrap;
// goes to nanosecond precision, wider than @internationalized/date's Time (millisecond ceiling),
// since GMT's PlainTime and setTime already support the full range
export type TimeCycleField =
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "microsecond"
  | "nanosecond";
