/**
 * The time-lapses Deck 0's slides and builds may name with `lapse` (`lib/slides/time-lapse.ts`
 * holds the maths and the `LapseDef` shape). `stage-data.test.ts` checks every name a slide writes
 * is a key here.
 */
import type { LapseDef } from "~/lib/slides/time-lapse";
import newMoon from "./new-moon.json";

export const LAPSES = {
  /** `gd`, the abort slide's language, is Scottish Gaelic: Scotland keeps London's clock. */
  abort: { zones: ["Europe/London"] },
  tehran: { zones: ["Asia/Tehran"] },
  tokyo: { zones: ["Asia/Tokyo"] },
  kolkata: { zones: ["Asia/Kolkata"] },
  shanghai: { zones: ["Asia/Shanghai"] },
  /** Manila's calendar jump at the end of 1844, found in the zone's data. */
  manila: {
    zones: ["Asia/Manila"],
    around: { zone: "Asia/Manila", years: [1844, 1845] },
  },
  /** The sun runs the two hours up to February 2027's new moon, Shanghai's clock stopping on it. */
  newmoon: {
    zones: ["Asia/Shanghai"],
    endsAt: { utc: newMoon.utc, hours: 2 },
    durationMs: 8000,
  },
  /** The sun alone, no zone dated. */
  sun: { zones: [] },
} as const satisfies Record<string, LapseDef>;
