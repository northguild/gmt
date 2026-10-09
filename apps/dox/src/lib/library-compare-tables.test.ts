import { describe, expect, it } from "vitest";

import { gmtStats, formatCount } from "../data/gmt-stats";
import {
  combinedCompetitorExecutions,
  competitorComparisons,
  executionRatio,
  libraryMeasurements,
} from "../data/library-comparison";
import {
  cellHtml,
  compareTables,
  inlineCodeHtml,
  notesHtml,
  PROSE_TABLES,
  differsTable,
  measuredTable,
  measurementDateRange,
  measurementNotes,
  notesMarkdown,
  overviewTable,
  tableMarkdown,
} from "./library-compare-tables";
import { renderMdxComponents } from "./mdx-jsx";

describe("library-measurements.json", () => {
  it("has one entry for each other library, and each carries a date", () => {
    expect(libraryMeasurements.map((m) => m.id)).toEqual(
      competitorComparisons.map((l) => l.id),
    );
    for (const m of libraryMeasurements) {
      expect(m.measuredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(m.note.length).toBeGreaterThan(0);
    }
  });

  it("feeds library-comparison.ts with the same counts", () => {
    for (const library of competitorComparisons) {
      const m = libraryMeasurements.find((x) => x.id === library.id)!;
      expect(library.stats.tests).toBe(m.tests);
      expect(library.stats.executions).toBe(m.executions);
      expect(library.stats.nodeVersions).toBe(m.nodeVersions);
      expect(library.stats.timezones).toBe(m.timezones);
      expect(library.stats.locales).toBe(m.locales);
      expect(library.stats.publicApi).toEqual(m.publicApi);
    }
  });
});

describe("the /compare tables", () => {
  it("lists GMT and every other library in the full table", () => {
    const table = overviewTable();
    expect(table.rows).toHaveLength(competitorComparisons.length + 1);
    expect(table.rows[0][0].text).toBe("@northguild/gmt");
    expect(table.rows[0][1].text).toBe(formatCount(gmtStats.tests));
    expect(table.rows[0][2].text).toBe(formatCount(gmtStats.executions));
    for (const row of table.rows) expect(row).toHaveLength(table.head.length);
  });

  it("shows a known failure count only where one was measured", () => {
    const column = overviewTable().head.indexOf("Known failing tests");
    const byName = Object.fromEntries(
      overviewTable().rows.map((r) => [r[0].text, r[column].text]),
    );
    expect(byName["Spacetime"]).toBe("41");
    expect(byName["Luxon"]).toBe("not measured");
  });

  it("gives the version, commit, date and command of each measurement", () => {
    const rows = measuredTable().rows;
    const intl = rows.find((r) => r[0].text === "@internationalized/date")!;
    expect(intl[1].text).toBe("3.12.3; API counted at 3.12.4");
    expect(intl[2].text).toBe("adobe/react-spectrum@5d191ab");
    expect(intl[3].text).toBe("2026-08-22");
    expect(intl[4].text).toContain("jest");
  });

  it("gives every library a version and a link to its CI configuration", () => {
    const rows = measuredTable().rows.slice(1);
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row[1].text).toMatch(/^\d+\.\d+\.\d+/);
      expect(row[5].href).toMatch(/^https:\/\/github\.com\//);
    }
    const byName = Object.fromEntries(rows.map((r) => [r[0].text, r]));
    expect(byName["Day.js"][1].text).toBe("1.11.23");
    expect(byName["Day.js"][5].text).toBe(
      "iamkun/dayjs/blob/dev/.github/workflows/lint-test.yml",
    );
    expect(byName["Spacetime"][1].text).toBe("7.13.0");
    expect(byName["Spacetime"][5].text).toBe(
      "spencermountain/spacetime/tree/master/.github/workflows",
    );
  });

  it("never invents a field that was not recorded", () => {
    const dateFns = measuredTable().rows.find((r) => r[0].text === "date-fns")!;
    expect(dateFns[4].text).toBe("not recorded");
  });

  it("states the combined multiple from the data, for all the other libraries", () => {
    const rows = differsTable().rows;
    const last = rows[rows.length - 1][2].text;
    expect(last).toContain(formatCount(combinedCompetitorExecutions()));
    expect(last).toContain(
      `about ${executionRatio(combinedCompetitorExecutions())} times`,
    );
    expect(last).toContain(
      `All ${competitorComparisons.length} other libraries`,
    );
  });

  it("never says only GMT", () => {
    const text = JSON.stringify([differsTable(), overviewTable()]);
    expect(text).not.toMatch(/only GMT/i);
  });

  it("names every other library in the time-zone and locale rows", () => {
    const [zones, locales] = differsTable().rows;
    for (const library of competitorComparisons) {
      expect(zones[2].text).toContain(library.displayName);
      expect(locales[2].text).toContain(library.displayName);
    }
  });

  it("renders Markdown pipe tables with one line per row", () => {
    for (const id of Object.keys(
      compareTables,
    ) as (keyof typeof compareTables)[]) {
      const table = compareTables[id]();
      const md = tableMarkdown(table).trim().split("\n");
      expect(md).toHaveLength(table.rows.length + 2);
    }
  });

  it("replaces the component tag in the text surfaces", () => {
    const out = renderMdxComponents(
      '<LibraryCompare table="overview" />\n<LibraryCompare table="notes" />',
    );
    expect(out).not.toContain("<LibraryCompare");
    expect(out).toContain("| Library |");
    expect(out).toContain(notesMarkdown().trim());
    expect(measurementNotes()).toHaveLength(competitorComparisons.length);
  });

  it("reports the oldest and newest measurement date", () => {
    expect(measurementDateRange()).toEqual({
      oldest: "2026-08-22",
      newest: "2026-09-09",
    });
  });
});

describe("inline code in strings that come from the data", () => {
  it("sets each backtick span in <code> and escapes everything else", () => {
    expect(inlineCodeHtml("runs `npm test` on <Node> & more")).toBe(
      "runs <code>npm test</code> on &lt;Node&gt; &amp; more",
    );
    expect(inlineCodeHtml('`a < b` and "quoted"')).toBe(
      "<code>a &lt; b</code> and &quot;quoted&quot;",
    );
  });

  it("leaves no backtick in the page's notes, and keeps them in the Markdown", () => {
    for (const html of notesHtml()) expect(html).not.toContain("`");
    expect(notesHtml().join("")).toContain("<code>dst-off</code>");
    expect(notesMarkdown()).toContain("`dst-off`");
  });

  it("renders a code cell and a linked cell as HTML", () => {
    expect(cellHtml({ text: "tape ./test/**/*.test.js", code: true })).toBe(
      "<code>tape ./test/**/*.test.js</code>",
    );
    expect(cellHtml({ text: "a&b", href: "https://x.test/?a=1&b=2" })).toBe(
      '<a href="https://x.test/?a=1&amp;b=2">a&amp;b</a>',
    );
  });

  it("keeps a command in backticks in the Markdown table", () => {
    const md = tableMarkdown(compareTables.measured());
    expect(md).toContain("`npm test`");
  });

  it("lets the capability table's first column wrap", () => {
    expect(PROSE_TABLES).toContain("covers");
    expect(compareTables.covers().rows).toHaveLength(10);
  });
});
