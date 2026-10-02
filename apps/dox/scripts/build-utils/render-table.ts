/**
 * Markdown escaping and the two property tables of a reference page.
 *
 * Pure string functions: no compiler, no file access. `build-reference.ts` extracts the rows
 * (`PropertyDoc`) and this module turns them into the Options table of a function page and
 * the Members table of a type. One renderer, so an inline literal, an interface, an alias and
 * an intersection all read the same.
 *
 * No row ever invents text. Missing content prints `—`; `doc-gate.ts` reports it.
 */

/** One property of an options object or of a public object type. */
export interface PropertyDoc {
  /** The property name, with no trailing `?`. */
  name: string;
  optional: boolean;
  /** The printed type, without the `| undefined` an optional property implies. */
  type: string;
  /** Public type names the declared type node references, for links. */
  typeRefs: string[];
  /** The property's own JSDoc text, joined onto one line. */
  description: string;
  /** Text of the `@defaultValue` tag, undefined when absent. */
  defaultValue?: string;
  /** True when the property is declared in a TypeScript lib file. */
  fromLib: boolean;
  /** The lib interface that declares it (`Intl.DateTimeFormatOptions`), on lib rows only. */
  libType?: string;
  /** True when the JSDoc uses `@default`, which the gate rejects in favour of `@defaultValue`. */
  usesDefaultTag?: boolean;
  /** True when the JSDoc text holds a Markdown list, which a table cell cannot show. */
  hasList?: boolean;
  /** Source position of the declaration, for the gate: file (repo-relative) and 1-based line. */
  source?: { file: string; line: number };
}

/** What a table needs from the page it sits on. */
export interface TableContext {
  /** The URL of a public type's documentation, or undefined when the name is not one. */
  typeUrl: (name: string) => string | undefined;
}

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

/**
 * A code span as CommonMark delimits it: a backtick run, closed by a run of the same
 * length. Text inside is literal, so nothing in it may be entity-escaped.
 */
const CODE_SPAN = /(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)/g;

function escapeEntities(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");
}

/** `s` with `outside` applied to the prose and `inside` to each code span's content. */
function mapCodeSpans(
  s: string,
  outside: (prose: string) => string,
  inside: (code: string) => string,
): string {
  let out = "";
  let last = 0;
  for (const m of s.matchAll(CODE_SPAN)) {
    out += outside(s.slice(last, m.index));
    out += `${m[1]}${inside(m[2])}${m[1]}`;
    last = m.index + m[0].length;
  }
  return out + outside(s.slice(last));
}

/**
 * Prose for a paragraph or a list item. Outside a code span, the characters MDX would read
 * as JSX or an expression become entities and `|` is escaped. Inside a code span nothing
 * changes: an entity or a backslash there is shown as written, which is how `a <= b` came to
 * read `a &lt;= b` on the page.
 */
export function mdText(s: string): string {
  const flat = s.replace(/\n/g, " ");
  return mapCodeSpans(
    flat,
    (prose) => escapeEntities(prose).replace(/\|/g, "\\|"),
    (code) => code,
  );
}

/**
 * Prose for a table cell. As `mdText`, but `|` is escaped inside code spans too: the table
 * splits a row on every unescaped `|` before any inline parsing, and reads `\|` back as `|`.
 */
export function mdCellText(s: string): string {
  const flat = s.replace(/\n/g, " ");
  return mapCodeSpans(
    flat,
    (prose) => escapeEntities(prose).replace(/\|/g, "\\|"),
    (code) => code.replace(/\|/g, "\\|"),
  );
}

/**
 * Text placed inside backticks, in a table cell or in prose built for one. No entity
 * escaping: a code span is literal. Escapes only what breaks the cell: `|`, and a newline.
 * A backtick in the text is handled by `mdCodeSpan`, which picks the fence.
 */
export function mdCode(s: string): string {
  return s.replace(/\n/g, " ").replace(/\|/g, "\\|");
}

/**
 * `s` as a complete code span for a table cell. The fence is one backtick longer than the
 * longest run inside the text, and padded with a space when the text starts or ends with a
 * backtick, as CommonMark requires.
 */
export function mdCodeSpan(s: string): string {
  const code = mdCode(s);
  const longest = Math.max(
    0,
    ...(code.match(/`+/g) ?? []).map((r) => r.length),
  );
  const fence = "`".repeat(longest + 1);
  const pad = code.startsWith("`") || code.endsWith("`") ? " " : "";
  return `${fence}${pad}${code}${pad}${fence}`;
}

/**
 * One row of a Markdown table an author wrote, made safe for MDX. The `|` separators are the
 * author's and stay; only the characters MDX would read as JSX or an expression change, and
 * only outside a code span.
 */
function mdTableRow(row: string): string {
  return mapCodeSpans(row, escapeEntities, (code) => code);
}

/**
 * One list item of a function's behaviour notes. An item is a line of prose, or prose and the
 * rows of a table separated by newlines (see `behaviorItems`). The table is emitted as a
 * table, set off by blank lines and indented under the bullet it belongs to, instead of being
 * run into the sentence. An item that opens with a table has no sentence to hang it from, so
 * it stands as a block of its own with no bullet.
 */
export function mdListItem(item: string): string {
  const isRow = (line: string) => line.startsWith("|");
  const lines = item.split("\n");
  const bullet = !isRow(lines[0]);
  const indent = bullet ? "  " : "";
  const out: string[] = [];
  let afterRow = false;
  for (const [i, line] of lines.entries()) {
    const row = isRow(line);
    if (i > 0 && row !== afterRow) out.push("");
    if (row) out.push(`${indent}${mdTableRow(line)}`);
    else out.push(i === 0 ? `- ${mdText(line)}` : `${indent}${mdText(line)}`);
    afterRow = row;
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const EMPTY = "—";

/**
 * Where a collapsed run of lib-declared rows points. Only `Intl.DateTimeFormatOptions`
 * reaches a public signature; any other lib interface is named without links.
 */
const LIB_LINKS: Record<string, { type: string; spec: string; label: string }> =
  {
    "Intl.DateTimeFormatOptions": {
      type: "DateTimeFormatOptions",
      spec: "https://tc39.es/ecma402/#sec-createdatetimeformat",
      label: "ECMA-402",
    },
  };

/** The Type cell: the printed type, then a link for each public type it names. */
function typeCell(row: PropertyDoc, ctx: TableContext): string {
  if (!row.type) return EMPTY;
  const links = row.typeRefs.flatMap((name) => {
    const url = ctx.typeUrl(name);
    return url ? [{ name, url }] : [];
  });
  // A type that is exactly one public type needs no second copy of its name.
  if (links.length === 1 && links[0].name === row.type) {
    return `[${mdCodeSpan(row.type)}](${links[0].url})`;
  }
  const span = mdCodeSpan(row.type);
  if (links.length === 0) return span;
  const list = links.map((l) => `[${mdCodeSpan(l.name)}](${l.url})`).join(", ");
  return `${span} (${list})`;
}

function nameCell(row: PropertyDoc): string {
  return mdCodeSpan(row.optional ? `${row.name}?` : row.name);
}

function descriptionCell(row: PropertyDoc): string {
  return row.description ? mdCellText(row.description) : EMPTY;
}

function defaultCell(row: PropertyDoc): string {
  if (!row.optional) return "Required";
  return row.defaultValue ? mdCellText(row.defaultValue) : EMPTY;
}

/**
 * The description of the one row that stands for every property a lib interface declares.
 * `alone` is true when the table has no row of its own beside it.
 */
function libDescription(
  libType: string,
  alone: boolean,
  ctx: TableContext,
): string {
  const every = alone ? "Every field" : "Every other field";
  const link = LIB_LINKS[libType];
  const url = link && ctx.typeUrl(link.type);
  if (!link || !url) {
    return `${every} of ${mdCodeSpan(libType)}, declared by the TypeScript standard library.`;
  }
  return `${every} of [${mdCodeSpan(link.type)}](${url}), as [${link.label}](${link.spec}) defines it.`;
}

/**
 * The rows of a table, with each lib interface's properties folded into one row placed
 * where its first property was. A property a GMT interface redeclares is not `fromLib` and
 * keeps its own row.
 */
function tableRows(
  rows: readonly PropertyDoc[],
  ctx: TableContext,
  own: (row: PropertyDoc) => string[],
  lib: (name: string, description: string) => string[],
): string[] {
  const seenLib = new Set<string>();
  const alone = rows.every((row) => row.fromLib);
  const out: string[] = [];
  for (const row of rows) {
    if (!row.fromLib) {
      out.push(`| ${own(row).join(" | ")} |`);
      continue;
    }
    const libType = row.libType ?? "lib";
    if (seenLib.has(libType)) continue;
    seenLib.add(libType);
    const cells = lib(
      mdCodeSpan(`…${libType}`),
      libDescription(libType, alone, ctx),
    );
    out.push(`| ${cells.join(" | ")} |`);
  }
  return out;
}

/** `| Option | Type | Default | Description |`, one row per property. */
export function renderOptionsTable(
  rows: readonly PropertyDoc[],
  ctx: TableContext,
): string {
  return [
    `| Option | Type | Default | Description |`,
    `| --- | --- | --- | --- |`,
    ...tableRows(
      rows,
      ctx,
      (row) => [
        nameCell(row),
        typeCell(row, ctx),
        defaultCell(row),
        descriptionCell(row),
      ],
      (name, description) => [name, EMPTY, EMPTY, description],
    ),
  ].join("\n");
}

/** `| Member | Type | Description |`, one row per property. */
export function renderMembersTable(
  rows: readonly PropertyDoc[],
  ctx: TableContext,
): string {
  return [
    `| Member | Type | Description |`,
    `| --- | --- | --- |`,
    ...tableRows(
      rows,
      ctx,
      (row) => [nameCell(row), typeCell(row, ctx), descriptionCell(row)],
      (name, description) => [name, EMPTY, description],
    ),
  ].join("\n");
}
