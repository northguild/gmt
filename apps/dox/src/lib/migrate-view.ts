/**
 * What the `/migrate/` components print, as plain data.
 *
 * The three Astro components (`MigrationMap`, `BehaviourDiffs`, `BehaviourMatrix`) and the
 * Markdown renderers in `mdx-jsx.ts` both read these functions, so the page and its `.md` twin
 * carry the same words. Nothing here measures anything: results come from
 * `data/behaviour-matrix.json` and function links come from the reference corpus.
 */
import { codeBreakClass, codeBreakHtml } from "./code-break";
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
  type GmtRow,
  type LibraryId,
  type LibraryRow,
  type MatrixCase,
  type Verdict,
} from "../data/behaviour-matrix";
import { mapFor, type MapRow } from "../data/migration-maps";
import { temporalMap } from "../data/temporal-map";
import type { BadgeOptions } from "../widgets/builders/badge";

interface GmtFunctionLink {
  name: string;
  url: string;
  /** The import path of the module that holds it, e.g. `@northguild/gmt/plain/calculate`. */
  importPath: string;
  /** The first example on its reference page: the call and what it returns. */
  example: { call: string; result: string };
}

/** One function's link and module. Throws when the name is not exactly one function. */
function gmtFunction(name: string): GmtFunctionLink {
  const found = corpus.filter(
    (entry) => entry.kind === "function" && entry.name === name,
  );
  if (found.length !== 1) {
    throw new Error(`migrate-view: "${name}" is not exactly one function`);
  }
  const [entry] = found;
  const [example] = entry.examples;
  if (!example) {
    throw new Error(
      `migrate-view: "${name}" has no example on its reference page`,
    );
  }
  return {
    name,
    url: entry.url,
    importPath: `@northguild/gmt/${entry.namespace}/${entry.module}`,
    example: { call: example.call, result: example.result },
  };
}

const isLibraryId = (value: unknown): value is LibraryId =>
  typeof value === "string" &&
  matrix.libraries.some((library) => library.id === value);

export function libraryProp(value: string | undefined, tag: string): LibraryId {
  if (!isLibraryId(value)) {
    throw new Error(`${tag}: unknown library "${String(value)}"`);
  }
  return value;
}

interface MapRowView {
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

function mapView(library: LibraryId, part: "rows" | "more") {
  const map = mapFor(library);
  return {
    heading: libraryOf(library).name,
    rows: map[part].map((row) => rowView(row, library)),
  };
}

/** One side of a pair: the frame's title and the code in it. */
interface CodeSide {
  title: string;
  code: string;
}

/** A link under a pair; `code` sets its text as code (a function name). */
interface PairLink {
  text: string;
  href: string;
  code?: boolean;
}

/**
 * One item of a pair list: a library's code beside the GMT code that replaces it, then a note and
 * links. The From-X call lists, their differences from Temporal and the Temporal list on
 * /migrate/temporal/ all print this shape, through `CodePairs.astro` and `renderCodePairs`.
 */
export interface CodePairView {
  /** A heading over the pair: an optional case id and words. A call-list row has none. */
  heading?: { tag?: string; text: string };
  /** Short facts over the code. Text with `backtick` spans. */
  facts: { label: string; text: string }[];
  theirs: CodeSide;
  gmt: CodeSide;
  /** Text with `backtick` spans, under the pair. */
  note?: string;
  /** Link groups under the note, such as `Reference` and `Measured in`. Empty groups are left out. */
  links: { label: string; links: PairLink[] }[];
}

/** Plain text as `//` comment lines, cut at spaces to about 60 characters; backticks dropped. */
const commentLines = (text: string): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.replace(/`/g, "").split(/\s+/).filter(Boolean)) {
    if (line && line.length + word.length + 1 > 60) {
      lines.push(`// ${line}`);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(`// ${line}`);
  return lines;
};

/**
 * A library cell as code: each backtick span on its own line when only commas or `or` join them.
 * A trailing `(name)` is a Day.js plugin the call needs and becomes a comment. Any other wording
 * is not code, so it becomes a comment as written.
 */
export function theirsCode(text: string): string {
  const parts = text.split("`");
  const spans = parts.filter((_, index) => index % 2 === 1);
  const glue = parts.filter((_, index) => index % 2 === 0);
  const inner = glue.slice(1, -1);
  const head = glue[0] ?? "";
  const tail = glue.at(-1) ?? "";
  const plugin = /^\s*\((\w+)\)\s*$/.exec(tail);
  const isCode =
    parts.length >= 3 &&
    parts.length % 2 === 1 &&
    head.trim() === "" &&
    inner.every((piece) => /^\s*(,|or)?\s*$/.test(piece)) &&
    (tail.trim() === "" || plugin !== null);
  if (!isCode) return commentLines(text).join("\n");
  return [
    ...spans,
    ...(plugin ? [`// needs the ${plugin[1]} plugin`] : []),
  ].join("\n");
}

/** The import lines for some functions: one per module, in order, wrapped past 80 characters. */
const importLines = (fns: readonly GmtFunctionLink[]): string[] => {
  const modules = new Map<string, string[]>();
  for (const fn of fns) {
    const names = modules.get(fn.importPath) ?? [];
    if (!names.includes(fn.name)) names.push(fn.name);
    modules.set(fn.importPath, names);
  }
  return [...modules].map(([path, names]) => {
    const line = `import { ${names.join(", ")} } from "${path}";`;
    return line.length <= 80
      ? line
      : `import {\n${names.map((name) => `  ${name},`).join("\n")}\n} from "${path}";`;
  });
};

/**
 * A call and what it returns: the call on one line, the result as a comment under it. A result
 * over several lines keeps its arrow on the first and indents the rest under it; a result the
 * reference already wrote as `//` comments loses those markers first, so none is doubled.
 */
export const callLines = (call: string, result: string): string => {
  const lines = result.split("\n");
  const commented = lines.every((line) => /^\s*\/\//.test(line));
  const [first, ...rest] = commented
    ? lines.map((line) => line.replace(/^\s*\/\/ ?/, ""))
    : lines;
  return [
    `${call};`,
    `// → ${first}`,
    ...rest.map((line) => `//   ${line}`),
  ].join("\n");
};

/** GMT code for some functions: their imports, then each one's first reference example. */
export function gmtCode(fns: readonly GmtFunctionLink[]): string {
  return [
    importLines(fns).join("\n"),
    fns.map((fn) => callLines(fn.example.call, fn.example.result)).join("\n"),
  ].join("\n\n");
}

const referenceLinks = (fns: readonly GmtFunctionLink[]) => ({
  label: "Reference",
  links: fns.map((fn) => ({ text: fn.name, href: fn.url, code: true })),
});

/** A call list as pairs: the library's call beside the GMT code, then the note and links. */
export function mapPairs(
  library: LibraryId,
  part: "rows" | "more",
): CodePairView[] {
  const view = mapView(library, part);
  return view.rows.map((row) => {
    // With no GMT call the note says why, so it fills the GMT side instead of sitting under it.
    const none = row.gmt.length === 0;
    return {
      facts: [],
      theirs: { title: view.heading, code: theirsCode(row.theirs) },
      gmt: {
        title: "GMT",
        code: none
          ? commentLines(row.note ?? "No GMT call.").join("\n")
          : gmtCode(row.gmt),
      },
      note: none ? undefined : row.note,
      links: [
        {
          label: "Measured in",
          links: row.cases.map((c) => ({ text: c.id, href: c.href })),
        },
        referenceLinks(row.gmt),
      ],
    };
  });
}

/** What Temporal returned for a case, or the stated result for a case with no Temporal call. */
const temporalText = (matrixCase: MatrixCase): string =>
  matrixCase.temporal?.returns ?? matrixCase.expected ?? "";

/** The facts over a case: its input, the form results are compared in, and the reference result. */
const caseFacts = (
  matrixCase: MatrixCase,
): { label: string; text: string }[] => [
  { label: "Input", text: matrixCase.input },
  { label: "Compared as", text: matrixCase.compare },
  {
    label: matrixCase.temporal === null ? "Stated result" : "Temporal returns",
    text: `\`${temporalText(matrixCase)}\``,
  },
];

/** The /migrate/temporal/ list as pairs: Temporal's code beside GMT's, under the task. */
export function temporalPairs(): CodePairView[] {
  return temporalMap.map((row) => {
    const fns = row.gmt.map(gmtFunction);
    return {
      heading: { text: row.task },
      facts: [],
      theirs: { title: "Temporal", code: row.temporal },
      gmt: { title: "GMT", code: row.gmtCode ?? gmtCode(fns) },
      note: row.note,
      links: [
        {
          label: "Specification",
          links: row.clauses.map((clause) => ({
            text: clause.label,
            href: clause.url,
          })),
        },
        referenceLinks(fns),
      ],
    };
  });
}

/**
 * What a measured call gave, for a comment: the error it threw, or its result reduced to the
 * form the case compares (`Compared as`), which is not always the value the call returns.
 */
const outcome = (result: { returns?: string; detail?: string }): string =>
  result.detail ? `throws ${result.detail}` : (result.returns ?? "");

/**
 * A measured call and what it gave, as code. A result that varies with the host zone has a line
 * per host; a library with no such call has its reason as a comment.
 */
const rowCode = (row: LibraryRow): string => {
  if (row.verdict === "unsupported" || !row.call) {
    return commentLines(`Not supported: ${row.reason ?? "no such call"}.`).join(
      "\n",
    );
  }
  const lines =
    row.hosts && row.hosts.length > 0
      ? row.hosts.map((host) => `// ${host.zone} host: ${outcome(host)}`)
      : [`// ${outcome(row)}`];
  return [`${row.call};`, ...lines].join("\n");
};

const gmtRowCode = (row: GmtRow): string => `${row.call};\n// ${outcome(row)}`;

/**
 * The cases where one library differs from Temporal, as pairs: the library's call and result
 * beside GMT's call and result, under the case's input and Temporal's result.
 */
export function diffPairs(library: LibraryId): CodePairView[] {
  const name = libraryOf(library).name;
  return diffsFor(library).map(({ case: matrixCase, row }) => ({
    heading: { tag: matrixCase.id, text: matrixCase.title },
    facts: caseFacts(matrixCase),
    theirs: {
      title: name,
      code: rowCode(row),
    },
    gmt: {
      title: "GMT",
      code: gmtRowCode(matrixCase.gmt),
    },
    links: [
      {
        label: "Specification",
        links: [
          {
            text: matrixCase.clauses[0].label,
            href: matrixCase.clauses[0].url,
          },
        ],
      },
      {
        label: "Upstream",
        links: row.issues.map((issue) => ({
          text: issue,
          href: issueUrl(issue),
        })),
      },
      {
        label: "Full results",
        links: [
          {
            text: matrixCase.id,
            href: `/compare/behaviour/#${rowAnchor(matrixCase.id, library)}`,
          },
        ],
      },
    ],
  }));
}

/** One result on /compare/behaviour/: who made the call, the verdict, and the call as code. */
export interface MatrixEntryView {
  /** `m1-date-fns`, which the /migrate/ pages link to. GMT's entry has none. */
  anchor: string | null;
  name: string;
  verdict: Verdict;
  issues: { text: string; url: string }[];
  /** The call, then what it gave as comments: one per host when it varies with the host zone. */
  code: string;
}

export interface MatrixCaseView {
  id: string;
  anchor: string;
  title: string;
  facts: { label: string; text: string }[];
  clauses: { label: string; url: string }[];
  /** Text with `backtick` spans, under the facts. */
  notes: string[];
  /** GMT first, then each library in the matrix's order. */
  entries: MatrixEntryView[];
}

/**
 * The badge for each verdict. The word names the verdict; the icon and tone repeat it. Amber is the
 * sentinel's alone, so a result that varies with the host is purple.
 */
export const VERDICT_BADGE: Record<Verdict, BadgeOptions> = {
  same: { text: VERDICT_LABEL.same, tone: "spring", icon: "check" },
  differs: { text: VERDICT_LABEL.differs, tone: "danger", icon: "x" },
  varies: {
    text: VERDICT_LABEL.varies,
    tone: "purple",
    icon: "clock",
    wrap: true,
  },
  unsupported: { text: VERDICT_LABEL.unsupported, tone: "neutral", dim: true },
};

/** The behaviour matrix as one view per case: its facts, then GMT's result and each library's. */
export function matrixView(): MatrixCaseView[] {
  return matrix.cases.map((matrixCase) => ({
    id: matrixCase.id,
    anchor: caseAnchor(matrixCase.id),
    title: matrixCase.title,
    facts: caseFacts(matrixCase),
    clauses: [...matrixCase.clauses],
    notes: [
      ...(matrixCase.temporal === null
        ? [
            "Temporal has no call for this, so each result is compared with the stated result.",
          ]
        : []),
      ...(matrixCase.gmt.note ? [matrixCase.gmt.note] : []),
    ],
    entries: [
      {
        anchor: null,
        name: "GMT",
        verdict: matrixCase.gmt.verdict,
        issues: [],
        code: gmtRowCode(matrixCase.gmt),
      },
      ...matrixCase.libraries.map((row) => ({
        anchor: rowAnchor(matrixCase.id, row.library),
        name: libraryOf(row.library).name,
        verdict: row.verdict,
        issues: row.issues.map((issue) => ({
          text: issue,
          url: issueUrl(issue),
        })),
        code: rowCode(row),
      })),
    ],
  }));
}

export { casesFor };

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One code span as HTML; a span with break points carries `gmt-codebreak` and its pieces. */
const codeSpanHtml = (text: string): string => {
  const breakClass = codeBreakClass(text);
  return `<code${breakClass ? ` class="${breakClass}"` : ""}>${codeBreakHtml(text)}</code>`;
};

/** Text with `backtick` spans as HTML: escaped, with `<code>` around each span. */
export const codeSpans = (text: string): string =>
  text
    .split("`")
    .map((part, index) =>
      index % 2 === 1 ? codeSpanHtml(part) : escapeHtml(part),
    )
    .join("");
