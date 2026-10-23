/**
 * The Morocco 2026 clock-change checker: its facts and shapes. Pure: no DOM, no network, no HTML,
 * so the Worker can import it. `worker/morocco-clock-change.ts` computes every value at request
 * time; nothing here holds a computed offset, because the runtime's time zone data is what the
 * page exists to show. The one exception is `NO_LONGER`, facts about a past release.
 */
import {
  CHECK_RATE_LIMIT,
  type Change,
  type ClockCheckFacts,
  type ProbeFact,
  type ProbeRow,
  type TransitionRow,
  type ZoneNow,
} from "./clock-check/facts";

export {
  CHECK_RATE_LIMIT,
  STORED_MAX_BYTES,
  STORED_MAX_LINES,
  type Change,
  type ProbeFact,
  type ProbeRow,
  type StoredCheck,
  type StoredRow,
  type TransitionRow,
  type ZoneNow,
} from "./clock-check/facts";

/** The two zones tzdb 2026c changes, in `zone.tab` order. */
export const MOROCCO_ZONES = ["Africa/Casablanca", "Africa/El_Aaiun"] as const;

/** Each zone's offset at the probe instant, now and under the rules before 2026c. */
export const MOROCCO_PROBE: ProbeFact[] = MOROCCO_ZONES.map((zone) => ({
  zone,
  offset: "+00:00",
  oldOffset: "+01:00",
  release: "2026c",
}));

/**
 * 2027-06-01T12:00Z is outside every Ramadan the old data predicted, so old data gives `+01:00`
 * there and current data `+00:00`.
 */
export const MOROCCO_PROBE_INSTANT = "2027-06-01T12:00:00Z";

/** The years the transitions table covers. */
export const MOROCCO_TRANSITION_YEARS = [2026, 2027] as const;

/** What the Worker and the page share about this checker. */
export const MOROCCO_FACTS: ClockCheckFacts = {
  id: "morocco",
  probeInstant: MOROCCO_PROBE_INSTANT,
  probe: MOROCCO_PROBE,
  transitionYears: MOROCCO_TRANSITION_YEARS,
  clockZones: MOROCCO_ZONES,
  storedZones: MOROCCO_ZONES,
};

/** The checker's own rate-limit policy: the shared one. */
export const MOROCCO_RATE_LIMIT = CHECK_RATE_LIMIT;

/**
 * The changes old data still makes through 2027, for both zones. Source: tzdb 2026b `africa`,
 * `Rule Morocco 2027 only - Feb 7 3:00 -1:00` and `Rule Morocco 2027 only - Mar 14 2:00 0`.
 * These are facts about a past release, so they do not age; the Worker cannot compute them,
 * because it runs current data.
 */
export const NO_LONGER: readonly Change[] = [
  {
    instant: "2027-02-07T02:00:00Z",
    offsetBefore: "+01:00",
    offsetAfter: "+00:00",
  },
  {
    instant: "2027-03-14T02:00:00Z",
    offsetBefore: "+00:00",
    offsetAfter: "+01:00",
  },
];

/**
 * The example lines, one per outcome. The labels never claim a kind: the Worker's answer is what
 * shows. The last line has no zone and is completed with the picked one.
 */
export const MOROCCO_STORED_PRESET: string = [
  "2027-06-01T09:00:00+01:00[Africa/Casablanca]",
  "2026-11-15T09:00:00+01:00[Africa/El_Aaiun]",
  "2027-06-01T09:00:00+00:00[Africa/Casablanca]",
  "2026-09-20T01:30:00+01:00[Africa/Casablanca]",
  "2027-03-14T02:30:00+00:00",
].join("\n");

export interface MoroccoCheck {
  now: string;
  probe: ProbeRow[];
  transitions: TransitionRow[];
  zones: ZoneNow[];
}
