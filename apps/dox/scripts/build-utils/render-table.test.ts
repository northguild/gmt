import { describe, expect, it } from "vitest";
import {
  mdCellText,
  mdCode,
  mdCodeSpan,
  mdListItem,
  mdText,
  renderMembersTable,
  renderOptionsTable,
  type PropertyDoc,
  type TableContext,
} from "./render-table";

const ENTITY = /&(?:amp|lt|gt|#123|#125);/;

function row(over: Partial<PropertyDoc> & { name: string }): PropertyDoc {
  return {
    optional: true,
    type: "string",
    typeRefs: [],
    description: "",
    fromLib: false,
    ...over,
  };
}

const URLS: Record<string, string> = {
  Overflow: "/reference/types/overflow/Overflow",
  BusinessCalendar: "/reference/types/business-calendar/BusinessCalendar",
  DateTimeFormatOptions:
    "/reference/types/datetime-format-options/DateTimeFormatOptions",
};
const ctx: TableContext = { typeUrl: (name) => URLS[name] };

/** The cells of the table's body rows. `\|` is an escaped pipe, not a cell boundary. */
function cells(table: string): string[][] {
  return table
    .split("\n")
    .slice(2)
    .map((line) =>
      line
        .replace(/^\| /, "")
        .replace(/ \|$/, "")
        .split(/(?<!\\) \| /),
    );
}

describe("mdCode", () => {
  it("leaves a type literal: no entities for <, >, { or }", () => {
    const out = mdCode('Partial<Record<"a" | "b", number>>');
    expect(out).not.toMatch(ENTITY);
    expect(out).toBe('Partial<Record<"a" \\| "b", number>>');
    expect(mdCode("{ unit?: string; }")).toBe("{ unit?: string; }");
  });

  it("escapes the pipe that would split a table cell, and flattens a newline", () => {
    expect(mdCode('"a" | "b"')).toBe('"a" \\| "b"');
    expect(mdCode("{\n  a: string;\n}")).toBe("{   a: string; }");
  });
});

describe("mdCodeSpan", () => {
  it.each`
    text                 | span
    ${"string"}          | ${"`string`"}
    ${'"a" | "b"'}       | ${'`"a" \\| "b"`'}
    ${"a `quoted` name"} | ${"``a `quoted` name``"}
    ${"`${number}px`"}   | ${"`` `${number}px` ``"}
    ${"a ``b`` c"}       | ${"```a ``b`` c```"}
  `("wraps $text as $span", ({ text, span }) => {
    expect(mdCodeSpan(text)).toBe(span);
  });
});

describe("mdText", () => {
  it("escapes what MDX would read as JSX, an expression or a table cell", () => {
    expect(mdText("a < b")).toBe("a &lt; b");
    expect(mdText("a > b & c")).toBe("a &gt; b &amp; c");
    expect(mdText("{ year, quarter }")).toBe("&#123; year, quarter &#125;");
    expect(mdText('"constrain" | "reject"')).toBe('"constrain" \\| "reject"');
    expect(mdText("one\ntwo")).toBe("one two");
  });

  it("leaves the inside of a code span as written", () => {
    expect(mdText("true when `value1 <= value2`.")).toBe(
      "true when `value1 <= value2`.",
    );
    expect(mdText("so `f(x, { unit: 4 })` is <ok>")).toBe(
      "so `f(x, { unit: 4 })` is &lt;ok&gt;",
    );
    expect(mdText("``a ` < b`` and {c}")).toBe("``a ` < b`` and &#123;c&#125;");
    // In prose a backslash inside a code span would be shown, so the pipe stays bare.
    expect(mdText("`a | b` or c | d")).toBe("`a | b` or c \\| d");
  });

  it("escapes around a backtick that opens no code span", () => {
    expect(mdText("a ` b < c")).toBe("a ` b &lt; c");
  });
});

describe("mdCellText", () => {
  it("escapes a pipe inside a code span too, and nothing else there", () => {
    expect(mdCellText("`a | b` or c | d, `Map<K, V>` and <x>")).toBe(
      "`a \\| b` or c \\| d, `Map<K, V>` and &lt;x&gt;",
    );
  });
});

describe("renderOptionsTable", () => {
  it("prints name, type, default and description, with — for what is missing", () => {
    const table = renderOptionsTable(
      [
        row({
          name: "timeZone",
          description: "The zone to render in.",
          defaultValue: '`"UTC"`',
        }),
        row({ name: "unit", optional: false, description: "The unit." }),
        row({ name: "limit", type: "number" }),
      ],
      ctx,
    );
    expect(table.split("\n")).toEqual([
      "| Option | Type | Default | Description |",
      "| --- | --- | --- | --- |",
      '| `timeZone?` | `string` | `"UTC"` | The zone to render in. |',
      "| `unit` | `string` | Required | The unit. |",
      "| `limit?` | `number` | — | — |",
    ]);
  });

  it("reads Required for a required option even when it carries a @defaultValue", () => {
    const table = renderOptionsTable(
      [row({ name: "unit", optional: false, defaultValue: "`day`" })],
      ctx,
    );
    expect(cells(table)[0][2]).toBe("Required");
  });

  it("keeps a Type cell free of entities and in one cell", () => {
    const table = renderOptionsTable(
      [
        row({
          name: "units",
          type: 'Partial<Record<"days" | "weeks", number>>',
        }),
        row({ name: "shape", type: "{ a?: string; }" }),
      ],
      ctx,
    );
    for (const line of cells(table)) {
      expect(line).toHaveLength(4);
      expect(line[1]).not.toMatch(ENTITY);
    }
    expect(cells(table)[0][1]).toBe(
      '`Partial<Record<"days" \\| "weeks", number>>`',
    );
  });

  it("links the public types a property's type names", () => {
    const table = renderOptionsTable(
      [
        row({
          name: "overflow",
          type: '"constrain" | "reject"',
          typeRefs: ["Overflow"],
        }),
        row({
          name: "calendar",
          type: "BusinessCalendar",
          typeRefs: ["BusinessCalendar"],
        }),
        row({
          name: "calendars",
          type: "BusinessCalendar[]",
          typeRefs: ["BusinessCalendar"],
        }),
        row({ name: "other", type: "Unknown", typeRefs: ["Unknown"] }),
      ],
      ctx,
    );
    expect(cells(table).map((c) => c[1])).toEqual([
      '`"constrain" \\| "reject"` ([`Overflow`](/reference/types/overflow/Overflow))',
      "[`BusinessCalendar`](/reference/types/business-calendar/BusinessCalendar)",
      "`BusinessCalendar[]` ([`BusinessCalendar`](/reference/types/business-calendar/BusinessCalendar))",
      "`Unknown`",
    ]);
  });

  it("escapes prose in the Default and Description cells", () => {
    const table = renderOptionsTable(
      [
        row({
          name: "mode",
          description: "Either `a | b` or <none>.",
          defaultValue: "None. Uses {zone}.",
        }),
      ],
      ctx,
    );
    expect(cells(table)[0]).toEqual([
      "`mode?`",
      "`string`",
      "None. Uses &#123;zone&#125;.",
      "Either `a \\| b` or &lt;none&gt;.",
    ]);
  });

  it("collapses the rows a lib interface declares into one, where the first one was", () => {
    const lib = (name: string) =>
      row({ name, fromLib: true, libType: "Intl.DateTimeFormatOptions" });
    const table = renderOptionsTable(
      [
        row({ name: "epochUnit" }),
        lib("weekday"),
        row({ name: "timeZone", description: "The zone." }),
        lib("era"),
        lib("year"),
      ],
      ctx,
    );
    expect(cells(table).map((c) => c[0])).toEqual([
      "`epochUnit?`",
      "`…Intl.DateTimeFormatOptions`",
      "`timeZone?`",
    ]);
    expect(cells(table)[1]).toEqual([
      "`…Intl.DateTimeFormatOptions`",
      "—",
      "—",
      "Every other field of [`DateTimeFormatOptions`](/reference/types/datetime-format-options/DateTimeFormatOptions), as [ECMA-402](https://tc39.es/ecma402/#sec-createdatetimeformat) defines it.",
    ]);
  });

  it("names a lib interface it has no link for, without inventing one", () => {
    const table = renderOptionsTable(
      [
        row({
          name: "style",
          fromLib: true,
          libType: "Intl.NumberFormatOptions",
        }),
      ],
      ctx,
    );
    expect(cells(table)[0]).toEqual([
      "`…Intl.NumberFormatOptions`",
      "—",
      "—",
      "Every field of `Intl.NumberFormatOptions`, declared by the TypeScript standard library.",
    ]);
  });

  it("says every field, not every other field, when the lib rows are the whole table", () => {
    const table = renderOptionsTable(
      [
        row({
          name: "weekday",
          fromLib: true,
          libType: "Intl.DateTimeFormatOptions",
        }),
      ],
      ctx,
    );
    expect(cells(table)[0][3]).toMatch(
      /^Every field of \[`DateTimeFormatOptions`\]/,
    );
  });
});

describe("renderMembersTable", () => {
  it("prints name, type and description", () => {
    const table = renderMembersTable(
      [
        row({
          name: "duration",
          optional: false,
          description: "The elapsed time.",
        }),
        row({ name: "note" }),
      ],
      ctx,
    );
    expect(table.split("\n")).toEqual([
      "| Member | Type | Description |",
      "| --- | --- | --- |",
      "| `duration` | `string` | The elapsed time. |",
      "| `note?` | `string` | — |",
    ]);
  });

  it("collapses lib rows to one three-cell row", () => {
    const table = renderMembersTable(
      [
        row({
          name: "weekday",
          fromLib: true,
          libType: "Intl.DateTimeFormatOptions",
        }),
        row({
          name: "era",
          fromLib: true,
          libType: "Intl.DateTimeFormatOptions",
        }),
      ],
      ctx,
    );
    expect(cells(table)).toHaveLength(1);
    expect(cells(table)[0]).toHaveLength(3);
    expect(cells(table)[0][1]).toBe("—");
  });
});

describe("mdListItem", () => {
  it("renders a line of prose as a bullet, escaped as mdText escapes it", () => {
    expect(mdListItem("Returns `a <= b` when a < b | c.")).toBe(
      "- Returns `a <= b` when a &lt; b \\| c.",
    );
  });

  it("emits a table as a table, set off by blank lines and indented under its bullet", () => {
    const item = [
      "One call replaces several:",
      "| Before | After |",
      "| --- | --- |",
      "| `a <= b` | {x} |",
      "and nothing else changes.",
    ].join("\n");
    expect(mdListItem(item).split("\n")).toEqual([
      "- One call replaces several:",
      "",
      "  | Before | After |",
      "  | --- | --- |",
      // The separators stay; only what MDX would read as JSX changes, outside code.
      "  | `a <= b` | &#123;x&#125; |",
      "",
      "  and nothing else changes.",
    ]);
  });

  it("gives an item that opens with a table no bullet", () => {
    expect(
      mdListItem("| A | B |\n| --- | --- |\n| 1 | 2 |").split("\n"),
    ).toEqual(["| A | B |", "| --- | --- |", "| 1 | 2 |"]);
  });
});
