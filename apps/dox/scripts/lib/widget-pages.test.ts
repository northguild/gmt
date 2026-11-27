import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { listWidgetPages } from "./widget-pages.mjs";

let dist: string;

function page(slug: string, html: string) {
  const dir = path.join(dist, "gmt", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), html);
}

beforeEach(() => {
  dist = mkdtempSync(path.join(tmpdir(), "widget-pages-"));
});

afterEach(() => {
  rmSync(dist, { recursive: true, force: true });
});

describe("listWidgetPages", () => {
  it("lists only the pages whose markup holds a data-widget element", () => {
    page("tools/a", '<main><div class="x" data-widget="a"></div></main>');
    page("tools/b", "<main><p>no widget</p></main>");
    page(
      "tools/c",
      '<script>const s = \'<div data-widget="c">\'.length</script><p>data-widget="c"</p>',
    );
    expect(listWidgetPages(dist)).toEqual(["/tools/a/"]);
  });

  it("returns the paths sorted and is empty for a dist with no site", () => {
    page("z", '<i data-widget="z"></i>');
    page("a", '<i data-widget="a"></i>');
    expect(listWidgetPages(dist)).toEqual(["/a/", "/z/"]);
    rmSync(path.join(dist, "gmt"), { recursive: true });
    mkdirSync(path.join(dist, "gmt"));
    expect(listWidgetPages(dist)).toEqual([]);
  });
});
