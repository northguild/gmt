/**
 * The Morocco 2026 clock-change checker (CORE-89) — the facts the server and the page share.
 * Pure: no DOM, no network. Nothing here holds a computed offset: the runtime's time zone data
 * is what the page exists to show.
 */
import { MOROCCO_MINIMUMS } from "../data/morocco-runtime-minimums";
import { minimumsMarkdown } from "../data/clock-change-minimums";
import { MOROCCO_HELP } from "../data/morocco-key-points";
import {
  SERVERS_LINE,
  SERVERS_TITLE,
  cityOf,
  nodeProbeCommand,
} from "./clock-change-common";
import type { Change, ProbeFact } from "./clock-change-common";
import { helpMarkdown } from "./clock-change-help";
import type {
  ProbeConfig,
  ProbeInstant,
  VerdictText,
} from "./clock-change-probe";
import { REGION_KEY, classPhrase } from "./clock-change-tense";
import type { Moment, Tensed, TenseView } from "./clock-change-tense";
import type { MapZone } from "./zone-map";

/**
 * The two zones that stop changing their clocks, from tzdb 2026c (`africa`: `Zone
 * Africa/Casablanca` and `Zone Africa/El_Aaiun`, `1:00 Morocco %z 2026 Sep 20 2:00`, then
 * `0:00 - %z`). The map's first class is read from here, never from a runtime's own data.
 */
export const MOROCCO_ZONES = ["Africa/Casablanca", "Africa/El_Aaiun"] as const;

/** The tzdb release that recorded the change for both zones. */
export const MOROCCO_RELEASE = "2026c";

/** The year the two zones stop changing their clocks in. The year after is read too. */
export const MOROCCO_STOP_YEAR = 2026;

/** The zones the map draws in its first class. */
export const MOROCCO_STOPPED: ReadonlySet<string> = new Set(MOROCCO_ZONES);

/**
 * The moment both zones stop changing their clocks: 2026-09-20 at 02:00 local time (+01:00), as a
 * UTC instant. The words of the date and time are the library's (`momentWords`); a test pins the
 * instant to the library.
 */
export const MOROCCO_STOP_MOMENT: Moment = {
  at: "2026-09-20T01:00:00Z",
  from: "+01:00",
};

/** Every moment the page's phrases state: each zone's, and the region's. Only the words are read from it. */
export const MOROCCO_MOMENTS: Readonly<Record<string, Moment>> = {
  ...Object.fromEntries(
    MOROCCO_ZONES.map((zone) => [zone, MOROCCO_STOP_MOMENT]),
  ),
  [REGION_KEY]: MOROCCO_STOP_MOMENT,
};

/**
 * The class words of a zone's `kind`. The change is past, so the phrase has the one past form; it
 * is dated, so it stays true after 2027. Both zones change at one instant, so the legend carries
 * local time and UTC.
 */
export function moroccoClassText(
  kind: MapZone["kind"],
  id: string | null,
  view: TenseView,
): Tensed {
  return classPhrase(kind, id, view, true, true);
}

/**
 * The two instants every Moroccan zone is read at. The first decides the verdict (the same
 * instant Canada's checker uses); the second falls in the 2026b data's Ramadan window
 * (`Rule Morocco` 2027: 7 Feb to 14 Mar), where old and new data agree, so it is shown only.
 */
export const MOROCCO_PROBE: readonly ProbeInstant[] = [
  { iso: "2026-11-02T12:00:00Z", epochMs: 1793620800000, role: "verdict" },
  { iso: "2027-02-22T12:00:00Z", epochMs: 1803297600000, role: "blind" },
];

/** The offset both zones have at both probe instants in tzdb 2026c and later. */
export const MOROCCO_FACTS: readonly ProbeFact[] = MOROCCO_ZONES.map(
  (zone) => ({
    zone,
    offset: "+00:00",
    release: MOROCCO_RELEASE,
  }),
);

/** The offset a zone has in tzdb 2026c and later. */
export function expectedOffset(zone: string): string {
  const fact = MOROCCO_FACTS.find((item) => item.zone === zone);
  if (fact === undefined) throw new Error(`No reference fact for ${zone}.`);
  return fact.offset;
}

/** A clock change the page states, and the tzdb release that recorded it. */
export interface StatedChange {
  at: string;
  from: string;
  to: string;
  /** `2026b`: a change 2026c removed. `2026c`: a change 2026c added. */
  recordedBy: "2026b" | "2026c";
}

/**
 * The changes the page states, from tzdb's `africa` file. Each applies to both zones, which
 * share one `Rule Morocco` and one `Zone` change line.
 */
export const MOROCCO_CHANGES: readonly StatedChange[] = [
  // 2026c `Zone Africa/Casablanca` and `Zone Africa/El_Aaiun`: `1:00 Morocco %z 2026 Sep 20 2:00`.
  {
    at: "2026-09-20T01:00:00Z",
    from: "+01:00",
    to: "+00:00",
    recordedBy: "2026c",
  },
  // 2026b `Rule Morocco 2027 only - Feb 7 3:00 -1:00 -` (Ramadan begins), removed in 2026c.
  {
    at: "2027-02-07T02:00:00Z",
    from: "+01:00",
    to: "+00:00",
    recordedBy: "2026b",
  },
  // 2026b `Rule Morocco 2027 only - Mar 14 2:00 0 -` (Ramadan ends), removed in 2026c.
  {
    at: "2027-03-14T02:00:00Z",
    from: "+00:00",
    to: "+01:00",
    recordedBy: "2026b",
  },
];

/** The saved-events picker: the two Moroccan zones, no contrast zone. */
export const MOROCCO_STORED_ZONES = MOROCCO_ZONES;

/** The checker's own rate-limit policy, shared by GET and POST. Per isolate: blunt protection. */
export const MOROCCO_RATE_LIMIT = { max: 20, windowSeconds: 60 } as const;

/** A probe row: one zone at one instant. */
export interface MoroccoProbeRow {
  zone: string;
  instant: string;
  role: ProbeInstant["role"];
  expected: string;
  offset: string;
}

/** A stated change in one zone, with whether this runtime's data has it. */
export interface MoroccoChangeRow extends StatedChange {
  zone: string;
  present: boolean;
}

export interface MoroccoTransitionRow {
  zone: string;
  year: number;
  changes: Change[];
}

export interface MoroccoCheck {
  now: string;
  probe: MoroccoProbeRow[];
  changes: MoroccoChangeRow[];
  transitions: MoroccoTransitionRow[];
  zones: MapZone[];
}

/** The verdict instant, which decides the verdict. */
const VERDICT_INSTANT = MOROCCO_PROBE.find((item) => item.role === "verdict")!;

/** The "Your browser" card's rows and instants: both zones, read at both probe instants. */
export function moroccoProbe(idPrefix: string): ProbeConfig {
  return {
    idPrefix,
    zones: MOROCCO_FACTS.map((fact) => ({
      zone: fact.zone,
      expected: { verdict: fact.offset, blind: fact.offset },
    })),
    instants: MOROCCO_PROBE,
  };
}

/** The "Your browser" card's words. The HTML fields are written here, never by a reader. */
export const MOROCCO_VERDICT: VerdictText = {
  title: "Your browser",
  correctNote: "tzdb 2026c or later",
  yoursNote: "your data",
  checking: "Checking your browser&hellip;",
  right: "Your browser has the new rules for both places.",
  wrongBefore: "Your browser has old time zone data for ",
  wrongAfter:
    ". It shows them an hour ahead for most of the year, and right only in the weeks the old rules gave +00:00.",
  more: [
    "<strong>For you:</strong> update your browser. If it is already up to date, its maker has not shipped the fix yet. Check again after the next update.",
    '<strong>For developers:</strong> your users&rsquo; browsers can be the same. See step 2 under <a href="#morocco-developers">For developers</a>.',
  ],
  unknown: "Your browser cannot read these zones.",
  blindNote:
    "Old and new data agree here, so a check during these weeks cannot tell.",
};

/**
 * The one-line Node probe the page offers for the reader's own runtime: each city's offset at the
 * verdict instant. It prints the page's "Correct" column on a runtime with tzdb 2026c or later.
 */
export const NODE_PROBE_COMMAND = nodeProbeCommand(
  MOROCCO_ZONES,
  VERDICT_INSTANT.epochMs,
);

/** What the command prints on a runtime with the new data: `[city, offset]` per zone. */
export function expectedProbeOutput(): [string, string][] {
  return MOROCCO_FACTS.map((fact) => [cityOf(fact.zone), fact.offset]);
}

/**
 * The example lines. The first four are Moroccan lines whose kind changed in tzdb 2026c (the
 * fourth, inside the old Ramadan weeks, reads the same on both data); the last four are Lisbon
 * lines that give one of each kind on any tz data: valid in summer, valid in winter, an offset
 * mismatch, and a time in the 2026-10-25 overlap. The labels here never claim a kind: the
 * Worker's answer is what shows.
 */
export const MOROCCO_PRESET: string = [
  "2026-11-16T09:00:00+01:00[Africa/Casablanca]",
  "2027-03-14T02:30:00+00:00[Africa/Casablanca]",
  "2026-09-20T01:30:00+00:00[Africa/Casablanca]",
  "2027-02-22T10:00:00+00:00[Africa/El_Aaiun]",
  "2026-07-01T12:00:00+01:00[Europe/Lisbon]",
  "2026-12-01T12:00:00+00:00[Europe/Lisbon]",
  "2026-07-01T12:00:00+00:00[Europe/Lisbon]",
  "2026-10-25T01:30:00+00:00[Europe/Lisbon]",
].join("\n");

/** A stated change's local wall time just before it, from its UTC instant and its `from` offset. */
export function localBefore(change: StatedChange): string {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(change.from);
  if (match === null) throw new Error(`Not an offset: ${change.from}`);
  const minutes =
    (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
  const total =
    Number(change.at.slice(11, 13)) * 60 +
    Number(change.at.slice(14, 16)) +
    minutes;
  if (total < 0 || total >= 24 * 60) {
    throw new Error(`${change.at} crosses a date line at ${change.from}.`);
  }
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${change.at.slice(0, 10)} ${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** The sentence that says which tzdb release recorded a stated change. */
export function recordedByText(change: StatedChange): string {
  return change.recordedBy === "2026b"
    ? "In tzdb 2026b and earlier; removed in 2026c"
    : "Added in tzdb 2026c; older data does not have it";
}

/**
 * The sentence that says whether the answering server's data has a stated change. "Still" fits only
 * a change tzdb 2026b recorded and 2026c removed: a server that has it is holding on to old data. A
 * change 2026c added is simply there on an up-to-date server. Absent reads the same for both: a
 * 2026b change is gone (right), a 2026c change is missing (the server's data is older).
 */
export function presentText(
  change: StatedChange & { present: boolean },
): string {
  if (!change.present) return "This server does not have it";
  return change.recordedBy === "2026b"
    ? "This server still has it"
    : "This server has it";
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
    minimumsMarkdown(MOROCCO_MINIMUMS),
    helpMarkdown(MOROCCO_HELP),
  ].join("\n");
}
