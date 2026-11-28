import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PAGE_SHELL_SCRIPTS,
  pageShellGroup,
  recordClientChunks,
} from "./page-shell";

const QUERY = "?astro&type=script&index=0&lang.ts";

describe("pageShellGroup", () => {
  const { test } = pageShellGroup();

  it("accepts each shell script, with either path separator", () => {
    for (const suffix of PAGE_SHELL_SCRIPTS) {
      const path = `/work/apps/dox${suffix}`;
      expect(test(path + QUERY)).toBe(true);
      expect(test((path + QUERY).replaceAll("/", "\\"))).toBe(true);
    }
  });

  it("rejects a style, a bare component, a lookalike and a library module", () => {
    expect(
      test(
        "/work/apps/dox/src/components/Head.astro?astro&type=style&index=0&lang.css",
      ),
    ).toBe(false);
    expect(test("/work/apps/dox/src/components/Head.astro")).toBe(false);
    expect(test(`/work/apps/dox/src/components/HeadExtra.astro${QUERY}`)).toBe(
      false,
    );
    expect(test("/work/packages/gmt/dist/plain/calculate.js")).toBe(false);
  });
});

describe("recordClientChunks", () => {
  let dir = "";
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const bundle = {
    "_astro/a.js": {
      type: "chunk",
      fileName: "_astro/a.js",
      modules: { "/work/apps/dox/src/lib/a.ts": {} },
      imports: ["_astro/b.js"],
      dynamicImports: [],
      isEntry: true,
      facadeModuleId: "/work/apps/dox/src/lib/a.ts",
    },
    "_astro/x.css": { type: "asset", fileName: "_astro/x.css" },
  };

  function record(environment: string): string {
    dir = mkdtempSync(join(tmpdir(), "page-shell-"));
    const file = join(dir, "nested", "chunks.json");
    recordClientChunks(file).generateBundle.call(
      {
        environment: { name: environment },
        getModuleInfo: (id) => ({
          importedIds: id.endsWith("a.ts")
            ? ["/work/apps/dox/src/lib/b.ts"]
            : [],
        }),
      },
      {},
      bundle,
    );
    return file;
  }

  it("writes each chunk's graph in the client build", () => {
    const file = record("client");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      "_astro/a.js": {
        modules: ["apps/dox/src/lib/a.ts"],
        moduleImports: { "apps/dox/src/lib/a.ts": ["apps/dox/src/lib/b.ts"] },
        imports: ["_astro/b.js"],
        dynamicImports: [],
        isEntry: true,
        facade: "apps/dox/src/lib/a.ts",
      },
    });
  });

  it.each(["prerender", "ssr"])("writes nothing in the %s build", (name) => {
    expect(existsSync(record(name))).toBe(false);
  });
});
