import { convertUtcToPlainDateTime } from "@northguild/gmt/utc/convert";
import { getUtcNow } from "@northguild/gmt/utc/get";
import { getTimeZoneOffset } from "@northguild/gmt/zoned/get";
import canadaZones from "../src/lib/canada-zones.json";
import {
  CANADA_RATE_LIMIT,
  PROBE_INSTANT,
  PROBE_ZONES,
  STORED_ZONES,
  TRANSITION_ZONES,
  type CanadaCheck,
  type ProbeRow,
  type TransitionRow,
} from "../src/lib/canada-clock-change";
import {
  handleClockChangeCheck,
  mapZone,
  transitionsFor,
} from "./clock-change-shared";
import type { CheckEndpoint } from "./clock-change-shared";

const TRANSITION_YEARS = [2026, 2027] as const;

let fixed: Pick<CanadaCheck, "probe" | "transitions"> | undefined;

/** The `now`-free part: built on first use, then reused for the life of the isolate. */
function fixedTables(): Pick<CanadaCheck, "probe" | "transitions"> {
  if (fixed) return fixed;
  const probe: ProbeRow[] = PROBE_ZONES.map(({ zone }) => ({
    zone,
    offset: getTimeZoneOffset(zone, PROBE_INSTANT),
  }));

  const transitions: TransitionRow[] = [];
  for (const zone of TRANSITION_ZONES) {
    for (const year of TRANSITION_YEARS) {
      for (const change of transitionsFor(zone, year)) {
        transitions.push({
          zone,
          year,
          ...change,
          wallBefore: convertUtcToPlainDateTime(change.instant, {
            timeZone: change.offsetBefore,
          }),
        });
      }
    }
  }
  fixed = { probe, transitions };
  return fixed;
}

/** Every value the checker shows, computed on this runtime's tz data. */
export function computeCanadaCheck(now: string): CanadaCheck {
  return {
    now,
    ...fixedTables(),
    zones: canadaZones.zones.map((zone) => mapZone(zone, now)),
  };
}

const CANADA_ENDPOINT: CheckEndpoint = {
  prefix: "canada",
  policy: CANADA_RATE_LIMIT,
  storedZones: STORED_ZONES,
  compute: computeCanadaCheck,
};

/**
 * `GET /gmt/api/canada-clock-change`: Canada's settings for `handleClockChangeCheck`, which holds
 * the methods, `HEAD`, `POST` and the caps. Rate limited at `CANADA_RATE_LIMIT` under its own
 * `canada:` key, so the chat's bucket and this one never share a count.
 */
export function handleCanadaClockChange(
  request: Request,
  _env: unknown,
  now: () => string = getUtcNow,
): Promise<Response> {
  return handleClockChangeCheck(request, CANADA_ENDPOINT, now);
}
