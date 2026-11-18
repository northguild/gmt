/**
 * The zone matrix as the pages read it: each library's own test suite run under the time zones
 * and Node versions of GMT's CI job, and every failure sorted into one of two kinds.
 *
 * `./zone-matrix.json` is written by `scripts/zone-matrix/run.mjs`, which a person runs by hand
 * (the suites live outside the workspace). Nothing here stores a count: every figure below is
 * derived from the failures the runner recorded and the tags that sort them, the same rule
 * `behaviour-matrix.ts` follows. A failure counted in neither kind (one that also fails in the
 * reference zone, or one that failed in only one of a cell's two runs) is listed with its cause.
 * `assertRecord` throws on a record that has an untagged failure, such a failure with no cause,
 * any GMT failure (GMT is the control, so a failure there is a GMT bug), or a shape the runner
 * does not write, so a hand edit or a bad run fails the build instead of rendering a number.
 *
 * Slide 5 of Deck 0 reads `zoneMatrixSummary()`.
 */
import snapshot from "./zone-matrix.json";

export const KINDS = ["one-zone", "wrong-answer"] as const;
export type Kind = (typeof KINDS)[number];

/** The words each kind is shown as. */
export const KIND_LABEL: Record<Kind, string> = {
  "one-zone": "The test assumes one zone",
  "wrong-answer": "The library gives a wrong answer",
};

export interface Tag {
  kind: Kind;
  reason: string;
  /** The zones the tag covers. Absent means every zone. */
  zones?: string[];
  /** Present on a `wrong-answer` tag. */
  evidence?: { input: string; zone: string; temporal: string; library: string };
}

export interface Cell {
  node: string;
  nodeVersion: string;
  /** The Node's time-zone data (`process.versions.tz`), e.g. `2026e`. */
  tzdata: string;
  tz: string;
  zone: string;
  ranOn: string;
  tests: number;
  /** Failing test ids that do not fail in the suite's reference zone. */
  failed: string[];
  /** Failing ids that also fail in the reference zone: known, counted in neither kind. */
  alsoFailsAtReference: string[];
  /** Ids that failed in only one of the cell's two runs: counted in neither kind. */
  unstable: string[];
  overriddenBy?: { file: string | null; line: number | null; zone: string };
  couldNotRun?: string;
}

export interface SuiteRecord {
  id: string;
  name: string;
  version: string;
  repository: string;
  commit: string;
  command: string;
  ownCommand: string;
  reference: {
    zone: string;
    source: string;
    runs: {
      node: string;
      nodeVersion: string;
      tzdata: string;
      tests: number;
      failed: string[];
      /** Ids that failed in only one of the reference zone's two runs. */
      unstable: string[];
      couldNotRun?: string;
    }[];
  };
  pins: { file: string; line: number; text: string }[];
  cells: Cell[];
}

/** Why a failure counted in neither kind happens, stated as a fact, from `causes.mjs`. */
export interface Cause {
  cause: string;
  /** The Node majors it covers. Absent means every one. */
  nodes?: string[];
}

export interface ZoneMatrixRecord {
  matrix: { ci: string; zones: string[]; node: string[] };
  tags: Record<string, Tag>;
  untagged: string[];
  /** Keyed as `tags` is: the cause of each reference-zone and unstable failure. */
  causes: Record<string, Cause>;
  /** Reference-zone and unstable failures the runner found no cause for. Must be empty. */
  uncaused: string[];
  suites: SuiteRecord[];
}

/** The order the pages list suites in: the libraries as `/compare` has them, then GMT, the control. */
export const SUITE_ORDER = [
  "internationalized-date",
  "luxon",
  "date-fns",
  "moment",
  "dayjs",
  "spacetime",
  "js-temporal",
  "temporal-polyfill",
  "gmt",
] as const;

export const tagKey = (
  suite: { id: string; version: string },
  id: string,
): string => `${suite.id}@${suite.version} | ${id}`;

/** Throws on anything the pages must not show. */
export function assertRecord(record: ZoneMatrixRecord): void {
  if (record.untagged.length > 0) {
    throw new Error(
      `zone-matrix.json has untagged failures: ${record.untagged.join("; ")}. Tag them in scripts/zone-matrix/tags.mjs and run again.`,
    );
  }
  if (!Array.isArray(record.uncaused) || !record.causes) {
    throw new Error(
      "zone-matrix.json has no causes or uncaused list: it was not written by the current run.mjs. Run again.",
    );
  }
  if (record.uncaused.length > 0) {
    throw new Error(
      `zone-matrix.json has failures counted in neither kind with no cause: ${record.uncaused.join("; ")}. State each in scripts/zone-matrix/causes.mjs and run again.`,
    );
  }
  for (const suite of record.suites) {
    if (!(SUITE_ORDER as readonly string[]).includes(suite.id)) {
      throw new Error(`zone-matrix.json has an unknown suite ${suite.id}`);
    }
    for (const row of uncounted(suite)) {
      if (suite.id === "gmt") {
        throw new Error(
          `GMT, the control, fails ${row.id} on Node ${row.node}: that is a GMT bug, not a result.`,
        );
      }
      if (!causeOf(record, suite, row.id, row.node)) {
        throw new Error(
          `${tagKey(suite, row.id)} has no cause on Node ${row.node}`,
        );
      }
    }
    for (const cell of suite.cells) {
      if (suite.id === "gmt" && cell.failed.length > 0) {
        throw new Error(
          `GMT, the control, fails in ${cell.zone} on Node ${cell.node}: that is a GMT bug, not a result.`,
        );
      }
      for (const id of cell.failed) {
        if (!tagOf(record, suite, id, cell.zone)) {
          throw new Error(
            `${tagKey(suite, id)} has no tag in zone ${cell.zone}`,
          );
        }
      }
    }
  }
}

/** Every failure counted in neither kind, once per place it was seen. */
function uncounted(suite: SuiteRecord): {
  id: string;
  why: KnownWhy;
  node: string;
  zone: string;
}[] {
  const rows: { id: string; why: KnownWhy; node: string; zone: string }[] = [];
  const zone = suite.reference.zone;
  for (const run of suite.reference.runs) {
    for (const id of run.failed)
      rows.push({ id, why: "reference", node: run.node, zone });
    for (const id of run.unstable)
      rows.push({ id, why: "unstable", node: run.node, zone });
  }
  for (const cell of suite.cells) {
    for (const id of cell.alsoFailsAtReference)
      rows.push({ id, why: "reference", node: cell.node, zone });
    for (const id of cell.unstable)
      rows.push({ id, why: "unstable", node: cell.node, zone: cell.zone });
  }
  return rows;
}

function causeOf(
  record: ZoneMatrixRecord,
  suite: SuiteRecord,
  id: string,
  node: string,
): Cause | undefined {
  const cause = record.causes[tagKey(suite, id)];
  return cause && (!cause.nodes || cause.nodes.includes(node))
    ? cause
    : undefined;
}

function tagOf(
  record: ZoneMatrixRecord,
  suite: SuiteRecord,
  id: string,
  zone: string,
): Tag | undefined {
  const tag = record.tags[tagKey(suite, id)];
  return tag && (!tag.zones || tag.zones.includes(zone)) ? tag : undefined;
}

export interface Counts {
  oneZone: number;
  wrongAnswer: number;
}

/** Both kinds together. */
export const total = (c: Counts): number => c.oneZone + c.wrongAnswer;

/** Distinct failing tests of each kind over the cells given (one test counts once). */
export function countsOf(
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

/** Why a failure is counted in neither kind. */
export type KnownWhy = "reference" | "unstable";

/** The words each reason is shown as, before its zones. */
export const KNOWN_LABEL: Record<KnownWhy, string> = {
  reference: "in the reference zone",
  unstable: "failed once in two runs",
};

export interface ZoneSummary extends Counts {
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

export interface ZoneMatrixSummary {
  /** False until a run is recorded. Every page then says so instead of showing a count. */
  ran: boolean;
  zones: string[];
  nodes: string[];
  ranOn: { from: string; to: string } | null;
  suites: SuiteSummary[];
}

function summarise(record: ZoneMatrixRecord, suite: SuiteRecord): SuiteSummary {
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
    .map((s) => summarise(record, s));
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

const record = snapshot as unknown as ZoneMatrixRecord;

/** What the pages and slide 5 read. Throws at import on a record `assertRecord` rejects. */
export const zoneMatrixSummary: ZoneMatrixSummary = summarize(record);

/** The summary of one suite, or undefined when it has not run. */
export const suiteSummary = (id: string): SuiteSummary | undefined =>
  zoneMatrixSummary.suites.find((s) => s.id === id);

/** The two kinds as one short phrase: `3 tests that assume one zone, 5 wrong answers`. */
export function countsPhrase(c: Counts): string {
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
