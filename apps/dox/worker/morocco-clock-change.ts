import { getUtcNow } from "@northguild/gmt/utc/get";
import {
  MOROCCO_CHANGES,
  MOROCCO_PROBE,
  MOROCCO_RATE_LIMIT,
  MOROCCO_STOP_YEAR,
  MOROCCO_STORED_ZONES,
  MOROCCO_ZONES,
  expectedOffset,
  type MoroccoCheck,
} from "../src/lib/morocco-clock-change";
import moroccoZones from "../src/lib/morocco-region-zones.json";
import {
  handleClockChangeCheck,
  mapZone,
  probeRows,
  transitionRows,
  transitionsFor,
} from "./clock-change-shared";
import type { CheckEndpoint } from "./clock-change-shared";

type Fixed = Pick<MoroccoCheck, "probe" | "changes" | "transitions">;
const fixedByYear = new Map<number, Fixed>();

/** The `now`-free part: built on first use, then reused for the life of the isolate. */
function fixedTables(stopYear: number): Fixed {
  const cached = fixedByYear.get(stopYear);
  if (cached) return cached;
  const years = [stopYear, stopYear + 1] as const;
  const probe: MoroccoCheck["probe"] = probeRows(
    { instants: MOROCCO_PROBE },
    MOROCCO_ZONES,
  ).map(({ zone, instant, role, offset }) => ({
    zone,
    instant,
    role,
    expected: expectedOffset(zone),
    offset,
  }));

  const changes: MoroccoCheck["changes"] = MOROCCO_ZONES.flatMap((zone) =>
    MOROCCO_CHANGES.map((change) => ({
      zone,
      ...change,
      present: years.some((year) =>
        transitionsFor(zone, year).some(({ instant }) => instant === change.at),
      ),
    })),
  );

  const transitions: MoroccoCheck["transitions"] = transitionRows(
    years,
    MOROCCO_ZONES,
  );
  const built = { probe, changes, transitions };
  fixedByYear.set(stopYear, built);
  return built;
}

/** Every value the checker shows, computed on this runtime's tz data. */
export function computeMoroccoCheck(
  now: string,
  stopYear: number,
): MoroccoCheck {
  return {
    now,
    ...fixedTables(stopYear),
    zones: moroccoZones.zones.map((zone) => mapZone(zone, now, stopYear)),
  };
}

const MOROCCO_ENDPOINT: CheckEndpoint = {
  prefix: "morocco",
  stopYear: MOROCCO_STOP_YEAR,
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
