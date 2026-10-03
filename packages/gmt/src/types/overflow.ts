import type { Temporal } from "@js-temporal/polyfill";

/**
 * What to do when a date or time field is out of range, as Temporal's `overflow` option
 * (`Temporal.PlainDate.prototype.add(item, { overflow })`). `"constrain"` clamps the field to the
 * nearest valid value, so January 31 plus one month is the last day of February; `"reject"`
 * refuses the value.
 */
export type Overflow = Temporal.ArithmeticOptions["overflow"];
