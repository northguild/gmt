/**
 * The `stand-ins` slide: the three libraries that stand in for Temporal until it is everywhere, one
 * column each. Every number is derived, never typed:
 *
 * - `@internationalized/date`'s calendar faults are our own probe's record
 *   (`intl-date-calendars.json`, written by `scripts/zone-matrix/intl-date-calendars.mjs` on Node 26
 *   against native Temporal). A fault the record no longer shows fails the build, so the slide never
 *   says a bug is there after it is fixed.
 * - the two polyfills' counts are read from `data/upstream-filings.json`: a report is an issue we
 *   opened for a new defect, and a fix sent is a pull request we opened. A maintainer's pull request
 *   we only added evidence to is not ours, so it is not counted (`role` is not `contributor`).
 *
 * A line is a list of parts; a `wrong` part is a measured fault and shows in the danger colour.
 */
import {
  filings,
  type GitHubFiling,
  type UpstreamFiling,
} from "~/data/upstream-filings";
import { libraryTotals, zoneProbe } from "~/data/zone-probe";
import record from "./intl-date-calendars.json";

interface LinePart {
  text: string;
  /** A measured fault. */
  wrong?: true;
}

interface StandIn {
  id: string;
  name: string;
  /** What the library is, in one line. */
  kind: string;
  lines: LinePart[][];
}

const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n.toLocaleString("en")} ${n === 1 ? one : many}`;

const sentence = (text: string): string =>
  text.replace(/^./, (c) => c.toUpperCase());

const ours = (f: UpstreamFiling): boolean => f.role !== "contributor";

const github = (repo: string) =>
  filings.filter(
    (f): f is GitHubFiling => f.tracker === "github" && f.repo === repo,
  );

function fullcalendar(): StandIn {
  const repo = github("fullcalendar/temporal-polyfill");
  const reports = repo.filter(
    (f) => f.kind === "issue" && f.work === "report",
  ).length;
  const fixes = repo.filter((f) => f.kind === "pr" && ours(f)).length;
  return {
    id: "temporal-polyfill",
    name: "temporal-polyfill",
    kind: "The standard's API.",
    lines: [
      [
        { text: `${plural(reports, "bug")} reported`, wrong: true },
        { text: `, ${plural(fixes, "fix", "fixes")} sent.` },
      ],
    ],
  };
}

function jsTemporal(): StandIn {
  const fixes = github("js-temporal/temporal-polyfill").filter(
    (f) =>
      f.kind === "pr" && ours(f) && (f.work === "fix" || f.work === "port"),
  ).length;
  return {
    id: "js-temporal",
    name: "@js-temporal/polyfill",
    kind: "The standard's API.",
    lines: [[{ text: `${plural(fixes, "fix", "fixes")} sent.` }]],
  };
}

function internationalized(): StandIn {
  const { persian, japanese, chinese } = record;
  const { first, last } = japanese;
  if (persian.differ === 0 || !persian.first)
    throw new Error(
      "stand-ins: the probe finds no Persian fault; the slide's line is stale",
    );
  if (!first || !last || first.gives.era === first.expected.era)
    throw new Error(
      "stand-ins: the probe finds no Japanese era fault; the slide's line is stale",
    );
  if (chinese.gotIdentifier !== "gregory")
    throw new Error(
      `stand-ins: Chinese now gives "${chinese.gotIdentifier}"; the slide's line is stale`,
    );
  const years = `${first.date.slice(0, 4)}–${last.date.slice(0, 4)}`;
  return {
    id: "internationalized-date",
    name: "@internationalized/date",
    kind: "Its own classes, shaped like Temporal's.",
    lines: [
      [
        { text: "Persian: " },
        { text: plural(persian.differ, "year"), wrong: true },
        { text: " start a day late." },
      ],
      [
        { text: "Japanese: " },
        { text: `${years} in ${sentence(first.gives.era)}`, wrong: true },
        { text: `, where the standard says ${first.expected.era}.` },
      ],
      [
        { text: "Chinese: " },
        { text: "quietly Gregorian", wrong: true },
        { text: "." },
      ],
    ],
  };
}

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

/** The closing line: true only while all three get every zone experiment right. */
function closing(columns: readonly StandIn[]): string {
  const totals = libraryTotals();
  for (const { id } of columns) {
    const wrong = totals.find((t) => t.id === id)?.wrong;
    if (wrong !== 0)
      throw new Error(
        `stand-ins: ${id} is wrong ${wrong} time(s) in the zone probe; "pass" is stale`,
      );
  }
  const n = zoneProbe.experiments.length;
  const word = NUMBER_WORDS[n];
  if (!word) throw new Error(`stand-ins: no word for ${n} experiments`);
  return `All three pass the ${word} zone experiments. Calendars are where they break.`;
}

const columns = [internationalized(), fullcalendar(), jsTemporal()];

export const STAND_INS = { columns, closing: closing(columns) };
