import { getUtcNow } from "@northguild/gmt/utc/get";
import { getTimeZoneOffset } from "@northguild/gmt/zoned/get";
import { hasDaylightSaving } from "@northguild/gmt/zoned/validate";
import type { Change } from "../src/lib/clock-change-common";
import usZones from "../src/lib/us-region-zones.json";
import {
  json,
  lastAndNext,
  rateLimited,
  type RatePolicy,
} from "./clock-change-shared";

/** One US zone as the tz data models it at `now`. */
export interface WatchZone {
  zone: string;
  /** `getTimeZoneOffset(zone, now)`. */
  offset: string;
  /** `hasDaylightSaving(zone, { at: now })`: the zone changes its clocks. */
  observes: boolean;
  /** The last change at or before `now`, as the checkers' map rows pick it. */
  last: Change | null;
  /** The next change after `now`. */
  next: Change | null;
}

export interface SunshineActZones {
  now: string;
  zones: WatchZone[];
}

/** 20 requests a minute: the page makes one per view. */
export const SUNSHINE_ACT_RATE_LIMIT: RatePolicy = {
  max: 20,
  windowSeconds: 60,
} as const;

/**
 * Every US zone's offset, whether it changes its clocks and its last and next change, read with
 * this runtime's tz data. Rows follow `us-region-zones.json` (zone.tab order), the undrawn zones
 * included.
 */
export function computeSunshineActZones(now: string): SunshineActZones {
  return {
    now,
    zones: usZones.zones.map((zone) => ({
      zone,
      offset: getTimeZoneOffset(zone, now),
      observes: hasDaylightSaving(zone, { at: now }),
      ...lastAndNext(zone, now),
    })),
  };
}

/**
 * `GET /gmt/api/sunshine-protection-act`: the Today classes of the Sunshine Protection Act page,
 * computed on the Worker so every reader sees the same map whatever their browser's tz data.
 * Other methods answer 405 with `Allow: GET`. Rate limited under its own
 * `sunshine-protection-act:` key. `no-store`, as `now` changes every request.
 */
export async function handleSunshineProtectionAct(
  request: Request,
  _env: unknown,
  now: () => string = getUtcNow,
): Promise<Response> {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed.", retryable: false }, 405, {
      allow: "GET",
    });
  }
  const blocked = rateLimited(
    request,
    "sunshine-protection-act",
    SUNSHINE_ACT_RATE_LIMIT,
  );
  return blocked ?? json(computeSunshineActZones(now()));
}
