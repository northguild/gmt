import { readFileSync } from "node:fs";
import { join } from "node:path";

import { corpus } from "~/generated/reference/corpus";

import {
  CLAUSE_HOSTS,
  LIBRARY_IDS,
  casesFor,
  checkedLine,
  diffsFor,
  matrix,
  rowAnchor,
  toMatrix,
} from "./behaviour-matrix";
import snapshot from "./behaviour-matrix.json";
import { migrationMaps } from "./migration-maps";

const runnerPackage = JSON.parse(
  readFileSync(
    join(__dirname, "../../../../scripts/behaviour-matrix/package.json"),
    "utf8",
  ),
) as { dependencies: Record<string, string> };

const functionCount = (name: string): number =>
  corpus.filter((entry) => entry.kind === "function" && entry.name === name)
    .length;

describe("behaviour matrix snapshot", () => {
  it("is accepted by the shape check", () => {
    expect(() => toMatrix(snapshot)).not.toThrow();
  });

  it("is rejected by the shape check when a verdict is unknown", () => {
    const broken = structuredClone(snapshot) as typeof snapshot;
    (broken.cases[0].gmt as { verdict: string }).verdict = "better";
    expect(() => toMatrix(broken)).toThrow(/verdict/);
  });

  it("cites only specification hosts", () => {
    for (const matrixCase of matrix.cases) {
      for (const clause of matrixCase.clauses) {
        const url = new URL(clause.url);
        expect(url.protocol, matrixCase.id).toBe("https:");
        expect(CLAUSE_HOSTS as readonly string[], matrixCase.id).toContain(
          url.hostname,
        );
      }
    }
  });

  it("writes every issue as owner/repo#number", () => {
    for (const matrixCase of matrix.cases) {
      for (const row of matrixCase.libraries) {
        for (const issue of row.issues) {
          expect(issue, matrixCase.id).toMatch(/^[\w.-]+\/[\w.-]+#\d+$/);
        }
      }
    }
  });

  it("lists the versions the runner installs, exactly", () => {
    const packageOf = (id: string): string =>
      id === "internationalized-date" ? "@internationalized/date" : id;
    for (const library of matrix.libraries) {
      expect(library.version, library.id).toMatch(/^\d+\.\d+\.\d+$/);
      expect(
        runnerPackage.dependencies[packageOf(library.id)],
        library.id,
      ).toBe(library.version);
      for (const { name, version } of library.companions) {
        expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
        expect(runnerPackage.dependencies[name], name).toBe(version);
      }
    }
  });

  it("gives every library a row in every case", () => {
    for (const id of LIBRARY_IDS) {
      expect(casesFor(id)).toHaveLength(matrix.cases.length);
    }
  });

  it("anchors a row by case and library", () => {
    expect(rowAnchor("M3b", "date-fns")).toBe("m3b-date-fns");
  });

  it("lists only differing cases as differences", () => {
    for (const id of LIBRARY_IDS) {
      for (const { row } of diffsFor(id)) expect(row.verdict).toBe("differs");
    }
  });

  it("writes a version line with the measurement date", () => {
    expect(checkedLine("date-fns")).toContain(matrix.measuredOn);
  });

  it("names a time zone in no case outside the international set", () => {
    for (const matrixCase of matrix.cases) {
      expect(matrixCase.input).not.toMatch(/America\/New_York|US\//);
    }
  });
});

describe("behaviour matrix and migration maps against the reference", () => {
  it("names a GMT function that exists exactly once", () => {
    for (const matrixCase of matrix.cases) {
      expect(functionCount(matrixCase.gmt.fn), matrixCase.gmt.fn).toBe(1);
    }
    for (const map of migrationMaps) {
      for (const row of [...map.rows, ...map.more]) {
        for (const name of row.gmt) {
          expect(functionCount(name), `${map.id}: ${name}`).toBe(1);
        }
      }
    }
  });

  it("points only at cases the matrix measures", () => {
    const ids = new Set(matrix.cases.map((matrixCase) => matrixCase.id));
    for (const map of migrationMaps) {
      for (const row of [...map.rows, ...map.more]) {
        for (const id of row.cases ?? []) {
          expect(ids.has(id), `${map.id}: ${id}`).toBe(true);
        }
      }
    }
  });

  it("has a map for every library", () => {
    expect(migrationMaps.map((map) => map.id).sort()).toEqual(
      [...LIBRARY_IDS].sort(),
    );
  });

  it("writes no workaround for zoned equality", () => {
    const text = JSON.stringify(migrationMaps);
    expect(text).not.toContain("convertZonedToUtc");
  });
});
