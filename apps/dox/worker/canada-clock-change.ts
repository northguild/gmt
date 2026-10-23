import { convertUtcToPlainDateTime } from "@northguild/gmt/utc/convert";
import { getUtcNow } from "@northguild/gmt/utc/get";
import canadaZones from "../src/lib/canada-zones.json";
import {
  CANADA_PROBE_INSTANTS,
  CANADA_RATE_LIMIT,
  CANADA_STOP_YEAR,
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
  probeRows,
  transitionRows,
} from "./clock-change-shared";
import type { CheckEndpoint } from "./clock-change-shared";

const TRANSITION_YEARS = [CANADA_STOP_YEAR, CANADA_STOP_YEAR + 1] as const;

let fixed: Pick<CanadaCheck, "probe" | "transitions"> | undefined;

/** The `now`-free part: built on first use, then reused for the life of the isolate. */
function fixedTables(): Pick<CanadaCheck, "probe" | "transitions"> {
  if (fixed) return fixed;
  const probe: ProbeRow[] = probeRows(
    { instants: CANADA_PROBE_INSTANTS },
    PROBE_ZONES.map(({ zone }) => zone),
  ).map(({ zone, offset }) => ({ zone, offset }));

  const transitions: TransitionRow[] = transitionRows(
    TRANSITION_YEARS,
    TRANSITION_ZONES,
  ).flatMap(({ zone, year, changes }) =>
    changes.map((change) => ({
      zone,
      year,
      ...change,
      wallBefore: convertUtcToPlainDateTime(change.instant, {
        timeZone: change.offsetBefore,
      }),
    })),
  );
  fixed = { probe, transitions };
  return fixed;
}

/** Every value the checker shows, computed on this runtime's tz data. */
export function computeCanadaCheck(now: string): CanadaCheck {
  return {
    now,
    ...fixedTables(),
    zones: canadaZones.zones.map((zone) =>
      mapZone(zone, now, CANADA_STOP_YEAR),
    ),
  };
}

const CANADA_ENDPOINT: CheckEndpoint = {
  prefix: "canada",
  stopYear: CANADA_STOP_YEAR,
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
