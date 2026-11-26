/**
 * One made-up deck's stage data for the engine tests under `lib/slides/`. The engine knows no real
 * deck; a test that needs places, zones or lapses takes them from here, named by the part each
 * plays: a lapse over one zone, one with no end, one that runs around a calendar jump, one that
 * stops on a fixed instant, and the sun alone. A real deck's data is checked in its own folder.
 */
import type { DeckStageData } from "~/lib/slides/stage-data";
import type { LapseDef } from "~/lib/slides/time-lapse";

export const FIXTURE_LAPSES = {
  /** One zone, a day from now. */
  plain: { zones: ["Asia/Tokyo"] },
  /** One zone, a day from now, with no instant to stop on. */
  open: { zones: ["Asia/Tehran"] },
  /** A window centred on the calendar jump gmt finds in the zone's data. */
  jump: {
    zones: ["Asia/Manila"],
    around: { zone: "Asia/Manila", years: [1844, 1845] },
  },
  /** The two hours up to a fixed instant, the zone's clock stopping on it. */
  ends: {
    zones: ["Asia/Shanghai"],
    endsAt: { utc: "2027-02-06T15:56:00Z", hours: 2 },
    durationMs: 8000,
  },
  /** The sun alone, no zone dated. */
  sun: { zones: [] },
} as const satisfies Record<string, LapseDef>;

export const FIXTURE_PLANET_ZONES = [
  "Europe/Helsinki",
  "Asia/Tokyo",
  "America/Chicago",
  "Pacific/Auckland",
] as const;

export const FIXTURE_STAGE: DeckStageData = {
  points: {
    outpost: {
      lng: -20,
      lat: 40,
      label: "Outpost",
      source: "A made-up place for the engine tests",
    },
    meridian: {
      lng: 0,
      lat: 50,
      label: "Meridian",
      source: "A made-up place for the engine tests",
    },
  },
  planetZones: FIXTURE_PLANET_ZONES,
  lapses: FIXTURE_LAPSES,
  assetRows: [],
};
