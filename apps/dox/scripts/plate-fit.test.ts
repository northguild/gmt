import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listToolPages } from "./lib/tool-pages.mjs";

describe("listToolPages", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "tool-pages-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const page = (rel: string): void => {
    const dir = path.join(root, "gmt", rel);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "index.html"), "<main></main>");
  };

  it("lists every built tool page, sorted, as site paths", () => {
    page("tools/b-tool");
    page("tools/a-tool");
    page("guides/not-a-tool");
    page("tools");
    expect(listToolPages(root)).toEqual(["/tools/a-tool/", "/tools/b-tool/"]);
  });

  it("returns an empty list when nothing is built", () => {
    expect(listToolPages(root)).toEqual([]);
  });
});

describe("plate-fit.mjs usage", () => {
  it("exits 2 on an option it does not know", () => {
    const script = fileURLToPath(new URL("plate-fit.mjs", import.meta.url));
    const run = spawnSync(process.execPath, [script, "--bogus"], {
      encoding: "utf8",
    });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("unknown option --bogus");
  });
});
