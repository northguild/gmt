/**
 * The zone matrix's record: the types of what `scripts/zone-matrix/run.mjs` writes to
 * `./zone-matrix.json`, and the rules the pages hold it to. `assertRecord` throws on a record that
 * has an untagged failure, such a failure with no cause, any GMT failure (GMT is the control, so a
 * failure there is a GMT bug), or a shape the runner does not write, so a hand edit or a bad run
 * fails the build instead of rendering a number. `zone-matrix.ts` derives the figures from it.
 */

export type Kind = "one-zone" | "wrong-answer";

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
interface Cause {
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

/** Why a failure is counted in neither kind. */
export type KnownWhy = "reference" | "unstable";

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
export function uncounted(suite: SuiteRecord): {
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

export function causeOf(
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

export function tagOf(
  record: ZoneMatrixRecord,
  suite: SuiteRecord,
  id: string,
  zone: string,
): Tag | undefined {
  const tag = record.tags[tagKey(suite, id)];
  return tag && (!tag.zones || tag.zones.includes(zone)) ? tag : undefined;
}
