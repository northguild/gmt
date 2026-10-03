import type { Temporal } from "@js-temporal/polyfill";

/**
 * How a local wall time that a time zone's clock shows twice or never is resolved to an instant,
 * as Temporal's `disambiguation` option (`Temporal.ZonedDateTime.from(item, { disambiguation })`).
 *
 * `"compatible"` takes the earlier instant of a repeated time and moves a skipped time forward by
 * the length of the gap. `"earlier"` and `"later"` take that side in both cases, and `"reject"`
 * accepts neither.
 */
export type Disambiguation = Temporal.ToInstantOptions["disambiguation"];
