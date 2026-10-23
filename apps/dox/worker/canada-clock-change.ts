/**
 * The Canada endpoint, `GET /gmt/api/canada-clock-change`. The method, size, rate-limit and zone
 * rules, the probe and transition tables and the stored-times check are shared
 * (`./clock-check`); this module adds the map's zones and the class each one falls in.
 */
import canadaZones from "../src/lib/canada-zones.json";
import {
  CANADA_FACTS,
  CANADA_RATE_LIMIT,
  TRANSITION_YEARS,
  TRANSITION_ZONES,
  type CanadaCheck,
  type MapZone,
  type StoredCheck,
} from "../src/lib/canada-clock-change";
import {
  clockCheckHandler,
  computeStoredCheck as computeStoredCheckOf,
  probeRows,
  transitionRows,
  transitionsFor,
  zoneNow,
} from "./clock-check";

function mapZone(zone: string, now: string): MapZone {
  let kind: MapZone["kind"] = "none-2026-2027";
  if (transitionsFor(zone, 2027).length > 0) kind = "changes-2027";
  else if (transitionsFor(zone, 2026).length > 0) kind = "stopped-2026";
  return { ...zoneNow(zone, now), kind };
}

/** Every value the checker shows, computed on this runtime's tz data. */
export function computeCanadaCheck(now: string): CanadaCheck {
  return {
    now,
    probe: probeRows(CANADA_FACTS),
    transitions: transitionRows(TRANSITION_ZONES, TRANSITION_YEARS),
    zones: canadaZones.zones.map((zone) => mapZone(zone, now)),
  };
}

/** Every kept line, classified with this runtime's tz data. */
export function computeStoredCheck(text: string, zone: string): StoredCheck {
  return computeStoredCheckOf(text, zone);
}

/**
 * `GET /gmt/api/canada-clock-change`: see `clockCheckHandler`. Rate limited at
 * `CANADA_RATE_LIMIT` under its own `canada:` key.
 */
export const handleCanadaClockChange = clockCheckHandler({
  facts: CANADA_FACTS,
  limit: CANADA_RATE_LIMIT,
  compute: computeCanadaCheck,
});
