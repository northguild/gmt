/**
 * The zone matrix as the pages read it: each library's own test suite run under the time zones
 * and Node versions of GMT's CI job, and every failure sorted into one of two kinds.
 *
 * `./zone-matrix.json` is written by `scripts/zone-matrix/run.mjs`, which a person runs by hand
 * (the suites live outside the workspace), in the compact shape `record-shape.mjs` describes.
 * `zone-matrix-record.ts` holds its types and `assertRecord`. Nothing here stores a count: every
 * figure below is derived from the failures the runner recorded and the tags that sort them, the
 * same rule `behaviour-matrix.ts` follows. A failure counted in neither kind (one that also fails in
 * the reference zone, or one that failed in only one of a cell's two runs) is listed with its cause.
 *
 * Slide 5 of Deck 0 reads `zoneMatrixSummary()`.
 */
import { expandRecord } from "../../../../scripts/zone-matrix/record-shape.mjs";
import {
  assertRecord,
  causeOf,
  tagOf,
  SUITE_ORDER,
  uncounted,
  type Cell,
  type Kind,
  type KnownWhy,
  type SuiteRecord,
  type Tag,
  type ZoneMatrixRecord,
} from "./zone-matrix-record";
import snapshot from "./zone-matrix.json";

/** The words each kind is shown as. */
export const KIND_LABEL: Record<Kind, string> = {
  "one-zone": "The test assumes one zone",
  "wrong-answer": "The library gives a wrong answer",
};

interface Counts {
  oneZone: number;
  wrongAnswer: number;
}

/** Distinct failing tests of each kind over the cells given (one test counts once). */
function countsOf(
  record: ZoneMatrixRecord,
  suite: SuiteRecord,
  cells: readonly Cell[],
): Counts {
  const seen: Record<Kind, Set<string>> = {
    "one-zone": new Set(),
    "wrong-answer": new Set(),
  };
  for (const cell of cells) {
    for (const id of cell.failed) {
      const tag = tagOf(record, suite, id, cell.zone);
      if (tag) seen[tag.kind].add(id);
    }
  }
  return {
    oneZone: seen["one-zone"].size,
    wrongAnswer: seen["wrong-answer"].size,
  };
}

/** The words each reason is shown as, before its zones. */
export const KNOWN_LABEL: Record<KnownWhy, string> = {
  reference: "in the reference zone",
  unstable: "failed once in two runs",
};

interface ZoneSummary extends Counts {
  zone: string;
  /** The most tests any Node version ran in this zone. */
  tests: number;
  /** False when no cell ran, or none could run. */
  ran: boolean;
}

export interface SuiteSummary extends Counts {
  id: string;
  name: string;
  version: string;
  commit: string;
  command: string;
  ownCommand: string;
  repository: string;
  referenceZone: string;
  referenceSource: string;
  zones: ZoneSummary[];
  /**
   * False when no zone ran: every cell was overridden or could not run. Its counts are then 0
   * because nothing was measured, so a page shows that instead of the counts.
   */
  measured: boolean;
  /** Zones where the suite replaced the zone it was given, and so counted no failure. */
  overridden: {
    zone: string;
    node: string;
    file: string | null;
    line: number | null;
  }[];
  couldNotRun: { zone: string; node: string; reason: string }[];
  pins: { file: string; line: number; text: string }[];
  /** The tagged failures: one row per test id and kind, with the zones it failed in. */
  failures: {
    id: string;
    kind: Kind;
    reason: string;
    zones: string[];
    evidence?: Tag["evidence"];
  }[];
  /**
   * The failures counted in neither kind: one row per test id and reason, with the Node majors and
   * zones it failed in and its cause.
   */
  known: {
    id: string;
    why: KnownWhy;
    nodes: string[];
    zones: string[];
    cause: string;
  }[];
  /** The earliest and latest `ranOn` of the cells. */
  ranOn: { from: string; to: string };
  nodes: string[];
}

interface ZoneMatrixSummary {
  /** False until a run is recorded. Every page then says so instead of showing a count. */
  ran: boolean;
  zones: string[];
  nodes: string[];
  ranOn: { from: string; to: string } | null;
  suites: SuiteSummary[];
}

/** One suite as the pages read it. */
function summariseSuite(
  record: ZoneMatrixRecord,
  suite: SuiteRecord,
): SuiteSummary {
  const zones = record.matrix.zones.map((zone): ZoneSummary => {
    const cells = suite.cells.filter((c) => c.zone === zone);
    return {
      zone,
      tests: Math.max(0, ...cells.map((c) => c.tests)),
      ran: cells.some((c) => !c.couldNotRun && !c.overriddenBy),
      ...countsOf(record, suite, cells),
    };
  });
  const byId = new Map<string, SuiteSummary["failures"][number]>();
  for (const cell of suite.cells) {
    for (const id of cell.failed) {
      const tag = tagOf(record, suite, id, cell.zone);
      if (!tag) continue;
      const row = byId.get(id) ?? {
        id,
        kind: tag.kind,
        reason: tag.reason,
        zones: [],
        evidence: tag.evidence,
      };
      if (!row.zones.includes(cell.zone)) row.zones.push(cell.zone);
      byId.set(id, row);
    }
  }
  const known = new Map<string, SuiteSummary["known"][number]>();
  for (const row of uncounted(suite)) {
    const key = `${row.why} | ${row.id}`;
    const entry = known.get(key) ?? {
      id: row.id,
      why: row.why,
      nodes: [],
      zones: [],
      cause: causeOf(record, suite, row.id, row.node)?.cause ?? "",
    };
    if (!entry.nodes.includes(row.node)) entry.nodes.push(row.node);
    if (!entry.zones.includes(row.zone)) entry.zones.push(row.zone);
    known.set(key, entry);
  }
  for (const entry of known.values()) {
    entry.nodes.sort((a, b) => Number(a) - Number(b));
    entry.zones.sort(
      (a, b) => record.matrix.zones.indexOf(a) - record.matrix.zones.indexOf(b),
    );
  }
  const dates = suite.cells.map((c) => c.ranOn).sort();
  return {
    id: suite.id,
    name: suite.name,
    version: suite.version,
    commit: suite.commit,
    command: suite.command,
    ownCommand: suite.ownCommand,
    repository: suite.repository,
    referenceZone: suite.reference.zone,
    referenceSource: suite.reference.source,
    ...countsOf(record, suite, suite.cells),
    zones,
    measured: zones.some((z) => z.ran),
    overridden: suite.cells
      .filter((c) => c.overriddenBy)
      .map((c) => ({
        zone: c.zone,
        node: c.node,
        file: c.overriddenBy?.file ?? null,
        line: c.overriddenBy?.line ?? null,
      })),
    couldNotRun: suite.cells
      .filter((c) => c.couldNotRun)
      .map((c) => ({
        zone: c.zone,
        node: c.node,
        reason: c.couldNotRun ?? "",
      })),
    pins: suite.pins,
    failures: [...byId.values()].sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
    ),
    known: [...known.values()].sort(
      (a, b) =>
        a.why.localeCompare(b.why) ||
        a.cause.localeCompare(b.cause) ||
        a.id.localeCompare(b.id),
    ),
    ranOn: { from: dates[0] ?? "", to: dates[dates.length - 1] ?? "" },
    nodes: [...new Set(suite.cells.map((c) => c.node))].sort(
      (a, b) => Number(a) - Number(b),
    ),
  };
}

export function summarize(record: ZoneMatrixRecord): ZoneMatrixSummary {
  assertRecord(record);
  const suites = [...record.suites]
    .sort(
      (a, b) =>
        SUITE_ORDER.indexOf(a.id as never) - SUITE_ORDER.indexOf(b.id as never),
    )
    .map((s) => summariseSuite(record, s));
  const dates = suites
    .flatMap((s) => (s.ranOn.from ? [s.ranOn.from, s.ranOn.to] : []))
    .sort();
  return {
    ran: suites.length > 0,
    zones: record.matrix.zones,
    nodes: record.matrix.node,
    ranOn: dates.length
      ? { from: dates[0] as string, to: dates[dates.length - 1] as string }
      : null,
    suites,
  };
}

/**
 * The record in full: one cell per suite, Node and zone. The file stores it compactly (see
 * `scripts/zone-matrix/record-shape.mjs`), so this is where it is read back.
 */
export const zoneMatrixRecord = expandRecord(
  snapshot,
) as unknown as ZoneMatrixRecord;
const record = zoneMatrixRecord;

/** What the pages and slide 5 read. Throws at import on a record `assertRecord` rejects. */
export const zoneMatrixSummary: ZoneMatrixSummary = summarize(record);

/** The summary of one suite, or undefined when it has not run. */
export const suiteSummary = (id: string): SuiteSummary | undefined =>
  zoneMatrixSummary.suites.find((s) => s.id === id);

/** The two kinds as one short phrase: `3 tests that assume one zone, 5 wrong answers`. */
function countsPhrase(c: Counts): string {
  const one = `${c.oneZone} ${c.oneZone === 1 ? "test assumes" : "tests assume"} one zone`;
  const wrong = `${c.wrongAnswer} wrong ${c.wrongAnswer === 1 ? "answer" : "answers"}`;
  return `${one}, ${wrong}`;
}

/**
 * The line a Migrate page opens with, in the link text to `/compare/zone-matrix/`:
 * `Run in GMT's CI time zones: Moment.js 2.31.0's own tests, 8 tests assume one zone, 0 wrong answers (2026-11-18).`
 */
export function zoneMatrixLine(id: string): string {
  const s = suiteSummary(id);
  if (!s) return "Zone matrix: no run is recorded yet.";
  const when =
    s.ranOn.from === s.ranOn.to
      ? s.ranOn.from
      : `${s.ranOn.from} to ${s.ranOn.to}`;
  if (!s.measured)
    return `Zone matrix, ${s.zones.length} zones: ${s.name} ${s.version}'s own tests, not measured: no run kept the zone it was given (${when}).`;
  return `Zone matrix, ${s.zones.length} zones: ${s.name} ${s.version}'s own tests, ${countsPhrase(s)} (${when}).`;
}

/** When the suites were run: `on 2026-11-18`, `from 2026-11-18 to 2026-11-19`, or that none was. */
export const zoneMatrixRange: string = (() => {
  const r = zoneMatrixSummary.ranOn;
  if (!r) return "no run is recorded yet";
  return r.from === r.to ? `on ${r.from}` : `from ${r.from} to ${r.to}`;
})();
