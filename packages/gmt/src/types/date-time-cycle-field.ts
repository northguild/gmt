import type { DateCycleField } from "./date-cycle-field";
import type { TimeCycleField } from "./time-cycle-field";

/**
 * A date or time field `cycleDateTime` and `cycleZoned` can step and wrap: any `DateCycleField`
 * or `TimeCycleField`.
 */
export type DateTimeCycleField = DateCycleField | TimeCycleField;
