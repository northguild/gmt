// the subset of Temporal.PlainDateLike fields that cycleDate/cycleDateTime/cycleZoned can wrap;
// deliberately narrower than DateUnit, which includes "week" (not a .with()-settable field)
export type DateCycleField = "year" | "month" | "day";
