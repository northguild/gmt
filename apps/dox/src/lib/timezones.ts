import { gmtStats } from "../data/gmt-stats";

export interface TimezoneInfo {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Presentation-only map coordinates for the CI timezone matrix
 * (`gmtStats.timezoneList`, published by `scripts/stats.mjs` from
 * `.github/workflows/ci.yml`'s `gmt-matrix` job). This is decoration only —
 * *which* zones are shown comes from the published list, never from this
 * map's keys. `timezones.test.ts` polices both directions: every published
 * zone must have coordinates here, and this map must not carry a zone the
 * matrix doesn't.
 */
export const TIMEZONE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Pacific/Niue": { lat: -19.05, lng: -169.92 },
  "America/New_York": { lat: 40.71, lng: -74.01 },
  UTC: { lat: 0, lng: 0 },
  "Europe/London": { lat: 51.5, lng: -0.12 },
  "Asia/Kolkata": { lat: 22.57, lng: 88.36 },
  "Asia/Kathmandu": { lat: 27.72, lng: 85.32 },
  "Asia/Shanghai": { lat: 31.23, lng: 121.47 },
  "Australia/Lord_Howe": { lat: -31.52, lng: 159.08 },
  "Pacific/Chatham": { lat: -43.95, lng: -176.57 },
  "Pacific/Apia": { lat: -13.83, lng: -171.77 },
};

export function timezoneCoordinates(id: string): { lat: number; lng: number } {
  const coords = TIMEZONE_COORDINATES[id];
  if (!coords) {
    throw new Error(
      `timezones: ${id} is in gmtStats.timezoneList but has no entry in TIMEZONE_COORDINATES`,
    );
  }
  return coords;
}

export const TIMEZONES: TimezoneInfo[] = gmtStats.timezoneList.map((id) => ({
  id,
  name: id,
  ...timezoneCoordinates(id),
}));
