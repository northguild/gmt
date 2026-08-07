import type { Temporal } from "@js-temporal/polyfill";

// used in Temporal with methods like Temporal.ZonedDateTime.from(item, { disambiguation })
export type Disambiguation = Temporal.ToInstantOptions["disambiguation"];
