/**
 * The Database Timestamps guide is prose with a matrix and runnable snippets. This guard reads the
 * page as text, runs every marked snippet against the library, and holds the matrix to the
 * snippets, so a published example cannot drift from what the call returns.
 */
import {
  ONE_WAY,
  guideRows,
  guideSnippets,
  guideText,
} from "~/test/databases-guide-page";
import { GMT_MODULES } from "./gmt-modules";
import { stripMdx } from "./page-markdown";

/** The databases the guide must cover, named as the page names them. */
const DATABASES = [
  "PostgreSQL",
  "MySQL",
  "SQL Server",
  "Oracle",
  "SQLite",
  "MongoDB",
  "DynamoDB",
  "Redis",
  "Couchbase",
  "Cassandra, ScyllaDB",
  "Neo4j",
];

/** Snippets in the gap section show what each ISO reader does; they are not matrix rows. */
const GAP_PREFIX = "gap-";

const page = guideText;
const snippets = guideSnippets();
const matrix = guideRows();

describe("the databases guide snippets", () => {
  it("has snippets, and no marker id twice", () => {
    expect(snippets.length).toBeGreaterThan(0);
    const ids = snippets.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(snippets.map((s) => [s.id, s] as const))(
    "%s returns its expected literal",
    async (_id, snippet) => {
      expect(snippet.literal, "a `// ` line").not.toBe("");
      const names: string[] = [];
      const values: unknown[] = [];
      for (const { names: imported, path } of snippet.imports) {
        const load = GMT_MODULES[path];
        expect(load, `${path} is a key of GMT_MODULES`).toBeDefined();
        const module = await load();
        for (const name of imported) {
          expect(module[name], `${path} exports ${name}`).toBeDefined();
          names.push(name);
          values.push(module[name]);
        }
      }
      const body = `${snippet.body.slice(0, snippet.body.length - snippet.last.length)}return ${snippet.last}`;
      const result = new Function(...names, body)(...values);
      expect(result).toEqual(JSON.parse(snippet.literal));
    },
  );
});

describe("the databases guide matrix", () => {
  const cells = new Set(matrix.flatMap((row) => [row.read, row.write]));

  it("lists every database the guide audits", () => {
    for (const database of DATABASES) {
      expect(
        matrix.some((row) => row.database === database),
        database,
      ).toBe(true);
      expect(page, database).toMatch(
        new RegExp(`^## ${database.replace(/, /g, " and ")}$`, "m"),
      );
    }
  });

  it("marks every row ✓, ≈ or new", () => {
    for (const row of matrix) {
      expect(["✓", "≈", "new"], `${row.database}: ${row.form}`).toContain(
        row.kind,
      );
    }
  });

  it("ends every matrix snippet on a Read or Write cell", () => {
    for (const snippet of snippets) {
      if (snippet.id.startsWith(GAP_PREFIX)) continue;
      expect(cells.has(snippet.last), `${snippet.id}: ${snippet.last}`).toBe(
        true,
      );
    }
  });

  it("runs every ≈ and new row as a snippet", () => {
    const ends = new Set(snippets.map((s) => s.last));
    for (const row of matrix.filter((r) => r.kind !== "✓")) {
      const cell = ONE_WAY.includes(row.read) ? row.write : row.read;
      expect(ends.has(cell), `${row.database}: ${cell}`).toBe(true);
    }
  });

  it("uses a one-way marker only for a form with one direction", () => {
    for (const row of matrix) {
      if (ONE_WAY.includes(row.read)) {
        // A write-only export is real (Redis `EXPIRE`), so ✓ stands beside ≈; `new` is a read.
        expect(["✓", "≈"], row.form).toContain(row.kind);
        expect(ONE_WAY).not.toContain(row.write);
      }
    }
  });
});

describe("the databases guide page", () => {
  it("drops every marker comment from the Markdown twin and keeps the snippets", () => {
    const twin = stripMdx(page, {});
    expect(twin).not.toContain("db-row");
    expect(twin.split("```ts").length - 1).toBe(snippets.length);
  });

  it("links the Database Timestamp Reader", () => {
    expect(page).toContain("](/tools/database-timestamp-reader/)");
  });
});
