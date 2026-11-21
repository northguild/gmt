/**
 * The zone matrix page's tables (/compare/zone-matrix/), as data: one row per suite, per zone, per
 * counted failure, per failure counted in neither kind, and per wrong answer's evidence. Every
 * figure comes from `zone-matrix.ts`; the page (`ZoneMatrix.astro`) and its text twin (`mdx-jsx.ts`)
 * both read these builders.
 */
import {
  KIND_LABEL,
  KNOWN_LABEL,
  zoneMatrixSummary,
  type SuiteSummary,
} from "../data/zone-matrix";
import { NOT_MEASURED, code, plain, type CompareTable } from "./compare-table";

const NOT_RUN = "not run";

/** One row per suite: the figures of each kind, then the control. A suite nothing measured reads `not measured`. */
export function zoneMatrixSummaryTable(): CompareTable {
  return {
    head: [
      "Suite",
      "Version",
      KIND_LABEL["one-zone"],
      KIND_LABEL["wrong-answer"],
      "Reference zone",
    ],
    rows: zoneMatrixSummary.suites.map((s) => [
      { text: s.name, href: `#${s.id}` },
      plain(s.version),
      plain(s.measured ? String(s.oneZone) : NOT_MEASURED),
      plain(s.measured ? String(s.wrongAnswer) : NOT_MEASURED),
      plain(s.referenceZone),
    ]),
  };
}

/** One row per zone of one suite. A zone nothing ran in reads `not run`, never 0. */
export function zoneMatrixZoneTable(suite: SuiteSummary): CompareTable {
  return {
    head: [
      "Time zone",
      "Tests run",
      KIND_LABEL["one-zone"],
      KIND_LABEL["wrong-answer"],
    ],
    rows: suite.zones.map((z) => [
      plain(z.zone),
      plain(z.ran ? String(z.tests) : NOT_RUN),
      plain(z.ran ? String(z.oneZone) : NOT_RUN),
      plain(z.ran ? String(z.wrongAnswer) : NOT_RUN),
    ]),
  };
}

/** Each counted failure of one suite: the test, its kind, the zones it fails in and why. */
export function zoneMatrixFailureTable(suite: SuiteSummary): CompareTable {
  return {
    head: ["Test", "Kind", "Zones", "Why"],
    rows: suite.failures.map((f) => [
      code(f.id),
      plain(KIND_LABEL[f.kind]),
      plain(f.zones.join(", ")),
      plain(f.reason),
    ]),
  };
}

/**
 * The failures of one suite counted in neither kind: each test, where it failed (in the reference
 * zone, or once in two runs and in which zones), the Node majors and the cause.
 */
export function zoneMatrixKnownTable(suite: SuiteSummary): CompareTable {
  return {
    head: ["Test", "Fails", "Node", "Cause"],
    rows: suite.known.map((k) => [
      code(k.id),
      plain(`${KNOWN_LABEL[k.why]}, ${k.zones.join(", ")}`),
      plain(k.nodes.join(", ")),
      plain(k.cause),
    ]),
  };
}

/** The evidence for each wrong answer: the input, the zone, what Temporal gives and what the library gives. */
export function zoneMatrixEvidenceTable(suite: SuiteSummary): CompareTable {
  return {
    head: ["Test", "Input", "Zone", "Temporal", "Library"],
    rows: suite.failures.flatMap((f) =>
      f.evidence
        ? [
            [
              code(f.id),
              code(f.evidence.input),
              plain(f.evidence.zone),
              code(f.evidence.temporal),
              code(f.evidence.library),
            ],
          ]
        : [],
    ),
  };
}
