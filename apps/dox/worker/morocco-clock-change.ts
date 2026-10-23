/**
 * The Morocco endpoint, `GET|HEAD|POST /gmt/api/morocco-clock-change`. The method, size,
 * rate-limit and zone rules, the probe and transition tables and the stored-times check are
 * shared (`./clock-check`). No HTML, CSS or copy here: the Worker bundle must not pull a template.
 */
import {
  MOROCCO_FACTS,
  MOROCCO_RATE_LIMIT,
  MOROCCO_TRANSITION_YEARS,
  MOROCCO_ZONES,
  type MoroccoCheck,
} from "../src/lib/morocco-clock-change";
import {
  clockCheckHandler,
  probeRows,
  transitionRows,
  zoneNow,
} from "./clock-check";

/** Every value the checker shows, computed on this runtime's tz data. */
export function computeMoroccoCheck(now: string): MoroccoCheck {
  return {
    now,
    probe: probeRows(MOROCCO_FACTS),
    transitions: transitionRows(MOROCCO_ZONES, MOROCCO_TRANSITION_YEARS),
    zones: MOROCCO_ZONES.map((zone) => zoneNow(zone, now)),
  };
}

/** See `clockCheckHandler`. Rate limited under its own `morocco:` key. */
export const handleMoroccoClockChange = clockCheckHandler({
  facts: MOROCCO_FACTS,
  limit: MOROCCO_RATE_LIMIT,
  compute: computeMoroccoCheck,
});
