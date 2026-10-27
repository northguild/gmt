/**
 * What the `/migrate/` components print, as plain data.
 *
 * The three Astro components (`MigrationMap`, `BehaviourDiffs`, `BehaviourMatrix`) and the
 * Markdown renderers in `mdx-jsx.ts` both read these functions, so the page and its `.md` twin
 * carry the same words. Nothing here measures anything: results come from
 * `data/behaviour-matrix.json` and function links come from the reference corpus.
 */
import { corpus } from "../generated/reference/corpus";

import {
  VERDICT_LABEL,
  caseAnchor,
  casesFor,
  diffsFor,
  issueUrl,
  libraryOf,
  matrix,
  rowAnchor,
  type LibraryId,
  type MatrixCase,
} from "../data/behaviour-matrix";
import { mapFor, type MapRow } from "../data/migration-maps";

export interface GmtFunctionLink {
  name: string;
  url: string;
  /** The import path of the module that holds it, e.g. `@northguild/gmt/plain/calculate`. */
  importPath: string;
}

/** One function's link and module. Throws when the name is not exactly one function. */
export function gmtFunction(name: string): GmtFunctionLink {
  const found = corpus.filter(
    (entry) => entry.kind === "function" && entry.name === name,
  );
  if (found.length !== 1) {
    throw new Error(`migrate-view: "${name}" is not exactly one function`);
  }
  const [entry] = found;
  return {
    name,
    url: entry.url,
    importPath: `@northguild/gmt/${entry.namespace}/${entry.module}`,
  };
}

export const isLibraryId = (value: unknown): value is LibraryId =>
  typeof value === "string" &&
  matrix.libraries.some((library) => library.id === value);

export function libraryProp(value: string | undefined, tag: string): LibraryId {
  if (!isLibraryId(value)) {
    throw new Error(`${tag}: unknown library "${String(value)}"`);
  }
  return value;
}

export interface MapRowView {
  theirs: string;
  gmt: GmtFunctionLink[];
  note?: string;
  cases: { id: string; href: string }[];
}

const rowView = (row: MapRow, library: LibraryId): MapRowView => ({
  theirs: row.theirs,
  gmt: row.gmt.map(gmtFunction),
  note: row.note,
  cases: (row.cases ?? []).map((id) => ({
    id,
    href: `/compare/behaviour/#${rowAnchor(id, library)}`,
  })),
});

export function mapView(library: LibraryId, part: "rows" | "more") {
  const map = mapFor(library);
  return {
    heading: libraryOf(library).name,
    rows: map[part].map((row) => rowView(row, library)),
  };
}

export interface DiffView {
  id: string;
  title: string;
  input: string;
  compare: string;
  libraryReturns: string;
  temporalReturns: string;
  clause: { label: string; url: string };
  issues: { text: string; url: string }[];
  matrixHref: string;
}

/** What Temporal returned for a case, or the stated result for a case with no Temporal call. */
export const temporalText = (matrixCase: MatrixCase): string =>
  matrixCase.temporal?.returns ?? matrixCase.expected ?? "";

export function diffViews(library: LibraryId): DiffView[] {
  return diffsFor(library).map(({ case: matrixCase, row }) => ({
    id: matrixCase.id,
    title: matrixCase.title,
    input: matrixCase.input,
    compare: matrixCase.compare,
    libraryReturns: row.returns ?? "",
    temporalReturns: temporalText(matrixCase),
    clause: matrixCase.clauses[0],
    issues: row.issues.map((issue) => ({ text: issue, url: issueUrl(issue) })),
    matrixHref: `/compare/behaviour/#${rowAnchor(matrixCase.id, library)}`,
  }));
}

export interface MatrixRowView {
  anchor: string | null;
  who: string;
  call: string;
  returns: string;
  verdict: string;
  issues: { text: string; url: string }[];
}

export interface MatrixCaseView {
  id: string;
  anchor: string;
  title: string;
  input: string;
  compare: string;
  clauses: { label: string; url: string }[];
  /** Set for a case Temporal has no call for. */
  expectedNote: string | null;
  note: string | null;
  rows: MatrixRowView[];
}

export function matrixView(): MatrixCaseView[] {
  return matrix.cases.map((matrixCase) => {
    const rows: MatrixRowView[] = [];
    if (matrixCase.temporal) {
      rows.push({
        anchor: null,
        who: "Temporal",
        call: "the proposal's own call",
        returns: matrixCase.temporal.returns,
        verdict: "Reference",
        issues: [],
      });
    }
    rows.push({
      anchor: null,
      who: "GMT",
      call: matrixCase.gmt.call,
      returns: matrixCase.gmt.detail ?? matrixCase.gmt.returns,
      verdict: VERDICT_LABEL[matrixCase.gmt.verdict],
      issues: [],
    });
    for (const { row } of matrixCase.libraries.map((row) => ({ row }))) {
      const library = libraryOf(row.library);
      rows.push({
        anchor: rowAnchor(matrixCase.id, row.library),
        who: library.name,
        call: row.call ?? "none",
        returns:
          row.verdict === "unsupported"
            ? (row.reason ?? "")
            : (row.detail ?? row.returns ?? ""),
        verdict: VERDICT_LABEL[row.verdict],
        issues: row.issues.map((issue) => ({
          text: issue,
          url: issueUrl(issue),
        })),
      });
    }
    return {
      id: matrixCase.id,
      anchor: caseAnchor(matrixCase.id),
      title: matrixCase.title,
      input: matrixCase.input,
      compare: matrixCase.compare,
      clauses: [...matrixCase.clauses],
      expectedNote:
        matrixCase.temporal === null
          ? `Temporal has no call for this. Each result is compared with the stated result, ${matrixCase.expected}.`
          : null,
      note: matrixCase.gmt.note ?? null,
      rows,
    };
  });
}

export { casesFor };

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Text with `backtick` spans as HTML: escaped, with `<code>` around each span. */
export const codeSpans = (text: string): string =>
  text
    .split("`")
    .map((part, index) =>
      index % 2 === 1 ? `<code>${escapeHtml(part)}</code>` : escapeHtml(part),
    )
    .join("");
