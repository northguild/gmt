import type { DateCycleField } from "./date-cycle-field";
import type { TimeCycleField } from "./time-cycle-field";

// used by cycleDateTime and cycleZoned, which can cycle either a date or a time field
export type DateTimeCycleField = DateCycleField | TimeCycleField;
