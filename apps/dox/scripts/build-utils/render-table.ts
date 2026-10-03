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
  /**
   * The members of an inline object literal the property is declared as (`options?: { allowEqual?: boolean }`),
   * each a row of its own, nested to any depth. Absent when the type holds no literal.
   */
  children?: PropertyDoc[];
  /** True when `children` are the members of each element of an array (`{ type; value }[]`). */
  childrenAreItems?: boolean;
}

/**
 * The rows of a table with every nested row following its parent, named by its dotted path
 * (`options.allowEqual`; `parts[].type` for the members of an array's elements), which is
 * MDN's convention for a nested parameter. The result holds no `children`.
 */
export function flattenRows(
  rows: readonly PropertyDoc[],
  prefix = "",
): PropertyDoc[] {
  return rows.flatMap((row) => {
    const { children, childrenAreItems, ...own } = row;
    const path = `${prefix}${row.name}`;
    return [
      { ...own, name: path },
      ...flattenRows(children ?? [], `${path}${childrenAreItems ? "[]" : ""}.`),
    ];
  });
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

/**
 * A double-quoted token with a hyphen in it and no space (`"4-5-4"`, `"2024-03-10"`). A browser
 * may wrap after the hyphen; the token is wrapped in a span the stylesheet keeps whole. Only a
 * quote that opens and closes a word is matched, so `5" - 6"` and a quote inside a word stay as
 * they are, and a token already in a code span is never reached (code spans are handled apart).
 */
const QUOTED_HYPHENATED = /(?<![\w"])("[^"\s]*-[^"\s]*")(?![\w"])/g;

function keepQuotedLiterals(prose: string): string {
  return prose.replace(
    QUOTED_HYPHENATED,
    '<span class="gmt-nobreak">$1</span>',
  );
}

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
    (prose) => keepQuotedLiterals(escapeEntities(prose)).replace(/\|/g, "\\|"),
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
    (prose) => keepQuotedLiterals(escapeEntities(prose)).replace(/\|/g, "\\|"),
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
    // The author's table sits in the wrapper the generated tables use, so a cell too wide for
    // a phone scrolls instead of being squeezed into a column a letter wide.
    if (afterRow && !row) out.push("", `${indent}</div>`);
    if (i > 0 && row !== afterRow) out.push("");
    if (row && !afterRow) {
      out.push(`${indent}<div class="gmt-ref-table" data-kind="notes">`, "");
    }
    if (row) out.push(`${indent}${mdTableRow(line)}`);
    else out.push(i === 0 ? `- ${mdText(line)}` : `${indent}${mdText(line)}`);
    afterRow = row;
  }
  if (afterRow) out.push("", `${indent}</div>`);
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

/**
 * The members of a union at its top level: split at each `|` that sits outside every `<>`,
 * `()`, `[]` and `{}` and outside a string or template literal. A union inside a generic
 * (`Partial<Record<"a" | "b", T>>`) stays in its span. An arrow's `>` closes nothing.
 */
export function topLevelUnion(type: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let i = 0; i < type.length; i++) {
    const c = type[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = undefined;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if ("<([{".includes(c)) depth++;
    else if (")]}".includes(c) || (c === ">" && type[i - 1] !== "=")) {
      depth = Math.max(0, depth - 1);
    } else if (c === "|" && depth === 0) {
      parts.push(type.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(type.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p !== "");
}

/**
 * A printed type as code spans, one per top-level member of a union, joined by a plain `|`.
 * The stylesheet keeps each span whole, so a long union can wrap only between members and a
 * member such as `"4-4-5"` never breaks after its hyphen. A bracketed type is one span however
 * many `|` it holds, and a type is not rewritten.
 */
function typeSpans(type: string): string {
  const parts = topLevelUnion(type);
  return (parts.length > 0 ? parts : [type]).map(mdCodeSpan).join(" \\| ");
}

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
  const span = typeSpans(row.type);
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

/** Which generated table a wrapper holds; the stylesheet lays each out in its own way. */
export type RefTableKind = "options" | "members" | "parameters" | "notes";

/**
 * A generated table inside the wrapper the stylesheet and `src/lib/ref-table.ts` hook on.
 * Hand-written tables carry no wrapper, so a rule for the reference tables cannot reach them.
 * The blank lines let MDX read the table as Markdown inside the element.
 */
export function refTable(kind: RefTableKind, table: string): string {
  return [
    `<div class="gmt-ref-table" data-kind="${kind}">`,
    "",
    table,
    "",
    "</div>",
  ].join("\n");
}

/** `| Option | Type | Default | Description |`, one row per property. */
export function renderOptionsTable(
  allRows: readonly PropertyDoc[],
  ctx: TableContext,
): string {
  const rows = flattenRows(allRows);
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

/** `| Parameter | Type | Description |`, one row per positional parameter of a function. */
export function renderParametersTable(
  params: readonly { name: string; type?: string; description: string }[],
): string {
  return [
    `| Parameter | Type | Description |`,
    `| --- | --- | --- |`,
    ...params.map(
      (p) =>
        `| ${mdCodeSpan(p.name)} | ${p.type ? typeSpans(p.type) : EMPTY} | ${mdCellText(p.description)} |`,
    ),
  ].join("\n");
}

/** `| Member | Type | Description |`, one row per property. */
export function renderMembersTable(
  allRows: readonly PropertyDoc[],
  ctx: TableContext,
): string {
  const rows = flattenRows(allRows);
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
