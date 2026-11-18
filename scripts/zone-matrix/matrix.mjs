/**
 * Reads the zones and Node majors of the `gmt-matrix` job in `.github/workflows/ci.yml`, so the
 * matrix this runner repeats can never drift from the one GMT's own CI runs.
 */
import { readFileSync } from "node:fs";
import { parse } from "yaml";

export const JOB = "gmt-matrix";

/** @param {string} text the text of ci.yml */
export function matrixOf(text) {
  const job = parse(text)?.jobs?.[JOB];
  const matrix = job?.strategy?.matrix;
  const zones = matrix?.tz ?? matrix?.timezone ?? matrix?.zone;
  const node = matrix?.["node-version"] ?? matrix?.node;
  if (
    !Array.isArray(zones) ||
    !Array.isArray(node) ||
    zones.length === 0 ||
    node.length === 0
  ) {
    throw new Error(
      `ci.yml job ${JOB} has no matrix of zones and node versions`,
    );
  }
  return { zones: zones.map(String), node: node.map((n) => String(n)) };
}

export function readMatrix(path) {
  return matrixOf(readFileSync(path, "utf8"));
}
