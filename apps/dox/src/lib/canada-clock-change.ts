/**
 * The Canada 2026 clock-change checker: its facts and shapes. The shared parts (the row shapes,
 * the caps, the offset helpers) live in `clock-check/facts.ts` and are re-exported here; what stays
 * is Canada's own data, its map classes and `CanadaCheck`. Pure: no DOM, no network.
 * `worker/canada-clock-change.ts` computes every value at request time; nothing here holds a
 * computed offset, because the runtime's time zone data is what the page exists to show.
 */
import { minimumsMarkdown } from "../data/canada-runtime-minimums";
import { helpMarkdown } from "../data/canada-key-points";
import {
  CHECK_RATE_LIMIT,
  expectedProbeOutput as expectedOutputOf,
  nodeProbeCommand,
  probeEpochMs,
  type ClockCheckFacts,
  type ProbeFact,
  type ProbeRow,
  type TransitionRow,
  type ZoneNow,
} from "./clock-check/facts";

export {
  STORED_MAX_BYTES,
  STORED_MAX_LINES,
  changeText,
  cityOf,
  offsetFromIntl,
  signedOffset,
  wallHms,
  type Change,
  type ProbeFact,
  type ProbeRow,
  type StoredCheck,
  type StoredRow,
  type TransitionRow,
} from "./clock-check/facts";

/** The instant every probe row is read at: a Monday noon UTC, after all five changes took effect. */
export const PROBE_INSTANT = "2026-11-02T12:00:00Z";

/**
 * `PROBE_INSTANT` as epoch milliseconds. A test pins it to the library's own conversion of
 * `PROBE_INSTANT`.
 */
export const PROBE_EPOCH_MS = probeEpochMs({ probeInstant: PROBE_INSTANT });

/**
 * Source: IANA tzdb `NEWS`, releases 2026b-2026e
 * (<https://data.iana.org/time-zones/tzdb/NEWS>): BC to permanent -07 (2026b), AB to -06 and
 * Morocco to +00 (2026c), NT west to -06 (2026d), MB to -05 (2026e). `oldOffset` is the offset
 * each zone had at `PROBE_INSTANT` before its change (standard time).
 */
export const PROBE_ZONES: readonly ProbeFact[] = [
  {
    zone: "America/Vancouver",
    offset: "-07:00",
    oldOffset: "-08:00",
    release: "2026b",
  },
  {
    zone: "America/Edmonton",
    offset: "-06:00",
    oldOffset: "-07:00",
    release: "2026c",
  },
  {
    zone: "Africa/Casablanca",
    offset: "+00:00",
    oldOffset: "+01:00",
    release: "2026c",
  },
  {
    zone: "America/Inuvik",
    offset: "-06:00",
    oldOffset: "-07:00",
    release: "2026d",
  },
  {
    zone: "America/Winnipeg",
    offset: "-05:00",
    oldOffset: "-06:00",
    release: "2026e",
  },
];

/**
 * The four Canadian zones the page is about: the probe zones without Casablanca. Casablanca stays
 * in `PROBE_ZONES` (the API still answers it); nothing on the page shows it.
 */
export const TABLE_ZONES: readonly ProbeFact[] = PROBE_ZONES.filter(
  (fact) => fact.zone !== "Africa/Casablanca",
);

/**
 * The zones that stop changing their clocks in 2026, from the tzdb 2026e facts above. The map's
 * first class is read from here, never from a runtime's own data, so it looks the same wherever
 * it is served.
 */
export const STOPPED_ZONES: ReadonlySet<string> = new Set(
  TABLE_ZONES.map((fact) => fact.zone),
);

/** The table zones plus Toronto, the control that still changes its clocks. */
export const TRANSITION_ZONES: readonly string[] = [
  ...TABLE_ZONES.map((fact) => fact.zone),
  "America/Toronto",
];

/** The five zones the clocks show. */
export const CLOCK_ZONES: readonly string[] = [
  "America/Vancouver",
  "America/Edmonton",
  "America/Inuvik",
  "America/Winnipeg",
  "America/Toronto",
];

/** The zone picker of the stored-times check: the same five. */
export const STORED_ZONES: readonly string[] = CLOCK_ZONES;

/** The years the transitions table covers. */
export const TRANSITION_YEARS = [2026, 2027] as const;

/** What the Worker and the page share about this checker. */
export const CANADA_FACTS: ClockCheckFacts = {
  id: "canada",
  probeInstant: PROBE_INSTANT,
  probe: PROBE_ZONES,
  transitionYears: TRANSITION_YEARS,
  clockZones: CLOCK_ZONES,
  storedZones: STORED_ZONES,
};

/** The checker's own rate-limit policy: the shared one. */
export const CANADA_RATE_LIMIT = CHECK_RATE_LIMIT;

export interface MapZone extends ZoneNow {
  kind: "stopped-2026" | "changes-2027" | "none-2026-2027";
}

export interface CanadaCheck {
  now: string;
  probe: ProbeRow[];
  transitions: TransitionRow[];
  zones: MapZone[];
}

/**
 * The one-line Node probe the page offers for the reader's own runtime. It prints each
 * city's UTC offset at `PROBE_INSTANT`; the output matches the page's "Correct" column when the
 * runtime carries tzdb 2026e data. `GMT` alone (UTC) is read as `+00:00`.
 */
export const NODE_PROBE_COMMAND = nodeProbeCommand(TABLE_ZONES, PROBE_INSTANT);

const KIND_LABELS: Record<MapZone["kind"], string> = {
  "stopped-2026": "Stops changing clocks in 2026",
  "changes-2027": "Still changes clocks",
  "none-2026-2027": "Never changes clocks",
};

/** The class word for a zone's `kind`: a dated phrase, so it stays true after 2027. */
export function mapKindLabel(kind: MapZone["kind"]): string {
  return KIND_LABELS[kind];
}

/** The "Test your own servers" card's words: one source for the page, the `.md` twin and the llms files. */
export const SERVERS_TITLE = "Test your own servers";
export const SERVERS_LINE =
  "Run this wherever your code runs (servers, containers, CI). It must print the Correct offsets below. If it doesn't, update the runtime or the OS tzdata package and rebuild images.";

/** What the command prints on a runtime with the new data: `[city, offset]` per table zone. */
export function expectedProbeOutput(): [string, string][] {
  return expectedOutputOf(TABLE_ZONES);
}

/** The card as Markdown for the `.md` twin and the llms files, command included. */
export function serversMarkdown(): string {
  return [
    "",
    `## ${SERVERS_TITLE}`,
    "",
    SERVERS_LINE,
    "",
    "```sh",
    NODE_PROBE_COMMAND,
    "```",
    "",
    `Expected: ${expectedProbeOutput()
      .map(([city, offset]) => `\`${city}\` ${offset}`)
      .join(" \u00b7 ")}`,
    minimumsMarkdown(),
    helpMarkdown(),
  ].join("\n");
}
