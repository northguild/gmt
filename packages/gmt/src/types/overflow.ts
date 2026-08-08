import type { Temporal } from "@js-temporal/polyfill";

// used in Temporal add()/subtract() methods like Temporal.PlainDate.prototype.add(item, { overflow })
export type Overflow = Temporal.ArithmeticOptions["overflow"];
