import { gmtStats, formatCount } from "../data/gmt-stats";
import {
  combinedCompetitorExecutions,
  competitorComparisons,
  executionRatio,
  fullSuiteZoneClauses,
  libraryMeasurements,
} from "../data/library-comparison";
import { cellHtml, tableMarkdown } from "./compare-table";
import {
  compareTables,
  notesHtml,
  PROSE_TABLES,
  differsTable,
  measuredTable,
  measurementDateRange,
  measurementNotes,
  notesMarkdown,
  overviewTable,
} from "./library-compare-tables";
import { summarize, zoneMatrixSummary } from "../data/zone-matrix";
import { tagKey, type ZoneMatrixRecord } from "../data/zone-matrix-record";
import {
  zoneMatrixEvidenceTable,
  zoneMatrixFailureTable,
  zoneMatrixKnownTable,
  zoneMatrixSummaryTable,
  zoneMatrixZoneTable,
} from "./zone-matrix-tables";
import { CODE_BREAK_CLASS, CODE_PIECE_CLASS } from "./code-break";
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
      expect(library.stats.fullSuiteZones).toBe(m.fullSuiteZones);
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
    expect(byName["Day.js"]).toBe("1");
    expect(byName["Luxon"]).toBe("not measured");
  });

  it("gives the version, commit, date and command of each measurement", () => {
    const rows = measuredTable().rows;
    const intl = rows.find((r) => r[0].text === "@internationalized/date")!;
    expect(intl[1].text).toBe("3.12.4");
    expect(intl[2].text).toBe("adobe/react-spectrum@d354aa2");
    expect(intl[3].text).toBe("2026-11-11");
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
    expect(byName["Spacetime"][1].text).toBe("7.17.1");
    expect(byName["Spacetime"][5].text).toBe(
      "spencermountain/spacetime/tree/master/.github/workflows",
    );
  });

  it("never invents a field that was not recorded", () => {
    for (const m of libraryMeasurements) {
      const row = measuredTable().rows.find(
        (r) =>
          r[0].text ===
          competitorComparisons.find((c) => c.id === m.id)!.displayName,
      )!;
      expect(row[4].text).toBe(m.command ?? "not recorded");
    }
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

  it("states date-fns's zone matrix as whole-suite runs, never as files", () => {
    const zones = differsTable().rows[0][2].text;
    expect(zones).toContain(
      "date-fns re-runs its whole suite under 378 time-zone settings",
    );
    expect(zones).not.toContain("378 time-zone test files");
    expect(fullSuiteZoneClauses()).toEqual([
      "date-fns re-runs its whole suite under 378 time-zone settings",
    ]);
    const timeZonesColumn = overviewTable().head.indexOf("Time zones");
    const dateFnsRow = overviewTable().rows.find(
      (row) => row[0].text === "date-fns",
    )!;
    expect(dateFnsRow[timeZonesColumn].text).toBe("378");
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
      oldest: "2026-11-11",
      newest: "2026-11-11",
    });
  });
});

describe("inline code in strings that come from the data", () => {
  it("leaves no backtick in the page's notes, and keeps them in the Markdown", () => {
    for (const html of notesHtml()) expect(html).not.toContain("`");
    expect(notesHtml().join("")).toContain("<code>main</code>");
    expect(notesMarkdown()).toContain("`main`");
  });

  it("renders a code cell and a linked cell as HTML, an external link opening in a new tab", () => {
    expect(cellHtml({ text: "npm", code: true })).toBe("<code>npm</code>");
    expect(cellHtml({ text: "a&b", href: "https://x.test/?a=1&b=2" })).toBe(
      '<a href="https://x.test/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">a&amp;b</a>',
    );
  });

  /* A suite's test name is a sentence in code ("diff.test.js › DateTime#diff handles …"): held on
     one line it ran a table 1000px past its column. It wraps at its spaces, never inside a piece. */
  it("lets code with spaces wrap at them, in a code cell and in backticks", () => {
    expect(cellHtml({ text: "tape ./test/**/*.test.js", code: true })).toBe(
      `<code class="${CODE_BREAK_CLASS}"><span class="${CODE_PIECE_CLASS}">tape</span> <span class="${CODE_PIECE_CLASS}">./test/**/*.test.js</span></code>`,
    );
    expect(cellHtml({ text: "In `2011-12-31T00:00:00 Apia`, a & b" })).toBe(
      `In <code class="${CODE_BREAK_CLASS}"><span class="${CODE_PIECE_CLASS}">2011-12-31T00:00:00</span> <span class="${CODE_PIECE_CLASS}">Apia</span></code>, a &amp; b`,
    );
    expect(cellHtml({ text: "Run `npm`" })).toBe("Run <code>npm</code>");
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

describe("the zone matrix", () => {
  it("adds the column to the full table, GMT's row first, linked to the page", () => {
    const table = overviewTable();
    const column = table.head.indexOf("Fails in our zone matrix");
    expect(column).toBeGreaterThan(-1);
    for (const row of table.rows) expect(row).toHaveLength(table.head.length);
    // Until a run is recorded the cell says so; it never shows a 0 nobody measured.
    const gmt = zoneMatrixSummary.suites.find((s) => s.id === "gmt");
    expect(table.rows[0][column].text).toBe(
      !gmt ? "not run" : gmt.measured ? "0" : "not measured",
    );
  });

  const lux = {
    id: "luxon",
    version: "3.7.2",
  };
  const record: ZoneMatrixRecord = {
    matrix: { ci: "ci.yml", zones: ["Pacific/Apia", "UTC"], node: ["24"] },
    tags: {
      [tagKey(lux, "a.js › one")]: {
        kind: "one-zone",
        reason: "hard-coded offset",
      },
      [tagKey(lux, "a.js › two")]: {
        kind: "wrong-answer",
        reason: "week year | start",
        evidence: {
          input: "2021-01-01",
          zone: "Pacific/Apia",
          temporal: "W53",
          library: "W1",
        },
      },
    },
    untagged: [],
    causes: {
      [tagKey(lux, "a.js › known")]: {
        cause: "needs tzdata older than 2026e | stated",
      },
    },
    uncaused: [],
    suites: [
      {
        ...lux,
        name: "Luxon",
        repository: "https://github.com/moment/luxon",
        commit: "a".repeat(40),
        command: "TZ=<zone> jest",
        ownCommand: "npm test",
        reference: {
          zone: "UTC",
          source: "none",
          runs: [
            {
              node: "24",
              nodeVersion: "v24.21.0",
              tzdata: "2026e",
              tests: 1152,
              failed: ["a.js › known"],
              unstable: [],
            },
          ],
        },
        pins: [],
        cells: [
          {
            node: "24",
            nodeVersion: "v24.21.0",
            tzdata: "2026e",
            tz: "Pacific/Apia",
            zone: "Pacific/Apia",
            ranOn: "2026-11-18",
            tests: 1152,
            failed: ["a.js › one", "a.js › two"],
            alsoFailsAtReference: ["a.js › known"],
            unstable: [],
          },
        ],
      },
    ],
  };
  const suite = summarize(record).suites[0];

  it("builds the summary, per-zone, failure and evidence tables", () => {
    const summary = zoneMatrixSummaryTable();
    for (const row of summary.rows)
      expect(row).toHaveLength(summary.head.length);
    const zones = zoneMatrixZoneTable(suite);
    expect(zones.rows.map((r) => r.map((c) => c.text))).toEqual([
      ["Pacific/Apia", "1152", "1", "1"],
      ["UTC", "not run", "not run", "not run"],
    ]);
    expect(zoneMatrixFailureTable(suite).rows).toHaveLength(2);
    const evidence = zoneMatrixEvidenceTable(suite).rows;
    expect(evidence).toHaveLength(1);
    expect(evidence[0].map((c) => c.text)).toContain("W53");
  });

  it("lists the failures counted in neither kind with Node and cause", () => {
    expect(
      zoneMatrixKnownTable(suite).rows.map((r) => r.map((c) => c.text)),
    ).toEqual([
      [
        "a.js › known",
        "in the reference zone, UTC",
        "24",
        "needs tzdata older than 2026e | stated",
      ],
    ]);
    expect(tableMarkdown(zoneMatrixKnownTable(suite))).toContain(
      "2026e \\| stated",
    );
  });

  it("shows a suite nothing measured as not measured, never 0", () => {
    const overridden: ZoneMatrixRecord = structuredClone(record);
    const cells = overridden.suites[0].cells;
    cells[0] = {
      ...cells[0],
      failed: [],
      alsoFailsAtReference: [],
      overriddenBy: { file: null, line: null, zone: "UTC" },
    };
    const s = summarize(overridden).suites[0];
    expect(s.measured).toBe(false);
    expect(
      zoneMatrixZoneTable(s)
        .rows[0].slice(1)
        .map((c) => c.text),
    ).toEqual(["not run", "not run", "not run"]);
    for (const row of zoneMatrixSummaryTable().rows) {
      const live = zoneMatrixSummary.suites.find((x) => x.name === row[0].text);
      if (live && !live.measured)
        expect(row[2].text + row[3].text).toBe("not measurednot measured");
    }
  });

  it("escapes a pipe in a reason in the Markdown table", () => {
    expect(tableMarkdown(zoneMatrixFailureTable(suite))).toContain(
      "week year \\| start",
    );
  });

  it("replaces the component tag in the text surfaces", () => {
    const out = renderMdxComponents("<ZoneMatrix />");
    expect(out).not.toContain("<ZoneMatrix");
    if (!zoneMatrixSummary.ran) {
      expect(out).toContain("No zone-matrix run is recorded yet");
      return;
    }
    for (const s of zoneMatrixSummary.suites) {
      expect(out).toContain(`## ${s.name} ${s.version}`);
      if (!s.measured) expect(out).toContain("it is not measured");
      for (const k of s.known) expect(out).toContain(k.cause);
    }
  });
});
