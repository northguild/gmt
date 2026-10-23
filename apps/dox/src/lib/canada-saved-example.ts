/**
 * The worked example at the top of Canada's saved-times check: a 9:00 meeting in Vancouver on 15
 * November 2026, saved before the change. Derived from the Vancouver reference fact in
 * `PROBE_ZONES` by the shared `savedExample`.
 */
import { PROBE_ZONES } from "./canada-clock-change";
import { savedExample } from "./clock-check/saved-example";

const ZONE = "America/Vancouver";
const fact = PROBE_ZONES.find((f) => f.zone === ZONE);
if (fact === undefined) throw new Error(`No reference fact for ${ZONE}.`);

export const SAVED_EXAMPLE = savedExample(fact, "2026-11-15T09:00:00");
