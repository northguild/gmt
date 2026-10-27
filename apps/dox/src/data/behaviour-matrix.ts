/**
 * The behaviour matrix as the pages read it: sixteen cases, each run against Temporal, GMT and
 * five date libraries.
 *
 * `./behaviour-matrix.json` is written by `scripts/behaviour-matrix/run.mjs`, which a person runs
 * by hand (the libraries it measures live outside the workspace). Nothing here computes a
 * result: a verdict, a returned value and the version line all come from that file, the same
 * rule `temporal-compat.ts` follows. `toMatrix` throws on a file that does not have the shape the
 * runner writes, so a hand edit fails the build instead of rendering a wrong row.
 */
import snapshot from "./behaviour-matrix.json";

export const VERDICTS = ["same", "differs", "unsupported"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const LIBRARY_IDS = [
  "date-fns",
  "luxon",
  "dayjs",
  "moment",
  "internationalized-date",
] as const;
export type LibraryId = (typeof LIBRARY_IDS)[number];

export interface Companion {
  name: string;
  version: string;
}

export interface MatrixLibrary {
  id: LibraryId;
  /** The name as the comparison table spells it, e.g. `Moment.js`. */
  name: string;
  /** The version of the package the matrix ran. */
  version: string;
  /** Packages installed beside it that the cases also call, e.g. `moment-timezone`. */
  companions: readonly Companion[];
}

export interface Clause {
  label: string;
  url: string;
}

export interface LibraryRow {
  library: LibraryId;
  /** The call as the case prints it. Absent when the library has no such operation. */
  call?: string;
  /** What the call returned, as the library wrote it. Absent when unsupported. */
  returns?: string;
  /** The error a throwing call raised, as `Name: message`. */
  detail?: string;
  verdict: Verdict;
  /** Why the library has no such operation. Present only with `unsupported`. */
  reason?: string;
  /** Open upstream issues, as `owner/repo#number`. Present only with `differs`. */
  issues: readonly string[];
}

export interface GmtRow {
  fn: string;
  call: string;
  returns: string;
  detail?: string;
  verdict: Exclude<Verdict, "unsupported">;
  /** Why GMT's result differs on purpose. */
  note?: string;
}

export interface MatrixCase {
  /** `M1`, `M3b` and so on. */
  id: string;
  title: string;
  input: string;
  /** The comparable form every result is reduced to, e.g. `local time and offset`. */
  compare: string;
  clauses: readonly Clause[];
  /** Temporal's result. Null for a case Temporal has no call for; then `expected` is set. */
  temporal: { returns: string } | null;
  expected?: string;
  gmt: GmtRow;
  libraries: readonly LibraryRow[];
}

export interface Matrix {
  /** The day the runner wrote the file, as `YYYY-MM-DD`. */
  measuredOn: string;
  runtime: { node: string; tz: string; icu: string; hostTimeZone: string };
  libraries: readonly MatrixLibrary[];
  cases: readonly MatrixCase[];
}

/** Hosts a clause may link to: the specifications the cases cite and nothing else. */
export const CLAUSE_HOSTS = [
  "tc39.es",
  "www.rfc-editor.org",
  "www.unicode.org",
  "www.iso.org",
] as const;

const fail = (where: string, what: string): never => {
  throw new Error(`behaviour-matrix.json: ${where} ${what}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, where: string): string =>
  typeof value === "string" && value !== ""
    ? value
    : fail(where, "must be a non-empty string");

const optionalText = (value: unknown, where: string): string | undefined =>
  value === undefined ? undefined : text(value, where);

const verdictOf = (value: unknown, where: string): Verdict => {
  const verdict = VERDICTS.find((known) => known === value);
  return verdict ?? fail(where, `has the unknown verdict ${String(value)}`);
};

const libraryIdOf = (value: unknown, where: string): LibraryId => {
  const id = LIBRARY_IDS.find((known) => known === value);
  return id ?? fail(where, `has the unknown library ${String(value)}`);
};

const listOf = (value: unknown, where: string): unknown[] =>
  Array.isArray(value) ? value : fail(where, "must be an array");

const recordOf = (value: unknown, where: string): Record<string, unknown> =>
  isRecord(value) ? value : fail(where, "must be an object");

const toClause = (value: unknown, where: string): Clause => {
  const clause = recordOf(value, where);
  return {
    label: text(clause.label, `${where}.label`),
    url: text(clause.url, `${where}.url`),
  };
};

const toLibraryRow = (value: unknown, where: string): LibraryRow => {
  const row = recordOf(value, where);
  const verdict = verdictOf(row.verdict, `${where}.verdict`);
  const out: LibraryRow = {
    library: libraryIdOf(row.library, `${where}.library`),
    verdict,
    issues: listOf(row.issues, `${where}.issues`).map((issue, index) =>
      text(issue, `${where}.issues[${index}]`),
    ),
  };
  if (verdict === "unsupported") {
    out.reason = text(row.reason, `${where}.reason`);
    return out;
  }
  out.call = text(row.call, `${where}.call`);
  out.returns = text(row.returns, `${where}.returns`);
  const detail = optionalText(row.detail, `${where}.detail`);
  if (detail !== undefined) out.detail = detail;
  return out;
};

const toGmtRow = (value: unknown, where: string): GmtRow => {
  const row = recordOf(value, where);
  const verdict = verdictOf(row.verdict, `${where}.verdict`);
  if (verdict === "unsupported") fail(where, "cannot be unsupported");
  const out: GmtRow = {
    fn: text(row.fn, `${where}.fn`),
    call: text(row.call, `${where}.call`),
    returns: text(row.returns, `${where}.returns`),
    verdict: verdict as GmtRow["verdict"],
  };
  const detail = optionalText(row.detail, `${where}.detail`);
  if (detail !== undefined) out.detail = detail;
  const note = optionalText(row.note, `${where}.note`);
  if (note !== undefined) out.note = note;
  return out;
};

const toCase = (value: unknown, index: number): MatrixCase => {
  const row = recordOf(value, `cases[${index}]`);
  const id = text(row.id, `cases[${index}].id`);
  const where = `case ${id}`;
  const clauses = listOf(row.clauses, `${where}.clauses`).map((clause, i) =>
    toClause(clause, `${where}.clauses[${i}]`),
  );
  if (clauses.length === 0) fail(where, "must cite at least one clause");
  const temporal =
    row.temporal === null
      ? null
      : {
          returns: text(
            recordOf(row.temporal, `${where}.temporal`).returns,
            `${where}.temporal.returns`,
          ),
        };
  const expected = optionalText(row.expected, `${where}.expected`);
  if (temporal === null && expected === undefined) {
    fail(where, "has no Temporal call and no expected value");
  }
  const libraries = listOf(row.libraries, `${where}.libraries`).map((lib, i) =>
    toLibraryRow(lib, `${where}.libraries[${i}]`),
  );
  const seen = new Set(libraries.map((lib) => lib.library));
  for (const id of LIBRARY_IDS) {
    if (!seen.has(id)) fail(where, `has no row for ${id}`);
  }
  const out: MatrixCase = {
    id,
    title: text(row.title, `${where}.title`),
    input: text(row.input, `${where}.input`),
    compare: text(row.compare, `${where}.compare`),
    clauses,
    temporal,
    gmt: toGmtRow(row.gmt, `${where}.gmt`),
    libraries,
  };
  if (expected !== undefined) out.expected = expected;
  return out;
};

const toLibrary = (value: unknown, index: number): MatrixLibrary => {
  const where = `libraries[${index}]`;
  const row = recordOf(value, where);
  return {
    id: libraryIdOf(row.id, `${where}.id`),
    name: text(row.name, `${where}.name`),
    version: text(row.version, `${where}.version`),
    companions: listOf(row.companions, `${where}.companions`).map((c, i) => {
      const companion = recordOf(c, `${where}.companions[${i}]`);
      return {
        name: text(companion.name, `${where}.companions[${i}].name`),
        version: text(companion.version, `${where}.companions[${i}].version`),
      };
    }),
  };
};

/**
 * Check the file the runner wrote and give it its types. Throws, naming the field, on anything
 * the runner would not have written.
 */
export const toMatrix = (json: unknown): Matrix => {
  const root = recordOf(json, "the file");
  const runtime = recordOf(root.runtime, "runtime");
  const libraries = listOf(root.libraries, "libraries").map(toLibrary);
  for (const id of LIBRARY_IDS) {
    if (!libraries.some((library) => library.id === id)) {
      fail("libraries", `has no entry for ${id}`);
    }
  }
  return {
    measuredOn: text(root.measuredOn, "measuredOn"),
    runtime: {
      node: text(runtime.node, "runtime.node"),
      tz: text(runtime.tz, "runtime.tz"),
      icu: text(runtime.icu, "runtime.icu"),
      hostTimeZone: text(runtime.hostTimeZone, "runtime.hostTimeZone"),
    },
    libraries,
    cases: listOf(root.cases, "cases").map(toCase),
  };
};

export const matrix: Matrix = toMatrix(snapshot);

export const libraryOf = (id: LibraryId): MatrixLibrary => {
  const library = matrix.libraries.find((known) => known.id === id);
  return library ?? fail("libraries", `has no entry for ${id}`);
};

export interface LibraryCase {
  case: MatrixCase;
  row: LibraryRow;
}

/** Every case with the library's row beside it, in case order. */
export const casesFor = (id: LibraryId): LibraryCase[] =>
  matrix.cases.flatMap((matrixCase) => {
    const row = matrixCase.libraries.find((lib) => lib.library === id);
    return row === undefined ? [] : [{ case: matrixCase, row }];
  });

/** The cases where the library's result differs from Temporal's. */
export const diffsFor = (id: LibraryId): LibraryCase[] =>
  casesFor(id).filter(({ row }) => row.verdict === "differs");

/** `m1-date-fns`: the anchor of one library's row on `/compare/behaviour/`. */
export const rowAnchor = (caseId: string, libraryId: LibraryId): string =>
  `${caseId.toLowerCase()}-${libraryId}`;

/** `m1`: the anchor of a case's heading. */
export const caseAnchor = (caseId: string): string => caseId.toLowerCase();

/** `Checked against date-fns 4.4.0 and @date-fns/tz 1.5.0 on 2026-10-26.` */
export const checkedLine = (id: LibraryId): string => {
  const library = libraryOf(id);
  const packages = [library, ...library.companions].map(
    ({ name, version }) => `${name} ${version}`,
  );
  return `Checked against ${packages.join(" and ")} on ${matrix.measuredOn}.`;
};

/** The words a verdict is shown as. Never colour alone. */
export const VERDICT_LABEL: Record<Verdict, string> = {
  same: "Same",
  differs: "Differs",
  unsupported: "Not supported",
};

/** `iamkun/dayjs#1271` as its GitHub address. */
export const issueUrl = (issue: string): string => {
  const [repo, number] = issue.split("#");
  return `https://github.com/${repo}/issues/${number}`;
};
