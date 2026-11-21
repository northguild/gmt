/**
 * The zone probe as the slides read it: the same inputs fed to every library, and how many
 * answers each one got wrong. `./zone-probe.json` is written by `scripts/zone-matrix/probe/run.mjs`,
 * which a person runs by hand. The expected answers come from the Temporal specification and the
 * tz database only (the two Temporal implementations had to agree), never from a library.
 *
 * Nothing here stores a count: the rows are read from the record. `assertRecord` throws on a record
 * where GMT is wrong anywhere (GMT is the control, so a wrong answer there is a GMT bug), where a
 * count does not add up, or where an example is missing or invented, so a hand edit or a bad run
 * fails the build instead of rendering a number.
 */
import snapshot from "./zone-probe.json";

interface ProbeExample {
  /** What was fed in, in words. */
  input: string;
  /** The library's answer. */
  answer: string;
  /** The right answer, from the Temporal specification. */
  expected: string;
  /** The host zones the answer was wrong in, or `every` when it was wrong in all of them. */
  zones: string[] | "every";
}

interface ProbeLibraryResult {
  library: string;
  total: number;
  /** Cases answered wrongly under at least one host zone. */
  wrong: number;
  wrongEverywhere: number;
  wrongSomeZones: number;
  /** Cases the library says it does not support. Not a break. */
  unsupported: number;
  example: ProbeExample | null;
  nodeCounts: Record<string, number>;
  nodesAgree: boolean;
}

interface ProbeExperiment {
  id: string;
  number: number;
  title: string;
  question: string;
  fed: string;
  cases: number;
  perLibrary: ProbeLibraryResult[];
}

interface ProbeLibrary {
  id: string;
  name: string;
  version: string;
}

export interface ProbeRecord {
  runDate: string;
  answeredBy: { polyfill: string; native: string; tzdata: string };
  nodes: { major: string; version: string; tzdata: string }[];
  zones: string[];
  libraries: ProbeLibrary[];
  experiments: ProbeExperiment[];
  dropped: number;
  seconds: number;
}

/** One bar of an experiment slide. */
export interface ProbeRow {
  id: string;
  name: string;
  wrong: number;
  total: number;
  /** Wrong cases as a share of the total, 0 to 1. */
  share: number;
}

interface ExperimentView {
  id: string;
  number: number;
  title: string;
  question: string;
  fed: string;
  cases: number;
  /** Most wrong answers first; ties keep the record's order; GMT is last. */
  rows: ProbeRow[];
  /** The first non-GMT library with a wrong answer, worst first, or null. */
  example: (ProbeExample & { name: string }) | null;
}

const CONTROL = "gmt";

export function assertRecord(record: ProbeRecord): ProbeRecord {
  const ids = new Set(record.libraries.map((l) => l.id));
  if (!ids.has(CONTROL))
    throw new Error("zone-probe: GMT is not in the library list");
  if (record.dropped !== 0)
    throw new Error(`zone-probe: ${record.dropped} case(s) dropped`);
  for (const experiment of record.experiments) {
    const where = `zone-probe: experiment ${experiment.id}`;
    const seen = new Set<string>();
    for (const row of experiment.perLibrary) {
      if (!ids.has(row.library))
        throw new Error(`${where} names the unknown library ${row.library}`);
      if (seen.has(row.library))
        throw new Error(`${where} lists ${row.library} twice`);
      seen.add(row.library);
      if (row.total !== experiment.cases)
        throw new Error(
          `${where}: ${row.library} ran ${row.total} of ${experiment.cases} cases`,
        );
      if (row.wrongEverywhere + row.wrongSomeZones !== row.wrong)
        throw new Error(`${where}: ${row.library} wrong counts do not add up`);
      if (row.wrong + row.unsupported > row.total)
        throw new Error(`${where}: ${row.library} has more answers than cases`);
      if (row.wrong > 0 !== (row.example !== null))
        throw new Error(
          `${where}: ${row.library} example does not match its wrong count`,
        );
      if (row.library === CONTROL && row.wrong > 0)
        throw new Error(
          `${where}: GMT was wrong ${row.wrong} time(s): a GMT bug, not a result`,
        );
    }
    for (const id of ids) {
      if (!seen.has(id)) throw new Error(`${where} has no result for ${id}`);
    }
  }
  return record;
}

export const zoneProbe: ProbeRecord = assertRecord(snapshot as ProbeRecord);

/** The slide data for one experiment, derived from the record. */
export function experimentViews(
  record: ProbeRecord = zoneProbe,
): ExperimentView[] {
  const names = new Map(record.libraries.map((l) => [l.id, l.name]));
  return record.experiments.map((experiment) => {
    const order = new Map(record.libraries.map((l, i) => [l.id, i]));
    const rows = experiment.perLibrary
      .map((r) => ({
        id: r.library,
        name: names.get(r.library) ?? r.library,
        wrong: r.wrong,
        total: r.total,
        share: r.total === 0 ? 0 : r.wrong / r.total,
      }))
      .sort((a, b) => {
        if ((a.id === CONTROL) !== (b.id === CONTROL))
          return a.id === CONTROL ? 1 : -1;
        return (
          b.wrong - a.wrong || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
        );
      });
    const worst = rows.find((r) => r.id !== CONTROL && r.wrong > 0);
    const found =
      worst &&
      experiment.perLibrary.find((r) => r.library === worst.id)?.example;
    return {
      id: experiment.id,
      number: experiment.number,
      title: experiment.title,
      question: experiment.question,
      fed: experiment.fed,
      cases: experiment.cases,
      rows,
      example: worst && found ? { ...found, name: worst.name } : null,
    };
  });
}

/** The footnote: the library versions, the engines that answered, and the run date. */
export function probeFootnote(record: ProbeRecord = zoneProbe): string {
  const versions = record.libraries
    .map((l) => `${l.name} ${l.version}`)
    .join(", ");
  const { polyfill, native, tzdata } = record.answeredBy;
  return `Run ${record.runDate}. Right answers: Temporal specification, checked on @js-temporal/polyfill ${polyfill} and Node ${native}, tz data ${tzdata}. Tested: ${versions}.`;
}

/** One library's wrong answers over every experiment, out of every case it was fed. */
interface LibraryTotal {
  id: string;
  name: string;
  wrong: number;
  total: number;
}

/** Every library's totals across the experiments, in the record's order. Nothing is stored: sums. */
export function libraryTotals(record: ProbeRecord = zoneProbe): LibraryTotal[] {
  return record.libraries.map((library) => {
    const rows = record.experiments.map((e) => {
      const row = e.perLibrary.find((r) => r.library === library.id);
      if (!row)
        throw new Error(`zone-probe: ${e.id} has no result for ${library.id}`);
      return row;
    });
    return {
      id: library.id,
      name: library.name,
      wrong: rows.reduce((sum, r) => sum + r.wrong, 0),
      total: rows.reduce((sum, r) => sum + r.total, 0),
    };
  });
}
