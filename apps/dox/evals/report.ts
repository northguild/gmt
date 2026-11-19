/**
 * The committed live report (`evals/live-<brainId>.json`) and the diff against a new run.
 * Pure; the script reads and writes the files. Verdicts, latency and Neurons only: no answers.
 */
import type { CheckName, Verdict } from "./graders";

export interface CaseReport {
  status: Verdict["status"];
  checks: Partial<Record<CheckName, boolean>>;
  neurons: number | null;
  firstTokenMs: number | null;
  totalMs: number | null;
}

export interface LiveReport {
  brain: string;
  model: string;
  generatedAt: string;
  neurons: { spent: number; budget: number };
  cases: Record<string, CaseReport>;
}

export interface CaseDiff {
  id: string;
  before: CaseReport["status"] | "none";
  after: CaseReport["status"];
  changedChecks: string[];
  /** A case that passed in the committed report and now fails. */
  regression: boolean;
  neurons: { before: number | null; after: number | null };
  totalMs: { before: number | null; after: number | null };
}

/** Compares only the cases the new run holds, so a partial run is never a regression elsewhere. */
export function diffReports(
  committed: LiveReport | undefined,
  next: Record<string, CaseReport>,
): CaseDiff[] {
  return Object.keys(next)
    .sort()
    .map((id) => {
      const before = committed?.cases[id];
      const after = next[id]!;
      const names = new Set([
        ...Object.keys(before?.checks ?? {}),
        ...Object.keys(after.checks),
      ]);
      const changedChecks = [...names]
        .filter(
          (name) =>
            before?.checks[name as CheckName] !==
            after.checks[name as CheckName],
        )
        .map(
          (name) =>
            `${name}: ${before?.checks[name as CheckName] ?? "-"} -> ${after.checks[name as CheckName] ?? "-"}`,
        );
      return {
        id,
        before: before?.status ?? "none",
        after: after.status,
        changedChecks,
        regression: before?.status === "pass" && after.status === "fail",
        neurons: { before: before?.neurons ?? null, after: after.neurons },
        totalMs: { before: before?.totalMs ?? null, after: after.totalMs },
      };
    });
}

/**
 * The report to write: a full run replaces the cases; a partial run replaces only its own
 * entries and adds their Neurons to `spent`. Keys are sorted so a diff of the file is quiet.
 */
export function mergeReport(
  committed: LiveReport | undefined,
  run: {
    brain: string;
    model: string;
    generatedAt: string;
    budget: number;
    cases: Record<string, CaseReport>;
    partial: boolean;
  },
): LiveReport {
  const ran = Object.values(run.cases).reduce(
    (sum, c) => sum + (c.neurons ?? 0),
    0,
  );
  const cases = run.partial ? { ...committed?.cases, ...run.cases } : run.cases;
  return {
    brain: run.brain,
    model: run.model,
    generatedAt: run.generatedAt,
    neurons: {
      spent: (run.partial ? (committed?.neurons.spent ?? 0) : 0) + ran,
      budget: run.budget,
    },
    cases: Object.fromEntries(
      Object.entries(cases).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  };
}

/** Object keys in sorted order at every depth, so a rewritten report differs only where it changed. */
const sortKeys = (_key: string, value: unknown): unknown =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      )
    : value;

export const serialiseReport = (report: LiveReport): string =>
  `${JSON.stringify(report, sortKeys, 2)}\n`;

/**
 * Why this run may not become the committed report, or `undefined` when it may. Only a run where
 * every case passed is written: the report is the standard a later run is held to, so it never
 * records a known fault, and an ungraded case was never measured at all.
 */
export function baselineBlocker(
  results: Readonly<Record<string, CaseReport>>,
): string | undefined {
  const failed = Object.keys(results).filter(
    (id) => results[id]?.status === "fail",
  );
  if (failed.length > 0) return `failed: ${failed.sort().join(", ")}`;
  const ungraded = Object.keys(results).filter(
    (id) => results[id]?.status === "ungraded",
  );
  if (ungraded.length > 0) return `ungraded: ${ungraded.sort().join(", ")}`;
  return undefined;
}
