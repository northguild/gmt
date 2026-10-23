import { getUtcNow } from "@northguild/gmt/utc/get";
import { getTimeZoneOffset } from "@northguild/gmt/zoned/get";
import {
  MOROCCO_CHANGES,
  MOROCCO_EXPECTED,
  MOROCCO_PROBE,
  MOROCCO_RATE_LIMIT,
  MOROCCO_STORED_ZONES,
  MOROCCO_ZONES,
  type MoroccoCheck,
} from "../src/lib/morocco-clock-change";
import moroccoZones from "../src/lib/morocco-region-zones.json";
import {
  handleClockChangeCheck,
  mapZone,
  transitionsFor,
} from "./clock-change-shared";
import type { CheckEndpoint } from "./clock-change-shared";

const TRANSITION_YEARS = [2026, 2027] as const;

type Fixed = Pick<MoroccoCheck, "probe" | "changes" | "transitions">;
let fixed: Fixed | undefined;

/** The `now`-free part: built on first use, then reused for the life of the isolate. */
function fixedTables(): Fixed {
  if (fixed) return fixed;
  const probe: MoroccoCheck["probe"] = MOROCCO_ZONES.flatMap((zone) =>
    MOROCCO_PROBE.map(({ iso, role }) => ({
      zone,
      instant: iso,
      role,
      expected: MOROCCO_EXPECTED,
      offset: getTimeZoneOffset(zone, iso),
    })),
  );

  const changes: MoroccoCheck["changes"] = MOROCCO_ZONES.flatMap((zone) =>
    MOROCCO_CHANGES.map((change) => ({
      zone,
      ...change,
      present: TRANSITION_YEARS.some((year) =>
        transitionsFor(zone, year).some(({ instant }) => instant === change.at),
      ),
    })),
  );

  const transitions: MoroccoCheck["transitions"] = MOROCCO_ZONES.flatMap(
    (zone) =>
      TRANSITION_YEARS.map((year) => ({
        zone,
        year,
        changes: transitionsFor(zone, year),
      })),
  );
  fixed = { probe, changes, transitions };
  return fixed;
}

/** Every value the checker shows, computed on this runtime's tz data. */
export function computeMoroccoCheck(now: string): MoroccoCheck {
  return {
    now,
    ...fixedTables(),
    zones: moroccoZones.zones.map((zone) => mapZone(zone, now)),
  };
}

const MOROCCO_ENDPOINT: CheckEndpoint = {
  prefix: "morocco",
  policy: MOROCCO_RATE_LIMIT,
  storedZones: MOROCCO_STORED_ZONES,
  compute: computeMoroccoCheck,
};

/**
 * `GET /gmt/api/morocco-clock-change`: Morocco's settings for `handleClockChangeCheck`. Rate
 * limited at `MOROCCO_RATE_LIMIT` under its own `morocco:` key, so no other checker's count and
 * this one are shared.
 */
export function handleMoroccoClockChange(
  request: Request,
  _env: unknown,
  now: () => string = getUtcNow,
): Promise<Response> {
  return handleClockChangeCheck(request, MOROCCO_ENDPOINT, now);
}
