import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listTablePages } from "./lib/table-pages.mjs";

describe("listTablePages", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "table-pages-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const page = (rel: string, html: string): void => {
    const dir = path.join(root, "gmt", rel);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "index.html"), html);
  };

  it("lists the pages that hold a table, sorted, as site paths", () => {
    page("", "<table></table>");
    page("b", "<main><table class='x'></table></main>");
    page("a/deep", "<table></table>");
    page("none", "<main>no table here</main>");
    expect(listTablePages(root)).toEqual(["/", "/a/deep/", "/b/"]);
  });

  it("ignores files other than index.html and folders outside gmt", () => {
    page("a", "<table></table>");
    writeFileSync(path.join(root, "gmt", "a", "page.md"), "<table>");
    mkdirSync(path.join(root, "other"), { recursive: true });
    writeFileSync(path.join(root, "other", "index.html"), "<table></table>");
    expect(listTablePages(root)).toEqual(["/a/"]);
  });

  it("returns an empty list when no page has a table", () => {
    page("a", "<p>x</p>");
    expect(listTablePages(root)).toEqual([]);
  });
});

describe("table-fit.mjs usage", () => {
  it("exits 2 on an option it does not know", () => {
    const script = fileURLToPath(new URL("table-fit.mjs", import.meta.url));
    const run = spawnSync(process.execPath, [script, "--bogus"], {
      encoding: "utf8",
    });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("unknown option --bogus");
  });
});
